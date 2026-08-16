/**
 * Browser-side PubChem PUG search.
 *
 * App Hosting / Cloud Run egress often gets HTTP 503 from PubChem.
 * The user's browser IP usually still works — use this path for search UI
 * and related-entity CID resolve, with a serial queue + 503 backoff.
 * Resolves CID, CAS, InChIKey, UNII, SMILES, and name (same types as server).
 */

import { pubchemQueuedFetch } from "@/lib/api/pubchemQueue";

export type BrowserPubChemHit = {
  cid: number;
  name: string;
  formula?: string;
  molecularWeight?: number;
  iupacName?: string;
  smiles?: string;
  inchiKey?: string;
  cas?: string;
};

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

function looksLikeCas(q: string): boolean {
  return /^\d{2,7}-\d{2}-\d$/.test(q.trim());
}

function looksLikeInchiKey(q: string): boolean {
  return /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(q.trim());
}

function looksLikeUnii(q: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(q.trim()) && !/^\d+$/.test(q.trim());
}

/** Same structured-SMILES heuristic as server searchPubChem — no invention. */
function looksLikeSmiles(q: string): boolean {
  const s = q.trim();
  if (s.length < 2 || s.length > 500) return false;
  if (/\s/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (looksLikeCas(s) || looksLikeInchiKey(s) || looksLikeUnii(s)) return false;
  if (/^[A-Za-z]+$/.test(s)) return false;
  const hasSmilesSyntax = /[=#@()\[\]\\/%]/.test(s) || /[0-9]/.test(s);
  if (!hasSmilesSyntax) return false;
  return /[A-Za-z]/.test(s);
}

function isNameQuery(q: string): boolean {
  return (
    !looksLikeCas(q) &&
    !looksLikeInchiKey(q) &&
    !looksLikeUnii(q) &&
    !looksLikeSmiles(q)
  );
}

async function fetchJson(
  url: string,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; data: unknown | null }> {
  return pubchemQueuedFetch(url, { signal, asJson: true, gapMs: 500, retries: 3 });
}

async function resolveCids(
  q: string,
  signal?: AbortSignal
): Promise<number[]> {
  const t = q.trim();
  if (!t) return [];
  if (/^\d+$/.test(t)) return [Number(t)];

  let url: string;
  if (looksLikeCas(t)) {
    url = `${PUG}/compound/xref/RN/${encodeURIComponent(t)}/cids/JSON`;
  } else if (looksLikeInchiKey(t)) {
    url = `${PUG}/compound/inchikey/${encodeURIComponent(t.toUpperCase())}/cids/JSON`;
  } else if (looksLikeUnii(t)) {
    url = `${PUG}/compound/name/${encodeURIComponent(t.toUpperCase())}/cids/JSON`;
  } else if (looksLikeSmiles(t)) {
    url = `${PUG}/compound/smiles/${encodeURIComponent(t)}/cids/JSON`;
  } else {
    url = `${PUG}/compound/name/${encodeURIComponent(t)}/cids/JSON`;
  }

  const r = await fetchJson(url, signal);
  if (r.ok && r.data && typeof r.data === "object") {
    const cids =
      (r.data as { IdentifierList?: { CID?: number[] } }).IdentifierList?.CID ??
      [];
    if (cids.length) return cids;
  }

  // Word match only if exact name failed with 404 (not 503)
  if (isNameQuery(t) && r.status === 404) {
    const word = await fetchJson(
      `${PUG}/compound/name/${encodeURIComponent(t)}/cids/JSON?name_type=word`,
      signal
    );
    if (word.ok && word.data && typeof word.data === "object") {
      return (
        (word.data as { IdentifierList?: { CID?: number[] } }).IdentifierList
          ?.CID ?? []
      );
    }
  }

  // Autocomplete → first terms → name resolve (still queued)
  if (isNameQuery(t) && t.length >= 2 && r.status !== 503) {
    const acUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(t)}/json?limit=6`;
    const ac = await fetchJson(acUrl, signal);
    if (ac.ok && ac.data && typeof ac.data === "object") {
      const terms =
        (ac.data as { dictionary_terms?: { compound?: string[] } })
          .dictionary_terms?.compound ?? [];
      for (const term of terms.slice(0, 3)) {
        const nr = await fetchJson(
          `${PUG}/compound/name/${encodeURIComponent(term)}/cids/JSON`,
          signal
        );
        if (nr.ok && nr.data && typeof nr.data === "object") {
          const cids =
            (nr.data as { IdentifierList?: { CID?: number[] } }).IdentifierList
              ?.CID ?? [];
          if (cids[0]) return cids;
        }
      }
    }
  }

  return [];
}

/**
 * Live PubChem search in the browser. Never invents hits.
 * Serial queue + 503 retries to avoid console storms on PubChem busy.
 */
export async function searchPubChemInBrowser(
  query: string,
  limit = 10,
  signal?: AbortSignal
): Promise<{ hits: BrowserPubChemHit[]; error?: string }> {
  const q = query.trim();
  if (!q) return { hits: [] };

  try {
    let cids = await resolveCids(q, signal);
    cids = [...new Set(cids)]
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, limit);

    if (!cids.length) {
      return {
        hits: [],
        error:
          "No PubChem hits (or PubChem is busy — try again in a moment)",
      };
    }

    const propsUrl = `${PUG}/compound/cid/${cids.join(",")}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,IsomericSMILES,InChIKey,Title/JSON`;
    const props = await fetchJson(propsUrl, signal);
    if (props.ok && props.data && typeof props.data === "object") {
      const list =
        (
          props.data as {
            PropertyTable?: {
              Properties?: Array<{
                CID: number;
                MolecularFormula?: string;
                MolecularWeight?: string | number;
                IUPACName?: string;
                CanonicalSMILES?: string;
                IsomericSMILES?: string;
                InChIKey?: string;
                Title?: string;
              }>;
            };
          }
        ).PropertyTable?.Properties ?? [];
      if (list.length) {
        return {
          hits: list.map((p) => ({
            cid: p.CID,
            name: p.Title || p.IUPACName || `CID ${p.CID}`,
            formula: p.MolecularFormula,
            molecularWeight:
              typeof p.MolecularWeight === "string"
                ? parseFloat(p.MolecularWeight)
                : p.MolecularWeight,
            iupacName: p.IUPACName,
            smiles: p.IsomericSMILES || p.CanonicalSMILES,
            inchiKey: p.InChIKey,
          })),
        };
      }
    }

    // Properties failed — still return CID cards
    return {
      hits: cids.map((cid) => ({ cid, name: `CID ${cid}` })),
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    return {
      hits: [],
      error: e instanceof Error ? e.message : "Browser PubChem search failed",
    };
  }
}
