/**
 * Spin a science campaign from problem-first / unit-op search hits.
 * Optional stream densify queue for thin multi-CID packages.
 */

import type { ProblemSearchHit } from "@/lib/search/problemFirst";
import {
  createCampaign,
  updateCampaign,
  type ScienceCampaign,
} from "@/lib/workspace/campaigns";
import { HUB_INDEX } from "@/lib/data/hubIndex";
import {
  streamBatchDensifyCids,
  type BatchClientResponse,
} from "@/lib/dossier/batchClient";
import type { LiteratureHit } from "@/lib/api/europePmc";
import {
  attachLiteratureHitsToCampaignCids,
  rematerializeCachesWithLocalPastes,
} from "@/lib/frontier/literatureToPaste";

/**
 * Extract PubChem CIDs from problem-search hits (hub-live, multi-source, example).
 */
export function cidsFromProblemHits(hits: ProblemSearchHit[]): {
  cids: number[];
  labels: Record<string, string>;
} {
  const cids: number[] = [];
  const labels: Record<string, string> = {};

  for (const h of hits) {
    // live-{cid} or ms-{cid} (multi-source molecule)
    const live = /^(?:live|ms)-(\d+)$/.exec(h.id);
    if (live) {
      const cid = Number(live[1]);
      if (cid > 0) {
        cids.push(cid);
        labels[String(cid)] = h.title.replace(/\s*\(training\)\s*$/i, "").trim();
      }
      continue;
    }
    // pubchem path in href
    const hrefCid = /\/cid\/(\d+)/i.exec(h.href || "");
    if (hrefCid) {
      const cid = Number(hrefCid[1]);
      if (cid > 0) {
        cids.push(cid);
        labels[String(cid)] =
          labels[String(cid)] ||
          h.title.replace(/\s*\(training\)\s*$/i, "").trim();
      }
      continue;
    }
    // example via hub index
    const ex = /^ex-(.+)$/.exec(h.id);
    if (ex) {
      const entry = HUB_INDEX.find((e) => e.exampleId === ex[1]);
      if (entry?.pubchemCid) {
        cids.push(entry.pubchemCid);
        labels[String(entry.pubchemCid)] = entry.name;
      }
    }
  }

  const unique = [...new Set(cids)].slice(0, 40);
  return { cids: unique, labels };
}

/**
 * Create a local science campaign from problem-first search results.
 */
export function createCampaignFromProblemHits(
  query: string,
  hits: ProblemSearchHit[],
  opts?: { name?: string; limit?: number }
): ScienceCampaign | null {
  const limited = hits.slice(0, opts?.limit ?? 16);
  const { cids, labels } = cidsFromProblemHits(limited);
  if (!cids.length) return null;

  const name =
    opts?.name?.trim() ||
    `Problem: ${query.trim().slice(0, 48) || "unit-op"}`;

  return createCampaign(name, cids, {
    description: `Auto-created from problem-first search “${query.trim()}” · free-public multi-source CIDs · not GMP`,
    labels,
  });
}

export interface ProblemCampaignDensifyResult {
  campaign: ScienceCampaign;
  densify: BatchClientResponse;
  queueCids: number[];
  literatureAttached: number;
  literatureChars: number;
  literatureSummary?: string;
}

/**
 * Create campaign from problem hits, optionally attach process literature as
 * local densify pastes, then stream-densify the CID queue.
 * Client-only (uses IndexedDB batch cache + local supplements).
 */
export async function createCampaignAndDensifyFromProblemHits(
  query: string,
  hits: ProblemSearchHit[],
  opts?: {
    name?: string;
    limit?: number;
    concurrency?: number;
    force?: boolean;
    literatureHits?: LiteratureHit[];
    /** Cancel densify stream when user navigates away (browser Back) */
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
  }
): Promise<ProblemCampaignDensifyResult | null> {
  const camp = createCampaignFromProblemHits(query, hits, {
    name: opts?.name,
    limit: opts?.limit,
  });
  if (!camp) return null;

  const queueCids = camp.cids.slice(0, 12);
  let literatureAttached = 0;
  let literatureChars = 0;
  let literatureSummary: string | undefined;

  if (opts?.literatureHits?.length) {
    opts.onProgress?.(
      "Enriching OA full text (PMCID) + attaching densify pastes…"
    );
    const lit = await attachLiteratureHitsToCampaignCids(
      queueCids,
      opts.literatureHits,
      { maxPerCid: 3, maxCids: 8, enrichOa: true }
    );
    literatureAttached = lit.totalAttached;
    literatureChars = lit.totalChars;
    literatureSummary = lit.summary;
    opts.onProgress?.(lit.summary);
  }

  opts?.onProgress?.(
    `Campaign “${camp.name}” · densifying ${queueCids.length} CID(s)…`
  );

  const densify = await streamBatchDensifyCids(queueCids, {
    includeDossiers: true,
    cacheLocal: true,
    concurrency: opts?.concurrency ?? 2,
    force: opts?.force ?? false,
    retries: 2,
    signal: opts?.signal,
    onProgress: opts?.onProgress,
  });

  if (opts?.signal?.aborted || densify.error === "aborted") {
    opts?.onProgress?.("Densify cancelled — left page or aborted");
    updateCampaign(camp.id, {
      lastBatch: {
        at: new Date().toISOString(),
        ok: densify.ok,
        fail: densify.fail,
        detail: "aborted mid densify (navigation)",
      },
    });
    return {
      campaign: camp,
      densify,
      queueCids,
      literatureAttached,
      literatureChars,
      literatureSummary,
    };
  }

  // Fold literature pastes into IDB so campaign agent/brief use enriched packages
  if (literatureAttached > 0) {
    opts?.onProgress?.("Rematerializing caches with literature pastes…");
    await rematerializeCachesWithLocalPastes(queueCids);
  }

  updateCampaign(camp.id, {
    lastBatch: {
      at: new Date().toISOString(),
      ok: densify.ok,
      fail: densify.fail,
      detail:
        densify.error ||
        `problem densify queue · ${queueCids.length} CIDs` +
          (literatureAttached ? ` · lit pastes ${literatureAttached}` : ""),
    },
  });

  const refreshed = {
    ...camp,
    lastBatch: {
      at: new Date().toISOString(),
      ok: densify.ok,
      fail: densify.fail,
      detail: densify.error,
    },
  };

  return {
    campaign: refreshed,
    densify,
    queueCids,
    literatureAttached,
    literatureChars,
    literatureSummary,
  };
}
