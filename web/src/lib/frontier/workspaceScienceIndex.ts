/**
 * Cross-campaign science index — local-first inventory of densify depth,
 * thin queues, and condition kinds across all science campaigns.
 */

import { listCampaigns, type ScienceCampaign } from "@/lib/workspace/campaigns";
import {
  campaignStatuses,
  thinOrMissingCids,
  type CampaignCidStatus,
} from "@/lib/frontier/campaignKnowledge";
import { getCachedDossier } from "@/lib/idb/dossierCache";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import type { ConditionKind } from "@/lib/frontier/types";

export const WORKSPACE_SCIENCE_INDEX_SCHEMA =
  "chemistry-recipes.workspace-science-index.v1" as const;

export interface IndexedCidRow {
  cid: number;
  name?: string;
  campaigns: string[];
  campaignIds: string[];
  cached: boolean;
  observationCount: number;
  idealScore?: number;
  procedureChars?: number;
  conditionKinds: string[];
  thin: boolean;
}

export interface WorkspaceScienceIndex {
  schema: typeof WORKSPACE_SCIENCE_INDEX_SCHEMA;
  generatedAt: string;
  summary: string;
  campaigns: Array<{
    id: string;
    name: string;
    cidCount: number;
    cachedCount: number;
    totalObs: number;
    thinCount: number;
    avgIdeal?: number;
  }>;
  cids: IndexedCidRow[];
  /** Global densify queue (thin or missing), ranked: multi-campaign first */
  densifyQueue: number[];
  conditionKindHistogram: Array<{ kind: string; n: number; cidCount: number }>;
  metrics: {
    campaignCount: number;
    uniqueCids: number;
    cachedCids: number;
    thinCids: number;
    totalObservations: number;
    queueLength: number;
  };
  disclaimer: string;
}

const DISCLAIMER =
  "Workspace science index is local browser inventory from free-public densify caches. " +
  "Not GMP. Not a multi-tenant lab notebook.";

/**
 * Build index over all local science campaigns + IndexedDB dossiers.
 */
export async function buildWorkspaceScienceIndex(
  campaigns?: ScienceCampaign[]
): Promise<WorkspaceScienceIndex> {
  const camps = campaigns ?? listCampaigns();
  const cidToCamps = new Map<number, { ids: string[]; names: string[] }>();
  for (const c of camps) {
    for (const cid of c.cids) {
      const row = cidToCamps.get(cid) || { ids: [], names: [] };
      row.ids.push(c.id);
      row.names.push(c.name);
      cidToCamps.set(cid, row);
    }
  }

  const uniqueCids = [...cidToCamps.keys()];
  const statusMap = new Map<number, CampaignCidStatus>();
  // Batch statuses via campaignStatuses helper
  const statuses = await campaignStatuses(uniqueCids);
  for (const s of statuses) statusMap.set(s.cid, s);

  const kindCounts = new Map<string, { n: number; cids: Set<number> }>();
  const rows: IndexedCidRow[] = [];

  for (const cid of uniqueCids) {
    const st = statusMap.get(cid);
    const campMeta = cidToCamps.get(cid)!;
    const rowCache = await getCachedDossier(cid);
    const d = rowCache?.dossier;
    const pack =
      d?.processKnowledge || (d ? buildProcessKnowledgePackage(d) : null);
    const kinds: string[] = [];
    if (pack?.conditionAtlas?.distributions) {
      for (const dist of pack.conditionAtlas.distributions) {
        kinds.push(dist.kind);
        const prev = kindCounts.get(dist.kind) || {
          n: 0,
          cids: new Set<number>(),
        };
        prev.n += dist.n;
        prev.cids.add(cid);
        kindCounts.set(dist.kind, prev);
      }
    }
    const obs = st?.observationCount ?? pack?.metrics.observationCount ?? 0;
    const thin = !st?.cached || obs < 2;
    rows.push({
      cid,
      name: st?.name || d?.identity?.name,
      campaigns: campMeta.names,
      campaignIds: campMeta.ids,
      cached: Boolean(st?.cached),
      observationCount: obs,
      idealScore: st?.idealScore,
      procedureChars: st?.procedureChars ?? pack?.metrics.procedureChars,
      conditionKinds: [...new Set(kinds)] as ConditionKind[],
      thin,
    });
  }

  // Rank densify queue: thin first, then multi-campaign membership
  const densifyQueue = rows
    .filter((r) => r.thin)
    .sort((a, b) => {
      const multi = b.campaigns.length - a.campaigns.length;
      if (multi !== 0) return multi;
      return a.observationCount - b.observationCount;
    })
    .map((r) => r.cid);

  const campaignSummaries = camps.map((c) => {
    const members = c.cids.map((cid) => rows.find((r) => r.cid === cid));
    const cachedCount = members.filter((m) => m?.cached).length;
    const totalObs = members.reduce(
      (n, m) => n + (m?.observationCount || 0),
      0
    );
    const thinCount = members.filter((m) => m?.thin).length;
    const ideals = members
      .map((m) => m?.idealScore)
      .filter((x): x is number => typeof x === "number");
    return {
      id: c.id,
      name: c.name,
      cidCount: c.cids.length,
      cachedCount,
      totalObs,
      thinCount,
      avgIdeal: ideals.length
        ? Math.round(ideals.reduce((a, b) => a + b, 0) / ideals.length)
        : undefined,
    };
  });

  const conditionKindHistogram = [...kindCounts.entries()]
    .map(([kind, v]) => ({
      kind,
      n: v.n,
      cidCount: v.cids.size,
    }))
    .sort((a, b) => b.n - a.n);

  const totalObservations = rows.reduce((n, r) => n + r.observationCount, 0);
  const cachedCids = rows.filter((r) => r.cached).length;
  const thinCids = rows.filter((r) => r.thin).length;

  const summary =
    camps.length === 0
      ? "No science campaigns yet — save a multi-CID set from a live dossier network."
      : `Workspace science index · ${camps.length} campaign(s) · ${uniqueCids.length} unique CID(s) · ${cachedCids} densified · ${totalObservations} atlas obs · queue ${densifyQueue.length}. Not GMP.`;

  return {
    schema: WORKSPACE_SCIENCE_INDEX_SCHEMA,
    generatedAt: new Date().toISOString(),
    summary,
    campaigns: campaignSummaries,
    cids: rows.sort((a, b) => {
      if (a.thin !== b.thin) return a.thin ? -1 : 1;
      return b.campaigns.length - a.campaigns.length;
    }),
    densifyQueue,
    conditionKindHistogram,
    metrics: {
      campaignCount: camps.length,
      uniqueCids: uniqueCids.length,
      cachedCids,
      thinCids,
      totalObservations,
      queueLength: densifyQueue.length,
    },
    disclaimer: DISCLAIMER,
  };
}

/** Convenience: thin/missing for one campaign via shared helper */
export function campaignDensifyQueue(
  statuses: CampaignCidStatus[]
): number[] {
  return thinOrMissingCids(statuses);
}

export function downloadWorkspaceScienceIndex(
  index: WorkspaceScienceIndex,
  filename = "workspace-science-index.json"
): void {
  const blob = new Blob([JSON.stringify(index, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
