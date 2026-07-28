/**
 * Campaign-level ideal page parity rollup — which Tier-A sections are
 * weak across densified CIDs. Honest inventory; never invents fills.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { MergedCampaignKnowledge } from "@/lib/frontier/campaignKnowledge";
import {
  assessIdealPageParity,
  type IdealPageParity,
  type IdealSectionId,
  type IdealSectionStatus,
} from "@/lib/dossier/idealPage";

export const CAMPAIGN_IDEAL_ROLLUP_SCHEMA =
  "chemistry-recipes.campaign-ideal-rollup.v1" as const;

export interface CampaignCidIdealRow {
  cid: number;
  name?: string;
  score: number;
  filledCount: number;
  totalCount: number;
  weakSections: Array<{ id: IdealSectionId; label: string; depth: number }>;
  preferredIsTeaching: boolean;
}

export interface CampaignSectionRollup {
  id: IdealSectionId;
  label: string;
  /** Mean depth 0–100 across densified CIDs */
  meanDepth: number;
  /** CIDs with depth < 50 */
  weakCids: number[];
  /** CIDs with depth >= 70 */
  strongCids: number[];
  n: number;
}

export interface CampaignIdealRollup {
  schema: typeof CAMPAIGN_IDEAL_ROLLUP_SCHEMA;
  generatedAt: string;
  campaignName?: string;
  summary: string;
  /** Mean ideal score across densified CIDs */
  meanScore: number;
  minScore: number;
  maxScore: number;
  densifiedCount: number;
  requestedCount: number;
  rows: CampaignCidIdealRow[];
  sections: CampaignSectionRollup[];
  /** Highest-leverage densify targets: low score CIDs first */
  densifyPriorityCids: number[];
  /** Sections weak on ≥ half of densified CIDs */
  systemicGaps: string[];
  disclaimer: string;
}

const DISCLAIMER =
  "Campaign ideal rollup measures free-public densify depth toward curated Tier-A " +
  "inventory. Not GMP readiness. Empty sections are honest gaps.";

function parityOf(d: LiveDossier): IdealPageParity {
  return d.idealParity || assessIdealPageParity(d);
}

/**
 * Roll up ideal-page parity across campaign dossiers.
 */
export function buildCampaignIdealRollup(
  dossiers: LiveDossier[],
  opts?: { campaignName?: string; requestedCount?: number }
): CampaignIdealRollup {
  const rows: CampaignCidIdealRow[] = dossiers.map((d) => {
    const p = parityOf(d);
    const weak = p.sections
      .filter((s) => s.depth < 50)
      .sort((a, b) => a.depth - b.depth)
      .slice(0, 6)
      .map((s) => ({ id: s.id, label: s.label, depth: s.depth }));
    return {
      cid: d.cid,
      name: d.identity?.name,
      score: p.score,
      filledCount: p.filledCount,
      totalCount: p.totalCount,
      weakSections: weak,
      preferredIsTeaching: p.preferredIsTeaching,
    };
  });

  const scores = rows.map((r) => r.score);
  const meanScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;

  // Section heatmap
  const sectionMap = new Map<
    IdealSectionId,
    { label: string; depths: number[]; weak: number[]; strong: number[] }
  >();
  for (const d of dossiers) {
    const p = parityOf(d);
    for (const s of p.sections) {
      const row = sectionMap.get(s.id) || {
        label: s.label,
        depths: [],
        weak: [],
        strong: [],
      };
      row.depths.push(s.depth);
      if (s.depth < 50) row.weak.push(d.cid);
      if (s.depth >= 70) row.strong.push(d.cid);
      sectionMap.set(s.id, row);
    }
  }

  const sections: CampaignSectionRollup[] = [...sectionMap.entries()]
    .map(([id, v]) => ({
      id,
      label: v.label,
      meanDepth: v.depths.length
        ? Math.round(v.depths.reduce((a, b) => a + b, 0) / v.depths.length)
        : 0,
      weakCids: v.weak,
      strongCids: v.strong,
      n: v.depths.length,
    }))
    .sort((a, b) => a.meanDepth - b.meanDepth);

  const densified = dossiers.length;
  const systemicGaps = sections
    .filter(
      (s) => densified > 0 && s.weakCids.length >= Math.ceil(densified / 2)
    )
    .map(
      (s) =>
        `${s.label}: mean depth ${s.meanDepth}/100 · weak on ${s.weakCids.length}/${densified} CID(s)`
    );

  const densifyPriorityCids = [...rows]
    .sort((a, b) => a.score - b.score)
    .map((r) => r.cid);

  const requested = opts?.requestedCount ?? densified;
  const summary =
    densified === 0
      ? "No densified CIDs — ideal rollup empty until campaign densify"
      : `Campaign ideal · mean ${meanScore}/100 (min ${minScore} · max ${maxScore}) · ${densified}/${requested} densified · ${systemicGaps.length} systemic section gap(s)`;

  return {
    schema: CAMPAIGN_IDEAL_ROLLUP_SCHEMA,
    generatedAt: new Date().toISOString(),
    campaignName: opts?.campaignName,
    summary,
    meanScore,
    minScore,
    maxScore,
    densifiedCount: densified,
    requestedCount: requested,
    rows: rows.sort((a, b) => a.score - b.score),
    sections,
    densifyPriorityCids,
    systemicGaps,
    disclaimer: DISCLAIMER,
  };
}

export function buildCampaignIdealRollupFromMerged(
  merged: MergedCampaignKnowledge,
  campaignName?: string
): CampaignIdealRollup {
  return buildCampaignIdealRollup(merged.dossiers, {
    campaignName,
    requestedCount: merged.cids.length,
  });
}

/** For Markdown / export helpers */
export function formatIdealSectionLine(s: IdealSectionStatus): string {
  return `${s.label}: ${s.depth}/100 (${s.source}) — ${s.detail}`;
}
