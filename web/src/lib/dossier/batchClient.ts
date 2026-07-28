/**
 * Client helper for POST /api/dossier/batch and SSE /api/dossier/batch/stream
 * Skip warm IndexedDB caches unless force — efficiency for campaigns.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import {
  getCachedDossier,
  putCachedDossierAndNotify,
} from "@/lib/idb/dossierCache";
import { recordDensifyRun } from "@/lib/dossier/densifyTelemetry";
import { ensureDossierKnowledge } from "@/lib/frontier/knowledgeFingerprint";
import { packageIsUsable } from "@/lib/frontier/knowledgeFingerprint";

export interface BatchClientResult {
  cid: number;
  ok: boolean;
  error?: string;
  durationMs: number;
  summary?: {
    name?: string;
    evidenceScore?: number;
    idealScore?: number;
    observationCount?: number;
    procedureChars?: number;
    productMode?: string;
    fromCache?: boolean;
  };
  dossier?: LiveDossier;
  fromCache?: boolean;
}

export interface BatchClientResponse {
  schema: string;
  requested: number;
  ok: number;
  fail: number;
  skipped?: number;
  durationMs: number;
  results: BatchClientResult[];
  error?: string;
}

const DEFAULT_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h

async function loadWarmCache(
  cid: number,
  maxAgeMs: number
): Promise<LiveDossier | null> {
  const row = await getCachedDossier(cid);
  if (!row?.dossier) return null;
  if (Date.now() - row.savedAt > maxAgeMs) return null;
  const d = ensureDossierKnowledge(row.dossier);
  // Prefer rebuild if knowledge package empty (old cache)
  if (!packageIsUsable(d.processKnowledge) && !d.processFacts?.facts?.length) {
    return null;
  }
  return d;
}

/**
 * Partition CIDs into cache hits vs need-build.
 */
export async function partitionCidsByCache(
  cids: number[],
  opts?: { force?: boolean; maxAgeMs?: number }
): Promise<{ warm: LiveDossier[]; needBuild: number[] }> {
  if (opts?.force) {
    return { warm: [], needBuild: [...cids] };
  }
  const maxAge = opts?.maxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
  const warm: LiveDossier[] = [];
  const needBuild: number[] = [];
  for (const cid of cids) {
    const d = await loadWarmCache(cid, maxAge);
    if (d) warm.push(d);
    else needBuild.push(cid);
  }
  return { warm, needBuild };
}

function warmToResult(d: LiveDossier): BatchClientResult {
  const pack = d.processKnowledge;
  return {
    cid: d.cid,
    ok: true,
    durationMs: 0,
    fromCache: true,
    dossier: d,
    summary: {
      name: d.identity?.name,
      evidenceScore: d.evidenceScore?.score,
      idealScore: d.idealParity?.score,
      observationCount: pack?.metrics.observationCount,
      procedureChars: pack?.metrics.procedureChars,
      productMode: d.productMode,
      fromCache: true,
    },
  };
}

/**
 * Batch densify CIDs on the server; skip warm local cache unless force.
 */
export async function batchDensifyCids(
  cids: number[],
  opts?: {
    includeDossiers?: boolean;
    cacheLocal?: boolean;
    concurrency?: number;
    retries?: number;
    force?: boolean;
    maxAgeMs?: number;
    onProgress?: (msg: string) => void;
  }
): Promise<BatchClientResponse> {
  const concurrency = Math.min(4, Math.max(1, opts?.concurrency || 2));
  const unique = [...new Set(cids.filter((c) => c > 0))].slice(0, 12);
  const { warm, needBuild } = await partitionCidsByCache(unique, {
    force: opts?.force,
    maxAgeMs: opts?.maxAgeMs,
  });

  opts?.onProgress?.(
    `Batch: ${warm.length} cache hit(s), ${needBuild.length} to build · concurrency ${concurrency}`
  );

  const warmResults = warm.map(warmToResult);
  if (!needBuild.length) {
    recordDensifyRun({
      kind: "batch-json",
      cids: unique,
      concurrency,
      ok: warmResults.length,
      fail: 0,
      durationMs: 0,
      detail: "all-from-cache",
    });
    return {
      schema: "chemistry-recipes.batch-dossier.v1",
      requested: unique.length,
      ok: warmResults.length,
      fail: 0,
      skipped: warmResults.length,
      durationMs: 0,
      results: warmResults,
    };
  }

  const res = await fetch("/api/dossier/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cids: needBuild,
      includeDossiers: opts?.includeDossiers ?? opts?.cacheLocal ?? false,
      concurrency,
      retries: opts?.retries ?? 2,
      force: opts?.force,
    }),
  });
  const data = (await res.json()) as BatchClientResponse;
  if (!res.ok) {
    return {
      schema: "chemistry-recipes.batch-dossier.v1",
      requested: unique.length,
      ok: warmResults.length,
      fail: needBuild.length,
      skipped: warmResults.length,
      durationMs: 0,
      results: [
        ...warmResults,
        ...needBuild.map((cid) => ({
          cid,
          ok: false,
          durationMs: 0,
          error: data.error || `HTTP ${res.status}`,
        })),
      ],
      error: data.error || `HTTP ${res.status}`,
    };
  }

  const built = data.results || [];
  if (opts?.cacheLocal) {
    for (const r of built) {
      if (r.ok && r.dossier) {
        await putCachedDossierAndNotify(r.dossier);
        opts.onProgress?.(`Cached CID ${r.cid}`);
      }
    }
  }

  const allResults = [...warmResults, ...built];
  const ok = allResults.filter((r) => r.ok).length;
  const fail = allResults.filter((r) => !r.ok).length;

  opts?.onProgress?.(
    `Batch done · ${ok} ok (${warmResults.length} cache) · ${fail} fail · ${Math.round((data.durationMs || 0) / 1000)}s`
  );
  recordDensifyRun({
    kind: "batch-json",
    cids: unique,
    concurrency,
    ok,
    fail,
    durationMs: data.durationMs || 0,
    detail: `skippedCache=${warmResults.length}`,
  });
  return {
    schema: "chemistry-recipes.batch-dossier.v1",
    requested: unique.length,
    ok,
    fail,
    skipped: warmResults.length,
    durationMs: data.durationMs || 0,
    results: allResults,
  };
}

