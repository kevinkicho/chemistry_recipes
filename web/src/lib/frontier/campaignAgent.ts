/**
 * Campaign-level quote-bound science agent over merged multi-CID knowledge.
 * Client or server — no plant invention.
 */

import type { ScienceCampaign } from "@/lib/workspace/campaigns";
import {
  buildMergedCampaignKnowledge,
  type MergedCampaignKnowledge,
} from "@/lib/frontier/campaignKnowledge";
import { buildCampaignKnowledgeExport } from "@/lib/frontier/campaignExport";
import { buildEdgePairExperiments } from "@/lib/frontier/edgeExperiments";
import { buildCampaignScientificBrief } from "@/lib/frontier/campaignBrief";
import type { EvidenceAnswer, NextExperiment } from "@/lib/frontier/types";
import { suggestEdgePairs, compareNetworkEdges } from "@/lib/frontier/edgeCompare";
import { buildCampaignAiGuidanceFromMerged } from "@/lib/frontier/campaignAiGuidance";

export interface CampaignAgentStep {
  id: string;
  role: "retrieve" | "merge" | "cite" | "refuse" | "edge" | "densify";
  detail: string;
}

export interface CampaignAgentResult {
  schema: "chemistry-recipes.campaign-agent.v1";
  campaignId: string;
  campaignName: string;
  question: string;
  answer: EvidenceAnswer;
  steps: CampaignAgentStep[];
  nextExperiments: NextExperiment[];
  metrics: {
    cachedCount: number;
    requestedCount: number;
    totalObservations: number;
    networkNodes: number;
    networkEdges: number;
  };
  /** Mean AI ingest readiness across cached CIDs */
  meanIngestScore?: number;
  /** CIDs recommended for densify queue */
  densifyQueueCids?: number[];
}

/**
 * Dense multi-CID text for token retrieval — process atoms + procedure
 * windows first (AI ingest), not UI previews.
 */
function campaignBlob(merged: MergedCampaignKnowledge): string {
  const parts: string[] = [merged.summary];
  for (const s of merged.statuses) {
    parts.push(
      `CID ${s.cid} ${s.name || ""} cached=${s.cached} evid=${s.evidenceScore ?? "—"} atlas=${s.observationCount ?? 0}`
    );
  }
  for (const d of merged.atlasByKind) {
    parts.push(d.summary);
    for (const o of d.observations.slice(0, 6)) {
      parts.push(`QUOTE [${o.sourceLabel}]: ${o.quote}`);
    }
  }
  for (const e of merged.network.edges.slice(0, 24)) {
    parts.push(
      `EDGE ${e.relation} str=${e.strength}: ${e.evidence.join(" | ")}`
    );
  }
  for (const d of merged.dossiers) {
    parts.push(
      d.identity?.name || `CID ${d.cid}`,
      d.synthesis.overview || ""
    );
    // Prefer densify harvest windows for multi-source guidance
    for (const pe of (d.procedureExcerpts || []).slice(0, 6)) {
      parts.push(
        `PROC [${pe.source}] ${pe.label}: ${(pe.text || "").slice(0, 900)}`
      );
    }
    for (const f of (d.processFacts?.facts || [])
      .filter((x) => x.kind !== "open-gap")
      .slice(0, 16)) {
      parts.push(
        `ATOM ${f.kind} ${f.claim} ${f.value || ""} ${f.unit || ""} ${f.quote || ""} ${f.sourceLabel}`
      );
    }
    for (const h of (d.literature || []).slice(0, 4)) {
      const body = h.fullTextExcerpt || h.abstract || "";
      if (body.length >= 80) {
        parts.push(`LIT ${h.title}: ${body.slice(0, 500)}`);
      }
    }
    for (const p of (d.patents || []).slice(0, 4)) {
      const body = p.procedureExcerpt || p.abstract || "";
      if (body.length >= 80) {
        parts.push(`PAT ${p.patentNumber || p.title}: ${body.slice(0, 500)}`);
      }
    }
  }
  return parts.join("\n").toLowerCase();
}

