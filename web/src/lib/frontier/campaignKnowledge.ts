/**
 * Load multi-CID campaign knowledge from IndexedDB caches and merge networks/atlases.
 * Client-only.
 */

import { getCachedDossier } from "@/lib/idb/dossierCache";
import type { LiveDossier } from "@/lib/dossier/types";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import {
  buildReactionNetwork,
  mergeReactionNetworks,
  type ReactionNetwork,
} from "@/lib/frontier/reactionNetwork";
import type { ConditionAtlas, ConditionDistribution } from "@/lib/frontier/types";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";

export interface CampaignCidStatus {
  cid: number;
  label?: string;
  cached: boolean;
  evidenceScore?: number;
  observationCount?: number;
  procedureChars?: number;
  idealScore?: number;
  name?: string;
}

export interface MergedCampaignKnowledge {
  cids: number[];
  statuses: CampaignCidStatus[];
  cachedCount: number;
  network: ReactionNetwork;
  /** Merged condition distributions by kind (observations concatenated) */
  atlasByKind: ConditionDistribution[];
  totalObservations: number;
  summary: string;
  dossiers: LiveDossier[];
}

/**
 * Load whatever campaign CIDs are already in IndexedDB.
 */
export async function loadCampaignDossiers(
  cids: number[]
): Promise<LiveDossier[]> {
  const out: LiveDossier[] = [];
  for (const cid of cids) {
    const row = await getCachedDossier(cid);
    if (row?.dossier) out.push(row.dossier);
  }
  return out;
}

export async function campaignStatuses(
  cids: number[],
  labels?: Record<string, string>
): Promise<CampaignCidStatus[]> {
  const statuses: CampaignCidStatus[] = [];
  for (const cid of cids) {
    const row = await getCachedDossier(cid);
    const d = row?.dossier;
    const pack = d?.processKnowledge || (d ? buildProcessKnowledgePackage(d) : null);
    statuses.push({
      cid,
      label: labels?.[String(cid)],
      cached: Boolean(d),
      name: d?.identity?.name || labels?.[String(cid)],
      evidenceScore: d?.evidenceScore?.score,
      idealScore: d?.idealParity?.score,
      observationCount: pack?.metrics.observationCount,
      procedureChars: pack?.metrics.procedureChars,
    });
  }
  return statuses;
}

function mergeAtlases(atlases: ConditionAtlas[]): ConditionDistribution[] {
  const byKind = new Map<string, ConditionDistribution>();
  for (const a of atlases) {
    for (const d of a.distributions) {
      const prev = byKind.get(d.kind);
      if (!prev) {
        byKind.set(d.kind, {
          ...d,
          observations: [...d.observations],
        });
        continue;
      }
      const observations = [...prev.observations, ...d.observations].slice(0, 80);
      const variants = [...new Set([...prev.variants, ...d.variants])].slice(0, 40);
      const nums: number[] = [];
      for (const o of observations) {
        if (o.baseLow != null) nums.push(o.baseLow);
        if (o.baseHigh != null && o.baseHigh !== o.baseLow) nums.push(o.baseHigh);
      }
      const conflict = prev.conflict || d.conflict;
      byKind.set(d.kind, {
        kind: d.kind,
        n: observations.length,
        variants,
        numeric:
          nums.length > 0
            ? {
                min: Math.min(...nums),
                max: Math.max(...nums),
                median: nums.sort((a, b) => a - b)[Math.floor(nums.length / 2)]!,
                unit: prev.numeric?.unit || d.numeric?.unit,
              }
            : undefined,
        conflict,
        conflictNote: conflict
          ? prev.conflictNote || d.conflictNote || "Merged campaign ranges may disagree"
          : undefined,
        observations,
        summary: `Campaign-merged ${d.kind}: n=${observations.length}${
          conflict ? " · conflict" : ""
        }`,
      });
    }
  }
  return [...byKind.values()];
}

/**
 * Merge networks + atlases from in-memory dossiers (server or client).
 * Does not touch IndexedDB.
 */
export function mergeLiveDossiersToCampaignKnowledge(
  dossiers: LiveDossier[],
  requestedCids?: number[],
  labels?: Record<string, string>
): MergedCampaignKnowledge {
  const cids =
    requestedCids && requestedCids.length
      ? requestedCids
      : dossiers.map((d) => d.cid);
  const byCid = new Map(dossiers.map((d) => [d.cid, d]));

  const statuses: CampaignCidStatus[] = cids.map((cid) => {
    const d = byCid.get(cid);
    const pack = d?.processKnowledge || (d ? buildProcessKnowledgePackage(d) : null);
    return {
      cid,
      label: labels?.[String(cid)],
      cached: Boolean(d),
      name: d?.identity?.name || labels?.[String(cid)],
      evidenceScore: d?.evidenceScore?.score,
      idealScore: d?.idealParity?.score,
      observationCount: pack?.metrics.observationCount,
      procedureChars: pack?.metrics.procedureChars,
    };
  });

  const networks = dossiers.map((d) => {
    const pack = d.processKnowledge || buildProcessKnowledgePackage(d);
    return (
      pack.reactionNetwork ||
      buildReactionNetwork(d, pack.conditionAtlas || buildConditionAtlas(d))
    );
  });

  const network =
    networks.length > 0
      ? mergeReactionNetworks(networks)
      : {
          cid: cids[0] || 0,
          centerName: "empty campaign",
          generatedAt: new Date().toISOString(),
          nodes: [],
          edges: [],
          campaignCids: cids,
          summary: "No dossiers — densify first",
          disclaimer: "—",
        };

  const atlases = dossiers.map(
    (d) => d.processKnowledge?.conditionAtlas || buildConditionAtlas(d)
  );
  const atlasByKind = mergeAtlases(atlases);
  const totalObservations = atlasByKind.reduce((n, d) => n + d.n, 0);

  const summary =
    dossiers.length === 0
      ? `0/${cids.length} CIDs available — densify to build campaign graph`
      : `Campaign: ${dossiers.length}/${cids.length} · ${network.nodes.length} nodes · ${network.edges.length} edges · ${totalObservations} condition obs`;

  return {
    cids,
    statuses,
    cachedCount: dossiers.length,
    network,
    atlasByKind,
    totalObservations,
    summary,
    dossiers,
  };
}

/**
 * Merge networks + atlases for all cached campaign dossiers (IndexedDB).
 */
export async function buildMergedCampaignKnowledge(
  cids: number[],
  labels?: Record<string, string>
): Promise<MergedCampaignKnowledge> {
  const dossiers = await loadCampaignDossiers(cids);
  return mergeLiveDossiersToCampaignKnowledge(dossiers, cids, labels);
}
