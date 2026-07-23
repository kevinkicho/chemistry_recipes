/**
 * Process-relevance scoring for literature / patent hits.
 * Used to rank Europe PMC results and gate AI evidence quality.
 */

import type { LiteratureHit } from "@/lib/api/europePmc";
import { looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";

/** Strong manufacturing / CMC / plant language */
const STRONG_PROCESS =
  /\b(process chemistry|process development|scale[- ]?up|industrial (production|process|synthesis)|pilot plant|tech(nology)? transfer|batch record|gmp|cqa|ipc\b|critical process parameter|crystalliz|hydrogenat|work[- ]?up|isolation of|manufacture of|method of (making|preparing)|process for (the )?prepar|kilo lab|commercial (manufacture|production)|continuous (manufacturing|process))\b/i;

/** Useful chemistry without full CMC */
const MEDIUM_PROCESS =
  /\b(synthes[ie]s|synthesi[sz]|preparat|manufactur|ferment|biocatal|enzymatic|production of|route to|catalys|acetylation|alkylation|amidat|esterif|hydrolysis|condensation|purification|downstream|upstream|chromatograph|cell culture|mab|monoclonal|peptide synthes|solid[- ]phase|oligonucleotide)\b/i;

/** Dense experimental condition language (high value for hands-on briefs) */
const CONDITION_DENSITY =
  /\b\d+(?:\.\d+)?\s*°\s*C\b|\b\d+\s*(?:h|hr|hours|min)\b|\b\d+(?:\.\d+)?\s*(?:bar|atm|psi|MPa)\b|\bpH\s*\d|\b\d+(?:\.\d+)?\s*(?:equiv|eq\.)\b|\bunder (N2|nitrogen|argon|H2|hydrogen)\b/i;

/** Worked-example / experimental section cues */
const EXPERIMENTAL_CUES =
  /\b(example\s+\d|experimental (section|procedure)|general procedure|worked example|embodiment|claim\s+\d)\b/i;

/** Clinical / pure biology noise to demote when not process-framed */
const CLINICAL_NOISE =
  /\b(clinical trial|patients? with|efficacy of|dose[- ]response|pharmacokinet|placebo|randomized|observational study|case report)\b/i;

/** Formulation / labeling — not API synthesis */
const FORMULATION_NOT_SYNTHESIS =
  /\b(tablet|capsule|oral (dose|suspension)|prescribing information|package insert|bioequivalence)\b/i;

export function scoreProcessRelevance(
  title: string,
  abstract?: string
): number {
  const hay = `${title} ${abstract || ""}`;
  let score = 0;
  if (STRONG_PROCESS.test(hay)) score += 50;
  if (MEDIUM_PROCESS.test(hay)) score += 25;
  if (looksLikeProcessLiterature(title, abstract)) score += 15;
  if (CONDITION_DENSITY.test(hay)) score += 20;
  if (EXPERIMENTAL_CUES.test(hay)) score += 15;
  // Condition density v2: count numeric process cues (capped)
  const densHits = hay.match(
    /\d+(?:\.\d+)?\s*(?:°\s*C|bar|atm|psi|h\b|hr|min|equiv|eq\.|pH\s*\d)/gi
  );
  if (densHits?.length) score += Math.min(25, densHits.length * 5);
  if (/\b(review|meta[- ]analysis)\b/i.test(title) && score < 40) score -= 10;
  if (CLINICAL_NOISE.test(hay) && score < 40) score -= 25;
  if (FORMULATION_NOT_SYNTHESIS.test(hay) && !STRONG_PROCESS.test(hay)) score -= 15;
  if (abstract && abstract.length > 200) score += 5;
  if (abstract && abstract.length > 600) score += 5;
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
