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

export const CAMPAIGN_KNOWLEDGE_SCHEMA =
  "chemistry-recipes.campaign-knowledge.v1" as const;

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
}

const DISCLAIMER =
  "Campaign process-knowledge from free-public densify only. " +
  "Not GMP, not a validated multi-product process package. " +
  "Condition distributions and edges are research structures with quotes where available.";

/**
 * Build exportable campaign knowledge from IndexedDB caches.
 */
export async function buildCampaignKnowledgeExport(
  campaign: ScienceCampaign
): Promise<CampaignKnowledgeExport> {
  const merged = await buildMergedCampaignKnowledge(
    campaign.cids,
    campaign.labels
  );
  const packages = merged.dossiers.map(
    (d) => d.processKnowledge || buildProcessKnowledgePackage(d)
  );

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
