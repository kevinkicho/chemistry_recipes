/**
 * Campaign-level process-knowledge export for agents / notebooks.
 */

import type { ScienceCampaign } from "@/lib/workspace/campaigns";
import {
  buildMergedCampaignKnowledge,
  type MergedCampaignKnowledge,
} from "@/lib/frontier/campaignKnowledge";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import type { ProcessKnowledgePackage } from "@/lib/frontier/types";
import type { CampaignAgentResult } from "@/lib/frontier/campaignAgent";
import type { CampaignScientificBrief } from "@/lib/frontier/campaignBrief";
import { buildCampaignScientificBrief } from "@/lib/frontier/campaignBrief";
import type { CampaignRouteHypothesesPackage } from "@/lib/frontier/campaignRouteHypotheses";
import { buildCampaignRouteHypotheses } from "@/lib/frontier/campaignRouteHypotheses";
import type { CampaignIdealRollup } from "@/lib/frontier/campaignIdealRollup";
import { buildCampaignIdealRollup } from "@/lib/frontier/campaignIdealRollup";

export const CAMPAIGN_KNOWLEDGE_SCHEMA =
  "chemistry-recipes.campaign-knowledge.v1" as const;

export const CAMPAIGN_AGENT_RUN_SCHEMA =
  "chemistry-recipes.campaign-agent-run.v1" as const;

export interface CampaignKnowledgeExport {
  schema: typeof CAMPAIGN_KNOWLEDGE_SCHEMA;
  exportedAt: string;
  disclaimer: string;
  campaign: {
    id: string;
    name: string;
    description?: string;
    cids: number[];
    labels: Record<string, string>;
  };
  summary: string;
  statuses: MergedCampaignKnowledge["statuses"];
  network: MergedCampaignKnowledge["network"];
  atlasByKind: MergedCampaignKnowledge["atlasByKind"];
  totalObservations: number;
  /** Per-CID process-knowledge packages (cached only) */
  packages: ProcessKnowledgePackage[];
  metrics: {
    cachedCount: number;
    requestedCount: number;
    networkNodes: number;
    networkEdges: number;
    packageCount: number;
  };
  /** Optional last agent Q&A attached for notebooks */
  agentRun?: {
    schema: typeof CAMPAIGN_AGENT_RUN_SCHEMA;
    question: string;
    answer: CampaignAgentResult["answer"];
    steps: CampaignAgentResult["steps"];
    nextExperiments: CampaignAgentResult["nextExperiments"];
    metrics: CampaignAgentResult["metrics"];
  };
  /** Multi-CID scientific brief (depth, cross-CID conflicts) */
  scientificBrief?: CampaignScientificBrief;
  /** Shared multi-CID route / unit-op hypotheses */
  routeHypotheses?: CampaignRouteHypothesesPackage;
  /** Ideal-page parity rollup across densified CIDs */
  idealRollup?: CampaignIdealRollup;
}

const DISCLAIMER =
  "Campaign process-knowledge from free-public densify only. " +
  "Not GMP, not a validated multi-product process package. " +
  "Condition distributions and edges are research structures with quotes where available.";

/**
 * Build exportable campaign knowledge from IndexedDB caches.
 * Optionally attach a campaign-agent run (question + grounded answer).
 */
export async function buildCampaignKnowledgeExport(
  campaign: ScienceCampaign,
  opts?: { agentResult?: CampaignAgentResult; includeBrief?: boolean }
): Promise<CampaignKnowledgeExport> {
  const merged = await buildMergedCampaignKnowledge(
    campaign.cids,
    campaign.labels
  );
  const packages = merged.dossiers.map((d) => {
    const p = d.processKnowledge || buildProcessKnowledgePackage(d);
    const rest = { ...p };
    delete rest._fp;
    return rest;
  });

  const agent = opts?.agentResult;
  const includeBrief = opts?.includeBrief !== false;
  const scientificBrief = includeBrief
    ? buildCampaignScientificBrief(merged, { campaignName: campaign.name })
    : undefined;
  const routeHypotheses = includeBrief
    ? buildCampaignRouteHypotheses(merged.dossiers, {
        campaignName: campaign.name,
      })
    : undefined;
  const idealRollup = includeBrief
    ? buildCampaignIdealRollup(merged.dossiers, {
        campaignName: campaign.name,
        requestedCount: campaign.cids.length,
      })
    : undefined;

  return {
    schema: CAMPAIGN_KNOWLEDGE_SCHEMA,
    exportedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      cids: campaign.cids,
      labels: campaign.labels,
    },
    summary: merged.summary,
    statuses: merged.statuses,
    network: merged.network,
    atlasByKind: merged.atlasByKind,
    totalObservations: merged.totalObservations,
    packages,
    metrics: {
      cachedCount: merged.cachedCount,
      requestedCount: campaign.cids.length,
      networkNodes: merged.network.nodes.length,
      networkEdges: merged.network.edges.length,
      packageCount: packages.length,
    },
    agentRun: agent
      ? {
          schema: CAMPAIGN_AGENT_RUN_SCHEMA,
          question: agent.question,
          answer: agent.answer,
          steps: agent.steps,
          nextExperiments: agent.nextExperiments,
          metrics: agent.metrics,
        }
      : undefined,
    scientificBrief,
    routeHypotheses,
    idealRollup,
  };
}

export function downloadCampaignKnowledge(
  data: CampaignKnowledgeExport,
  filename?: string
): void {
  const name =
    filename ||
    `campaign-knowledge-${data.campaign.name
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