export type StreamBatchEvent = {
  type: string;
  cid?: number;
  index?: number;
  total?: number;
  label?: string;
  ok?: boolean | number;
  error?: string;
  durationMs?: number;
  summary?: BatchClientResult["summary"];
  dossier?: LiveDossier;
  fail?: number;
  cids?: number[];
  attempts?: number;
};

/**
 * Streaming batch densify via SSE — skips warm local cache unless force.
 */
export async function streamBatchDensifyCids(
  cids: number[],
  opts?: {
    includeDossiers?: boolean;
    cacheLocal?: boolean;
    concurrency?: number;
    retries?: number;
    force?: boolean;
    maxAgeMs?: number;
    onEvent?: (ev: StreamBatchEvent) => void;
    onProgress?: (msg: string) => void;
  }
): Promise<BatchClientResponse> {
  const results: BatchClientResult[] = [];
  const concurrency = Math.min(4, Math.max(1, opts?.concurrency || 2));
  const unique = [...new Set(cids.filter((c) => c > 0))].slice(0, 12);

  const { warm, needBuild } = await partitionCidsByCache(unique, {
    force: opts?.force,
    maxAgeMs: opts?.maxAgeMs,
  });

  for (const d of warm) {
    const row = warmToResult(d);
    results.push(row);
    opts?.onEvent?.({
      type: "cid_complete",
      cid: d.cid,
      ok: true,
      durationMs: 0,
      summary: row.summary,
      dossier: d,
    });
    opts?.onProgress?.(`Cache hit CID ${d.cid}`);
  }

  if (!needBuild.length) {
    opts?.onProgress?.(`All ${warm.length} CID(s) served from local cache`);
    recordDensifyRun({
      kind: "batch-stream",
      cids: unique,
      concurrency,
      ok: warm.length,
      fail: 0,
      durationMs: 0,
      detail: "all-from-cache",
    });
    return {
      schema: "chemistry-recipes.batch-dossier.v1",
      requested: unique.length,
      ok: warm.length,
      fail: 0,
      skipped: warm.length,
      durationMs: 0,
      results,
    };
  }

  opts?.onProgress?.(
    `Streaming ${needBuild.length} build(s) · ${warm.length} cache · concurrency ${concurrency}…`
  );

  const res = await fetch("/api/dossier/batch/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cids: needBuild,
      includeDossiers: opts?.includeDossiers ?? opts?.cacheLocal ?? true,
      concurrency,
      retries: opts?.retries ?? 2,
      force: opts?.force,
    }),
  });

  if (!res.ok || !res.body) {
    return {
      schema: "chemistry-recipes.batch-dossier.v1",
      requested: unique.length,
      ok: warm.length,
      fail: needBuild.length,
      skipped: warm.length,
      durationMs: 0,
      results,
      error: `Stream HTTP ${res.status}`,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let ok = warm.length;
  let fail = 0;
  let durationMs = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const block of parts) {
      const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.replace(/^data:\s?/, "").trim();
      if (!json) continue;
      try {
        const ev = JSON.parse(json) as StreamBatchEvent;
        opts?.onEvent?.(ev);
        if (ev.label) opts?.onProgress?.(ev.label);
        if (ev.type === "cid_complete" && ev.cid != null) {
          const row: BatchClientResult = {
            cid: ev.cid,
            ok: Boolean(ev.ok),
            error: ev.error,
            durationMs: ev.durationMs || 0,
            summary: ev.summary,
            dossier: ev.dossier,
          };
          results.push(row);
          if (ev.ok) {
            ok += 1;
            if (opts?.cacheLocal && ev.dossier) {
              await putCachedDossierAndNotify(ev.dossier);
              opts.onProgress?.(`Cached CID ${ev.cid}`);
            }
          } else {
            fail += 1;
          }
        }
        if (ev.type === "batch_complete") {
          if (typeof ev.ok === "number") ok = warm.length + ev.ok;
          if (typeof ev.fail === "number") fail = ev.fail;
          durationMs = ev.durationMs || durationMs;
        }
      } catch {
        /* ignore partial */
      }
    }
  }

  opts?.onProgress?.(
    `Stream batch done · ${ok} ok (${warm.length} cache) · ${fail} fail · ${Math.round(durationMs / 1000)}s`
  );

  recordDensifyRun({
    kind: "batch-stream",
    cids: unique,
    concurrency,
    ok,
    fail,
    durationMs,
    detail: `skippedCache=${warm.length}`,
  });

  return {
    schema: "chemistry-recipes.batch-dossier.v1",
    requested: unique.length,
    ok,
    fail,
    skipped: warm.length,
    durationMs,
    results,
  };
}
