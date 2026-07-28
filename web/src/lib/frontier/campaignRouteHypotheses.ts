/**
 * Multi-CID shared route hypotheses — unit-op / step patterns that
 * appear across densified campaign dossiers. Research structure only.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { MergedCampaignKnowledge } from "@/lib/frontier/campaignKnowledge";
import type { RouteHypothesis } from "@/lib/frontier/types";
import { buildRouteHypotheses } from "@/lib/frontier/routeHypotheses";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";

export const CAMPAIGN_ROUTE_SCHEMA =
  "chemistry-recipes.campaign-route-hypotheses.v1" as const;

export interface SharedRouteStep {
  /** Normalized unit-op or step title key */
  key: string;
  label: string;
  unitOp?: string;
  /** CIDs where this step appears */
  cids: number[];
  names: string[];
  support: string[];
  n: number;
}

export interface CampaignRouteHypothesis {
  id: string;
  name: string;
  /** How many campaign CIDs contribute */
  coverageCids: number;
  evidenceScore: number;
  status: "shared" | "partial-shared" | "singleton-cluster";
  summary: string;
  sharedSteps: SharedRouteStep[];
  perCidHypotheses: Array<{
    cid: number;
    name?: string;
    hypothesisCount: number;
    topName?: string;
    topScore?: number;
  }>;
  openQuestions: string[];
  killCriteria: string[];
}

export interface CampaignRouteHypothesesPackage {
  schema: typeof CAMPAIGN_ROUTE_SCHEMA;
  generatedAt: string;
  campaignName?: string;
  summary: string;
  sharedSteps: SharedRouteStep[];
  hypotheses: CampaignRouteHypothesis[];
  metrics: {
    dossierCount: number;
    sharedStepCount: number;
    multiCidStepCount: number;
    singletonHypothesisCount: number;
  };
  disclaimer: string;
}

const DISCLAIMER =
  "Campaign route hypotheses are free-public research patterns across CIDs. " +
  "Not a validated multi-product process or plant preference. Not GMP.";

function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

function stepLabel(title: string, unitOp?: string): string {
  if (unitOp && unitOp.length > 2) return unitOp;
  return title.slice(0, 60);
}

/**
 * Find unit-op / step titles shared across campaign dossiers.
 */
