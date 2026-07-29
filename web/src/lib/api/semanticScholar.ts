/**
 * Semantic Scholar Graph API — free academic search (rate-limited).
 * Docs: https://api.semanticscholar.org/
 *
 * Optional free key: SEMANTIC_SCHOLAR_API_KEY or S2_API_KEY (higher limits).
 * Degrades quietly on 429 after short retries.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { LiteratureHit } from "@/lib/api/europePmc";
import { politeDelay } from "@/lib/api/rateLimit";

const SS = "https://api.semanticscholar.org/graph/v1";

function s2Headers(): Record<string, string> {
  const key = (
    process.env.SEMANTIC_SCHOLAR_API_KEY ||
    process.env.S2_API_KEY ||
    ""
  ).trim();
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent":
      "ChemistryRecipes/1.0 (educational free-public densify; mailto:devnull@example.com)",
  };
  if (key) h["x-api-key"] = key;
  return h;
}

/**
 * Process/synthesis paper search. Retries once on 429; degrades quietly.
 */
export async function searchSemanticScholarProcess(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<{ hits: LiteratureHit[]; traces: ApiFetchTrace[]; query: string }> {
  const limit = Math.min(opts.limit ?? 6, 10);
  const name = compoundName.trim();
  if (!name) return { hits: [], traces: [], query: "" };

  const q = `${name} synthesis OR manufacture OR preparation OR process chemistry`;
  const url =
    `${SS}/paper/search?query=${encodeURIComponent(q)}` +
    `&limit=${limit}&fields=title,year,abstract,url,externalIds,venue,authors,isOpenAccess,openAccessPdf`;

  type S2Paper = {
    paperId?: string;
    title?: string;
    year?: number;
    abstract?: string;
    url?: string;
    venue?: string;
    externalIds?: { DOI?: string; PubMed?: string; PubMedCentral?: string };
    authors?: Array<{ name?: string }>;
    isOpenAccess?: boolean;
    openAccessPdf?: { url?: string };
  };
  type S2Response = { data?: S2Paper[]; message?: string };

  const traces: ApiFetchTrace[] = [];
  let data: S2Response | null = null;

  // Up to 3 attempts with backoff on 429 (S2 free tier is strict)
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchJsonWithTrace<S2Response>(url, {
      next: { revalidate: 3600 },
      timeoutMs: 14_000,
      headers: s2Headers(),
      // Let our loop own 429 retries (trace still retries other 5xx)
      retries: 0,
    });
    traces.push(res.trace);
    if (res.trace.ok && res.data) {
      data = res.data;
      break;
    }
    if (res.trace.httpStatus === 429 && attempt < 2) {
      await politeDelay(1200 * (attempt + 1) + Math.floor(Math.random() * 400));
      continue;
    }
    break;
  }

  if (!data?.data?.length) {
    return { hits: [], traces, query: q };
  }

  const hits: LiteratureHit[] = data.data.map((p: S2Paper, i: number) => {
    const doi = p.externalIds?.DOI;
    const pmcid = p.externalIds?.PubMedCentral
      ? `PMC${String(p.externalIds.PubMedCentral).replace(/^PMC/i, "")}`
      : undefined;
    const pmid = p.externalIds?.PubMed;
    return {
      id: `s2:${p.paperId || i}`,
      source: "SemanticScholar",
      title: p.title || "(untitled)",
      authors: p.authors
        ?.slice(0, 4)
        .map((a) => a.name)
        .filter(Boolean)
        .join(", "),
      journal: p.venue,
      year: p.year != null ? String(p.year) : undefined,
      doi,
      pmid,
      pmcid,
      abstract: p.abstract?.slice(0, 1500),
      isOpenAccess: Boolean(p.isOpenAccess || p.openAccessPdf?.url || pmcid),
      url: doi
        ? `https://doi.org/${doi}`
        : p.openAccessPdf?.url ||
          p.url ||
          (p.paperId
            ? `https://www.semanticscholar.org/paper/${p.paperId}`
            : "https://www.semanticscholar.org/"),
    };
  });

  return { hits, traces, query: q };
}
