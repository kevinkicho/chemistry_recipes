/**
 * Default MSAT journey: problem → campaign → densify → brief + agent handoff.
 * Free-public only; local-first campaigns.
 */

import type { ProblemSearchHit } from "@/lib/search/problemFirst";
import type { LiteratureHit } from "@/lib/api/europePmc";
import {
  createCampaignAndDensifyFromProblemHits,
  type ProblemCampaignDensifyResult,
} from "@/lib/search/problemCampaign";
import { setCampaignAgentHandoff } from "@/lib/workspace/campaigns";
import { routes } from "@/lib/routes";
import {
  expandCampaignWithRouteNeighborhood,
} from "@/lib/frontier/routeNeighborhood";

export type MsatJourneyResult = ProblemCampaignDensifyResult & {
  agentQuestion: string;
  workspaceHref: string;
  neighborhoodExpanded: number;
};

/**
 * Full MSAT path from problem hits: densify CIDs, expand impurity/route
 * neighborhood once, hand off to Workspace brief + campaign agent.
 */
export async function runMsatJourney(
  query: string,
  hits: ProblemSearchHit[],
  opts?: {
    literatureHits?: LiteratureHit[];
    concurrency?: number;
    force?: boolean;
    signal?: AbortSignal;
    onProgress?: (msg: string) => void;
    /** Expand impurity/intermediate neighbors after first densify (default true) */
    expandNeighborhood?: boolean;
  }
): Promise<MsatJourneyResult | null> {
  const agentQ = `What free-public process conditions and unit-op evidence appear for “${query.trim()}” across this campaign? Any edge conflicts or impurity leads?`;

  opts?.onProgress?.("MSAT journey · spin campaign + densify…");
  let res = await createCampaignAndDensifyFromProblemHits(query, hits, {
    concurrency: opts?.concurrency ?? 2,
    force: opts?.force,
    literatureHits: opts?.literatureHits,
    signal: opts?.signal,
    onProgress: opts?.onProgress,
  });
  if (!res) return null;
  if (opts?.signal?.aborted || res.densify.error === "aborted") {
    return null;
  }

  let neighborhoodExpanded = 0;
  if (opts?.expandNeighborhood !== false && !opts?.signal?.aborted) {
    opts?.onProgress?.("MSAT journey · impurity / route neighborhood densify…");
    const expanded = await expandCampaignWithRouteNeighborhood(res.campaign, {
      maxNew: 6,
      concurrency: opts?.concurrency ?? 2,
      signal: opts?.signal,
      onProgress: opts?.onProgress,
    });
    if (expanded) {
      res = {
        ...res,
        campaign: expanded.campaign,
        densify: expanded.densify,
        queueCids: [
          ...new Set([...res.queueCids, ...expanded.addedCids]),
        ],
      };
      neighborhoodExpanded = expanded.addedCids.length;
    }
  }

  setCampaignAgentHandoff({
    campaignId: res.campaign.id,
    question: agentQ,
    autoRun: true,
    openBrief: true,
    problemQuery: query.trim(),
    literatureAttached: res.literatureAttached,
  });

  const workspaceHref = routes.workspace({
    campaign: res.campaign.id,
    agent: true,
    brief: true,
    q: agentQ,
  });

  return {
    ...res,
    agentQuestion: agentQ,
    workspaceHref,
    neighborhoodExpanded,
  };
}
