/**
 * Server-side durable evidence cache for free-public gather results.
 *
 * - In-memory LRU (fast, per instance)
 * - Optional disk under web/.cache/evidence/ (survives restarts locally;
 *   App Hosting ephemeral FS still helps multi-request bursts)
 *
 * Never stores secrets — only free-public CompoundEvidence JSON.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from "fs";
import path from "path";
import type { CompoundEvidence } from "@/lib/dossier/types";

/** Bump when gather shape / densify rules change */
/** Bump when gather durability / densify rules change */
export const EVIDENCE_CACHE_SCHEMA = 5;

const MEMORY_MAX = 48;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const DISK_TTL_MS = 48 * 60 * 60 * 1000; // 48h on disk

type CacheRow = {
  cid: number;
  schema: number;
  savedAt: number;
  evidence: CompoundEvidence;
};

const memory = new Map<number, CacheRow>();

function cacheDir(): string {
  // web/ when cwd is web; monorepo root otherwise
  const candidates = [
    path.resolve(process.cwd(), ".cache", "evidence"),
    path.resolve(process.cwd(), "web", ".cache", "evidence"),
  ];
  for (const c of candidates) {
    try {
      if (!existsSync(c)) mkdirSync(c, { recursive: true });
      return c;
    } catch {
      /* try next */
    }
  }
  return candidates[0]!;
}

function diskPath(cid: number): string {
  return path.join(cacheDir(), `cid-${cid}.v${EVIDENCE_CACHE_SCHEMA}.json`);
}

function touchMemory(cid: number, row: CacheRow) {
  if (memory.has(cid)) memory.delete(cid);
  memory.set(cid, row);
  while (memory.size > MEMORY_MAX) {
    const first = memory.keys().next().value;
    if (first == null) break;
    memory.delete(first);
  }
}

export function getCachedEvidence(
  cid: number,
  opts?: { maxAgeMs?: number }
): CompoundEvidence | null {
  if (!Number.isFinite(cid) || cid <= 0) return null;
  const maxAge = opts?.maxAgeMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  const mem = memory.get(cid);
  if (mem && mem.schema === EVIDENCE_CACHE_SCHEMA && now - mem.savedAt < maxAge) {
    return mem.evidence;
  }

  try {
    const fp = diskPath(cid);
    if (!existsSync(fp)) return null;
    const st = statSync(fp);
    if (now - st.mtimeMs > DISK_TTL_MS) return null;
    const raw = readFileSync(fp, "utf8");
    const row = JSON.parse(raw) as CacheRow;
    if (row.schema !== EVIDENCE_CACHE_SCHEMA || row.cid !== cid) return null;
    if (now - row.savedAt > DISK_TTL_MS) return null;
    touchMemory(cid, row);
    return row.evidence;
  } catch {
    return null;
  }
}

export function putCachedEvidence(evidence: CompoundEvidence): void {
  const cid = evidence.cid;
  if (!Number.isFinite(cid) || cid <= 0) return;
  const row: CacheRow = {
    cid,
    schema: EVIDENCE_CACHE_SCHEMA,
    savedAt: Date.now(),
    evidence,
  };
  touchMemory(cid, row);
  try {
    writeFileSync(diskPath(cid), JSON.stringify(row), "utf8");
  } catch {
    /* disk optional */
  }
}

/** Prefer denser procedure text when merging a fresh gather with a prior cache. */
export function mergeEvidencePreferDense(
  fresh: CompoundEvidence,
  prior: CompoundEvidence | null
): CompoundEvidence {
  if (!prior) return fresh;

  const freshProc = fresh.procedureExcerpts || [];
  const priorProc = prior.procedureExcerpts || [];
  const byId = new Map<string, (typeof freshProc)[0]>();
  for (const p of priorProc) byId.set(p.id, p);
  for (const p of freshProc) {
    const old = byId.get(p.id);
    if (!old || (p.chars || p.text.length) >= (old.chars || old.text.length)) {
      byId.set(p.id, p);
    }
  }
  // Keep prior-only excerpts that are unique procedure windows
  for (const p of priorProc) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  const procedureExcerpts = [...byId.values()]
    .sort((a, b) => (b.chars || b.text.length) - (a.chars || a.text.length))
    .slice(0, 48);

  // Literature: prefer hits with fullTextExcerpt
  const litMap = new Map<string, (typeof fresh.literature)[0]>();
  for (const h of prior.literature || []) litMap.set(h.id, h);
  for (const h of fresh.literature || []) {
    const old = litMap.get(h.id);
    if (!old) litMap.set(h.id, h);
    else if (
      (h.fullTextExcerpt?.length || 0) >= (old.fullTextExcerpt?.length || 0)
    ) {
      litMap.set(h.id, { ...old, ...h, fullTextExcerpt: h.fullTextExcerpt || old.fullTextExcerpt });
    }
  }

  // Patents: prefer procedureExcerpt density
  const patMap = new Map<string, (typeof fresh.patents)[0]>();
  for (const p of prior.patents || []) patMap.set(p.id, p);
  for (const p of fresh.patents || []) {
    const old = patMap.get(p.id);
    if (!old) patMap.set(p.id, p);
    else {
      const denser =
        (p.procedureExcerpt?.length || p.abstract?.length || 0) >=
        (old.procedureExcerpt?.length || old.abstract?.length || 0);
      patMap.set(p.id, denser ? { ...old, ...p } : { ...p, ...old });
    }
  }

  const manufacturingTexts = [
    ...new Set([
      ...(fresh.view?.manufacturingTexts || []),
      ...(prior.view?.manufacturingTexts || []),
    ]),
  ].slice(0, 60);

  const view = fresh.view
    ? {
        ...fresh.view,
        manufacturingTexts:
          manufacturingTexts.length > (fresh.view.manufacturingTexts?.length || 0)
            ? manufacturingTexts
            : fresh.view.manufacturingTexts,
      }
    : prior.view;

  const annotations = [...(fresh.annotations || [])];
  const annKeys = new Set(
    annotations.map((a) => `${a.source}|${a.title}|${a.url || ""}`)
  );
  for (const a of prior.annotations || []) {
    const k = `${a.source}|${a.title}|${a.url || ""}`;
    if (!annKeys.has(k)) {
      annotations.push(a);
      annKeys.add(k);
    }
  }

  const fetchErrors = [
    ...new Set([...(fresh.fetchErrors || []), ...(prior.fetchErrors || [])]),
  ].slice(0, 40);

  // Prefer longer traces list but cap
  const traces =
    (fresh.traces?.length || 0) >= (prior.traces?.length || 0)
      ? fresh.traces
      : prior.traces;

  return {
    ...fresh,
    view,
    literature: [...litMap.values()].slice(0, 40),
    patents: [...patMap.values()].slice(0, 32),
    annotations: annotations.slice(0, 80),
    procedureExcerpts,
    traces,
    fetchErrors,
    sourceRefs: fresh.sourceRefs?.length
      ? fresh.sourceRefs
      : prior.sourceRefs,
  };
}

/** Best-effort prune old disk cache files (local hygiene). */
export function pruneEvidenceCacheDisk(maxFiles = 200): void {
  try {
    const dir = cacheDir();
    if (!existsSync(dir)) return;
    const files = readdirSync(dir)
      .filter((f) => f.startsWith("cid-") && f.endsWith(".json"))
      .map((f) => {
        const fp = path.join(dir, f);
        return { fp, mtime: statSync(fp).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const f of files.slice(maxFiles)) {
      try {
        unlinkSync(f.fp);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}
