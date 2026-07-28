/**
 * Side-by-side campaign / multi-CID compare for densify depth + ideal.
 * Free-public metrics only — not plant readiness.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ScienceCampaign } from "@/lib/workspace/campaigns";
import { loadCampaignDossiers } from "@/lib/frontier/campaignKnowledge";
import { buildCampaignIdealRollup } from "@/lib/frontier/campaignIdealRollup";
import { buildCampaignScientificBrief } from "@/lib/frontier/campaignBrief";
import { mergeLiveDossiersToCampaignKnowledge } from "@/lib/frontier/campaignKnowledge";
import { buildLiteratureDepthReport } from "@/lib/frontier/literatureDepth";

export const CAMPAIGN_COMPARE_SCHEMA =
  "chemistry-recipes.campaign-compare.v1" as const;

export interface CampaignCompareSide {
  id: string;
  name: string;
  cids: number[];
  densifiedCount: number;
  meanIdeal: number;
  minIdeal: number;
  maxIdeal: number;
  totalObs: number;
  conditionKinds: number;
  meanLitDepth: number;
  depthScore: number;
  thinCidCount: number;
  crossCidConflicts: number;
  topWeakSections: string[];
}

export interface CampaignCompareResult {
  schema: typeof CAMPAIGN_COMPARE_SCHEMA;
  generatedAt: string;
  a: CampaignCompareSide;
  b: CampaignCompareSide;
  deltas: {
    meanIdeal: number;
    totalObs: number;
    densifiedCount: number;
    depthScore: number;
    meanLitDepth: number;
  };
  summary: string;
  sharedCids: number[];
  onlyInA: number[];
  onlyInB: number[];
  disclaimer: string;
}

const DISCLAIMER =
  "Campaign compare uses free-public densify metrics only. Not GMP readiness.";

function sideFrom(
  id: string,
  name: string,
  cids: number[],
  dossiers: LiveDossier[]
): CampaignCompareSide {
  const merged = mergeLiveDossiersToCampaignKnowledge(dossiers, cids);
  const ideal = buildCampaignIdealRollup(dossiers, {
    campaignName: name,
    requestedCount: cids.length,
  });
  const brief = buildCampaignScientificBrief(merged, { campaignName: name });
  const litScores = dossiers.map(
    (d) =>
      d.processKnowledge?.metrics.literatureDepthScore ??
      buildLiteratureDepthReport(d).depthScore
  );
  const meanLitDepth = litScores.length
    ? Math.round(litScores.reduce((a, b) => a + b, 0) / litScores.length)
    : 0;

  return {
    id,
    name,
    cids,
    densifiedCount: dossiers.length,
    meanIdeal: ideal.meanScore,
    minIdeal: ideal.minScore,
    maxIdeal: ideal.maxScore,
    totalObs: merged.totalObservations,
    conditionKinds: merged.atlasByKind.length,
    meanLitDepth,
    depthScore: brief.depthScore,
    thinCidCount: ideal.rows.filter((r) => r.score < 40).length,
    crossCidConflicts: brief.crossCidConflicts.length,
    topWeakSections: ideal.systemicGaps.slice(0, 4),
  };
}

export async function compareScienceCampaigns(
  a: ScienceCampaign,
  b: ScienceCampaign
): Promise<CampaignCompareResult> {
  const [dA, dB] = await Promise.all([
    loadCampaignDossiers(a.cids),
    loadCampaignDossiers(b.cids),
  ]);
  const sideA = sideFrom(a.id, a.name, a.cids, dA);
  const sideB = sideFrom(b.id, b.name, b.cids, dB);
  const setA = new Set(a.cids);
  const setB = new Set(b.cids);
  const sharedCids = a.cids.filter((c) => setB.has(c));
  const onlyInA = a.cids.filter((c) => !setB.has(c));
  const onlyInB = b.cids.filter((c) => !setA.has(c));

  const deltas = {
    meanIdeal: sideA.meanIdeal - sideB.meanIdeal,
    totalObs: sideA.totalObs - sideB.totalObs,
    densifiedCount: sideA.densifiedCount - sideB.densifiedCount,
    depthScore: sideA.depthScore - sideB.depthScore,
    meanLitDepth: sideA.meanLitDepth - sideB.meanLitDepth,
  };

  const summary = `Compare “${a.name}” vs “${b.name}” · ideal Δ ${
    deltas.meanIdeal > 0 ? "+" : ""
  }${deltas.meanIdeal} · obs Δ ${deltas.totalObs > 0 ? "+" : ""}${deltas.totalObs} · shared CIDs ${sharedCids.length}`;

  return {
    schema: CAMPAIGN_COMPARE_SCHEMA,
    generatedAt: new Date().toISOString(),
    a: sideA,
    b: sideB,
    deltas,
    summary,
    sharedCids,
    onlyInA,
    onlyInB,
    disclaimer: DISCLAIMER,
  };
}
