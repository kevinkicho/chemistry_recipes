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
}

const AI_SCORE_THRESHOLD = 18;

export function scoreCompoundEvidence(ev: CompoundEvidence): EvidenceScore {
  const reasons: string[] = [];
  let score = 0;

  if (ev.identity) {
    score += 12;
    reasons.push("PubChem identity resolved");
  }

  const mfg = filterUsefulTexts(ev.view?.manufacturingTexts ?? []);
  const desc = filterUsefulTexts(ev.view?.descriptionTexts ?? []);
  const props = filterUsefulTexts(ev.view?.propertyTexts ?? []);
  score += Math.min(18, mfg.length * 3);
  score += Math.min(8, desc.length * 2);
  score += Math.min(6, props.length);
  if (mfg.length) reasons.push(`${mfg.length} useful manufacturing/use excerpt(s)`);

  const hazards = ev.view?.hazards.hazardStatements?.length ?? 0;
  score += Math.min(12, hazards * 2);
  if (hazards) reasons.push(`${hazards} GHS hazard statement(s)`);

  const processLit = ev.literature.filter((h) =>
    looksLikeProcessLiterature(h.title, h.abstract)
  );
  const processPatents = ev.patents.filter((p) =>
    looksLikeProcessLiterature(p.title, p.abstract)
  );
  score += Math.min(28, processLit.length * 5);
  score += Math.min(16, processPatents.length * 4);
  if (processLit.length) reasons.push(`${processLit.length} process-oriented paper(s)`);
  if (processPatents.length) reasons.push(`${processPatents.length} process-oriented patent hit(s)`);

  if (ev.literature.some((h) => h.abstract && h.abstract.length > 200)) {
    score += 4;
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
  };
}
