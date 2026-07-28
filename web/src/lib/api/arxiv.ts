/**
 * arXiv Atom API — free preprints (process chemistry / catalysis often full text).
 * Docs: https://info.arxiv.org/help/api/user-manual.html
 */

import { fetchWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { LiteratureHit } from "@/lib/api/europePmc";
import { extractProcessWindowsFromFullText } from "@/lib/api/europePmc";
import { rankLiteratureByProcessRelevance } from "@/lib/literature/rank";
import { politeDelay } from "@/lib/api/rateLimit";

// Prefer https when available
const ARXIV_API_HTTPS = "https://export.arxiv.org/api/query";

/**
 * Search arXiv for process / synthesis preprints and densify with free PDF text when short.
 */
export async function searchArxivProcess(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: LiteratureHit[];
  traces: ApiFetchTrace[];
  query: string;
  procedureTexts: string[];
}> {
  const limit = Math.min(opts.limit ?? 6, 12);
  const name = compoundName.trim();
  if (!name) return { hits: [], traces: [], query: "", procedureTexts: [] };

  const q =
    `all:"${name.replace(/"/g, "")}" AND (all:synthesis OR all:manufacturing OR all:preparation OR all:catalysis OR all:hydrogenation OR all:crystallization OR all:"process chemistry" OR all:fermentation)`;
  const url =
    `${ARXIV_API_HTTPS}?search_query=${encodeURIComponent(q)}` +
    `&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`;

  const { text, trace } = await fetchWithTrace(url, {
    next: { revalidate: 3600 },
    timeoutMs: 12_000,
    headers: { Accept: "application/atom+xml, application/xml, text/xml, */*" },
  });

  const entries = parseAtomEntries(text || "");
  const hits: LiteratureHit[] = entries.map((e) => ({
    id: `arxiv:${e.id}`,
    source: "arXiv",
    title: e.title,
    authors: e.authors,
    year: e.published?.slice(0, 4),
    abstract: e.summary?.slice(0, 2000),
    url: e.absUrl,
    isOpenAccess: true,
    doi: e.doi,
  }));

  const ranked = rankLiteratureByProcessRelevance(hits).slice(0, limit);
  const procedureTexts: string[] = [];
  const traces: ApiFetchTrace[] = [trace];

  // Densify top 2 with free HTML abstract page (PDF binary not parsed here)
  for (const h of ranked.slice(0, 2)) {
    if (h.abstract && h.abstract.length > 400) {
      procedureTexts.push(
        extractProcessWindowsFromFullText(h.abstract, 2500)
      );
    }
    await politeDelay(50);
  }

  // Attach densest abstract window as fullTextExcerpt
  for (const h of ranked) {
    if (h.abstract && h.abstract.length > 200) {
      h.fullTextExcerpt = extractProcessWindowsFromFullText(h.abstract, 2800);
      h.fullTextChars = h.abstract.length;
    }
  }

  return {
    hits: ranked,
    traces,
    query: q,
    procedureTexts: procedureTexts.filter((t) => t.length >= 60),
  };
}

interface AtomEntry {
  id: string;
  title: string;
  summary?: string;
  authors?: string;
  published?: string;
  absUrl: string;
  doi?: string;
}

function parseAtomEntries(xml: string): AtomEntry[] {
  if (!xml) return [];
  const chunks = xml.split(/<entry>/i).slice(1);
  const out: AtomEntry[] = [];
  for (const c of chunks) {
    const idRaw =
      c.match(/<id>([^<]+)<\/id>/i)?.[1]?.trim() ||
      c.match(/arxiv\.org\/abs\/([^<"\s]+)/i)?.[1] ||
      "";
    const id = idRaw.replace(/^https?:\/\/arxiv\.org\/abs\//i, "").replace(/v\d+$/i, "");
    const title = decodeXml(
      c.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const summary = decodeXml(
      c.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const published = c.match(/<published>([^<]+)<\/published>/i)?.[1];
    const authors = [
      ...c.matchAll(/<name>([^<]+)<\/name>/gi),
    ]
      .map((m) => m[1].trim())
      .slice(0, 8)
      .join(", ");
    const absUrl =
      c.match(/href="(https?:\/\/arxiv\.org\/abs\/[^"]+)"/i)?.[1] ||
      (id ? `https://arxiv.org/abs/${id}` : "https://arxiv.org");
    const doi = c
      .match(/arxiv\.org\/abs\/[^"]+"[^>]*>doi:([^<]+)/i)?.[1]
      ?.trim();
    if (!title) continue;
    out.push({
      id: id || title.slice(0, 40),
      title,
      summary,
      authors: authors || undefined,
      published,
      absUrl,
      doi,
    });
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