function findQuotes(
  merged: MergedCampaignKnowledge,
  tokens: string[]
): EvidenceAnswer["citations"] {
  const cites: EvidenceAnswer["citations"] = [];
  for (const d of merged.atlasByKind) {
    for (const o of d.observations) {
      const hay = `${o.quote} ${o.raw} ${o.sourceLabel}`.toLowerCase();
      if (tokens.some((t) => t.length >= 3 && hay.includes(t))) {
        cites.push({
          label: o.sourceLabel,
          url: o.sourceUrl,
          quote: o.quote.slice(0, 160),
        });
      }
      if (cites.length >= 8) return cites;
    }
  }
  // Densify harvest + process atoms before thin lit titles
  for (const dossier of merged.dossiers) {
    const name = dossier.identity?.name || `CID ${dossier.cid}`;
    for (const pe of dossier.procedureExcerpts || []) {
      const hay = `${pe.label} ${pe.text || ""}`.toLowerCase();
      if (tokens.some((t) => t.length >= 3 && hay.includes(t))) {
        cites.push({
          label: `${name}: ${pe.label.slice(0, 50)}`,
          url: pe.url,
          quote: (pe.text || "").slice(0, 160),
        });
      }
      if (cites.length >= 8) return cites;
    }
    for (const f of dossier.processFacts?.facts || []) {
      if (f.kind === "open-gap") continue;
      const hay = `${f.claim} ${f.quote || ""} ${f.value || ""}`.toLowerCase();
      if (tokens.some((t) => t.length >= 3 && hay.includes(t))) {
        cites.push({
          label: `${name}: ${f.sourceLabel}`,
          url: f.sourceUrl,
          quote: (f.quote || f.claim).slice(0, 160),
        });
      }
      if (cites.length >= 8) return cites;
    }
    for (const h of (dossier.literature || []).slice(0, 6)) {
      const hay = `${h.title} ${h.fullTextExcerpt || ""} ${h.abstract || ""}`.toLowerCase();
      if (tokens.some((t) => hay.includes(t))) {
        cites.push({
          label: `${name}: ${h.title.slice(0, 50)}`,
          url: h.url,
          quote: (h.fullTextExcerpt || h.abstract || "").slice(0, 140),
        });
      }
      if (cites.length >= 8) break;
    }
  }
  return cites.slice(0, 8);
}

function metricsOf(
  merged: MergedCampaignKnowledge,
  requestedCount: number
): CampaignAgentResult["metrics"] {
  return {
    cachedCount: merged.cachedCount,
    requestedCount,
    totalObservations: merged.totalObservations,
    networkNodes: merged.network.nodes.length,
    networkEdges: merged.network.edges.length,
  };
}

/**
 * Core answer logic over already-merged campaign knowledge (server/client).
 */
