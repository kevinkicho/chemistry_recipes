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
}

/**
 * Create campaign from problem hits, then stream-densify the CID queue.
 * Client-only (uses IndexedDB batch cache).
 */
export async function createCampaignAndDensifyFromProblemHits(
  query: string,
  hits: ProblemSearchHit[],
  opts?: {
    name?: string;
    limit?: number;
    concurrency?: number;
    force?: boolean;
    onProgress?: (msg: string) => void;
  }
): Promise<ProblemCampaignDensifyResult | null> {
  const camp = createCampaignFromProblemHits(query, hits, {
    name: opts?.name,
    limit: opts?.limit,
  });
  if (!camp) return null;

  const queueCids = camp.cids.slice(0, 12);
  opts?.onProgress?.(
    `Campaign “${camp.name}” · densifying ${queueCids.length} CID(s)…`
  );

  const densify = await streamBatchDensifyCids(queueCids, {
    includeDossiers: true,
    cacheLocal: true,
    concurrency: opts?.concurrency ?? 2,
    force: opts?.force ?? false,
    retries: 2,
    onProgress: opts?.onProgress,
  });

  updateCampaign(camp.id, {
    lastBatch: {
      at: new Date().toISOString(),
      ok: densify.ok,
      fail: densify.fail,
      detail: densify.error || `problem densify queue · ${queueCids.length} CIDs`,
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
  };
}
