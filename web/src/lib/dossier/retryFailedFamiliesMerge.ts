import type { LiteratureHit } from "@/lib/api/europePmc";

/** Merge literature hits by DOI/PMID/id, prefer denser abstract/excerpt. */
export function mergeLiteratureHits(
  prior: LiteratureHit[],
  fresh: LiteratureHit[]
): LiteratureHit[] {
  const map = new Map<string, LiteratureHit>();
  const keyOf = (h: LiteratureHit) =>
    h.doi?.toLowerCase() ||
    h.pmid ||
    h.pmcid ||
    h.id ||
    h.title.slice(0, 80).toLowerCase();

  for (const h of prior) map.set(keyOf(h), h);
  for (const h of fresh) {
    const k = keyOf(h);
    const old = map.get(k);
    if (!old) {
      map.set(k, h);
      continue;
    }
    const oldBody = (old.fullTextExcerpt || old.abstract || "").length;
    const newBody = (h.fullTextExcerpt || h.abstract || "").length;
    map.set(k, newBody >= oldBody ? { ...old, ...h } : old);
  }
  return [...map.values()];
}
