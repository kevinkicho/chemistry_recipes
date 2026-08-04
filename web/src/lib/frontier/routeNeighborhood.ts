/**
 * Route-neighborhood densify — impurities and intermediates first.
 * Expands a campaign or single dossier with free-public related CIDs.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ScienceCampaign } from "@/lib/workspace/campaigns";
import { updateCampaign } from "@/lib/workspace/campaigns";
import {
  prioritizedNeighborCids,
  buildNeighborDensifyGraph,
} from "@/lib/frontier/neighborDensifyGraph";
import {
  streamBatchDensifyCids,
  type BatchClientResponse,
} from "@/lib/dossier/batchClient";
import { getCachedDossier } from "@/lib/idb/dossierCache";

function emptyDensify(requested = 0): BatchClientResponse {
  return {
    schema: "chemistry-recipes.batch-dossier.v1",
    requested,
    results: [],
    ok: 0,
    fail: 0,
    durationMs: 0,
  };
}

/**
 * Densify impurity/route neighbors for one live dossier (client).
 */
export async function densifyRouteNeighborhood(
  dossier: LiveDossier,
  opts?: {
    maxNeighbors?: number;
    force?: boolean;
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
  }
): Promise<{
  graph: ReturnType<typeof buildNeighborDensifyGraph>;
  densify: BatchClientResponse;
  queueCids: number[];
}> {
  const graph = buildNeighborDensifyGraph(dossier);
  const queueCids = prioritizedNeighborCids(
    dossier,
    opts?.maxNeighbors ?? 6
  ).filter((c) => c > 0 && c !== dossier.cid);

  if (!queueCids.length) {
    return {
      graph,
      densify: emptyDensify(0),
      queueCids: [],
    };
  }

  opts?.onProgress?.(
    `Route neighborhood · densify ${queueCids.length} (impurities first)…`
  );
  const densify = await streamBatchDensifyCids(queueCids, {
    includeDossiers: true,
    cacheLocal: true,
    force: opts?.force ?? false,
    signal: opts?.signal,
    onProgress: opts?.onProgress,
  });

  return { graph, densify, queueCids };
}

/**
 * After a problem campaign densify, expand with neighbors from successful
 * dossier caches and densify the new CIDs.
 */
export async function expandCampaignWithRouteNeighborhood(
  campaign: ScienceCampaign,
  opts?: {
    maxNew?: number;
    concurrency?: number;
    force?: boolean;
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
  }
): Promise<{
  campaign: ScienceCampaign;
  densify: BatchClientResponse;
  addedCids: number[];
} | null> {
  const maxNew = opts?.maxNew ?? 6;
  const existing = new Set(campaign.cids);
  const labels = { ...(campaign.labels || {}) };
  const candidates: Array<{ cid: number; label: string; priority: number }> =
    [];

  for (const cid of campaign.cids.slice(0, 12)) {
    if (opts?.signal?.aborted) break;
    const cached = await getCachedDossier(cid);
    const d = cached?.dossier;
    if (!d) continue;
    const graph = buildNeighborDensifyGraph(d);
    for (const t of graph.queue) {
      if (existing.has(t.cid) || t.cid <= 0) continue;
      candidates.push({
        cid: t.cid,
        label: t.label,
        priority: t.priority,
      });
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const addedCids: number[] = [];
  for (const c of candidates) {
    if (addedCids.length >= maxNew) break;
    if (existing.has(c.cid)) continue;
    existing.add(c.cid);
    addedCids.push(c.cid);
    labels[String(c.cid)] = c.label;
  }

  if (!addedCids.length) {
    return {
      campaign,
      densify: emptyDensify(0),
      addedCids: [],
    };
  }

  const next = updateCampaign(campaign.id, {
    cids: [...campaign.cids, ...addedCids],
    labels,
    description:
      (campaign.description || "") +
      ` · +${addedCids.length} route-neighborhood CID(s) (impurity/intermediate priority)`,
  });
  if (!next) return null;

  opts?.onProgress?.(
    `Neighborhood densify · ${addedCids.length} new CID(s)…`
  );
  const densify = await streamBatchDensifyCids(addedCids, {
    includeDossiers: true,
    cacheLocal: true,
    force: opts?.force ?? false,
    signal: opts?.signal,
    concurrency: opts?.concurrency ?? 2,
    onProgress: opts?.onProgress,
  });

  return { campaign: next, densify, addedCids };
}
