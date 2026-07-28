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
import type { EvidenceAnswer, NextExperiment } from "@/lib/frontier/types";
import { suggestEdgePairs, compareNetworkEdges } from "@/lib/frontier/edgeCompare";

export interface CampaignAgentStep {
  id: string;
  role: "retrieve" | "merge" | "cite" | "refuse" | "edge";
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
}

function campaignBlob(merged: MergedCampaignKnowledge): string {
  const parts: string[] = [merged.summary];
  for (const s of merged.statuses) {
    parts.push(
      `CID ${s.cid} ${s.name || ""} cached=${s.cached} evid=${s.evidenceScore ?? "—"} atlas=${s.observationCount ?? 0}`
    );
  }
  for (const d of merged.atlasByKind) {
    parts.push(d.summary);
    for (const o of d.observations.slice(0, 4)) {
      parts.push(`QUOTE [${o.sourceLabel}]: ${o.quote}`);
    }
  }
  for (const e of merged.network.edges.slice(0, 20)) {
    parts.push(
      `EDGE ${e.relation} str=${e.strength}: ${e.evidence.join(" | ")}`
    );
  }
  for (const d of merged.dossiers) {
    parts.push(
      d.identity?.name || `CID ${d.cid}`,
      d.synthesis.overview || "",
      ...(d.processFacts?.facts || [])
        .filter((f) => f.kind !== "open-gap")
        .slice(0, 8)
        .map((f) => f.claim + " " + (f.quote || ""))
    );
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
          label: `CID? ${o.sourceLabel}`,
          url: o.sourceUrl,
          quote: o.quote.slice(0, 160),
        });
      }
      if (cites.length >= 8) return cites;
    }
  }
  for (const dossier of merged.dossiers) {
    for (const h of (dossier.literature || []).slice(0, 5)) {
      const hay = `${h.title} ${h.abstract || ""}`.toLowerCase();
      if (tokens.some((t) => hay.includes(t))) {
        cites.push({
          label: `${dossier.identity?.name || dossier.cid}: ${h.title.slice(0, 50)}`,
          url: h.url,
          quote: (h.abstract || "").slice(0, 140),
        });
      }
      if (cites.length >= 8) break;
    }
  }
  return cites.slice(0, 8);
}

/**
 * Answer a scientist question against cached campaign knowledge only.
 */