export function buildCampaignRouteHypotheses(
  dossiers: LiveDossier[],
  opts?: { campaignName?: string }
): CampaignRouteHypothesesPackage {
  const stepMap = new Map<
    string,
    {
      label: string;
      unitOp?: string;
      cids: Set<number>;
      names: Set<string>;
      support: string[];
    }
  >();

  const perCid: CampaignRouteHypothesis["perCidHypotheses"] = [];

  for (const d of dossiers) {
    const atlas =
      d.processKnowledge?.conditionAtlas || buildConditionAtlas(d);
    const hyps: RouteHypothesis[] =
      d.processKnowledge?.routeHypotheses ||
      buildRouteHypotheses(d, atlas);

    perCid.push({
      cid: d.cid,
      name: d.identity?.name,
      hypothesisCount: hyps.length,
      topName: hyps[0]?.name,
      topScore: hyps[0]?.evidenceScore,
    });

    for (const h of hyps) {
      for (const st of h.steps) {
        const label = stepLabel(st.title || st.summary, st.unitOp);
        const key = normKey(st.unitOp || st.title || st.summary || "");
        if (!key || key.length < 3) continue;
        const row = stepMap.get(key) || {
          label,
          unitOp: st.unitOp,
          cids: new Set<number>(),
          names: new Set<string>(),
          support: [],
        };
        row.cids.add(d.cid);
        if (d.identity?.name) row.names.add(d.identity.name);
        for (const s of st.support.slice(0, 2)) {
          if (row.support.length < 8 && !row.support.includes(s)) {
            row.support.push(s);
          }
        }
        if (!row.unitOp && st.unitOp) row.unitOp = st.unitOp;
        stepMap.set(key, row);
      }
    }

    // Also scan process routes directly for unit-op / mechanism language
    for (const r of d.processRoutes || []) {
      for (const st of r.steps || []) {
        const unitHint = st.mechanismClass || st.workup;
        const label = stepLabel(st.title || "", unitHint);
        const key = normKey(unitHint || st.title || st.description || "");
        if (!key || key.length < 3) continue;
        const row = stepMap.get(key) || {
          label,
          unitOp: unitHint,
          cids: new Set<number>(),
          names: new Set<string>(),
          support: [],
        };
        row.cids.add(d.cid);
        if (d.identity?.name) row.names.add(d.identity.name);
        if (!row.unitOp && unitHint) row.unitOp = unitHint;
        stepMap.set(key, row);
      }
    }
  }

  const sharedSteps: SharedRouteStep[] = [...stepMap.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      unitOp: v.unitOp,
      cids: [...v.cids],
      names: [...v.names],
      support: v.support,
      n: v.cids.size,
    }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));

  const multi = sharedSteps.filter((s) => s.n >= 2);
  const hypotheses: CampaignRouteHypothesis[] = [];

  if (multi.length >= 2) {
    const cover = new Set(multi.flatMap((s) => s.cids));
    hypotheses.push({
      id: "camp-route:shared-core",
      name: "Shared multi-CID unit-op core",
      coverageCids: cover.size,
      evidenceScore: Math.min(
        90,
        30 + multi.length * 8 + cover.size * 10
      ),
      status: cover.size >= Math.max(2, Math.floor(dossiers.length / 2))
        ? "shared"
        : "partial-shared",
      summary: `${multi.length} unit-op/step pattern(s) appear on ≥2 campaign CIDs (${[...cover].join(", ")}). Research co-occurrence only — not a single process train.`,
      sharedSteps: multi.slice(0, 12),
      perCidHypotheses: perCid,
      openQuestions: [
        "Do shared unit ops reflect analogous chemistry or only vocabulary overlap in free-public text?",
        "Which shared steps have sourced numeric conditions on each CID?",
      ],
      killCriteria: [
        "Primary sources show the shared label is a false synonym (different unit ops)",
        "No free-public procedure text supports the shared step on majority of CIDs",
      ],
    });
  }

  // Cluster singleton-heavy dossiers
  const thin = perCid.filter((p) => (p.hypothesisCount || 0) <= 1);
  if (thin.length && dossiers.length >= 2) {
    hypotheses.push({
      id: "camp-route:thin-cluster",
      name: "Thin route-hypothesis CIDs",
      coverageCids: thin.length,
      evidenceScore: 20,
      status: "singleton-cluster",
      summary: `${thin.length} CID(s) have ≤1 route hypothesis — densify procedure text or paste public examples to deepen.`,
      sharedSteps: sharedSteps.filter((s) =>
        s.cids.some((c) => thin.some((t) => t.cid === c))
      ).slice(0, 8),
      perCidHypotheses: thin,
      openQuestions: [
        "Which thin CIDs need OA literature densify vs patent procedure windows?",
      ],
      killCriteria: [
        "After densify, each CID has ≥2 evidence-backed hypotheses",
      ],
    });
  }

  const summary =
    dossiers.length === 0
      ? "No densified dossiers — cannot build campaign route hypotheses"
      : `Campaign routes · ${multi.length} multi-CID step(s) · ${sharedSteps.length} unique step keys · ${hypotheses.length} hypothesis package(s)`;

  return {
    schema: CAMPAIGN_ROUTE_SCHEMA,
    generatedAt: new Date().toISOString(),
    campaignName: opts?.campaignName,
    summary,
    sharedSteps: sharedSteps.slice(0, 40),
    hypotheses,
    metrics: {
      dossierCount: dossiers.length,
      sharedStepCount: sharedSteps.length,
      multiCidStepCount: multi.length,
      singletonHypothesisCount: thin.length,
    },
    disclaimer: DISCLAIMER,
  };
}

export function buildCampaignRouteHypothesesFromMerged(
  merged: MergedCampaignKnowledge,
  campaignName?: string
): CampaignRouteHypothesesPackage {
  return buildCampaignRouteHypotheses(merged.dossiers, { campaignName });
}