export function answerCampaignQuestion(
  merged: MergedCampaignKnowledge,
  meta: { campaignId: string; campaignName: string; requestedCount: number },
  question: string,
  priorSteps: CampaignAgentStep[] = []
): CampaignAgentResult {
  const steps = [...priorSteps];
  const q = question.trim();
  const guidance = buildCampaignAiGuidanceFromMerged(merged, {
    id: meta.campaignId,
    name: meta.campaignName,
    cids: merged.cids,
    labels: Object.fromEntries(
      merged.statuses
        .filter((s) => s.label)
        .map((s) => [String(s.cid), s.label!])
    ),
  });
  steps.push({
    id: "s1b",
    role: "retrieve",
    detail: `AI guidance · mean ingest ${guidance.meanIngestScore}/100 · queue ${guidance.densifyQueueCids.length} CID(s)`,
  });
  const edgeExps = buildEdgePairExperiments(
    merged.network,
    merged.dossiers,
    6
  );
  if (edgeExps.length) {
    steps.push({
      id: "s2b",
      role: "edge",
      detail: `${edgeExps.length} edge-pair experiment suggestion(s)`,
    });
  }

  const withGuidance = (
    r: Omit<CampaignAgentResult, "meanIngestScore" | "densifyQueueCids">
  ): CampaignAgentResult => ({
    ...r,
    meanIngestScore: guidance.meanIngestScore,
    densifyQueueCids: guidance.densifyQueueCids,
  });

  if (merged.cachedCount === 0) {
    return withGuidance({
      schema: "chemistry-recipes.campaign-agent.v1",
      campaignId: meta.campaignId,
      campaignName: meta.campaignName,
      question: q,
      answer: {
        id: `camp:${Date.now()}`,
        question: q,
        answer:
          "Insufficient free-public evidence: no campaign CIDs densified yet. Run stream densify, then re-ask.\n\n" +
          guidance.densifyNext
            .slice(0, 3)
            .map((a) => `• [${a.priority}] ${a.title}: ${a.how}`)
            .join("\n"),
        grounded: false,
        citations: [],
        insufficientEvidence: true,
      },
      steps: [
        ...steps,
        {
          id: "s3",
          role: "refuse",
          detail: "Zero dossiers — refused to invent",
        },
      ],
      nextExperiments: [
        {
          id: "exp:camp:densify",
          question: "Stream densify all campaign CIDs from free-public APIs",
          rationale: "Campaign agent has no package to ground answers",
          gap: "Empty densify",
          priority: "high",
        },
        ...edgeExps,
      ],
      metrics: metricsOf(merged, meta.requestedCount),
    });
  }

  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9°%]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 14);
  const blob = campaignBlob(merged);
  const hasHit = tokens.some((t) => blob.includes(t));
  const citations = findQuotes(merged, tokens);

  if (/edge|relation|impurit|starting|network|compare/i.test(q)) {
    const pairs = suggestEdgePairs(merged.network, 3);
    if (pairs[0]) {
      const cmp = compareNetworkEdges(
        merged.network,
        pairs[0].a,
        pairs[0].b,
        merged.dossiers
      );
      if (cmp) {
        steps.push({
          id: "s3",
          role: "cite",
          detail: "Answered from edge evidence compare",
        });
        return withGuidance({
          schema: "chemistry-recipes.campaign-agent.v1",
          campaignId: meta.campaignId,
          campaignName: meta.campaignName,
          question: q,
          answer: {
            id: `camp:edge:${Date.now()}`,
            question: q,
            answer: `${cmp.summary}\n\n${cmp.overlapNotes.map((n) => `• ${n}`).join("\n")}\n\nA evidence: ${cmp.edgeA.evidence.join("; ") || "—"}\nB evidence: ${cmp.edgeB.evidence.join("; ") || "—"}`,
            grounded: true,
            citations: [
              ...cmp.edgeA.evidence.slice(0, 2).map((e) => ({
                label: `A: ${e.slice(0, 60)}`,
              })),
              ...cmp.edgeB.evidence.slice(0, 2).map((e) => ({
                label: `B: ${e.slice(0, 60)}`,
              })),
            ],
            insufficientEvidence:
              !cmp.edgeA.evidence.length && !cmp.edgeB.evidence.length,
          },
          steps,
          nextExperiments: edgeExps,
          metrics: metricsOf(merged, meta.requestedCount),
        });
      }
    }
  }

  if (
    /temp|condition|atlas|°c|pressure|solvent|brief|landscape|conflict|yield|concentrat/i.test(
      q
    )
  ) {
    const brief = buildCampaignScientificBrief(merged, {
      campaignName: meta.campaignName,
    });
    const lines = merged.atlasByKind.map((d) => `• ${d.summary}`);
    if (lines.length || brief.crossCidConflicts.length) {
      steps.push({
        id: "s3",
        role: "cite",
        detail: `Answered from campaign atlas + scientific brief (depth ${brief.depthScore})`,
      });
      const conflictLines = brief.crossCidConflicts
        .slice(0, 4)
        .map(
          (c) =>
            `• CONFLICT ${c.kind}: CID ${c.cidA} ${c.rangeA} vs CID ${c.cidB} ${c.rangeB}`
        );
      const spanLines = brief.crossCidSpans
        .slice(0, 6)
        .map(
          (s) =>
            `• CID ${s.cid} ${s.kind}: ${
              s.min != null && s.max != null
                ? `${s.min}–${s.max}${s.unit ? ` ${s.unit}` : ""}`
                : "—"
            } (n=${s.n})`
        );
      return withGuidance({
        schema: "chemistry-recipes.campaign-agent.v1",
        campaignId: meta.campaignId,
        campaignName: meta.campaignName,
        question: q,
        answer: {
          id: `camp:atlas:${Date.now()}`,
          question: q,
          answer: [
            `Campaign scientific brief · depth ${brief.depthScore}/100 · AI ingest mean ${guidance.meanIngestScore}/100 · ${merged.totalObservations} obs · ${merged.cachedCount} CID(s)`,
            lines.length ? `Condition landscape:\n${lines.join("\n")}` : null,
            spanLines.length
              ? `Per-CID spans:\n${spanLines.join("\n")}`
              : null,
            conflictLines.length
              ? `Cross-CID conflicts:\n${conflictLines.join("\n")}`
              : null,
            brief.openGaps[0] ? `Gap: ${brief.openGaps[0]}` : null,
            "Validate against primary sources. Not GMP.",
          ]
            .filter(Boolean)
            .join("\n\n"),
          grounded: true,
          citations: findQuotes(merged, [
            "°c",
            "temp",
            "solvent",
            "yield",
            ...tokens,
          ]),
          insufficientEvidence: merged.totalObservations < 2,
        },
        steps,
        nextExperiments: [
          ...brief.topExperiments.slice(0, 4),
          ...edgeExps,
        ].slice(0, 10),
        metrics: metricsOf(merged, meta.requestedCount),
      });
    }
  }

  if (!hasHit || citations.length === 0) {
    steps.push({
      id: "s3",
      role: "refuse",
      detail: "No token hits in campaign package — refused to invent",
    });
    const tips = guidance.densifyNext
      .slice(0, 3)
      .map((a) => `• [${a.priority}] ${a.title}: ${a.how}`)
      .join("\n");
    return withGuidance({
      schema: "chemistry-recipes.campaign-agent.v1",
      campaignId: meta.campaignId,
      campaignName: meta.campaignName,
      question: q,
      answer: {
        id: `camp:${Date.now()}`,
        question: q,
        answer:
          "Insufficient free-public evidence in the campaign package for this question. Densify more CIDs, paste public procedure text, or narrow to temperatures, edges, impurities, or network relations." +
          (tips ? `\n\nDensify next:\n${tips}` : ""),
        grounded: false,
        citations: [],
        insufficientEvidence: true,
      },
      steps,
      nextExperiments: [
        ...edgeExps,
        {
          id: "exp:camp:expand",
          question: "Increase densified procedure chars on thin campaign CIDs",
          rationale: "Campaign retrieval returned no grounded hits",
          gap: "Thin multi-CID package",
          priority: "high",
        },
      ],
      metrics: metricsOf(merged, meta.requestedCount),
    });
  }

  const quoteLines = citations
    .map((c) => (c.quote ? `“${c.quote}” — ${c.label}` : c.label))
    .slice(0, 5);

  steps.push({
    id: "s3",
    role: "cite",
    detail: `Keyword retrieval · ${citations.length} citation(s)`,
  });

  return withGuidance({
    schema: "chemistry-recipes.campaign-agent.v1",
    campaignId: meta.campaignId,
    campaignName: meta.campaignName,
    question: q,
    answer: {
      id: `camp:${Date.now()}`,
      question: q,
      answer: `Campaign retrieval (not complete scientific answer):\n${quoteLines.join("\n")}\n\n${merged.cachedCount}/${meta.requestedCount} CIDs · ${merged.totalObservations} condition obs · AI ingest mean ${guidance.meanIngestScore}/100. Validate against primary sources.`,
      grounded: true,
      citations,
      insufficientEvidence: citations.length < 2,
    },
    steps,
    nextExperiments: edgeExps,
    metrics: metricsOf(merged, meta.requestedCount),
  });
}

/**
 * Client path: load IndexedDB campaign caches then answer.
 */
export async function runCampaignAgent(
  campaign: ScienceCampaign,
  question: string
): Promise<CampaignAgentResult> {
  const steps: CampaignAgentStep[] = [
    {
      id: "s1",
      role: "retrieve",
      detail: `Campaign “${campaign.name}” · ${campaign.cids.length} CID(s)`,
    },
  ];

  const merged = await buildMergedCampaignKnowledge(
    campaign.cids,
    campaign.labels
  );
  steps.push({
    id: "s2",
    role: "merge",
    detail: merged.summary,
  });

  return answerCampaignQuestion(
    merged,
    {
      campaignId: campaign.id,
      campaignName: campaign.name,
      requestedCount: campaign.cids.length,
    },
    question,
    steps
  );
}

/** Prefetch export (ensures packages exist) */
export async function ensureCampaignExport(campaign: ScienceCampaign) {
  return buildCampaignKnowledgeExport(campaign);
}
