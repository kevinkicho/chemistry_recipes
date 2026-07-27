/**
 * Europe PMC REST client — free public literature (EMBL-EBI).
 * Docs: https://europepmc.org/RestfulWebService
 *
 * Multi-query harvest for process / manufacturing chemistry.
 */

import {
  fetchJsonWithTrace,
  fetchWithTrace,
  type ApiFetchTrace,
} from "@/lib/api/trace";
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
  /**
   * Process-relevant excerpt from Europe PMC OA fullTextXML when available
   * (experimental / methods / manufacturing language preferred).
   */
  fullTextExcerpt?: string;
  fullTextChars?: number;
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

/** Strip XML tags and collapse whitespace for process-fact extraction. */
function xmlToPlain(xml: string): string {
  return xml
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prefer experimental / methods / manufacturing windows from OA full text.
 * Falls back to process-keyword windows if section headers are missing.
 */
export function extractProcessWindowsFromFullText(
  plain: string,
  maxChars = 4500
): string {
  if (!plain || plain.length < 80) return "";
  const sectionRe =
    /(?:^|\s)((?:experimental(?:\s+section)?|materials?\s+and\s+methods|methods?(?:\s+and\s+materials)?|general\s+procedure|synthesis(?:\s+of)?|preparation(?:\s+of)?|manufacturing|process\s+for|industrial\s+production|worked\s+examples?|example\s+\d+)[:.\s])/gi;
  const hits: Array<{ i: number; label: string }> = [];
  let m: RegExpExecArray | null;
  sectionRe.lastIndex = 0;
  while ((m = sectionRe.exec(plain)) !== null && hits.length < 8) {
    hits.push({ i: m.index, label: m[1].trim() });
  }
  const chunks: string[] = [];
  if (hits.length) {
    for (const h of hits) {
      const start = h.i;
      const end = Math.min(plain.length, start + 1600);
      chunks.push(plain.slice(start, end));
    }
  } else {
    // Keyword windows: synthesis / °C / hydrogenat / crystall
    const kw =
      /synthesi|manufactur|preparat|hydrogenat|crystall|°\s*C|equiv\.?|under\s+N2|process for preparing|industrial/gi;
    kw.lastIndex = 0;
    let km: RegExpExecArray | null;
    let n = 0;
    while ((km = kw.exec(plain)) !== null && n < 6) {
      n += 1;
      const start = Math.max(0, km.index - 120);
      const end = Math.min(plain.length, km.index + 900);
      chunks.push(plain.slice(start, end));
    }
  }
  const merged = chunks.join("\n…\n").replace(/\s+/g, " ").trim();
  if (!merged) return plain.slice(0, maxChars);
  return merged.length > maxChars ? merged.slice(0, maxChars - 1) + "…" : merged;
}

/**
 * Fetch Europe PMC OA fullTextXML for a PMC article.
 * Only Open Access subset returns body; others 404/empty.
 */
export async function fetchEuropePmcFullTextXml(
  pmcid: string
): Promise<{ text: string; plain: string; excerpt: string; trace: ApiFetchTrace }> {
  const id = pmcid.replace(/^PMC/i, "").trim();
  const url = `${EPMC}/PMC${id}/fullTextXML`;
  const { text, trace } = await fetchWithTrace(url, {
    next: { revalidate: 86400 },
    timeoutMs: 14_000,
    headers: { Accept: "application/xml, text/xml, */*" },
  });
  const plain = xmlToPlain(text || "");
  return {
    text: (text || "").slice(0, 50_000),
    plain,
    excerpt: extractProcessWindowsFromFullText(plain),
    trace: {
      ...trace,
      // Prefer plain excerpt in provenance tables (not raw XML)
      responseBody: plain.slice(0, 1200) || trace.responseBody,
    },
  };
}

/**
 * Enrich top process-ranked OA hits with full-text procedure excerpts.
 * Caps concurrent fetches for gather latency.
 */
export async function enrichLiteratureWithOaFullText(
  hits: LiteratureHit[],
  opts: { maxArticles?: number } = {}
): Promise<{ hits: LiteratureHit[]; traces: ApiFetchTrace[] }> {
  const max = opts.maxArticles ?? 4;
  const traces: ApiFetchTrace[] = [];
  const candidates = hits.filter(
    (h) => h.isOpenAccess && (h.pmcid || (h.source === "PMC" && h.id))
  );
  const toFetch = candidates.slice(0, max);
  const byId = new Map(hits.map((h) => [h.id, { ...h }]));

  for (const h of toFetch) {
    const pmcid =
      h.pmcid ||
      (h.source === "PMC" ? String(h.id).replace(/^PMC/i, "") : "");
    if (!pmcid) continue;
    const ft = await fetchEuropePmcFullTextXml(pmcid);
    traces.push(ft.trace);
    if (ft.excerpt && ft.excerpt.length >= 80) {
      const cur = byId.get(h.id);
      if (cur) {
        cur.fullTextExcerpt = ft.excerpt;
        cur.fullTextChars = ft.plain.length;
        // Prefer denser abstract for ranking when abstract was thin
        if (!cur.abstract || cur.abstract.length < 200) {
          cur.abstract = ft.excerpt.slice(0, 1500);
        }
      }
    }
    await politeDelay(80);
  }

  return { hits: hits.map((h) => byId.get(h.id) || h), traces };
}
