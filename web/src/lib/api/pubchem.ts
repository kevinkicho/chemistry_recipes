/** PubChem PUG REST client (NCBI / NIH — free public). Traces are real HTTP only. */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

export interface PubChemHit {
  cid: number;
  name: string;
  formula?: string;
  molecularWeight?: number;
  iupacName?: string;
  smiles?: string;
  inchiKey?: string;
  cas?: string;
}

export interface PubChemSearchResult {
  hits: PubChemHit[];
  /** Real HTTP calls made for this search (no mock traces) */
  traces: ApiFetchTrace[];
}

/** InChIKey standard form: 14 chars + hyphen + 10 chars + hyphen + 1 char */
function looksLikeInchiKey(q: string): boolean {
  return /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(q.trim());
}

/** FDA UNII-like: 10 alphanumeric (no spaces) */
function looksLikeUnii(q: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(q.trim()) && !/^\d+$/.test(q.trim());
}

/** Resolve name, CAS, SMILES, InChIKey, UNII, or PubChem CID to hits + real API traces. Never throws. */
export async function searchPubChem(
  query: string,
  limit = 12
): Promise<PubChemSearchResult> {
  try {
    const q = query.trim();
    if (!q) return { hits: [], traces: [] };

    const traces: ApiFetchTrace[] = [];
    const isNumeric = /^\d+$/.test(q);
    const looksLikeCas = /^\d{2,7}-\d{2}-\d$/.test(q);

    let cids: number[] = [];

    if (isNumeric) {
      cids = [Number(q)];
    } else if (looksLikeCas) {
      const url = `${PUG}/compound/xref/RN/${encodeURIComponent(q)}/cids/JSON`;
      const { data, trace } = await fetchJsonWithTrace<{
        IdentifierList?: { CID?: number[] };
      }>(url, { next: { revalidate: 3600 } });
      traces.push(trace);
      cids = data?.IdentifierList?.CID ?? [];
    } else if (looksLikeInchiKey(q)) {
      const url = `${PUG}/compound/inchikey/${encodeURIComponent(q.toUpperCase())}/cids/JSON`;
      const { data, trace } = await fetchJsonWithTrace<{
        IdentifierList?: { CID?: number[] };
      }>(url, { next: { revalidate: 3600 } });
      traces.push(trace);
      cids = data?.IdentifierList?.CID ?? [];
    } else if (looksLikeUnii(q)) {
      // UNII often resolves via synonym / name endpoints
      const uniiUrl = `${PUG}/compound/name/${encodeURIComponent(q.toUpperCase())}/cids/JSON`;
      const byUnii = await fetchJsonWithTrace<{
        IdentifierList?: { CID?: number[] };
      }>(uniiUrl, { next: { revalidate: 3600 } });
      traces.push(byUnii.trace);
      cids = byUnii.data?.IdentifierList?.CID ?? [];
      if (cids.length === 0) {
        const xrefUrl = `${PUG}/compound/xref/RegistryID/${encodeURIComponent(q.toUpperCase())}/cids/JSON`;
        const byXref = await fetchJsonWithTrace<{
          IdentifierList?: { CID?: number[] };
        }>(xrefUrl, { next: { revalidate: 3600 } });
        traces.push(byXref.trace);
        cids = byXref.data?.IdentifierList?.CID ?? [];
      }
    } else {
      const nameUrl = `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON`;
      const byName = await fetchJsonWithTrace<{
        IdentifierList?: { CID?: number[] };
      }>(nameUrl, { next: { revalidate: 3600 } });
      traces.push(byName.trace);
      cids = byName.data?.IdentifierList?.CID ?? [];

      if (cids.length === 0) {
        const smilesUrl = `${PUG}/compound/smiles/${encodeURIComponent(q)}/cids/JSON`;
        const bySmiles = await fetchJsonWithTrace<{
          IdentifierList?: { CID?: number[] };
        }>(smilesUrl, { next: { revalidate: 3600 } });
        traces.push(bySmiles.trace);
        cids = bySmiles.data?.IdentifierList?.CID ?? [];
      }
    }

    cids = [...new Set(cids)].filter((n) => Number.isFinite(n) && n > 0).slice(0, limit);
    if (cids.length === 0) return { hits: [], traces };

    const propsUrl = `${PUG}/compound/cid/${cids.join(",")}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,IsomericSMILES,InChIKey,Title/JSON`;
    const props = await fetchJsonWithTrace<{
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
    }>(propsUrl, { next: { revalidate: 3600 } });
    traces.push(props.trace);

    const list = props.data?.PropertyTable?.Properties ?? [];
    const hits: PubChemHit[] = list.map((p) => ({
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
    }));

    return { hits, traces };
  } catch {
    return { hits: [], traces: [] };
  }
}

/**
 * Live-fetch PubChem compound properties for provenance (browser or server).
 * Returns only real HTTP traces.
 */
export async function fetchPubChemProvenance(cid: number): Promise<{
  hit: PubChemHit | null;
  traces: ApiFetchTrace[];
}> {
  if (!Number.isFinite(cid) || cid <= 0) return { hit: null, traces: [] };
  const result = await searchPubChem(String(cid), 1);
  return { hit: result.hits[0] ?? null, traces: result.traces };
}

export function pubchemStructureUrl(cid: number, size: "small" | "large" = "large"): string {
  const dim = size === "small" ? "150x150" : "300x300";
  return `${PUG}/compound/cid/${cid}/PNG?image_size=${dim}`;
}

export function pubchemDeepLink(cid: number): string {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}

export function pubchemPropertyEndpoint(cid: number): string {
  return `${PUG}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,IsomericSMILES,InChIKey,Title/JSON`;
}

export async function getPubChemCompound(
  cid: number
): Promise<{ hit: PubChemHit | null; traces: ApiFetchTrace[] }> {
  return fetchPubChemProvenance(cid);
}
