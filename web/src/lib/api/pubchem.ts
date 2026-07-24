/** PubChem PUG REST client (NCBI / NIH — free public). Traces are real HTTP only. */

import {
  fetchJsonWithTrace,
  type ApiFetchTrace,
} from "@/lib/api/trace";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

/** NCBI-friendly identity for free public use (polite pooling). */
const PUBCHEM_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "ChemistryRecipes/1.0 (educational; process-recipe hub; +https://github.com/local)",
};

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
  /**
   * Present only for hard transport / rate-limit / 5xx failures — not for
   * PubChem 404 "compound not found" (that yields empty hits, no failure).
   */
  failure?: string;
}

/** InChIKey standard form: 14 chars + hyphen + 10 chars + hyphen + 1 char */
function looksLikeInchiKey(q: string): boolean {
  return /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(q.trim());
}

/** FDA UNII-like: 10 alphanumeric (no spaces) */
function looksLikeUnii(q: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(q.trim()) && !/^\d+$/.test(q.trim());
}

/**
 * Heuristic SMILES / SMARTS-ish string.
 * Keep strict: plain dictionary names must never hit the SMILES endpoint
 * (invalid SMILES → HTTP 400, which used to surface as "request failed").
 */
function looksLikeSmiles(q: string): boolean {
  const s = q.trim();
  if (s.length < 2 || s.length > 500) return false;
  if (/\s/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (looksLikeCas(s) || looksLikeInchiKey(s) || looksLikeUnii(s)) return false;
  // Pure alphabetic tokens are names (aspirin, ibuprofen, zzzz…), never SMILES
  if (/^[A-Za-z]+$/.test(s)) return false;
  // SMILES nearly always has digits (ring closures), bonds, branches, or aromatic lowercase + symbols
  const hasSmilesSyntax = /[=#@()\[\]\\/%]/.test(s) || /[0-9]/.test(s);
  if (!hasSmilesSyntax) return false;
  // At least one element-like letter
  return /[A-Za-z]/.test(s);
}

function looksLikeCas(q: string): boolean {
  return /^\d{2,7}-\d{2}-\d$/.test(q.trim());
}

function isTransientStatus(status?: number): boolean {
  return status === 429 || status === 503 || status === 502 || status === 504;
}

/**
 * True only for transport / rate-limit / server outages.
 * PubChem 400/404 on identifier endpoints = "no match", not an outage.
 */
function isHardFailure(trace: ApiFetchTrace): boolean {
  if (trace.ok || trace.notFound) return false;
  // Network / abort
  if (trace.httpStatus == null) return true;
  if (isTransientStatus(trace.httpStatus)) return true;
  if (trace.httpStatus >= 500) return true;
  // 4xx from PUG (bad SMILES, unknown name, etc.) → empty result, not "request failed"
  if (trace.httpStatus >= 400 && trace.httpStatus < 500) return false;
  return true;
}

/** Search must not reuse a cached failure from an earlier outage. */
const SEARCH_FETCH: RequestInit & { next?: { revalidate?: number } } = {
  cache: "no-store",
  headers: PUBCHEM_HEADERS,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * CID-list fetch with 404-as-empty and short retries on 429/5xx/network.
 * Pushes one final trace per logical call (last attempt).
 */
async function fetchCids(
  url: string,
  traces: ApiFetchTrace[],
  opts: { retries?: number } = {}
): Promise<number[]> {
  const retries = opts.retries ?? 2;
  type CidPayload = { IdentifierList?: { CID?: number[] } };
  let last: { data: CidPayload | null; trace: ApiFetchTrace } | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await fetchJsonWithTrace<CidPayload>(url, SEARCH_FETCH);

    if (last.trace.ok) {
      traces.push(last.trace);
      return last.data?.IdentifierList?.CID ?? [];
    }

    // PubChem: 404 NotFound / 400 bad identifier → empty result (not outage)
    const status = last.trace.httpStatus;
    if (last.trace.notFound || status === 404 || status === 400) {
      traces.push({
        ...last.trace,
        notFound: true,
        error: last.trace.error ?? "Not found",
      });
      return [];
    }

    const retryable =
      last.trace.httpStatus == null || isTransientStatus(last.trace.httpStatus);
    if (!retryable || attempt === retries) break;

    await sleep(350 * Math.pow(2, attempt) + Math.floor(Math.random() * 120));
  }

  if (last) traces.push(last.trace);
  return [];
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

    let cids: number[] = [];

    if (isNumeric) {
      cids = [Number(q)];
    } else if (looksLikeCas(q)) {
      cids = await fetchCids(
        `${PUG}/compound/xref/RN/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
    } else if (looksLikeInchiKey(q)) {
      cids = await fetchCids(
        `${PUG}/compound/inchikey/${encodeURIComponent(q.toUpperCase())}/cids/JSON`,
        traces
      );
    } else if (looksLikeUnii(q)) {
      cids = await fetchCids(
        `${PUG}/compound/name/${encodeURIComponent(q.toUpperCase())}/cids/JSON`,
        traces
      );
      if (cids.length === 0) {
        cids = await fetchCids(
          `${PUG}/compound/xref/RegistryID/${encodeURIComponent(q.toUpperCase())}/cids/JSON`,
          traces
        );
      }
    } else if (looksLikeSmiles(q)) {
      cids = await fetchCids(
        `${PUG}/compound/smiles/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
    } else {
      // Name (exact) then looser word match — never fall through to SMILES for prose names
      cids = await fetchCids(
        `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
      if (cids.length === 0) {
        cids = await fetchCids(
          `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON?name_type=word`,
          traces
        );
      }
    }

    cids = [...new Set(cids)].filter((n) => Number.isFinite(n) && n > 0).slice(0, limit);

    if (cids.length === 0) {
      const hard = traces.find(isHardFailure);
      if (hard) {
        return {
          hits: [],
          traces,
          failure:
            hard.error ||
            (hard.httpStatus != null
              ? `HTTP ${hard.httpStatus}`
              : "Network error contacting PubChem"),
        };
      }
      return { hits: [], traces };
    }

    const propsUrl = `${PUG}/compound/cid/${cids.join(",")}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,IsomericSMILES,InChIKey,Title/JSON`;

    type PropsRow = {
      CID: number;
      MolecularFormula?: string;
      MolecularWeight?: string | number;
      IUPACName?: string;
      CanonicalSMILES?: string;
      IsomericSMILES?: string;
      InChIKey?: string;
      Title?: string;
    };

    let propsData: { PropertyTable?: { Properties?: PropsRow[] } } | null = null;
    let propsTrace: ApiFetchTrace | null = null;

    for (let attempt = 0; attempt <= 2; attempt++) {
      const props = await fetchJsonWithTrace<{
        PropertyTable?: { Properties?: PropsRow[] };
      }>(propsUrl, SEARCH_FETCH);
      propsData = props.data;
      propsTrace = props.trace;
      if (props.trace.ok) break;
      if (
        attempt < 2 &&
        (props.trace.httpStatus == null || isTransientStatus(props.trace.httpStatus))
      ) {
        await sleep(350 * Math.pow(2, attempt));
        continue;
      }
      break;
    }

    if (propsTrace) traces.push(propsTrace);

    const list = propsData?.PropertyTable?.Properties ?? [];

    if (list.length === 0) {
      const hard = propsTrace && isHardFailure(propsTrace) ? propsTrace : null;
      // CIDs resolved but properties failed — still offer minimal hits so search isn't empty
      const fallbackHits: PubChemHit[] = cids.map((cid) => ({
        cid,
        name: `CID ${cid}`,
      }));
      return {
        hits: fallbackHits,
        traces,
        failure: hard
          ? `Properties: ${hard.error || `HTTP ${hard.httpStatus}`}`
          : undefined,
      };
    }

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
  } catch (e) {
    return {
      hits: [],
      traces: [],
      failure: e instanceof Error ? e.message : "PubChem search failed",
    };
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
  const base = await fetchPubChemProvenance(cid);
  if (!base.hit) return base;

  // Enrich with CAS RN (Registry Number) so live pages match curated identity rows
  try {
    const casUrl = `${PUG}/compound/cid/${cid}/xrefs/RN/JSON`;
    const { data, trace } = await fetchJsonWithTrace<{
      InformationList?: {
        Information?: Array<{ CID?: number; RN?: string[] }>;
      };
    }>(casUrl, {
      next: { revalidate: 3600 },
      headers: PUBCHEM_HEADERS,
    });
    base.traces.push(trace);
    const rns = data?.InformationList?.Information?.[0]?.RN ?? [];
    // Prefer standard CAS form NNNNN-NN-N
    const cas =
      rns.find((r) => /^\d{2,7}-\d{2}-\d$/.test(r)) || rns[0] || undefined;
    if (cas) base.hit = { ...base.hit, cas };
  } catch {
    /* optional enrichment */
  }

  return base;
}
