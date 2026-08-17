/**
 * Campaign scientific brief — multi-CID condition landscape, cross-CID
 * conflicts, and research experiments. Free-public evidence only; not GMP.
 */

import type { MergedCampaignKnowledge } from "@/lib/frontier/campaignKnowledge";
import type { ConditionKind, NextExperiment } from "@/lib/frontier/types";
import { intervalsConflict } from "@/lib/frontier/unitNormalize";
import { buildEdgePairExperiments } from "@/lib/frontier/edgeExperiments";
import { honestCampaignBriefEmpty } from "@/lib/dossier/sectionHonesty";

export const CAMPAIGN_BRIEF_SCHEMA =
  "chemistry-recipes.campaign-brief.v1" as const;

export interface CrossCidConditionSpan {
  kind: ConditionKind | string;
  cid: number;
  name?: string;
  n: number;
  min?: number;
  max?: number;
  unit?: string;
  sampleQuote?: string;
}

export interface CrossCidConflict {
  id: string;
  kind: string;
  cidA: number;
  cidB: number;
  nameA?: string;
  nameB?: string;
  rangeA: string;
  rangeB: string;
  note: string;
  severity: "info" | "warning";
}

export interface CampaignScientificBrief {
  schema: typeof CAMPAIGN_BRIEF_SCHEMA;
  generatedAt: string;
  campaignName?: string;
  summary: string;
  depthScore: number;
  metrics: {
    cachedCount: number;
    requestedCount: number;
    totalObservations: number;
    conditionKinds: number;
    crossCidConflicts: number;
    networkEdges: number;
    thinCidCount: number;
  };
  conditionLandscape: string[];
  crossCidSpans: CrossCidConditionSpan[];
  crossCidConflicts: CrossCidConflict[];
  topExperiments: NextExperiment[];
  openGaps: string[];
  disclaimer: string;
  /** Harvest failed — not a clean miss. */
  harvestFail?: boolean;
}

const DISCLAIMER =
  "Campaign scientific brief from free-public densify only. " +
  "Cross-CID conflicts are research signals, not plant setpoints or QMS limits. " +
  "Not GMP. Validate against primary sources.";

function depthScoreOf(m: MergedCampaignKnowledge): number {
  const cover =
    m.cids.length > 0 ? (m.cachedCount / m.cids.length) * 40 : 0;
  const obs = Math.min(30, m.totalObservations * 2);
  const kinds = Math.min(15, m.atlasByKind.length * 3);
  const edges = Math.min(15, m.network.edges.length * 2);
  return Math.round(Math.min(100, cover + obs + kinds + edges));
}

/**
 * Build a research brief over merged campaign knowledge.
 */
