/**
 * WikiPathways webservice — community pathway models (free).
 * Docs: https://webservice.wikipathways.org/
 */

import { fetchWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface WikiPathwayHit {
  id: string;
  name: string;
  species?: string;
  url: string;
}

/**
 * Find pathways mentioning the compound (JSON findPathwaysByText).
 */
export async function fetchWikiPathwaysByName(
  name: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: WikiPathwayHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  const limit = Math.min(opts.limit ?? 5, 10);
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };

  const url =
    `https://webservice.wikipathways.org/findPathwaysByText?query=${encodeURIComponent(q)}` +
    `&format=json`;

  const { text, data, trace } = await fetchWithTrace(url, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });

  let rows: Array<Record<string, unknown>> = [];
  if (Array.isArray(data)) {
    rows = data as Array<Record<string, unknown>>;
  } else if (data && typeof data === "object") {
    const o = data as { result?: unknown; pathways?: unknown };
    if (Array.isArray(o.result)) rows = o.result as Array<Record<string, unknown>>;
    else if (Array.isArray(o.pathways))
      rows = o.pathways as Array<Record<string, unknown>>;
  } else if (text) {
    try {
      const j = JSON.parse(text) as { result?: Array<Record<string, unknown>> };
      rows = j.result || [];
    } catch {
      rows = [];
    }
  }

  const hits: WikiPathwayHit[] = [];
  for (const r of rows.slice(0, limit)) {
    const id = String(r.id || r.wpid || r.pathway_id || "").trim();
    const nameP = String(r.name || r.title || "").trim();
    if (!id && !nameP) continue;
    const species = r.species ? String(r.species) : undefined;
    const wpid = id || nameP;
    hits.push({
      id: wpid,
      name: nameP || wpid,
      species,
      url: `https://www.wikipathways.org/instance/${wpid}`,
    });
  }

  const annotations: ExternalAnnotation[] = hits.slice(0, 4).map((h) => ({
    source: "WikiPathways",
    organization: "WikiPathways",
    kind: "pathway",
    title: h.name,
    summary: [
      h.id,
      h.species,
      "Community pathway model (context for biocatalytic / metabolic routes)",
    ]
      .filter(Boolean)
      .join(" · "),
    url: h.url,
    endpointUrl: "https://webservice.wikipathways.org",
    fields: {
      id: h.id,
      ...(h.species ? { species: h.species } : {}),
    },
  }));

  return { hits, annotations, traces: [trace], query: q };
}
