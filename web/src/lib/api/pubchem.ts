/** PubChem PUG REST client (NCBI / NIH — free public). Traces are real HTTP only. */

import {
  fetchJsonWithTrace,
  type ApiFetchTrace,
} from "@/lib/api/trace";

const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

const PUBCHEM_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "ChemistryRecipes/1.2 (educational; process-recipe hub)",
};

/** Timeouts — App Hosting egress often gets 503; retry with longer backoff. */
const PUG_TIMEOUT_MS = 6000;
const PUG_RETRIES = 3;
const PUG_BASE_DELAY_MS = 550;

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
  traces: ApiFetchTrace[];
  failure?: string;
}

function looksLikeInchiKey(q: string): boolean {
  return /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(q.trim());
}

function looksLikeUnii(q: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(q.trim()) && !/^\d+$/.test(q.trim());
}

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

function isHardFailure(trace: ApiFetchTrace): boolean {
  if (trace.ok || trace.notFound) return false;
  if (trace.httpStatus == null) return true;
  if (isTransientStatus(trace.httpStatus)) return true;
  if (trace.httpStatus >= 500) return true;
  if (trace.httpStatus >= 400 && trace.httpStatus < 500) return false;
  return true;
}

const SEARCH_FETCH = {
  cache: "no-store" as RequestCache,
  headers: PUBCHEM_HEADERS,
  timeoutMs: PUG_TIMEOUT_MS,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}


type CidFetchOutcome = {
  cids: number[];
  hardFailed: boolean;
  notFound: boolean;
};

async function fetchCids(
  url: string,
  traces: ApiFetchTrace[],
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<CidFetchOutcome> {
  const retries = opts.retries ?? PUG_RETRIES;
  const baseDelayMs = opts.baseDelayMs ?? PUG_BASE_DELAY_MS;
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
      last.trace.httpStatus == null ||
      isTransientStatus(last.trace.httpStatus) ||
      (last.trace.error?.includes("timeout") ?? false);
    if (!retryable || attempt === retries) break;

    await sleep(
      baseDelayMs * Math.pow(1.8, attempt) + Math.floor(Math.random() * 150)
    );
  }

  if (last) traces.push(last.trace);
  return {
    cids: [],
    hardFailed: Boolean(last && isHardFailure(last.trace)),
    notFound: false,
  };
}

async function fetchPropertiesOnce(
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
  ok: boolean;
}> {
  if (!cids.length) return { rows: [], ok: false };
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

  // At most 2 attempts — never block search on property table
  for (let attempt = 0; attempt <= 1; attempt++) {
    const props = await fetchJsonWithTrace<{
      PropertyTable?: { Properties?: PropsRow[] };
    }>(propsUrl, SEARCH_FETCH);
    if (props.trace.ok) {
      traces.push(props.trace);
      return {
        rows: props.data?.PropertyTable?.Properties ?? [],
        ok: true,
      };
    }
    if (
      attempt === 0 &&
      (props.trace.httpStatus == null ||
        isTransientStatus(props.trace.httpStatus) ||
        props.trace.error?.includes("timeout"))
    ) {
      await sleep(500);
      continue;
    }
    traces.push(props.trace);
    break;
  }
  return { rows: [], ok: false };
}

function rowsToHits(
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
  nameHints: Map<number, string>
): PubChemHit[] {
  return list.map((p) => {
    return {
      cid: p.CID,
      name: p.Title || p.IUPACName || nameHints.get(p.CID) || `CID ${p.CID}`,
      formula: p.MolecularFormula,
      molecularWeight:
        typeof p.MolecularWeight === "string"
          ? parseFloat(p.MolecularWeight)
          : p.MolecularWeight,
      iupacName: p.IUPACName,
      smiles: p.IsomericSMILES || p.CanonicalSMILES,
      inchiKey: p.InChIKey,
    };
  });
}

function hitsFromCids(cids: number[], nameHints: Map<number, string>): PubChemHit[] {
  return cids.map((cid) => {
    return {
      cid,
      name: nameHints.get(cid) || `CID ${cid}`,
    };
  });
}

/**
 * Resolve name/CAS/SMILES/InChIKey/UNII/CID → hits via free-public PubChem only.
 */
