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

const AI_SCORE_THRESHOLD = 22;

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

  score = Math.min(100, Math.round(score));

  const confidence: EvidenceConfidence =
    score >= 55 ? "high" : score >= 30 ? "medium" : "low";

  // AI only when identity + (process lit/patents OR fact density OR rich mfg)
  const shouldSynthesize =
    Boolean(ev.identity) &&
    (score >= AI_SCORE_THRESHOLD ||
      processLit.length > 0 ||
      processPatents.length > 0 ||
      condN >= 2 ||
      (mfg.length >= 2 && unitN >= 1));

  const preferFastModel =
    score < 45 ||
    !bundle.productionBriefEligible ||
    processLit.length + processPatents.length < 2;

  if (!shouldSynthesize) {
    reasons.push("Evidence below synthesis threshold — skip AI invention");
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
    litSources.size
      ? `Literature APIs: ${[...litSources].join(", ")}`
      : "Literature APIs: none",
  ];

  const aiRecommendation = !shouldSynthesize
    ? "AI synthesis not recommended — thin process-fact density (avoids invented plant conditions)."
    : preferFastModel
      ? "AI may structure evidence on a draft model; uncited numbers will be stripped."
      : "AI recommended to assemble dual-view from sourced process facts (full model).";

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
