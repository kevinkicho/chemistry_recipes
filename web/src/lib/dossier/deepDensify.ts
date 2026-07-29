/**
 * Deep densify: fill abstracts + OA windows for literature hits using free APIs only.
 * Never scrapes DOI landing pages / HTML — Europe PMC + Crossref JSON only.
 */

import type { LiteratureHit } from "@/lib/api/europePmc";
import {
  fetchEuropePmcFullTextXml,
  enrichLiteratureWithOaFullText,
} from "@/lib/api/europePmc";
import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import { politeDelay } from "@/lib/api/rateLimit";
import {
  scoreProcessRelevance,
  isClinicalLiterature,
} from "@/lib/literature/rank";
import type { SourceRef } from "@/lib/types/process";

const EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const CROSSREF = "https://api.crossref.org";

/**
 * Fetch abstract / metadata for a single hit via Europe PMC DOI or PMID query,
 * then Crossref works/{doi} as backup.
 */
export async function densifyLiteratureHitMetadata(
  hit: LiteratureHit
): Promise<{ hit: LiteratureHit; traces: ApiFetchTrace[] }> {
  const traces: ApiFetchTrace[] = [];
  const next = { ...hit };

  if ((next.abstract && next.abstract.length >= 120) || next.fullTextExcerpt) {
    return { hit: next, traces };
  }

  // Europe PMC by DOI
  if (next.doi) {
    const q = `DOI:"${next.doi.replace(/"/g, "")}"`;
    const url =
      `${EPMC}/search?query=${encodeURIComponent(q)}` +
      `&resultType=core&pageSize=1&format=json`;
    const { data, trace } = await fetchJsonWithTrace<{
      resultList?: {
        result?: Array<{
          abstractText?: string;
          pmcid?: string;
          isOpenAccess?: string;
          title?: string;
        }>;
      };
    }>(url, { next: { revalidate: 86400 }, timeoutMs: 12_000 });
    traces.push(trace);
    const r = data?.resultList?.result?.[0];
    if (r?.abstractText && r.abstractText.length > (next.abstract?.length || 0)) {
      next.abstract = r.abstractText.slice(0, 2000);
    }
    if (r?.pmcid && !next.pmcid) next.pmcid = r.pmcid;
    if (r?.isOpenAccess === "Y") next.isOpenAccess = true;
    if (r?.title && next.title.includes("(untitled)")) next.title = r.title;
    await politeDelay(60);
  }

  // Europe PMC by PMID
  if ((!next.abstract || next.abstract.length < 80) && next.pmid) {
    const q = `EXT_ID:${next.pmid} AND SRC:MED`;
    const url =
      `${EPMC}/search?query=${encodeURIComponent(q)}` +
      `&resultType=core&pageSize=1&format=json`;
    const { data, trace } = await fetchJsonWithTrace<{
      resultList?: { result?: Array<{ abstractText?: string; pmcid?: string }> };
    }>(url, { next: { revalidate: 86400 }, timeoutMs: 12_000 });
    traces.push(trace);
    const r = data?.resultList?.result?.[0];
    if (r?.abstractText) next.abstract = r.abstractText.slice(0, 2000);
    if (r?.pmcid && !next.pmcid) next.pmcid = r.pmcid;
    await politeDelay(60);
  }

  // Crossref abstract by DOI (when present in metadata)
  if ((!next.abstract || next.abstract.length < 80) && next.doi) {
    const url = `${CROSSREF}/works/${encodeURIComponent(next.doi)}`;
    const { data, trace } = await fetchJsonWithTrace<{
      message?: { abstract?: string; title?: string[] };
    }>(url, {
      next: { revalidate: 86400 },
      timeoutMs: 10_000,
      headers: {
        "User-Agent":
          "ChemistryRecipes/1.0 (mailto:devnull@example.com; educational)",
        Accept: "application/json",
      },
    });
    traces.push(trace);
    const abs = data?.message?.abstract
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (abs && abs.length > 40) next.abstract = abs.slice(0, 2000);
  }

  return { hit: next, traces };
}

/**
 * Deep densify top process-ranked literature: metadata fill + OA full text budget.
 */