export async function searchPubChem(
  query: string,
  limit = 12
): Promise<PubChemSearchResult> {
  try {
    const q = query.trim();
    if (!q) return { hits: [], traces: [] };

    const traces: ApiFetchTrace[] = [];
    const nameHints = new Map<number, string>();

    let cids: number[] = [];
    let hardFailed = false;
    const isNumeric = /^\d+$/.test(q);

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
    } else if (looksLikeSmiles(q)) {
      const out = await fetchCids(
        `${PUG}/compound/smiles/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
      cids = out.cids;
      hardFailed = out.hardFailed;
    } else {
      const primary = await fetchCids(
        `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON`,
        traces
      );
      cids = primary.cids;
      hardFailed = primary.hardFailed;
      // Word match only after clean not-found (never after 503)
      if (cids.length === 0 && primary.notFound) {
        const word = await fetchCids(
          `${PUG}/compound/name/${encodeURIComponent(q)}/cids/JSON?name_type=word`,
          traces,
          { retries: 1 }
        );
        cids = word.cids;
        hardFailed = word.hardFailed;
      }
    }

    cids = [...new Set(cids)].filter((n) => Number.isFinite(n) && n > 0).slice(0, limit);

    if (cids.length === 0) {
      if (hardFailed) {
        const hard = traces.find(isHardFailure);
        return {
          hits: [],
          traces,
          failure:
            hard?.error ||
            (hard?.httpStatus != null
              ? `HTTP ${hard.httpStatus}`
              : "PubChem unreachable from this host"),
        };
      }
      return { hits: [], traces };
    }

    const { rows, ok } = await fetchPropertiesOnce(cids, traces);
    if (ok && rows.length) {
      return { hits: rowsToHits(rows, nameHints), traces };
    }

    // CID-only cards still open full dossier pages
    return { hits: hitsFromCids(cids, nameHints), traces };
  } catch (e) {
    return {
      hits: [],
      traces: [],
      failure: e instanceof Error ? e.message : "PubChem search failed",
    };
  }
}

export async function fetchPubChemProvenance(cid: number): Promise<{
  hit: PubChemHit | null;
  traces: ApiFetchTrace[];
}> {
  if (!Number.isFinite(cid) || cid <= 0) return { hit: null, traces: [] };
  const result = await searchPubChem(String(cid), 1);
  return { hit: result.hits[0] ?? null, traces: result.traces };
}

export type PubchemStructureSize = "small" | "large";

/** Direct NIH PUG PNG URL (server-side proxy / diagnostics only). */
export function pubchemStructureUpstreamUrl(
  cid: number,
  size: PubchemStructureSize = "large"
): string {
  const dim = size === "small" ? "150x150" : "300x300";
  return `${PUG}/compound/cid/${cid}/PNG?image_size=${dim}`;
}

/**
 * Browser-facing structure image URL.
 * Goes through /api/pubchem/structure so the client never hits PubChem PNG
 * (avoids console 503 spam when NIH is ServerBusy).
 */
export function pubchemStructureUrl(
  cid: number,
  size: PubchemStructureSize = "large"
): string {
  const s = size === "small" ? "small" : "large";
  return `/api/pubchem/structure/${cid}?size=${s}`;
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

  let hit = base.hit;

  // Optional CAS enrich from PubChem xrefs only (no mock hub fallback)
  try {
    const casUrl = `${PUG}/compound/cid/${cid}/xrefs/RN/JSON`;
    const { data, trace } = await fetchJsonWithTrace<{
      InformationList?: {
        Information?: Array<{ CID?: number; RN?: string[] }>;
      };
    }>(casUrl, {
      cache: "no-store",
      headers: PUBCHEM_HEADERS,
      timeoutMs: PUG_TIMEOUT_MS,
    });
    base.traces.push(trace);
    const rns = (data?.InformationList?.Information?.[0]?.RN ?? []).filter(
      (r) => /^\d{2,7}-\d{2}-\d$/.test(r)
    );
    if (rns[0]) hit = { ...hit, cas: rns[0] };
  } catch {
    /* optional */
  }

  return { hit, traces: base.traces };
}
