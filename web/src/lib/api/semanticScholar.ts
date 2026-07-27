/**
 * Semantic Scholar Graph API — free academic search (rate-limited).
 * Docs: https://api.semanticscholar.org/
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { LiteratureHit } from "@/lib/api/europePmc";

const SS = "https://api.semanticscholar.org/graph/v1";

/**
 * Process/synthesis paper search. Degrades quietly on 429.
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

  const { data, trace } = await fetchJsonWithTrace<{
    data?: Array<{
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
    }>;
    message?: string;
  }>(url, { next: { revalidate: 3600 } });

  if (!trace.ok) {
    return { hits: [], traces: [trace], query: q };
  }

  const hits: LiteratureHit[] = (data?.data ?? []).map((p, i) => {
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

  return { hits, traces: [trace], query: q };
}
