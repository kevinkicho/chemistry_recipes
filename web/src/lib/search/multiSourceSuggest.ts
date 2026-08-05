/**
 * Multi-source autocomplete suggestions (free-public only).
 * PubChem autocomplete + RxNorm + openFDA (no mock hub catalog).
 */

import { fetchPubChemAutocomplete } from "@/lib/api/pubchemAutocomplete";
import { fetchRxNormByName } from "@/lib/api/rxnorm";
import { fetchOpenFdaByName } from "@/lib/api/openFda";
import type { SuggestItem } from "@/lib/data/suggestions";

export interface MultiSourceSuggestResult {
  schema: "chemistry-recipes.multi-source-suggest.v1";
  q: string;
  suggestions: SuggestItem[];
  sourcesUsed: string[];
  durationMs: number;
}

/**
 * Build ranked autocomplete rows for the search combobox.
 * Safe for short prefixes; never invents chemical names.
 */
export async function multiSourceSuggest(
  term: string,
  limit = 14
): Promise<MultiSourceSuggestResult> {
  const q = term.trim();
  const t0 = Date.now();
  if (q.length < 2) {
    return {
      schema: "chemistry-recipes.multi-source-suggest.v1",
      q,
      suggestions: [],
      sourcesUsed: [],
      durationMs: 0,
    };
  }

  const out: SuggestItem[] = [];
  const seen = new Set<string>();
  const sourcesUsed: string[] = [];

  function push(item: SuggestItem) {
    const key = item.value.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  }

  // PubChem autocomplete (browser-friendly; also used server-side)
  const pc = await fetchPubChemAutocomplete(q, 8);
  if (pc.ok && pc.terms.length) sourcesUsed.push("pubchem");
  for (const t of pc.terms) {
    push({
      value: t,
      detail: "PubChem · NIH",
      kind: "pubchem",
    });
  }

  // Lightweight RxNorm + openFDA (name only — no full multi search)
  if (q.length >= 3) {
    const [rx, fda] = await Promise.allSettled([
      fetchRxNormByName(q),
      fetchOpenFdaByName(q),
    ]);
    if (rx.status === "fulfilled" && rx.value.hit) {
      sourcesUsed.push("rxnorm");
      push({
        value: rx.value.hit.name,
        detail: `RxNorm · RxCUI ${rx.value.hit.rxcui}`,
        kind: "rxnorm",
      });
    }
    if (fda.status === "fulfilled" && fda.value.hits[0]) {
      sourcesUsed.push("openfda");
      const h = fda.value.hits[0];
      const name = h.genericName || h.brandName;
      if (name) {
        push({
          value: name,
          detail: `openFDA${h.dosageForm ? ` · ${h.dosageForm}` : ""}`,
          kind: "openfda",
        });
      }
    }
  }

  return {
    schema: "chemistry-recipes.multi-source-suggest.v1",
    q,
    suggestions: out.slice(0, limit),
    sourcesUsed,
    durationMs: Date.now() - t0,
  };
}
