/**
 * Reactome Content Service — curated pathway maps (free public).
 * Docs: https://reactome.org/dev/content-service
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface ReactomeHit {
  stId: string;
  name: string;
  species?: string;
  url: string;
}

/**
 * Search Reactome entities / pathways by compound name.
 */
export async function fetchReactomeByName(
  name: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: ReactomeHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  const limit = Math.min(opts.limit ?? 6, 12);
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };

  const url =
    `https://reactome.org/ContentService/search/query?query=${encodeURIComponent(q)}` +
    `&types=Pathway,Reaction,ChemicalCompound&cluster=true`;

  const { data, trace } = await fetchJsonWithTrace<{
    results?: Array<{
      entries?: Array<{
        stId?: string;
        name?: string;
        speciesNames?: string[];
        exactType?: string;
      }>;
      typeName?: string;
    }>;
    // alternate flat shape
  }>(url, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });

  const hits: ReactomeHit[] = [];
  for (const cluster of data?.results ?? []) {
    for (const e of cluster.entries ?? []) {
      if (!e.stId || !e.name) continue;
      hits.push({
        stId: e.stId,
        name: e.name,
        species: e.speciesNames?.[0],
        url: `https://reactome.org/content/detail/${e.stId}`,
      });
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  const annotations: ExternalAnnotation[] = hits.slice(0, 5).map((h) => ({
    source: "Reactome",
    organization: "Reactome",
    kind: "pathway",
    title: h.name,
    summary: [
      h.stId,
      h.species,
      "Curated pathway/reaction context (biosynthetic — not plant organic SOP)",
    ]
      .filter(Boolean)
      .join(" · "),
    url: h.url,
    endpointUrl: "https://reactome.org/ContentService",
    fields: {
      stId: h.stId,
      ...(h.species ? { species: h.species } : {}),
    },
  }));

  return { hits, annotations, traces: [trace], query: q };
}
