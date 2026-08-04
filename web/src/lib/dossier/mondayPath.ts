/**
 * Monday path helpers — progressive disclosure + densify-first CTAs.
 * Free-public only; never invents plant numbers.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import {
  buildAiGuidancePackage,
  type DensifyNextAction,
} from "@/lib/frontier/aiGuidancePackage";
import type { WorkerRole } from "@/lib/worker/roleMode";

export type MondayPathState = {
  thin: boolean;
  score: number;
  ideal: number;
  facts: number;
  mode: string;
  framing?: string;
  ingestScore: number;
  densifyNext: DensifyNextAction[];
  highDensify: DensifyNextAction[];
  /** Collapse frontier science lab behind details */
  collapseScienceLab: boolean;
  /** Prefer MSAT outcome sections first */
  mondayPrimary: boolean;
};

export function assessMondayPath(
  dossier: LiveDossier,
  role: WorkerRole = "msat"
): MondayPathState {
  const score = dossier.evidenceScore?.score ?? 0;
  const ideal = dossier.idealParity?.score ?? 0;
  const facts =
    dossier.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ??
    0;
  const mode =
    dossier.productMode || dossier.recipeReadiness?.mode || "scout-dossier";
  const framing = dossier.processFraming;
  const thin =
    mode === "scout-dossier" ||
    framing === "evidence-lead-pack" ||
    score < 50 ||
    ideal < 55 ||
    facts < 3;

  const guidance = buildAiGuidancePackage(dossier);
  const densifyNext = guidance.densifyNext || [];
  const highDensify = densifyNext.filter((a) => a.priority === "high");

  // Science lab: always collapse when thin; for operator always collapse;
  // for msat/manager collapse unless ideal is strong
  const collapseScienceLab =
    role === "operator" ||
    thin ||
    (role !== "chemist" && ideal < 70);

  return {
    thin,
    score,
    ideal,
    facts,
    mode,
    framing,
    ingestScore: guidance.ingestScore,
    densifyNext,
    highDensify,
    collapseScienceLab,
    mondayPrimary: role === "operator" || role === "msat" || role === "manager",
  };
}
