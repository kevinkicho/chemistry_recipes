/**
 * Pathway Commons PC2 web service — integrated pathway graphs (free).
 * Docs: https://www.pathwaycommons.org/pc2/
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface PathwayCommonsHit {
  uri: string;
  name: string;
  dataSource?: string;
  url: string;
}

/**
 * Search Pathway Commons by keyword (pathways / interactions mentioning name).
 */
export async function fetchPathwayCommonsByName(
  name: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: PathwayCommonsHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  const limit = Math.min(opts.limit ?? 5, 10);
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };

  // PC2 search (JSON body; `.json` suffix 404s as of 2026 — use plain /search)
  const url =
    `https://www.pathwaycommons.org/pc2/search?q=${encodeURIComponent(q)}` +
    `&type=Pathway&page=0`;

  const { data, trace } = await fetchJsonWithTrace<{
    searchHit?: Array<{
      uri?: string;
      name?: string;
      dataSource?: string[];
      numParticipants?: number;
      numProcesses?: number;
    }>;
  }>(url, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });

  const hits: PathwayCommonsHit[] = (data?.searchHit ?? [])
    .slice(0, limit)
    .map((h) => ({
      uri: h.uri || "",
      name: h.name || "Pathway",
      dataSource: h.dataSource?.[0],
      url: h.uri
        ? `https://apps.pathwaycommons.org/pathways?uri=${encodeURIComponent(h.uri)}`
        : "https://www.pathwaycommons.org/",
    }))
    .filter((h) => h.uri || h.name);

  const annotations: ExternalAnnotation[] = hits.slice(0, 4).map((h) => ({
    source: "Pathway Commons",
    organization: "UBC / EMBL-EBI",
    kind: "pathway",
    title: h.name,
    summary: [
      h.dataSource,
      "Integrated pathway graph (biosynthetic / signaling context — not plant SOP)",
    ]
      .filter(Boolean)
      .join(" · "),
    url: h.url,
    endpointUrl: "https://www.pathwaycommons.org/pc2",
    fields: {
      ...(h.dataSource ? { dataSource: h.dataSource } : {}),
      ...(h.uri ? { uri: h.uri.slice(0, 120) } : {}),
    },
  }));

  return { hits, annotations, traces: [trace], query: q };
}