export async function runCampaignAgent(
  campaign: ScienceCampaign,
  question: string
): Promise<CampaignAgentResult> {
  const steps: CampaignAgentStep[] = [];
  const q = question.trim();

  steps.push({
    id: "s1",
    role: "retrieve",
    detail: `Campaign “${campaign.name}” · ${campaign.cids.length} CID(s)`,
  });

  const merged = await buildMergedCampaignKnowledge(
    campaign.cids,
    campaign.labels
  );
  steps.push({
    id: "s2",
    role: "merge",
    detail: merged.summary,
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

  if (merged.cachedCount === 0) {
    return {
      schema: "chemistry-recipes.campaign-agent.v1",
      campaignId: campaign.id,
      campaignName: campaign.name,
      question: q,
      answer: {
        id: `camp:${Date.now()}`,
        question: q,
        answer:
          "Insufficient free-public evidence: no campaign CIDs are cached yet. Run stream densify on the campaign, then re-ask.",
        grounded: false,
        citations: [],
        insufficientEvidence: true,
      },
      steps: [
        ...steps,
        {
          id: "s3",
          role: "refuse",
          detail: "Zero cached dossiers — refused to invent",
        },
      ],
      nextExperiments: [
        {
          id: "exp:camp:densify",
          question: "Stream densify all campaign CIDs from free-public APIs",
          rationale: "Campaign agent has no package to ground answers",
          gap: "Empty cache",
          priority: "high",
        },
        ...edgeExps,
      ],
      metrics: {
        cachedCount: 0,
        requestedCount: campaign.cids.length,
        totalObservations: 0,
        networkNodes: 0,
        networkEdges: 0,
      },
    };
  }

  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9°%]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 14);
  const blob = campaignBlob(merged);
  const hasHit = tokens.some((t) => blob.includes(t));
  const citations = findQuotes(merged, tokens);

  // Edge-focused questions
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
        return {
          schema: "chemistry-recipes.campaign-agent.v1",
          campaignId: campaign.id,
          campaignName: campaign.name,
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
          metrics: {
            cachedCount: merged.cachedCount,
            requestedCount: campaign.cids.length,
            totalObservations: merged.totalObservations,
            networkNodes: merged.network.nodes.length,
            networkEdges: merged.network.edges.length,
          },
        };
      }
    }
  }

  // Condition atlas summary
  if (/temp|condition|atlas|°c|pressure|solvent/i.test(q)) {
    const lines = merged.atlasByKind.map((d) => `• ${d.summary}`);
    if (lines.length) {
      steps.push({
        id: "s3",
        role: "cite",
        detail: "Answered from campaign-merged condition atlas",
      });
      return {
        schema: "chemistry-recipes.campaign-agent.v1",
        campaignId: campaign.id,
        campaignName: campaign.name,
        question: q,
        answer: {
          id: `camp:atlas:${Date.now()}`,
          question: q,
          answer: `Campaign-merged condition space (${merged.totalObservations} obs across ${merged.cachedCount} cached CID(s)):\n${lines.join("\n")}`,
          grounded: true,
          citations: findQuotes(merged, ["°c", "temp", "solvent", ...tokens]),
          insufficientEvidence: merged.totalObservations < 2,
        },
        steps,
        nextExperiments: edgeExps,
        metrics: {
          cachedCount: merged.cachedCount,
          requestedCount: campaign.cids.length,
          totalObservations: merged.totalObservations,
          networkNodes: merged.network.nodes.length,
          networkEdges: merged.network.edges.length,
        },
      };
    }
  }

  if (!hasHit || citations.length === 0) {
    steps.push({
      id: "s3",
      role: "refuse",
      detail: "No token hits in campaign package — refused to invent",
    });
    return {
      schema: "chemistry-recipes.campaign-agent.v1",
      campaignId: campaign.id,
      campaignName: campaign.name,
      question: q,
      answer: {
        id: `camp:${Date.now()}`,
        question: q,
        answer:
          "Insufficient free-public evidence in the cached campaign package for this question. Densify more CIDs, paste public procedure text, or narrow the question to temperatures, edges, impurities, or network relations.",
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
      metrics: {
        cachedCount: merged.cachedCount,
        requestedCount: campaign.cids.length,
        totalObservations: merged.totalObservations,
        networkNodes: merged.network.nodes.length,
        networkEdges: merged.network.edges.length,
      },
    };
  }

  const quoteLines = citations
    .map((c) => (c.quote ? `“${c.quote}” — ${c.label}` : c.label))
    .slice(0, 5);

  steps.push({
    id: "s3",
    role: "cite",
    detail: `Keyword retrieval · ${citations.length} citation(s)`,
  });

  return {
    schema: "chemistry-recipes.campaign-agent.v1",
    campaignId: campaign.id,
    campaignName: campaign.name,
    question: q,
    answer: {
      id: `camp:${Date.now()}`,
      question: q,
      answer: `Campaign retrieval (not complete scientific answer):\n${quoteLines.join("\n")}\n\nCached ${merged.cachedCount}/${campaign.cids.length} CIDs · ${merged.totalObservations} condition obs. Validate against primary sources.`,
      grounded: true,
      citations,
      insufficientEvidence: citations.length < 2,
    },
    steps,
    nextExperiments: edgeExps,
    metrics: {
      cachedCount: merged.cachedCount,
      requestedCount: campaign.cids.length,
      totalObservations: merged.totalObservations,
      networkNodes: merged.network.nodes.length,
      networkEdges: merged.network.edges.length,
    },
  };
}

/** Prefetch export (ensures packages exist) — used by UI before agent if needed */
export async function ensureCampaignExport(campaign: ScienceCampaign) {
  return buildCampaignKnowledgeExport(campaign);
}
