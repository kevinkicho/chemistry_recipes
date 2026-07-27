/**
 * PubMed via NCBI E-utilities (free public).
 * Docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/
 *
 * Process-focused search → esummary abstracts → optional PMC full text via Europe PMC.
 */

import {
  fetchJsonWithTrace,
  fetchWithTrace,
  type ApiFetchTrace,
} from "@/lib/api/trace";
import { politeDelay } from "@/lib/api/rateLimit";
import type { LiteratureHit } from "@/lib/api/europePmc";
import { enrichLiteratureWithOaFullText } from "@/lib/api/europePmc";
import { rankLiteratureByProcessRelevance } from "@/lib/literature/rank";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function toolParams(): string {
  // Optional NCBI key raises rate limits
  const key = (process.env.NCBI_API_KEY || process.env.PUBMED_API_KEY || "").trim();
  const base = "tool=ChemistryRecipes&email=noreply%40chemistry-recipes.local";
  return key ? `${base}&api_key=${encodeURIComponent(key)}` : base;
}

/**
 * Search PubMed for process / manufacturing chemistry literature.
 */
export async function searchPubMedProcess(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: LiteratureHit[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const limit = Math.min(opts.limit ?? 10, 20);
  const name = compoundName.trim();
  if (!name) return { hits: [], traces: [], query: "" };

  const term =
    `(${name}[Title/Abstract]) AND (synthesis OR manufacturing OR preparation OR "process chemistry" OR "industrial production" OR crystallization OR hydrogenation OR fermentation OR biocatalytic OR "scale-up" OR "process for preparing")`;
  const searchUrl =
    `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=${limit}` +
    `&sort=relevance&term=${encodeURIComponent(term)}&${toolParams()}`;

  const traces: ApiFetchTrace[] = [];
  const search = await fetchJsonWithTrace<{
    esearchresult?: { idlist?: string[]; count?: string };
  }>(searchUrl, {
    next: { revalidate: 3600 },
    timeoutMs: 12_000,
  });
  traces.push(search.trace);

  const ids = search.data?.esearchresult?.idlist ?? [];
  if (!ids.length) {
    return { hits: [], traces, query: term };
  }

  await politeDelay(120);
  const sumUrl =
    `${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}` +
    `&${toolParams()}`;
  const sum = await fetchJsonWithTrace<{
    result?: Record<
      string,
      {
        uid?: string;
        title?: string;
        fulljournalname?: string;
        source?: string;
        pubdate?: string;
        authors?: Array<{ name?: string }>;
        elocationid?: string;
        articleids?: Array<{ idtype?: string; value?: string }>;
      }
    >;
  }>(sumUrl, { next: { revalidate: 3600 }, timeoutMs: 12_000 });
  traces.push(sum.trace);

  // Abstract via efetch XML (retmode=xml) for denser process windows
  await politeDelay(120);
  const fetchUrl =
    `${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.slice(0, limit).join(",")}` +
    `&${toolParams()}`;
  const { text: xml, trace: fetchTrace } = await fetchWithTrace(fetchUrl, {
    next: { revalidate: 3600 },
    timeoutMs: 14_000,
    headers: { Accept: "application/xml" },
  });
  traces.push(fetchTrace);

  const abstractByPmid = parsePubmedAbstracts(xml || "");

  const hits: LiteratureHit[] = [];
  for (const id of ids) {
    const r = sum.data?.result?.[id];
    if (!r || r.uid === undefined && !r.title) continue;
    const pmid = r.uid || id;
    const doi = r.articleids?.find((a) => a.idtype === "doi")?.value;
    const pmcid = r.articleids?.find(
      (a) => a.idtype === "pmc" || a.idtype === "pmcid"
    )?.value;
    const year = r.pubdate?.match(/\d{4}/)?.[0];
    const authors = r.authors
      ?.slice(0, 6)
      .map((a) => a.name)
      .filter(Boolean)
      .join(", ");
    const abstract = abstractByPmid[pmid] || abstractByPmid[id];
    hits.push({
      id: `pubmed:${pmid}`,
      source: "PubMed",
      title: r.title || "(untitled)",
      authors,
      journal: r.fulljournalname || r.source,
      year,
      doi,
      pmid,
      pmcid: pmcid?.replace(/^PMC/i, "PMC"),
      abstract: abstract?.slice(0, 2000),
      url: doi
        ? `https://doi.org/${doi}`
        : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      isOpenAccess: Boolean(pmcid),
    });
  }

  let ranked = rankLiteratureByProcessRelevance(hits).slice(0, limit);

  // OA densify via Europe PMC when PMCID present
  const oa = await enrichLiteratureWithOaFullText(ranked, { maxArticles: 3 });
  ranked = oa.hits;
  traces.push(...oa.traces);

  return { hits: ranked, traces, query: term };
}

function parsePubmedAbstracts(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!xml) return out;
  // Split by PubmedArticle roughly
  const articles = xml.split(/<PubmedArticle>/i).slice(1);
  for (const art of articles) {
    const pmid = art.match(/<PMID[^>]*>(\d+)<\/PMID>/i)?.[1];
    if (!pmid) continue;
    const absParts = [
      ...art.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi),
    ].map((m) =>
      m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (absParts.length) out[pmid] = absParts.join(" ");
  }
  return out;
}
