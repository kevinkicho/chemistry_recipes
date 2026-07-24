/** PubChem PUG REST client (NCBI / NIH — free public). Traces are real HTTP only. */

import {
  fetchJsonWithTrace,
  type ApiFetchTrace,
} from "@/lib/api/trace";
import { HUB_INDEX } from "@/lib/data/hubIndex";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const AUTOCOMPLETE =
  "https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound";

/**
 * NCBI-friendly identity. Keep short — some edge IPs rate-limit heavy clients.
 * Do not spam secondary endpoints after 503 (that worsens throttling).
 */
const PUBCHEM_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "ChemistryRecipes/1.1 (educational; mailto:dev@localhost)",
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
  /** True when hub/local index supplied CIDs because live PUG was throttled */
  usedLocalFallback?: boolean;
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
 * Keep strict: plain dictionary names must never hit the SMILES endpoint.
 */
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
  if (trace.httpStatus == null) return true;
  if (isTransientStatus(trace.httpStatus)) return true;
  if (trace.httpStatus >= 500) return true;
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
 * Resolve known hub compounds without hitting PubChem (helps when GCP IPs get 503).
 * Exact name / CAS / exampleId / CID only — never invents unknown compounds.
 */
export function resolveLocalHubCids(query: string, limit = 12): PubChemHit[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const hits: PubChemHit[] = [];
  for (const h of HUB_INDEX) {
    const match =
      String(h.pubchemCid) === q ||
      (h.cas != null && h.cas === q) ||
      h.name.toLowerCase() === lower ||
      (h.exampleId != null && h.exampleId === lower) ||
      (lower.length >= 3 && h.name.toLowerCase().startsWith(lower));
    if (!match) continue;
    hits.push({
      cid: h.pubchemCid,
      name: h.name,
      cas: h.cas,
    });
    if (hits.length >= limit) break;
  }
  // de-dupe by cid
  const seen = new Set<number>();
  return hits.filter((h) => {
    if (seen.has(h.cid)) return false;
    seen.add(h.cid);
    return true;
  });
}

type CidFetchOutcome = {
  cids: number[];
  /** last attempt was hard failure (503/network) after retries */
  hardFailed: boolean;
  /** empty because not found (404/400) */
  notFound: boolean;
};

/**
 * CID-list fetch with aggressive backoff on 429/5xx (common from shared cloud egress).
 * Does not cascade callers — they decide whether to try alternate endpoints.
 */
async function fetchCids(
  url: string,
  traces: ApiFetchTrace[],
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<CidFetchOutcome> {
  // Cloud Run → PubChem often sees 503; give it several spaced tries
  const retries = opts.retries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 700;
  type CidPayload = { IdentifierList?: { CID?: number[] } };
  let last: { data: CidPayload | null; trace: ApiFetchTrace } | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await fetchJsonWithTrace<CidPayload>(url, SEARCH_FETCH);

    if (last.trace.ok) {
      traces.push(last.trace);
      return {
        cids: last.data?.IdentifierList?.CID ?? [],
        hardFailed: false,
        notFound: false,
      };
    }

    const status = last.trace.httpStatus;
    if (last.trace.notFound || status === 404 || status === 400) {
      traces.push({
        ...last.trace,
        notFound: true,
        error: last.trace.error ?? "Not found",
      });
      return { cids: [], hardFailed: false, notFound: true };
    }

    const retryable =
      last.trace.httpStatus == null || isTransientStatus(last.trace.httpStatus);
    if (!retryable || attempt === retries) break;

    // Exponential + jitter; longer delays for 503
    const mult = status === 503 || status === 429 ? 1.6 : 1;
    const delay =
      baseDelayMs * mult * Math.pow(1.7, attempt) +
      Math.floor(Math.random() * 250);
    await sleep(Math.min(delay, 8000));
  }

  if (last) traces.push(last.trace);
  return {
    cids: [],
    hardFailed: Boolean(last && isHardFailure(last.trace)),
    notFound: false,
  };
}

/** Autocomplete may succeed when PUG name is throttled (different edge path). */
async function fetchAutocompleteTerms(
  term: string,
  traces: ApiFetchTrace[]
): Promise<string[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const url = `${AUTOCOMPLETE}/${encodeURIComponent(q)}/json?limit=8`;
  // fewer retries — lightweight
  for (let attempt = 0; attempt <= 2; attempt++) {
    const { data, trace } = await fetchJsonWithTrace<{
      dictionary_terms?: { compound?: string[] };
    }>(url, SEARCH_FETCH);
    if (trace.ok) {
      traces.push(trace);
      return (data?.dictionary_terms?.compound ?? [])
        .map((t) => String(t).trim())
        .filter(Boolean);
    }
    if (trace.notFound || trace.httpStatus === 404 || trace.httpStatus === 400) {
      traces.push({ ...trace, notFound: true });
      return [];
    }
    if (
      attempt < 2 &&
      (trace.httpStatus == null || isTransientStatus(trace.httpStatus))
    ) {
      await sleep(500 * (attempt + 1));
      continue;
    }
    traces.push(trace);
    return [];
  }
  return [];
}

