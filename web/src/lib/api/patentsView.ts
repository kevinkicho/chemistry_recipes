/**
 * PatentsView (USPTO) client — free public patent search when API key is set.
 * Docs: https://patentsview.org/apis/api-query-language
 *
 * Without PATENTSVIEW_API_KEY, returns empty hits (key required by USPTO portal).
 * Europe PMC patent-style literature is used as a parallel free path in gather.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const PV = "https://search.patentsview.org/api/v1";

export interface PatentHit {
  id: string;
  patentNumber: string;
  title: string;
  date?: string;
  abstract?: string;
  assignees?: string[];
  url: string;
}

export interface PatentSearchResult {
  query: string;
  hits: PatentHit[];
  traces: ApiFetchTrace[];
  keyConfigured: boolean;
  note?: string;
}

function getPatentsViewKey(): string {
  return (process.env.PATENTSVIEW_API_KEY || "").trim();
}

/**
 * Search PatentsView for process / synthesis patents mentioning the compound.
 */
export async function searchPatentsView(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<PatentSearchResult> {
  const limit = Math.min(opts.limit ?? 10, 25);
  const name = compoundName.trim();
  const key = getPatentsViewKey();

  if (!name) {
    return { query: "", hits: [], traces: [], keyConfigured: Boolean(key) };
  }

  if (!key) {
    return {
      query: name,
      hits: [],
      traces: [],
      keyConfigured: false,
      note: "PatentsView requires a free API key (PATENTSVIEW_API_KEY). Literature patents may still appear via Europe PMC.",
    };
  }

  // PatentsView query language (GET)
  const url = `${PV}/patent/?q=${encodeURIComponent(
    JSON.stringify({
      _or: [
        { _text_any: { patent_title: `${name} synthesis` } },
        { _text_any: { patent_title: `${name} process` } },
        { _text_any: { patent_abstract: `${name} manufacturing` } },
        { _text_any: { patent_title: name } },
      ],
    })
  )}&f=${encodeURIComponent(
    JSON.stringify([
      "patent_id",
      "patent_title",
      "patent_date",
      "patent_abstract",
      "assignees",
    ])
  )}&o=${encodeURIComponent(JSON.stringify({ size: limit }))}&s=${encodeURIComponent(
    JSON.stringify([{ patent_date: "desc" }])
  )}`;

  const { data, trace } = await fetchJsonWithTrace<{
    patents?: Array<{
      patent_id?: string;
      patent_title?: string;
      patent_date?: string;
      patent_abstract?: string;
      assignees?: Array<{ assignee_organization?: string; assignee_harmonized?: string }>;
    }>;
    error?: string;
  }>(url, {
    headers: {
      "X-Api-Key": key,
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  const patents = data?.patents ?? [];
  const hits: PatentHit[] = patents.map((p) => {
    const num = p.patent_id || "unknown";
    const assignees =
      p.assignees
        ?.map((a) => a.assignee_organization || a.assignee_harmonized || "")
        .filter(Boolean) ?? [];
    return {
      id: `uspto:${num}`,
      patentNumber: num,
      title: p.patent_title || "(untitled patent)",
      date: p.patent_date,
      // Keep longer abstracts for process-fact extraction (conditions often in abstract)
      abstract: p.patent_abstract?.slice(0, 4000),
      assignees,
      url: `https://patents.google.com/patent/US${num.replace(/^US/i, "")}`,
    };
  });

  return {
    query: `${name} (process/synthesis)`,
    hits,
    traces: [trace],
    keyConfigured: true,
    note: hits.length === 0 ? "No PatentsView hits for this query." : undefined,
  };
}

/**
 * Free fallback: Europe PMC works that look like patents / process IP mentions.
 * Uses the Europe PMC REST already allowed without a key.
 */
export async function searchPatentLiterature(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<PatentSearchResult> {
  const limit = opts.limit ?? 8;
  const name = compoundName.trim();
  if (!name) {
    return { query: "", hits: [], traces: [], keyConfigured: false };
  }

  const query = `(TITLE_ABS:"${name.replace(/"/g, " ")}") AND (patent OR USPTO OR "process for preparing" OR "method of manufacturing" OR "industrial process")`;
  const url =
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}` +
    `&resultType=core&pageSize=${limit}&format=json`;

  const { data, trace } = await fetchJsonWithTrace<{
    resultList?: {
      result?: Array<{
        id?: string;
        source?: string;
        title?: string;
        pubYear?: string;
        abstractText?: string;
        doi?: string;
        pmid?: string;
      }>;
    };
  }>(url, { next: { revalidate: 3600 } });

  const results = data?.resultList?.result ?? [];
  const hits: PatentHit[] = results.map((r, i) => ({
    id: `epmc-pat:${r.source || "x"}:${r.id || i}`,
    patentNumber: r.pmid || r.id || `lit-${i}`,
    title: r.title || "(untitled)",
    date: r.pubYear,
    abstract: r.abstractText?.slice(0, 1200),
    url: r.doi
      ? `https://doi.org/${r.doi}`
      : r.pmid
        ? `https://europepmc.org/article/MED/${r.pmid}`
        : "https://europepmc.org",
  }));

  return {
    query,
    hits,
    traces: [trace],
    keyConfigured: false,
    note: "Patent-adjacent literature via Europe PMC (free). Set PATENTSVIEW_API_KEY for USPTO PatentsView.",
  };
}
