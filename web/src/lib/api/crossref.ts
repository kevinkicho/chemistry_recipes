/**
 * Crossref Works API — free scholarly metadata (no key for polite use).
 * Docs: https://api.crossref.org/
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { LiteratureHit } from "@/lib/api/europePmc";

const CROSSREF = "https://api.crossref.org";

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  "container-title"?: string[];
  issued?: { "date-parts"?: number[][] };
  abstract?: string;
  URL?: string;
}

/**
 * Process / manufacturing literature via Crossref bibliographic search.
 */
export async function searchCrossrefProcess(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<{ hits: LiteratureHit[]; traces: ApiFetchTrace[]; query: string }> {
  const limit = Math.min(opts.limit ?? 8, 12);
  const name = compoundName.trim();
  if (!name) return { hits: [], traces: [], query: "" };

  const q = `${name} synthesis OR manufacture OR preparation OR "process chemistry"`;
  const url =
    `${CROSSREF}/works?query.bibliographic=${encodeURIComponent(q)}` +
    `&rows=${limit}&select=DOI,title,author,container-title,issued,abstract,URL`;

  const { data, trace } = await fetchJsonWithTrace<{
    message?: { items?: CrossrefItem[] };
  }>(url, {
    next: { revalidate: 3600 },
    headers: {
      // Crossref asks for a polite mailto User-Agent
      "User-Agent": "ChemistryRecipes/1.0 (mailto:devnull@example.com; educational)",
      Accept: "application/json",
    },
  });

  const items = data?.message?.items ?? [];
  const hits: LiteratureHit[] = items.map((it, i) => {
    const doi = it.DOI;
    const year = it.issued?.["date-parts"]?.[0]?.[0];
    const authors = it.author
      ?.slice(0, 4)
      .map((a) => [a.given, a.family].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", ");
    const abstract = it.abstract
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1200);
    return {
      id: `crossref:${doi || i}`,
      source: "Crossref",
      title: it.title?.[0] || "(untitled)",
      authors: authors || undefined,
      journal: it["container-title"]?.[0],
      year: year != null ? String(year) : undefined,
      doi,
      abstract,
      url: doi ? `https://doi.org/${doi}` : it.URL || "https://www.crossref.org/",
    };
  });

  return { hits, traces: [trace], query: q };
}
