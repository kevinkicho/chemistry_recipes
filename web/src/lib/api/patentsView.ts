/**
 * Patent search — PatentsView (USPTO) when available, free Europe PMC fallback.
 *
 * As of 2026, PatentsView is migrating into USPTO Open Data Portal
 * (search.patentsview.org may be unreachable). Free-public process patents
 * continue via Europe PMC SRC:PAT + PubChem patent xrefs / PUG View densify.
 *
 * Optional PATENTSVIEW_API_KEY when PatentsView PatentSearch API is restored.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import { searchEuropePmcPatents } from "@/lib/api/patentFullText";

const PV = "https://search.patentsview.org/api/v1";

export interface PatentHit {
  id: string;
  patentNumber: string;
  title: string;
  date?: string;
  abstract?: string;
  /**
   * Process/example window extracted from abstract or Europe PMC patent record.
   * Not full claims — use Local enrich for full example text.
   */
  procedureExcerpt?: string;
  assignees?: string[];
  url: string;
}

export interface PatentSearchResult {
  query: string;
  hits: PatentHit[];
  traces: ApiFetchTrace[];
  keyConfigured: boolean;
  note?: string;
  /** Which backend produced hits */
  backend?: "patentsview" | "europepmc-pat" | "none";
}

function getPatentsViewKey(): string {
  return (process.env.PATENTSVIEW_API_KEY || "").trim();
}

/**
 * Search for process / synthesis patents mentioning the compound.
 * Prefers PatentsView when host+key work; always free-fallback to Europe PMC patents.
 */
export async function searchPatentsView(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<PatentSearchResult> {
  const limit = Math.min(opts.limit ?? 10, 25);
  const name = compoundName.trim();
  const key = getPatentsViewKey();

  if (!name) {
    return {
      query: "",
      hits: [],
      traces: [],
      keyConfigured: Boolean(key),
      backend: "none",
    };
  }

  // 1) PatentsView when key present and host resolves (may be down during ODP migration)
  if (key) {
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

    try {
      const { data, trace } = await fetchJsonWithTrace<{
        patents?: Array<{
          patent_id?: string;
          patent_title?: string;
          patent_date?: string;
          patent_abstract?: string;
          assignees?: Array<{
            assignee_organization?: string;
            assignee_harmonized?: string;
          }>;
        }>;
        error?: string;
      }>(url, {
        headers: {
          "X-Api-Key": key,
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
        timeoutMs: 14_000,
      });

      if (trace.ok && (data?.patents?.length || 0) > 0) {
        const hits: PatentHit[] = (data?.patents ?? []).map((p) => {
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
            abstract: p.patent_abstract?.slice(0, 4000),
            assignees,
            url: `https://patents.google.com/patent/US${num.replace(/^US/i, "")}`,
          };
        });
        return {
          query: name,
          hits,
          traces: [trace],
          keyConfigured: true,
          backend: "patentsview",
        };
      }

      // Host up but empty / error — fall through to free EPMC
      if (!trace.ok) {
        /* fall through */
      } else {
        // empty patents — still try EPMC for denser process abstracts
      }
    } catch {
      /* DNS/network — fall through to free path */
    }
  }

  // 2) Free-public fallback: Europe PMC SRC:PAT (works without PatentsView)
  const epmc = await searchEuropePmcPatents(name, { limit });
  return {
    query: epmc.query || name,
    hits: epmc.hits,
    traces: epmc.traces,
    keyConfigured: Boolean(key),
    backend: epmc.hits.length ? "europepmc-pat" : "none",
    note: key
      ? "PatentsView unavailable or empty (USPTO ODP migration) — used free Europe PMC patent corpus."
      : "PatentsView host/API requires key and may be offline during USPTO ODP migration — used free Europe PMC patent corpus (SRC:PAT).",
  };
}

/**
 * Free patent-adjacent literature (title/abstract keywords) via Europe PMC.
 * Parallel gather path alongside PatentsView / SRC:PAT densify.
 */
export async function searchPatentLiterature(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<PatentSearchResult> {
  const limit = opts.limit ?? 8;
  const name = compoundName.trim();
  if (!name) {
    return {
      query: "",
      hits: [],
      traces: [],
      keyConfigured: Boolean(getPatentsViewKey()),
      backend: "none",
    };
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
  }>(url, { next: { revalidate: 3600 }, timeoutMs: 12_000 });

  const results = data?.resultList?.result ?? [];
  const hits: PatentHit[] = results.map((r, i) => ({
    id: `epmc-patlit:${r.source || "x"}:${r.id || i}`,
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
    keyConfigured: Boolean(getPatentsViewKey()),
    backend: hits.length ? "europepmc-pat" : "none",
    note: "Patent-adjacent literature via free Europe PMC. PatentsView host may be offline during USPTO ODP migration.",
  };
}