export function buildCampaignScientificBrief(
  merged: MergedCampaignKnowledge,
  opts?: { campaignName?: string; minObsThin?: number }
): CampaignScientificBrief {
  const thinThresh = opts?.minObsThin ?? 2;
  const thinCidCount = merged.statuses.filter(
    (s) => !s.cached || (s.observationCount ?? 0) < thinThresh
  ).length;

  const conditionLandscape = merged.atlasByKind.map((d) => d.summary);

  // Per-CID spans for numeric kinds (temperature, time, pressure, …)
  const crossCidSpans: CrossCidConditionSpan[] = [];
  for (const d of merged.dossiers) {
    const atlas = d.processKnowledge?.conditionAtlas;
    const dists = atlas?.distributions || [];
    for (const dist of dists) {
      if (!dist.numeric) continue;
      const quote = dist.observations[0]?.quote;
      crossCidSpans.push({
        kind: dist.kind,
        cid: d.cid,
        name: d.identity?.name,
        n: dist.n,
        min: dist.numeric.min,
        max: dist.numeric.max,
        unit: dist.numeric.unit,
        sampleQuote: quote?.slice(0, 140),
      });
    }
  }

  // If per-dossier atlas missing, synthesize from merged atlas observations
  if (!crossCidSpans.length) {
    for (const dist of merged.atlasByKind) {
      if (!dist.numeric) continue;
      const byCid = new Map<
        number,
        { lows: number[]; highs: number[]; quote?: string }
      >();
      for (const o of dist.observations) {
        const cidMatch = /CID\s*(\d+)/i.exec(o.sourceLabel || "");
        const idMatch = /:(\d+)/.exec(o.sourceId || "");
        const cid = Number(cidMatch?.[1] || idMatch?.[1] || 0);
        if (!cid) continue;
        const row = byCid.get(cid) || { lows: [], highs: [] };
        if (o.baseLow != null) row.lows.push(o.baseLow);
        if (o.baseHigh != null) row.highs.push(o.baseHigh);
        if (!row.quote && o.quote) row.quote = o.quote;
        byCid.set(cid, row);
      }
      for (const [cid, row] of byCid) {
        if (!row.lows.length) continue;
        const min = Math.min(...row.lows);
        const max = Math.max(...(row.highs.length ? row.highs : row.lows));
        const st = merged.statuses.find((s) => s.cid === cid);
        crossCidSpans.push({
          kind: dist.kind,
          cid,
          name: st?.name,
          n: row.lows.length,
          min,
          max,
          unit: dist.numeric?.unit,
          sampleQuote: row.quote?.slice(0, 140),
        });
      }
    }
  }

  // Cross-CID conflicts: same kind, non-overlapping base ranges across CIDs
  const crossCidConflicts: CrossCidConflict[] = [];
  const byKind = new Map<string, CrossCidConditionSpan[]>();
  for (const s of crossCidSpans) {
    if (s.min == null || s.max == null) continue;
    const list = byKind.get(String(s.kind)) || [];
    list.push(s);
    byKind.set(String(s.kind), list);
  }
  let conflictI = 0;
  for (const [kind, spans] of byKind) {
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        const a = spans[i]!;
        const b = spans[j]!;
        if (a.cid === b.cid) continue;
        if (
          a.min == null ||
          a.max == null ||
          b.min == null ||
          b.max == null
        )
          continue;
        const { conflict } = intervalsConflict([
          { low: a.min, high: a.max },
          { low: b.min, high: b.max },
        ]);
        if (!conflict) continue;
        conflictI += 1;
        crossCidConflicts.push({
          id: `xconf:${conflictI}`,
          kind,
          cidA: a.cid,
          cidB: b.cid,
          nameA: a.name,
          nameB: b.name,
          rangeA: `${a.min}–${a.max}${a.unit ? ` ${a.unit}` : ""}`,
          rangeB: `${b.min}–${b.max}${b.unit ? ` ${b.unit}` : ""}`,
          note: `Non-overlapping ${kind} windows across CID ${a.cid} vs ${b.cid} in free-public text — research conflict, not a plant limit.`,
          severity: "warning",
        });
      }
    }
  }

  const edgeExps = buildEdgePairExperiments(
    merged.network,
    merged.dossiers,
    6
  );
  const conflictExps: NextExperiment[] = crossCidConflicts
    .slice(0, 4)
    .map((c) => ({
      id: `exp:xconf:${c.id}`,
      question: `Compare ${c.kind} evidence for CID ${c.cidA} (${c.rangeA}) vs CID ${c.cidB} (${c.rangeB}) in primary sources`,
      rationale: c.note,
      gap: `Cross-CID ${c.kind} non-overlap`,
      priority: "high" as const,
    }));

  // Harvest failure is not "Few condition observations" /
  // "No reaction-network edges yet" / "Empty campaign package".
  // Leftover identity / annotation HTTP is not a campaign-brief miss.
  // cachedCount === 0 stays a local-cache gap.
  const harvestEmpty = honestCampaignBriefEmpty({
    dossiers: merged.dossiers,
    cachedCount: merged.cachedCount,
    totalObservations: merged.totalObservations,
    networkEdgeCount: merged.network.edges.length,
    thinCidCount,
    thinThresh,
  });
  const openGaps: string[] = [...harvestEmpty.openGaps];
  for (const c of crossCidConflicts.slice(0, 3)) {
    openGaps.push(c.note);
  }

  const depth = depthScoreOf(merged);
  const summary =
    harvestEmpty.summaryOverlay ||
    `Campaign brief · depth ${depth}/100 · ${merged.cachedCount}/${merged.cids.length} densified · ${merged.totalObservations} condition obs · ${crossCidConflicts.length} cross-CID range conflict(s) · ${merged.network.edges.length} network edge(s). Not GMP.`;

  return {
    schema: CAMPAIGN_BRIEF_SCHEMA,
    generatedAt: new Date().toISOString(),
    campaignName: opts?.campaignName,
    summary,
    depthScore: depth,
    metrics: {
      cachedCount: merged.cachedCount,
      requestedCount: merged.cids.length,
      totalObservations: merged.totalObservations,
      conditionKinds: merged.atlasByKind.length,
      crossCidConflicts: crossCidConflicts.length,
      networkEdges: merged.network.edges.length,
      thinCidCount,
    },
    conditionLandscape,
    crossCidSpans: crossCidSpans.slice(0, 40),
    crossCidConflicts: crossCidConflicts.slice(0, 12),
    topExperiments: [...conflictExps, ...edgeExps].slice(0, 10),
    openGaps: openGaps.slice(0, 10),
    disclaimer: DISCLAIMER,
    harvestFail: harvestEmpty.harvestFail,
  };
}
