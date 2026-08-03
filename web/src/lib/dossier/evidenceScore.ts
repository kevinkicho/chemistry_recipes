/**
 * Score free-public evidence richness for AI / confidence decisions.
 * Weights process-fact density so thin abstracts don't unlock invented plant routes.
 */

import { filterUsefulTexts, looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";
import { extractProcessFacts } from "@/lib/dossier/processFacts";
import type { CompoundEvidence } from "@/lib/dossier/types";

export type EvidenceConfidence = "low" | "medium" | "high";

export interface EvidenceScore {
  /** 0–100 */
  score: number;
  confidence: EvidenceConfidence;
  /** Recommend running full Ollama synthesis */
  shouldSynthesize: boolean;
  /** Prefer faster draft model */
  preferFastModel: boolean;
  reasons: string[];
  processLitCount: number;
  processPatentCount: number;
  usefulMfgCount: number;
  hazardCount: number;
  processFactConditions?: number;
  unitOpFacts?: number;
  productionBriefEligible?: boolean;
  /** Short human lines for EvidenceScoreExplainer UI */
  explainer?: string[];
  /** Plain-language AI run recommendation */
  aiRecommendation?: string;
}

/** Soft floor — product mode is AI-integral; identity + any multi-source signal unlocks synthesis. */
const AI_SCORE_THRESHOLD = 12;
/** Prefer densified procedure body before unlocking full dual-view AI */
const PROC_DENSITY_SOFT = 400;
const PROC_DENSITY_STRONG = 800;

export function scoreCompoundEvidence(ev: CompoundEvidence): EvidenceScore {
  const reasons: string[] = [];
  let score = 0;

  if (ev.identity) {
    score += 10;
    reasons.push("PubChem identity resolved");
  }

  const mfg = filterUsefulTexts(ev.view?.manufacturingTexts ?? []);
  const desc = filterUsefulTexts(ev.view?.descriptionTexts ?? []);
  const props = filterUsefulTexts(ev.view?.propertyTexts ?? []);
  score += Math.min(12, mfg.length * 3);
  score += Math.min(5, desc.length * 2);
  score += Math.min(4, props.length);
  if (mfg.length) reasons.push(`${mfg.length} useful manufacturing/use excerpt(s)`);

  const hazards = ev.view?.hazards.hazardStatements?.length ?? 0;
  score += Math.min(10, hazards * 2);
  if (hazards) reasons.push(`${hazards} GHS hazard statement(s)`);

  // Non-PubChem free APIs (ChEMBL, openFDA, KEGG, RxNorm, MyChem, …)
  const ann = ev.annotations ?? [];
  const annSources = new Set(ann.map((a) => a.source));
  score += Math.min(14, annSources.size * 3);
  if (annSources.size) {
    reasons.push(
      `${annSources.size} non-PubChem API source(s): ${[...annSources].slice(0, 5).join(", ")}`
    );
  }
  if (ann.some((a) => a.kind === "regulatory")) score += 3;
  if (ann.some((a) => a.kind === "mechanism")) score += 3;
  if (ann.some((a) => a.kind === "pathway")) score += 2;

  const processLit = ev.literature.filter((h) =>
    looksLikeProcessLiterature(h.title, h.abstract)
  );
  const processPatents = ev.patents.filter((p) =>
    looksLikeProcessLiterature(p.title, p.abstract)
  );
  score += Math.min(20, processLit.length * 4);
  score += Math.min(16, processPatents.length * 4);
  if (processLit.length) reasons.push(`${processLit.length} process-oriented paper(s)`);
  if (processPatents.length) reasons.push(`${processPatents.length} process-oriented patent hit(s)`);

  // Process fact atoms (accuracy layer) — dominant signal for production-usable density
  const bundle = ev.processFacts ?? extractProcessFacts(ev);
  const condN = bundle.sourcedConditionCount;
  const unitN = bundle.unitOpCount;
  score += Math.min(22, condN * 4 + unitN * 3);
  if (condN || unitN) {
    reasons.push(
      `Process facts: ${condN} sourced condition(s), ${unitN} unit-op cue(s)${
        bundle.productionBriefEligible ? " · production-brief eligible" : " · thin density"
      }`
    );
  }

  // Literature diversity (Europe PMC + OpenAlex + Crossref)
  const litSources = new Set(ev.literature.map((h) => h.source));
  if (litSources.size >= 2) {
    score += 4;
    reasons.push(`Literature from ${litSources.size} APIs (${[...litSources].join(", ")})`);
  }

  if (ev.literature.some((h) => h.abstract && h.abstract.length > 200)) {
    score += 3;
  }

  // Densified procedure windows (OA full text, patents, OrgSyn) — agentic signal
  const proc = ev.procedureExcerpts || [];
  const procChars = proc.reduce((n, p) => n + (p.chars || p.text.length), 0);
  const oaLit = ev.literature.filter((h) => (h.fullTextExcerpt?.length || 0) >= 80);
  const patProc = ev.patents.filter(
    (p) => (p.procedureExcerpt?.length || 0) >= 80
  );
  score += Math.min(16, Math.floor(procChars / 400) + proc.length * 2);
  score += Math.min(6, oaLit.length * 2);
  score += Math.min(6, patProc.length * 2);
  if (procChars >= 800 || proc.length >= 3) {
    reasons.push(
      `Procedure densify: ${proc.length} excerpt(s) · ~${procChars} chars · ${oaLit.length} OA · ${patProc.length} patent windows`
    );
  }

  score = Math.min(100, Math.round(score));

  const confidence: EvidenceConfidence =
    score >= 55 ? "high" : score >= 30 ? "medium" : "low";

  // Procedure-density gate: thin abstract-only hits should not unlock AI invention.
  // Require identity + at least one densified process signal.
  const hasProcessSignal =
    processLit.length > 0 ||
    processPatents.length > 0 ||
    condN >= 2 ||
    procChars >= PROC_DENSITY_SOFT ||
    (mfg.length >= 2 && unitN >= 1);

  const hasProcedureDensity =
    procChars >= PROC_DENSITY_SOFT ||
    condN >= 2 ||
    proc.length >= 2 ||
    oaLit.length + patProc.length >= 1 ||
    (processLit.length + processPatents.length >= 2 && mfg.length >= 1);

  // AI is integral: run whenever identity resolved and any free-public signal exists.
  // Thin densify still allowed — quality gate strips uncited plant numbers.
  const multiSignal =
    processLit.length +
      processPatents.length +
      mfg.length +
      proc.length +
      (ev.annotations?.length || 0) +
      (ev.literature?.length || 0) +
      (ev.patents?.length || 0) >
    0;

  const shouldSynthesize =
    Boolean(ev.identity) &&
    (hasProcessSignal ||
      hasProcedureDensity ||
      multiSignal ||
      score >= AI_SCORE_THRESHOLD);

  // Prefer full model when densify + facts support high-value agentic structure
  const denseForFullModel =
    bundle.productionBriefEligible ||
    (condN >= 3 && unitN >= 2) ||
    procChars >= 2000 ||
    (proc.length >= 5 && processLit.length + processPatents.length >= 2) ||
    (procChars >= PROC_DENSITY_STRONG && condN >= 2);

  const preferFastModel =
    !denseForFullModel &&
    (score < 45 ||
      !bundle.productionBriefEligible ||
      processLit.length + processPatents.length < 2 ||
      procChars < PROC_DENSITY_STRONG);

  if (!shouldSynthesize) {
    reasons.push(
      "No identity/multi-source signal — AI synthesis deferred until free-public harvest returns data"
    );
  } else if (procChars < PROC_DENSITY_STRONG && !bundle.productionBriefEligible) {
    reasons.push(
      `AI-integral path · procedure density soft (${procChars} chars) — draft model preferred; uncited numbers stripped`
    );
  } else {
    reasons.push(
      "AI-integral path · densified free-public package supports dual-view structure"
    );
  }

  const explainer = [
    `Score ${score}/100 (${confidence})`,
    ev.identity ? "Identity: PubChem resolved" : "Identity: missing",
    `Manufacturing excerpts: ${mfg.length}`,
    `GHS statements: ${hazards}`,
    `Process facts: ${condN} conditions · ${unitN} unit ops · brief ${
      bundle.productionBriefEligible ? "eligible" : "not eligible"
    }`,
    `Non-PubChem API sources: ${annSources.size}${
      annSources.size ? ` (${[...annSources].slice(0, 6).join(", ")})` : ""
    }`,
    `Process literature: ${processLit.length} · process patents: ${processPatents.length}`,
    `Procedure densify: ${proc.length} excerpts · ~${procChars} chars`,
    litSources.size
      ? `Literature APIs: ${[...litSources].join(", ")}`
      : "Literature APIs: none",
    "Product mode: AI dual-view is integral (structures densified public evidence only)",
  ];

  const aiRecommendation = !shouldSynthesize
    ? "AI waiting for free-public harvest — dual-view runs as soon as identity + multi-source data arrive."
    : preferFastModel
      ? "AI dual-view (draft model) — structures densified public evidence; uncited plant numbers stripped."
      : "AI dual-view (full model) — densified procedure excerpts + process facts drive manufacturing/mechanism views.";

  return {
    score,
    confidence,
    shouldSynthesize,
    preferFastModel,
    reasons,
    processLitCount: processLit.length,
    processPatentCount: processPatents.length,
    usefulMfgCount: mfg.length,
    hazardCount: hazards,
    processFactConditions: condN,
    unitOpFacts: unitN,
    productionBriefEligible: bundle.productionBriefEligible,
    explainer,
    aiRecommendation,
  };
}
