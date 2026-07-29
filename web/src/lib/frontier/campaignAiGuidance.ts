/**
 * Campaign-level AI guidance — densify-first multi-CID package for agents.
 * Aggregates per-CID ingest scores + densify-next; not full-text previews.
 */

import type { ScienceCampaign } from "@/lib/workspace/campaigns";
import {
  buildMergedCampaignKnowledge,
  thinOrMissingCids,
  type MergedCampaignKnowledge,
} from "@/lib/frontier/campaignKnowledge";
import {
  buildAiGuidancePackage,
  type AiGuidancePackage,
  type DensifyNextAction,
} from "@/lib/frontier/aiGuidancePackage";

export const CAMPAIGN_AI_GUIDANCE_SCHEMA =
  "chemistry-recipes.campaign-ai-guidance.v1" as const;

export interface CampaignCidIngest {
  cid: number;
  name?: string;
  ingestScore: number;
  procedureChars: number;
  processFactConditions: number;
  harvestedExcerpts: number;
  highDensifyCount: number;
  densifyNext: DensifyNextAction[];
}

export interface CampaignAiGuidancePackage {
  schema: typeof CAMPAIGN_AI_GUIDANCE_SCHEMA;
  generatedAt: string;
  disclaimer: string;
  campaign: {
    id: string;
    name: string;
    cids: number[];
    labels: Record<string, string>;
  };
  /** Mean ingest across cached CIDs (0 if none) */
  meanIngestScore: number;
  /** Min ingest among cached — bottleneck for multi-CID guidance */
  minIngestScore: number;
  summary: string;
  perCid: CampaignCidIngest[];
  /** Merged densify-next (campaign-wide + per-CID high actions) */
  densifyNext: DensifyNextAction[];
  /** CIDs to force-regather for best multi-CID package growth */
  densifyQueueCids: number[];
  metrics: {
    cachedCount: number;
    requestedCount: number;
    totalProcedureChars: number;
    totalProcessAtoms: number;
    totalHarvestedExcerpts: number;
    networkEdges: number;
    thinOrMissing: number;
  };
  /** Compact process atoms across CIDs for agent context */
  crossCidAtoms: Array<{
    cid: number;
    name?: string;
    kind: string;
    claim: string;
    value?: string;
    unit?: string;
    quote?: string;
    sourceLabel: string;
  }>;
  /** Top procedure window snippets across campaign (truncated) */
  topWindows: Array<{
    cid: number;
    id: string;
    source: string;
    label: string;
    score: number;
    chars: number;
    text: string;
  }>;
}

const DISCLAIMER =
  "Campaign AI guidance from free-public densify only. Structure multi-CID evidence — " +
  "never invent plant limits, CPPs, or site setpoints. Not GMP.";

/**
 * Build from already-merged campaign knowledge (client or server).
 */