async function fetchProperties(
  cids: number[],
  traces: ApiFetchTrace[]
): Promise<{
  rows: Array<{
    CID: number;
    MolecularFormula?: string;
    MolecularWeight?: string | number;
    IUPACName?: string;
    CanonicalSMILES?: string;
    IsomericSMILES?: string;
    InChIKey?: string;
    Title?: string;
  }>;
  hardFailed: boolean;
}> {
  if (!cids.length) return { rows: [], hardFailed: false };
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

  let lastTrace: ApiFetchTrace | null = null;
  for (let attempt = 0; attempt <= 5; attempt++) {
    const props = await fetchJsonWithTrace<{
      PropertyTable?: { Properties?: PropsRow[] };
    }>(propsUrl, SEARCH_FETCH);
    lastTrace = props.trace;
    if (props.trace.ok) {
      traces.push(props.trace);
      return {
        rows: props.data?.PropertyTable?.Properties ?? [],
        hardFailed: false,
      };
    }
    if (
      attempt < 5 &&
      (props.trace.httpStatus == null || isTransientStatus(props.trace.httpStatus))
    ) {
      await sleep(700 * Math.pow(1.6, attempt) + Math.floor(Math.random() * 200));
      continue;
    }
    break;
  }
  if (lastTrace) traces.push(lastTrace);
  return {
    rows: [],
    hardFailed: Boolean(lastTrace && isHardFailure(lastTrace)),
  };
}

function hitsFromProps(
  list: Array<{
    CID: number;
    MolecularFormula?: string;
    MolecularWeight?: string | number;
    IUPACName?: string;
    CanonicalSMILES?: string;
    IsomericSMILES?: string;
    InChIKey?: string;
    Title?: string;
  }>,
  nameHints?: Map<number, string>
): PubChemHit[] {
  return list.map((p) => ({
    cid: p.CID,
    name: p.Title || p.IUPACName || nameHints?.get(p.CID) || `CID ${p.CID}`,
    formula: p.MolecularFormula,
    molecularWeight:
      typeof p.MolecularWeight === "string"
        ? parseFloat(p.MolecularWeight)
        : p.MolecularWeight,
    iupacName: p.IUPACName,
    smiles: p.IsomericSMILES || p.CanonicalSMILES,
    inchiKey: p.InChIKey,
  }));
}

