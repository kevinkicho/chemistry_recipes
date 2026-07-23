/**
 * Europe PMC REST client — free public literature (EMBL-EBI).
 * Docs: https://europepmc.org/RestfulWebService
 *
 * Multi-query harvest for process / manufacturing chemistry.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import { politeDelay } from "@/lib/api/rateLimit";
import { rankLiteratureByProcessRelevance } from "@/lib/literature/rank";

const EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";

export interface LiteratureHit {
  id: string;
  source: string;
  title: string;
  authors?: string;
  journal?: string;
  year?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  abstract?: string;
  url: string;
  isOpenAccess?: boolean;
}

export interface LiteratureSearchResult {
  query: string;
  hits: LiteratureHit[];
  hitCount?: number;
  traces: ApiFetchTrace[];
}

interface EpmcResult {
  id?: string;
  source?: string;
  title?: string;
  authorString?: string;
  journalTitle?: string;
  pubYear?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  abstractText?: string;
  isOpenAccess?: string;
}

interface EpmcResponse {
  hitCount?: number;
  resultList?: { result?: EpmcResult[] };
}

function deepLink(r: EpmcResult): string {
  if (r.doi) return `https://doi.org/${r.doi}`;
  if (r.pmcid)
    return `https://europepmc.org/article/PMC/${r.pmcid.replace(/^PMC/i, "")}`;
  if (r.pmid) return `https://europepmc.org/article/MED/${r.pmid}`;
  if (r.id && r.source) return `https://europepmc.org/article/${r.source}/${r.id}`;
  return "https://europepmc.org";
}

function mapHit(r: EpmcResult): LiteratureHit {
  return {
    id: `${r.source || "EPMC"}:${r.id || r.pmid || r.doi || Math.random()}`,
    source: r.source || "EuropePMC",
    title: r.title || "(untitled)",
    authors: r.authorString,
    journal: r.journalTitle,
    year: r.pubYear,
    doi: r.doi,
    pmid: r.pmid,
    pmcid: r.pmcid,
    abstract: r.abstractText?.slice(0, 1500),
    url: deepLink(r),
    isOpenAccess: r.isOpenAccess === "Y",
  };
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, " ");
}

async function epmcSearch(
  query: string,
  limit: number
): Promise<{ hits: LiteratureHit[]; hitCount?: number; trace: ApiFetchTrace }> {
  const url =
    `${EPMC}/search?query=${encodeURIComponent(query)}` +
    `&resultType=core&pageSize=${limit}&format=json&cursorMark=*`;
  const { data, trace } = await fetchJsonWithTrace<EpmcResponse>(url, {
    next: { revalidate: 3600 },
  });
  const results = data?.resultList?.result ?? [];
  return {
    hits: results.map(mapHit),
    hitCount: data?.hitCount,
    trace,
  };
}

/**
 * Multi-query Europe PMC harvest focused on process chemistry.
 */
export async function searchEuropePmc(
  compoundName: string,
  opts: { limit?: number; extraTerms?: string } = {}
): Promise<LiteratureSearchResult> {
  const limit = opts.limit ?? 16;
  const name = compoundName.trim();
  if (!name) return { query: "", hits: [], traces: [] };

  const n = escapeQuotes(name);
  const processTerms =
    opts.extraTerms ||
    "(synthesis OR synthesi* OR manufacture OR manufacturing OR \"process chemistry\" OR preparation OR \"industrial production\" OR scale-up OR \"process development\" OR \"process for preparing\" OR \"method of making\" OR fermentation OR biocatalytic OR \"chemical synthesis\" OR \"production of\" OR crystalliz* OR hydrogenation OR acetylation)";

  const queries = [
    `((TITLE_ABS:"${n}" OR TITLE:"${n}") AND ${processTerms})`,
    `(TITLE:"synthesis of ${n}" OR TITLE:"preparation of ${n}" OR TITLE:"${n} synthesis" OR TITLE:"production of ${n}" OR TITLE:"${n} manufacture")`,
    `(TITLE_ABS:"${n}") AND (ferment* OR biocatal* OR "process for the preparation" OR "industrial process")`,
  ];

  const traces: ApiFetchTrace[] = [];
  const byId = new Map<string, LiteratureHit>();
  let hitCount = 0;
  const used: string[] = [];

  for (const q of queries) {
    const page = Math.min(8, limit);
    const { hits, hitCount: hc, trace } = await epmcSearch(q, page);
    traces.push(trace);
    used.push(q);
    if (hc) hitCount = Math.max(hitCount, hc);
    for (const h of hits) {
      if (!byId.has(h.id)) byId.set(h.id, h);
    }
    if (byId.size >= limit) break;
    await politeDelay(60);
  }

  // Name-only fallback if still thin
  if (byId.size < 4) {
    const q2 = `TITLE_ABS:"${n}"`;
    const { hits, hitCount: hc, trace } = await epmcSearch(q2, limit);
    traces.push(trace);
    used.push(`fallback:${q2}`);
    if (hc) hitCount = Math.max(hitCount, hc);
    for (const h of hits) {
      if (!byId.has(h.id)) byId.set(h.id, h);
    }
  }

  // Rank by process-relevance scorer (CMC / synthesis language first)
  const hits = rankLiteratureByProcessRelevance([...byId.values()]).slice(
    0,
    limit
  );

  return {
    query: used.join(" | "),
    hitCount,
    hits,
    traces,
  };
}
