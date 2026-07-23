/**
 * PubChem free public autocomplete (NCBI / NIH).
 * Docs: https://pubchem.ncbi.nlm.nih.gov/docs/autocomplete
 *
 * GET https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/{term}/json?limit=N
 */

const AUTOCOMPLETE =
  "https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound";

export interface PubChemAutocompleteResult {
  terms: string[];
  endpointUrl: string;
  ok: boolean;
  error?: string;
}

/**
 * Live compound name suggestions from PubChem.
 * Returns empty terms on failure — never invents suggestions.
 */
export async function fetchPubChemAutocomplete(
  term: string,
  limit = 8,
  signal?: AbortSignal
): Promise<PubChemAutocompleteResult> {
  const q = term.trim();
  if (q.length < 2) {
    return { terms: [], endpointUrl: "", ok: true };
  }

  const endpointUrl = `${AUTOCOMPLETE}/${encodeURIComponent(q)}/json?limit=${limit}`;

  try {
    const res = await fetch(endpointUrl, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) {
      return {
        terms: [],
        endpointUrl,
        ok: false,
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      dictionary_terms?: { compound?: string[] };
      total?: number;
    };
    const terms = (data.dictionary_terms?.compound ?? [])
      .map((t) => String(t).trim())
      .filter(Boolean);
    return { terms, endpointUrl, ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { terms: [], endpointUrl, ok: true };
    }
    return {
      terms: [],
      endpointUrl,
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}
