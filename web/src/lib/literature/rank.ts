/**
 * Process-relevance scoring for literature / patent hits.
 * Used to rank Europe PMC results and gate AI evidence quality.
 */

import type { LiteratureHit } from "@/lib/api/europePmc";
import { looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";

/** Strong manufacturing / CMC language */
const STRONG_PROCESS =
  /\b(process chemistry|process development|scale[- ]?up|industrial (production|process|synthesis)|pilot plant|tech(nology)? transfer|batch record|gmp|cqa|ipc\b|critical process parameter|crystalliz|hydrogenat|work[- ]?up|isolation of|manufacture of|method of (making|preparing)|process for (the )?prepar)/i;

/** Useful chemistry without full CMC */
const MEDIUM_PROCESS =
  /\b(synthes[ie]s|synthesi[sz]|preparat|manufactur|ferment|biocatal|enzymatic|production of|route to|catalys|acetylation|alkylation|amidat|esterif|hydrolysis|condensation|purification|downstream|upstream|chromatograph|cell culture|mab|monoclonal|peptide synthes|solid[- ]phase|oligonucleotide)/i;

/** Clinical / pure biology noise to demote when not process-framed */
const CLINICAL_NOISE =
  /\b(clinical trial|patients? with|efficacy of|dose[- ]response|pharmacokinet|placebo|randomized|observational study|case report)\b/i;

export function scoreProcessRelevance(
  title: string,
  abstract?: string
): number {
  const hay = `${title} ${abstract || ""}`;
  let score = 0;
  if (STRONG_PROCESS.test(hay)) score += 50;
  if (MEDIUM_PROCESS.test(hay)) score += 25;
  if (looksLikeProcessLiterature(title, abstract)) score += 15;
  if (/\b(review|meta[- ]analysis)\b/i.test(title) && score < 40) score -= 10;
  if (CLINICAL_NOISE.test(hay) && score < 40) score -= 20;
  if (abstract && abstract.length > 200) score += 5;
  if (/\b(patent|WO\d|US\d{7,})\b/i.test(hay)) score += 10;
  return Math.max(0, Math.min(100, score));
}

export function rankLiteratureByProcessRelevance(
  hits: LiteratureHit[]
): LiteratureHit[] {
  return [...hits].sort((a, b) => {
    const sa = scoreProcessRelevance(a.title, a.abstract);
    const sb = scoreProcessRelevance(b.title, b.abstract);
    if (sb !== sa) return sb - sa;
    // Prefer newer when scores tie
    const ya = parseInt(a.year || "0", 10) || 0;
    const yb = parseInt(b.year || "0", 10) || 0;
    return yb - ya;
  });
}

export function filterProcessLiterature(
  hits: LiteratureHit[],
  minScore = 15
): LiteratureHit[] {
  return rankLiteratureByProcessRelevance(hits).filter(
    (h) => scoreProcessRelevance(h.title, h.abstract) >= minScore
  );
}
