/**
 * Pathway search for WikiPathways-class context.
 * Legacy webservice.wikipathways.org is retired (404).
 * Free-public replacement: Pathway Commons PC2 search (includes WikiPathways when present)
 * + always a site deep link. Never invents pathway IDs.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface WikiPathwayHit {
  id: string;
  name: string;
  species?: string;
  url: string;
  dataSource?: string;
}

/**
 * Find pathways mentioning the compound (Pathway Commons free search).
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

  // Pathway Commons PC2 — free public pathway search (replaces dead WikiPathways webservice)
  const url =
    `https://www.pathwaycommons.org/pc2/search?q=${encodeURIComponent(q)}` +
    `&type=Pathway&page=0`;

  const { data, trace } = await fetchJsonWithTrace<{
    searchHit?: Array<{
      uri?: string;
      name?: string;
      dataSource?: string[];
      numParticipants?: number;
    }>;
    numHits?: number;
  }>(url, {
    next: { revalidate: 86400 },
    timeoutMs: 12_000,
    headers: { Accept: "application/json" },
  });

  const rows = data?.searchHit || [];
  // Prefer WikiPathways-sourced hits, then any pathway
  const sorted = [...rows].sort((a, b) => {
    const aw = (a.dataSource || []).some((d) => /wikipathways/i.test(d)) ? 0 : 1;
    const bw = (b.dataSource || []).some((d) => /wikipathways/i.test(d)) ? 0 : 1;
    return aw - bw;
  });

  const hits: WikiPathwayHit[] = [];
  for (const r of sorted.slice(0, limit)) {
    const nameP = String(r.name || "").trim();
    const uri = String(r.uri || "").trim();
    if (!nameP && !uri) continue;
    const ds = r.dataSource?.[0];
    const id =
      uri.replace(/^.*[\/:#]/, "") ||
      nameP.slice(0, 40);
    const isWp = /wikipathways/i.test(ds || "") || /wikipathways/i.test(uri);
    hits.push({
      id,
      name: nameP || id,
      dataSource: ds,
      url: isWp
        ? `https://www.wikipathways.org/instance/${encodeURIComponent(id)}`
        : uri
          ? `https://apps.pathwaycommons.org/pathways?uri=${encodeURIComponent(uri)}`
          : `https://www.wikipathways.org/`,
    });
  }

  const annotations: ExternalAnnotation[] = hits.slice(0, 4).map((h) => ({
    source: /wikipathways/i.test(h.dataSource || "")
      ? "WikiPathways"
      : "Pathway Commons",
    organization: /wikipathways/i.test(h.dataSource || "")
      ? "WikiPathways"
      : "UBC / EMBL-EBI",
    kind: "pathway",
    title: h.name,
    summary: [
      h.id,
      h.dataSource,
      "Pathway context (biocatalytic / metabolic — not a plant SOP)",
      "WikiPathways legacy webservice retired; free PC2 search used",
    ]
      .filter(Boolean)
      .join(" · "),
    url: h.url,
    endpointUrl: "https://www.pathwaycommons.org/pc2",
    fields: {
      id: h.id,
      ...(h.dataSource ? { dataSource: h.dataSource } : {}),
    },
  }));

  // Always keep a WikiPathways site pointer for operators
  if (!annotations.length) {
    annotations.push({
      source: "WikiPathways",
      organization: "WikiPathways",
      kind: "pathway",
      title: `Pathway search: ${q}`,
      summary:
        "No free-public pathway hits — open WikiPathways / Pathway Commons manually.",
      url: `https://www.wikipathways.org/`,
      endpointUrl: "https://www.pathwaycommons.org/pc2",
    });
  }

  return { hits, annotations, traces: [trace], query: q };
}
