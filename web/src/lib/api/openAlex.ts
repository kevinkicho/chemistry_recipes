/**
 * OpenAlex free works API — process / synthesis literature enrichment.
 * Docs: https://docs.openalex.org/
 * No API key required for modest use; polite User-Agent recommended.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { LiteratureHit } from "@/lib/api/europePmc";

const OPENALEX = "https://api.openalex.org";

interface OpenAlexWork {
  id?: string;
  display_name?: string;
  publication_year?: number;
  doi?: string;
  abstract_inverted_index?: Record<string, number[]>;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { source?: { display_name?: string } };
  open_access?: { is_oa?: boolean; oa_url?: string };
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
  meta?: { count?: number };
}

function reconstructAbstract(inv?: Record<string, number[]>): string | undefined {
  if (!inv || typeof inv !== "object") return undefined;
  const pairs: Array<{ word: string; pos: number }> = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const p of positions) pairs.push({ word, pos: p });
  }
  if (!pairs.length) return undefined;
  pairs.sort((a, b) => a.pos - b.pos);
  return pairs
    .map((p) => p.word)
    .join(" ")
    .slice(0, 1200);
}

function toHit(w: OpenAlexWork, i: number): LiteratureHit {
  const doi = w.doi?.replace(/^https?:\/\/doi\.org\//i, "");
  const id = w.id?.replace("https://openalex.org/", "") || `openalex-${i}`;
  const authors = w.authorships
    ?.map((a) => a.author?.display_name)
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  return {
    id: `openalex:${id}`,
    source: "OpenAlex",
    title: w.display_name || "(untitled)",
    authors: authors || undefined,
    journal: w.primary_location?.source?.display_name,
    year: w.publication_year != null ? String(w.publication_year) : undefined,
    doi,
    abstract: reconstructAbstract(w.abstract_inverted_index),
    url: doi
      ? `https://doi.org/${doi}`
      : w.open_access?.oa_url || w.id || "https://openalex.org",
    isOpenAccess: Boolean(w.open_access?.is_oa),
  };
}

/**
 * Search OpenAlex for process/synthesis works about a compound.
 */
export async function searchOpenAlexProcess(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<{ hits: LiteratureHit[]; traces: ApiFetchTrace[]; query: string }> {
  const limit = Math.min(opts.limit ?? 8, 15);
  const name = compoundName.trim();
  if (!name) return { hits: [], traces: [], query: "" };

  const q = `${name} (synthesis OR manufacture OR "process chemistry" OR preparation OR fermentation OR "industrial production")`;
  const url =
    `${OPENALEX}/works?search=${encodeURIComponent(q)}` +
    `&per_page=${limit}&sort=relevance_score:desc`;

  const { data, trace } = await fetchJsonWithTrace<OpenAlexResponse>(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ChemistryRecipes/1.0 (educational; mailto:dev@localhost)",
    },
    next: { revalidate: 3600 },
  });

  const hits = (data?.results ?? []).map(toHit);
  return { hits, traces: [trace], query: q };
}
