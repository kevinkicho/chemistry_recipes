/**
 * Spin a science campaign from problem-first / unit-op search hits.
 */

import type { ProblemSearchHit } from "@/lib/search/problemFirst";
import { createCampaign, type ScienceCampaign } from "@/lib/workspace/campaigns";
import { HUB_INDEX } from "@/lib/data/hubIndex";

/**
 * Extract PubChem CIDs from problem-search hits (hub-live + example).
 */
export function cidsFromProblemHits(hits: ProblemSearchHit[]): {
  cids: number[];
  labels: Record<string, string>;
} {
  const cids: number[] = [];
  const labels: Record<string, string> = {};

  for (const h of hits) {
    // live-{cid}
    const live = /^live-(\d+)$/.exec(h.id);
    if (live) {
      const cid = Number(live[1]);
      if (cid > 0) {
        cids.push(cid);
        labels[String(cid)] = h.title.replace(/\s*\(training\)\s*$/i, "").trim();
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
    description: `Auto-created from problem-first search “${query.trim()}” · free-public hub CIDs only · not GMP`,
    labels,
  });
}