export function buildCampaignAiGuidanceFromMerged(
  merged: MergedCampaignKnowledge,
  campaign: Pick<ScienceCampaign, "id" | "name" | "cids" | "labels">
): CampaignAiGuidancePackage {
  const perCid: CampaignCidIngest[] = [];
  const allWindows: CampaignAiGuidancePackage["topWindows"] = [];
  const crossCidAtoms: CampaignAiGuidancePackage["crossCidAtoms"] = [];
  const densifyNext: DensifyNextAction[] = [];

  let totalProc = 0;
  let totalAtoms = 0;
  let totalEx = 0;
  let sumIngest = 0;
  let minIngest = 100;

  for (const d of merged.dossiers) {
    const g = buildAiGuidancePackage(d);
    perCid.push({
      cid: d.cid,
      name: d.identity?.name || campaign.labels?.[String(d.cid)],
      ingestScore: g.ingestScore,
      procedureChars: g.metrics.procedureChars,
      processFactConditions: g.metrics.processFactConditions,
      harvestedExcerpts: g.metrics.harvestedExcerpts,
      highDensifyCount: g.densifyNext.filter((a) => a.priority === "high").length,
      densifyNext: g.densifyNext,
    });
    sumIngest += g.ingestScore;
    minIngest = Math.min(minIngest, g.ingestScore);
    totalProc += g.metrics.procedureChars;
    totalAtoms += g.metrics.processFactConditions;
    totalEx += g.metrics.harvestedExcerpts;

    for (const w of g.procedureWindows.slice(0, 4)) {
      allWindows.push({
        cid: d.cid,
        id: w.id,
        source: w.source,
        label: w.label,
        score: w.score,
        chars: w.chars,
        text: w.text.slice(0, 1200),
      });
    }
    for (const a of g.processAtoms.slice(0, 10)) {
      crossCidAtoms.push({
        cid: d.cid,
        name: d.identity?.name,
        kind: a.kind,
        claim: a.claim,
        value: a.value,
        unit: a.unit,
        quote: a.quote,
        sourceLabel: a.sourceLabel,
      });
    }
    // Lift high per-CID densify actions with CID tag
    for (const a of g.densifyNext.filter((x) => x.priority === "high").slice(0, 2)) {
      densifyNext.push({
        ...a,
        id: `cid${d.cid}:${a.id}`,
        title: `CID ${d.cid}: ${a.title}`,
        how: `${a.how} (CID ${d.cid})`,
      });
    }
  }

  const thin = thinOrMissingCids(merged.statuses);
  if (thin.length) {
    densifyNext.unshift({
      id: "act:camp:thin",
      kind: "campaign-densify",
      priority: "high",
      title: "Stream densify thin/missing campaign CIDs",
      rationale: `${thin.length} CID(s) missing or thin for multi-CID AI guidance`,
      how: "Campaign graph → Stream densify thin/missing",
      expectedGain: "More per-CID procedure windows + atlas for campaign agent",
    });
  }
  if (merged.cachedCount < campaign.cids.length) {
    densifyNext.push({
      id: "act:camp:all",
      kind: "campaign-densify",
      priority: "medium",
      title: "Densify remaining uncached CIDs",
      rationale: `${merged.cachedCount}/${campaign.cids.length} cached`,
      how: "Campaign graph or batch densify remaining CIDs",
      expectedGain: "Full multi-CID coverage for guidance",
    });
  }

  // Low-ingest cached CIDs also go on the queue
  const lowIngest = perCid
    .filter((p) => p.ingestScore < 45)
    .map((p) => p.cid);
  const densifyQueueCids = [
    ...new Set([...thin, ...lowIngest]),
  ].slice(0, 12);

  densifyNext.sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return p[a.priority] - p[b.priority];
  });

  allWindows.sort((a, b) => b.score - a.score || b.chars - a.chars);
  const n = merged.dossiers.length;
  const meanIngestScore = n ? Math.round(sumIngest / n) : 0;
  if (!n) minIngest = 0;

  const summary =
    `Campaign AI ingest mean ${meanIngestScore}/100 · min ${minIngest} · ` +
    `${merged.cachedCount}/${campaign.cids.length} cached · ` +
    `${totalProc.toLocaleString()} proc chars · ${totalEx} excerpts · ` +
    `${densifyQueueCids.length} densify queue CID(s)`;

  return {
    schema: CAMPAIGN_AI_GUIDANCE_SCHEMA,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      cids: campaign.cids,
      labels: campaign.labels || {},
    },
    meanIngestScore,
    minIngestScore: minIngest,
    summary,
    perCid,
    densifyNext: densifyNext.slice(0, 16),
    densifyQueueCids,
    metrics: {
      cachedCount: merged.cachedCount,
      requestedCount: campaign.cids.length,
      totalProcedureChars: totalProc,
      totalProcessAtoms: totalAtoms,
      totalHarvestedExcerpts: totalEx,
      networkEdges: merged.network.edges.length,
      thinOrMissing: thin.length,
    },
    crossCidAtoms: crossCidAtoms.slice(0, 48),
    topWindows: allWindows.slice(0, 16),
  };
}

export async function buildCampaignAiGuidance(
  campaign: ScienceCampaign
): Promise<CampaignAiGuidancePackage> {
  const merged = await buildMergedCampaignKnowledge(
    campaign.cids,
    campaign.labels
  );
  return buildCampaignAiGuidanceFromMerged(merged, campaign);
}

/** Flatten for model context (quote-bound multi-CID). */
export function formatCampaignAiGuidanceContext(
  g: CampaignAiGuidancePackage,
  maxChars = 36_000
): string {
  const lines: string[] = [
    `CAMPAIGN_AI_GUIDANCE ${g.schema} ${g.campaign.name}`,
    g.summary,
    g.disclaimer,
    "PRIORITY: crossCidAtoms + topWindows only for manufacturing claims.",
    "NEVER invent temperatures, yields, equipment IDs, or plant CPPs.",
  ];
  lines.push("\n## Densify next");
  for (const a of g.densifyNext) {
    lines.push(
      `[${a.priority}] ${a.title}: ${a.rationale} | HOW: ${a.how} | GAIN: ${a.expectedGain}`
    );
  }
  lines.push(`\n## Densify queue CIDs: ${g.densifyQueueCids.join(", ") || "—"}`);
  lines.push("\n## Per-CID ingest");
  for (const p of g.perCid) {
    lines.push(
      `CID ${p.cid} ${p.name || ""} ingest=${p.ingestScore} proc=${p.procedureChars} conditions=${p.processFactConditions} excerpts=${p.harvestedExcerpts}`
    );
  }
  lines.push("\n## Cross-CID process atoms");
  for (const a of g.crossCidAtoms.slice(0, 36)) {
    lines.push(
      `ATOM CID${a.cid} [${a.kind}] ${a.claim}` +
        (a.value ? ` = ${a.value}${a.unit ? " " + a.unit : ""}` : "") +
        (a.quote ? ` QUOTE: ${a.quote}` : "") +
        ` SRC: ${a.sourceLabel}`
    );
  }
  lines.push("\n## Top procedure windows");
  for (const w of g.topWindows.slice(0, 10)) {
    lines.push(
      `WINDOW CID${w.cid} score=${w.score} [${w.source}] ${w.label}\n${w.text.slice(0, 1400)}`
    );
  }
  const blob = lines.join("\n");
  return blob.length > maxChars ? blob.slice(0, maxChars - 1) + "…" : blob;
}

export function downloadCampaignAiGuidance(
  data: CampaignAiGuidancePackage,
  filename?: string
): void {
  const name =
    filename ||
    `campaign-ai-guidance-${data.campaign.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".json") ? name : `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Re-export type for consumers */
export type { AiGuidancePackage };