export async function deepDensifyLiterature(
  hits: LiteratureHit[],
  opts?: { maxMeta?: number; maxOa?: number }
): Promise<{ hits: LiteratureHit[]; traces: ApiFetchTrace[] }> {
  const maxMeta = opts?.maxMeta ?? 14;
  const maxOa = opts?.maxOa ?? 10;
  const traces: ApiFetchTrace[] = [];

  // Process-first order for budget
  const ordered = [...hits].sort((a, b) => {
    const sa = scoreProcessRelevance(a.title, a.abstract || a.fullTextExcerpt);
    const sb = scoreProcessRelevance(b.title, b.abstract || b.fullTextExcerpt);
    return sb - sa;
  });

  const byId = new Map(hits.map((h) => [h.id, { ...h }]));
  let metaN = 0;
  for (const h of ordered) {
    if (metaN >= maxMeta) break;
    const cur = byId.get(h.id)!;
    if ((cur.abstract && cur.abstract.length >= 120) || cur.fullTextExcerpt) continue;
    const densed = await densifyLiteratureHitMetadata(cur);
    byId.set(h.id, densed.hit);
    traces.push(...densed.traces);
    metaN += 1;
  }

  let list = [...byId.values()];
  const oa = await enrichLiteratureWithOaFullText(list, { maxArticles: maxOa });
  list = oa.hits;
  traces.push(...oa.traces);

  // Extra OA for process-ranked PMC with thin excerpt
  let extra = 0;
  for (const h of list
    .filter((x) => x.pmcid && !(x.fullTextExcerpt && x.fullTextExcerpt.length > 200))
    .sort(
      (a, b) =>
        scoreProcessRelevance(b.title, b.abstract) -
        scoreProcessRelevance(a.title, a.abstract)
    )) {
    if (extra >= 4) break;
    try {
      const ft = await fetchEuropePmcFullTextXml(h.pmcid!);
      traces.push(ft.trace);
      if (ft.excerpt && ft.excerpt.length >= 80) {
        h.fullTextExcerpt = ft.excerpt;
        h.fullTextChars = ft.plain.length;
        if (!h.abstract || h.abstract.length < 200) {
          h.abstract = ft.excerpt.slice(0, 1500);
        }
      }
      extra += 1;
      await politeDelay(80);
    } catch {
      /* continue */
    }
  }

  return { hits: list, traces };
}

/** Build SourceRef rows with harvest capture for provenance + AI. */
export function literatureToCapturedSourceRefs(
  hits: LiteratureHit[],
  limit = 18
): SourceRef[] {
  const now = new Date().toISOString();
  return hits.slice(0, limit).map((hit) => {
    const snippet = (hit.fullTextExcerpt || hit.abstract || "").slice(0, 1500);
    const clinical = isClinicalLiterature(hit.title, hit.abstract);
    const processScore = scoreProcessRelevance(
      hit.title,
      hit.fullTextExcerpt || hit.abstract
    );
    const endpoint = hit.pmcid
      ? `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC${String(hit.pmcid).replace(/^PMC/i, "")}/fullTextXML`
      : hit.doi
        ? `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(hit.doi)}`
        : "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
    return {
      type: "literature" as const,
      id: hit.id,
      label: hit.title.slice(0, 120),
      url: hit.url,
      note:
        [hit.source, hit.journal, hit.year].filter(Boolean).join(" · ") ||
        "Literature",
      capturedEndpoint: snippet ? endpoint : undefined,
      capturedAt: snippet ? now : undefined,
      capturedSnippet: snippet || undefined,
      relevanceTier: clinical && processScore < 35 ? "clinical" : "process",
    };
  });
}

export function patentToCapturedSourceRefs(
  patents: Array<{
    id: string;
    title: string;
    url?: string;
    patentNumber?: string;
    abstract?: string;
    procedureExcerpt?: string;
  }>,
  limit = 28
): SourceRef[] {
  const now = new Date().toISOString();
  return patents.slice(0, limit).map((p) => {
    const snippet = (p.procedureExcerpt || p.abstract || "").slice(0, 1500);
    return {
      type: "patent" as const,
      id: p.id,
      label: p.title.slice(0, 120),
      url: p.url,
      note: p.patentNumber,
      capturedEndpoint: snippet
        ? "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
        : undefined,
      capturedAt: snippet ? now : undefined,
      capturedSnippet: snippet || undefined,
      relevanceTier: "process" as const,
    };
  });
}
