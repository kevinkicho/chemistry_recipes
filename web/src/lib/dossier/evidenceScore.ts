/**
 * Score free-public evidence richness for AI / confidence decisions.
 */

import { filterUsefulTexts, looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";
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
  /** Short human lines for EvidenceScoreExplainer UI */
  explainer?: string[];
  /** Plain-language AI run recommendation */
  aiRecommendation?: string;
}

const AI_SCORE_THRESHOLD = 18;

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
  score += Math.min(14, mfg.length * 3);
  score += Math.min(6, desc.length * 2);
  score += Math.min(5, props.length);
  if (mfg.length) reasons.push(`${mfg.length} useful manufacturing/use excerpt(s)`);

  const hazards = ev.view?.hazards.hazardStatements?.length ?? 0;
  score += Math.min(10, hazards * 2);
  if (hazards) reasons.push(`${hazards} GHS hazard statement(s)`);

  // Non-PubChem free APIs (ChEMBL, openFDA, KEGG, RxNorm, MyChem, …)
  const ann = ev.annotations ?? [];
  const annSources = new Set(ann.map((a) => a.source));
  score += Math.min(16, annSources.size * 3);
  if (annSources.size) {
    reasons.push(
      `${annSources.size} non-PubChem API source(s): ${[...annSources].slice(0, 5).join(", ")}`
    );
  }
  if (ann.some((a) => a.kind === "regulatory")) score += 4;
  if (ann.some((a) => a.kind === "mechanism")) score += 4;
  if (ann.some((a) => a.kind === "pathway")) score += 3;

  const processLit = ev.literature.filter((h) =>
    looksLikeProcessLiterature(h.title, h.abstract)
  );
  const processPatents = ev.patents.filter((p) =>
    looksLikeProcessLiterature(p.title, p.abstract)
  );
  score += Math.min(24, processLit.length * 4);
  score += Math.min(14, processPatents.length * 4);
  if (processLit.length) reasons.push(`${processLit.length} process-oriented paper(s)`);
  if (processPatents.length) reasons.push(`${processPatents.length} process-oriented patent hit(s)`);

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

  const shouldSynthesize =
    Boolean(ev.identity) &&
    (score >= AI_SCORE_THRESHOLD ||
      processLit.length > 0 ||
      processPatents.length > 0 ||
      mfg.length >= 2);

  const preferFastModel = score < 40 || (processLit.length + processPatents.length) < 2;

  if (!shouldSynthesize) {
    reasons.push("Evidence below synthesis threshold — skip or short AI run");
  }

  const explainer = [
    `Score ${score}/100 (${confidence})`,
    ev.identity ? "Identity: PubChem resolved" : "Identity: missing",
    `Manufacturing excerpts: ${mfg.length}`,
    `GHS statements: ${hazards}`,
    `Non-PubChem API sources: ${annSources.size}${
      annSources.size ? ` (${[...annSources].slice(0, 6).join(", ")})` : ""
    }`,
    `Process literature: ${processLit.length} · process patents: ${processPatents.length}`,
    litSources.size
      ? `Literature APIs: ${[...litSources].join(", ")}`
      : "Literature APIs: none",
  ];

  const aiRecommendation = !shouldSynthesize
    ? "AI synthesis not recommended — thin process evidence (avoids low-quality invention)."
    : preferFastModel
      ? "AI recommended on fast/draft model (moderate evidence)."
      : "AI recommended on full model (stronger multi-source evidence).";

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
    explainer,
    aiRecommendation,
  };
}
