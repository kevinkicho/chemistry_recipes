/**
 * Organic Syntheses — classic validated prep literature (free HTML, no bulk API).
 * Site: https://www.orgsyn.org/
 *
 * Strategy: site search HTML + procedure page extract when a prep matches the name.
 * Educational plant context — not a modern GMP package.
 */

import { fetchWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import { extractProcessWindowsFromFullText } from "@/lib/api/europePmc";
import type { ExternalAnnotation } from "@/lib/dossier/types";
import type { ProcedureExcerpt } from "@/lib/dossier/types";

export interface OrgSynHit {
  title: string;
  url: string;
  procedureExcerpt?: string;
}

/**
 * Search Organic Syntheses for the compound and extract procedure text from top hit.
 */
export async function fetchOrgSynByName(
  name: string
): Promise<{
  hits: OrgSynHit[];
  annotations: ExternalAnnotation[];
  procedureExcerpts: ProcedureExcerpt[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  if (!q) {
    return {
      hits: [],
      annotations: [],
      procedureExcerpts: [],
      traces: [],
      query: "",
    };
  }

  const traces: ApiFetchTrace[] = [];
  // OrgSyn search form historically: search.aspx?q=
  const searchUrls = [
    `https://www.orgsyn.org/search.aspx?q=${encodeURIComponent(q)}`,
    `https://www.orgsyn.org/demo.aspx?prep=${encodeURIComponent(q)}`,
  ];

  let hits: OrgSynHit[] = [];
  for (const searchUrl of searchUrls) {
    const { text, trace } = await fetchWithTrace(searchUrl, {
      next: { revalidate: 86400 },
      timeoutMs: 12_000,
      headers: {
        Accept: "text/html",
        "User-Agent": "ChemistryRecipes/1.3 (educational; OrgSyn procedure lookup)",
      },
    });
    traces.push(trace);
    if (!text || text.length < 100) continue;
    const found = extractSearchHits(text, q);
    if (found.length) {
      hits = found;
      break;
    }
  }

  // Always add a deep search link even if HTML parse fails
  const searchLink = `https://www.orgsyn.org/search.aspx?q=${encodeURIComponent(q)}`;
  const annotations: ExternalAnnotation[] = [];
  const procedureExcerpts: ProcedureExcerpt[] = [];

  if (!hits.length) {
    annotations.push({
      source: "Organic Syntheses",
      organization: "Organic Syntheses, Inc.",
      kind: "literature",
      title: "Organic Syntheses (search)",
      summary:
        "No auto-matched prep in HTML parse — open OrgSyn search for classic validated procedures (educational).",
      url: searchLink,
      endpointUrl: "https://www.orgsyn.org/",
      fields: { query: q, role: "classic-prep-search" },
    });
    return { hits: [], annotations, procedureExcerpts, traces, query: q };
  }

  // Fetch top procedure page
  const top = hits[0]!;
  const page = await fetchWithTrace(top.url, {
    next: { revalidate: 86400 },
    timeoutMs: 14_000,
    headers: {
      Accept: "text/html",
      "User-Agent": "ChemistryRecipes/1.3 (educational; OrgSyn procedure extract)",
    },
  });
  traces.push(page.trace);

  if (page.text && page.text.length > 200) {
    const plain = htmlToPlain(page.text);
    const excerpt = extractProcessWindowsFromFullText(plain, 5000);
    // OrgSyn pages are dense with procedure language — take a generous window
    const body =
      excerpt.length >= 120
        ? excerpt
        : plain
            .match(
              /(?:procedure|preparation|synthesis)[\s\S]{80,4000}/i
            )?.[0]
            ?.replace(/\s+/g, " ")
            .trim() || plain.slice(0, 3500);

    if (body && body.length >= 80) {
      top.procedureExcerpt = body.slice(0, 5000);
      procedureExcerpts.push({
        id: `orgsyn:${top.url}`,
        source: "orgsyn",
        label: `Organic Syntheses — ${top.title}`.slice(0, 120),
        text: top.procedureExcerpt,
        url: top.url,
        chars: top.procedureExcerpt.length,
      });
    }
  }

  for (const h of hits.slice(0, 4)) {
    annotations.push({
      source: "Organic Syntheses",
      organization: "Organic Syntheses, Inc.",
      kind: "literature",
      title: h.title.slice(0, 120),
      summary: h.procedureExcerpt
        ? h.procedureExcerpt.slice(0, 320)
        : "Classic free prep literature — educational procedure (not site SOP).",
      url: h.url,
      endpointUrl: "https://www.orgsyn.org/",
      fields: {
        role: "classic-prep",
        ...(h.procedureExcerpt
          ? { procedureChars: String(h.procedureExcerpt.length) }
          : {}),
      },
    });
  }

  return { hits, annotations, procedureExcerpts, traces, query: q };
}

function extractSearchHits(html: string, name: string): OrgSynHit[] {
  const hits: OrgSynHit[] = [];
  const seen = new Set<string>();
  // Common OrgSyn link patterns: prep.aspx?prep=CV… or content PDFs/HTML
  const linkRe =
    /href="((?:https?:\/\/www\.orgsyn\.org\/)?(?:prep|content|demo)\.aspx\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null && hits.length < 8) {
    let href = m[1];
    if (href.startsWith("/")) href = `https://www.orgsyn.org${href}`;
    if (!href.startsWith("http")) href = `https://www.orgsyn.org/${href}`;
    const title = htmlToPlain(m[2]).slice(0, 160) || name;
    if (seen.has(href)) continue;
    seen.add(href);
    hits.push({ title, url: href });
  }

  // Fallback: any orgsyn prep link
  if (!hits.length) {
    const loose = [
      ...html.matchAll(
        /https?:\/\/www\.orgsyn\.org\/[^\s"'<>]+/gi
      ),
    ];
    for (const lm of loose) {
      const href = lm[0].replace(/[.,;)]+$/, "");
      if (!/prep|content|demo/i.test(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      hits.push({ title: `${name} — OrgSyn prep`, url: href });
      if (hits.length >= 5) break;
    }
  }
  return hits;
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
