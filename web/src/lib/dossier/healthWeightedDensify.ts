/**
 * Health-weighted densify prioritization.
 * Down-ranks sources whose hosts are rate-limited / circuit-open so densify
 * spends budget on healthy free-public families first.
 */

import {
  isFamilyRateLimited,
  isHostRateLimited,
  hostKeyFromUrl,
} from "@/lib/api/apiEtiquette";
import { isHostCircuitOpen } from "@/lib/api/hostCircuit";
import type { LiteratureHit } from "@/lib/api/europePmc";
import type { PatentHit } from "@/lib/api/patentsView";

/** Penalty applied when a densify source family/host is unhealthy. */
export function densifyHealthPenalty(opts: {
  family?: string;
  url?: string;
  sourceLabel?: string;
}): number {
  let pen = 0;
  if (opts.family && isFamilyRateLimited(opts.family)) pen += 40;
  if (opts.url) {
    if (isHostRateLimited(opts.url) || isHostCircuitOpen(opts.url)) pen += 35;
  }
  if (opts.sourceLabel) {
    const sl = opts.sourceLabel.toLowerCase();
    if (/semantic/.test(sl) && isFamilyRateLimited("semanticscholar")) pen += 40;
    if (/pubmed|ncbi/.test(sl) && isFamilyRateLimited("pubmed")) pen += 25;
  }
  return pen;
}

/** Family hint from literature hit source. */
export function literatureFamilyHint(h: LiteratureHit): string {
  const s = (h.source || "").toLowerCase();
  if (s.includes("pubmed") || s.includes("ncbi")) return "pubmed";
  if (s.includes("openalex")) return "openalex";
  if (s.includes("crossref")) return "crossref";
  if (s.includes("semantic")) return "semanticscholar";
  if (s.includes("arxiv")) return "arxiv";
  if (s.includes("epmc") || s.includes("europe")) return "europepmc";
  return "europepmc";
}

/**
 * Sort densify candidates by process score minus health penalty
 * (higher first). Healthy high-value thin hits win.
 */
export function rankByHealthAndValue<T>(
  items: T[],
  score: (item: T) => number,
  health: (item: T) => number
): T[] {
  return [...items]
    .map((item, i) => ({
      item,
      i,
      adj: score(item) - health(item),
    }))
    .sort((a, b) => b.adj - a.adj || a.i - b.i)
    .map((x) => x.item);
}

export function literatureHealthPenalty(h: LiteratureHit): number {
  return densifyHealthPenalty({
    family: literatureFamilyHint(h),
    url: h.url,
    sourceLabel: h.source,
  });
}

export function patentHealthPenalty(p: PatentHit): number {
  const url = p.url || "";
  const host = url ? hostKeyFromUrl(url) : "";
  let pen = densifyHealthPenalty({
    family: "patentsview",
    url: url || undefined,
  });
  if (host.includes("ebi.ac.uk")) {
    pen = densifyHealthPenalty({ family: "europepmc-pat", url });
  }
  if (host.includes("pubchem")) {
    pen = densifyHealthPenalty({ family: "pubchem-patents", url });
  }
  return pen;
}