function minimalHits(
  cids: number[],
  nameHints?: Map<number, string>
): PubChemHit[] {
  return cids.map((cid) => ({
    cid,
    name: nameHints?.get(cid) || `CID ${cid}`,
  }));
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
    let hardFailed = false;
    let usedLocalFallback = false;
    const nameHints = new Map<number, string>();

    // Always seed local hints for known hub compounds
    for (const h of resolveLocalHubCids(q, limit)) {
      nameHints.set(h.cid, h.name);
      if (h.cas) {
        /* cas kept on full hit later */
      }
    }

    if (isNumeric) {
      cids = [Number(q)];
    } else if (looksLikeCas(q)) {
      const out = await fetchCids(
        `${PUG}/compound/xref/RN/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
      cids = out.cids;
      hardFailed = out.hardFailed;
    } else if (looksLikeInchiKey(q)) {
      const out = await fetchCids(
        `${PUG}/compound/inchikey/${encodeURIComponent(q.toUpperCase())}/cids/JSON`,
        traces
      );
      cids = out.cids;
      hardFailed = out.hardFailed;
    } else if (looksLikeUnii(q)) {
      const out = await fetchCids(
        `${PUG}/compound/name/${encodeURIComponent(q.toUpperCase())}/cids/JSON`,
        traces
      );
      cids = out.cids;
      hardFailed = out.hardFailed;
      if (cids.length === 0 && out.notFound) {
        const xref = await fetchCids(
          `${PUG}/compound/xref/RegistryID/${encodeURIComponent(q.toUpperCase())}/cids/JSON`,
          traces
        );
        cids = xref.cids;
        hardFailed = xref.hardFailed;
      }
    } else if (looksLikeSmiles(q)) {
      const out = await fetchCids(
        `${PUG}/compound/smiles/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
      cids = out.cids;
      hardFailed = out.hardFailed;
    } else {
      // Name search — one primary PUG call with long retries (do NOT pile on word-match after 503)
      const primary = await fetchCids(
        `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
      cids = primary.cids;
      hardFailed = primary.hardFailed;

      // Word match only when PubChem said "not found", never after 503 throttle
      if (cids.length === 0 && primary.notFound) {
        const word = await fetchCids(
          `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON?name_type=word`,
          traces
        );
        cids = word.cids;
        hardFailed = word.hardFailed;
      }

      // Autocomplete alternate path if still empty and not a clean not-found
      if (cids.length === 0 && (hardFailed || !primary.notFound)) {
        const terms = await fetchAutocompleteTerms(q, traces);
        for (const term of terms.slice(0, 3)) {
          // Prefer local hub for autocomplete term first
          const local = resolveLocalHubCids(term, 3);
          if (local.length) {
            for (const h of local) {
              cids.push(h.cid);
              nameHints.set(h.cid, h.name);
            }
            usedLocalFallback = true;
            continue;
          }
          // Single polite PUG resolve per term
          await sleep(200);
          const r = await fetchCids(
            `${PUG}/compound/name/${encodeURIComponent(term)}/cids/JSON`,
            traces,
            { retries: 3, baseDelayMs: 900 }
          );
          if (r.cids[0]) {
            cids.push(r.cids[0]);
            nameHints.set(r.cids[0], term);
          }
          if (cids.length >= limit) break;
          if (r.hardFailed) {
            hardFailed = true;
            break; // stop hammering
          }
        }
      }
    }

    // Local hub fallback when live PUG is throttled or empty for known names
    if (cids.length === 0) {
      const local = resolveLocalHubCids(q, limit);
      if (local.length) {
        cids = local.map((h) => h.cid);
        for (const h of local) nameHints.set(h.cid, h.name);
        usedLocalFallback = true;
        hardFailed = false; // we can still serve results
      }
    }

    cids = [...new Set(cids)].filter((n) => Number.isFinite(n) && n > 0).slice(0, limit);

    if (cids.length === 0) {
      if (hardFailed) {
        const hard = traces.find(isHardFailure);
        const status = hard?.httpStatus ?? traces.find((t) => !t.ok)?.httpStatus;
        return {
          hits: [],
          traces,
          failure:
            hard?.error ||
            (status != null ? `HTTP ${status}` : "Network error contacting PubChem"),
        };
      }
      return { hits: [], traces };
    }

    const { rows, hardFailed: propsHard } = await fetchProperties(cids, traces);

    if (rows.length === 0) {
      // Still return CID cards so user can open live dossiers
      return {
        hits: minimalHits(cids, nameHints).map((h) => {
          const hub = HUB_INDEX.find((x) => x.pubchemCid === h.cid);
          return hub ? { ...h, name: hub.name, cas: hub.cas } : h;
        }),
        traces,
        usedLocalFallback: usedLocalFallback || undefined,
        failure: propsHard
          ? "PubChem property service busy (503) — open a CID for full dossier"
          : undefined,
      };
    }

    const hits = hitsFromProps(rows, nameHints).map((h) => {
      const hub = HUB_INDEX.find((x) => x.pubchemCid === h.cid);
      if (hub && (h.name.startsWith("CID ") || !h.cas)) {
        return { ...h, name: hub.name || h.name, cas: h.cas || hub.cas };
      }
      return h;
    });

    return {
      hits,
      traces,
      usedLocalFallback: usedLocalFallback || undefined,
      // Soft note only if we never got a successful PUG identity call
      failure:
        usedLocalFallback && hardFailed
          ? "PubChem was busy — used local hub CIDs; dossier pages still fetch live"
          : undefined,
    };
  } catch (e) {
    // Last-ditch local hub
    const local = resolveLocalHubCids(query, limit);
    if (local.length) {
      return {
        hits: local,
        traces: [],
        usedLocalFallback: true,
        failure: e instanceof Error ? e.message : "PubChem search failed",
      };
    }
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
  if (!base.hit) {
    // Hub name when provenance fails entirely
    const hub = HUB_INDEX.find((h) => h.pubchemCid === cid);
    if (hub) {
      return {
        hit: { cid, name: hub.name, cas: hub.cas },
        traces: base.traces,
      };
    }
    return base;
  }

  // Enrich with CAS RN (Registry Number) so live pages match curated identity rows
  try {
    const casUrl = `${PUG}/compound/cid/${cid}/xrefs/RN/JSON`;
    const { data, trace } = await fetchJsonWithTrace<{
      InformationList?: {
        Information?: Array<{ CID?: number; RN?: string[] }>;
      };
    }>(casUrl, {
      cache: "no-store",
      headers: PUBCHEM_HEADERS,
    });
    base.traces.push(trace);
    const rns = data?.InformationList?.Information?.[0]?.RN ?? [];
    const cas =
      rns.find((r) => /^\d{2,7}-\d{2}-\d$/.test(r)) || rns[0] || undefined;
    if (cas) base.hit = { ...base.hit, cas };
  } catch {
    /* optional enrichment */
  }

  // Fill CAS/name from hub if still missing
  const hub = HUB_INDEX.find((h) => h.pubchemCid === cid);
  if (hub && base.hit) {
    base.hit = {
      ...base.hit,
      name: base.hit.name?.startsWith("CID ") ? hub.name : base.hit.name || hub.name,
      cas: base.hit.cas || hub.cas,
    };
  }

  return base;
}
