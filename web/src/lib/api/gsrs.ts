/**
 * FDA GSRS / Ginas — Global Substance Registration System (free public API).
 * UNII and substance registration context for identity join.
 * Docs: https://gsrs.ncats.nih.gov/api
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface GsrsHit {
  unii?: string;
  name: string;
  uuid?: string;
  substanceClass?: string;
  url: string;
}

/**
 * Search GSRS substances by name.
 */
export async function fetchGsrsByName(
  name: string
): Promise<{
  hit: GsrsHit | null;
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  if (!q) return { hit: null, annotations: [], traces: [], query: "" };

  // Public substances search (Ginas API variants)
  const url =
    `https://gsrs.ncats.nih.gov/ginas/app/api/v1/substances/search?q=` +
    `${encodeURIComponent(`root_names_name:"^${q}$" OR root_names_name:"${q}"`)}` +
    `&top=5&skip=0`;

  const { data, trace } = await fetchJsonWithTrace<{
    content?: Array<{
      _id?: string;
      uuid?: string;
      _name?: string;
      _nameDisplay?: string;
      _substanceClass?: string;
      unii?: string;
      _approvalID?: string;
    }>;
  }>(url, {
    next: { revalidate: 86400 },
    timeoutMs: 12_000,
    headers: { Accept: "application/json" },
  });

  const row = data?.content?.[0];
  if (!row) {
    // Simpler text search fallback
    const url2 =
      `https://gsrs.ncats.nih.gov/ginas/app/api/v1/substances/search?q=${encodeURIComponent(q)}&top=5`;
    const r2 = await fetchJsonWithTrace<typeof data>(url2, {
      next: { revalidate: 86400 },
      timeoutMs: 12_000,
      headers: { Accept: "application/json" },
    });
    const row2 = r2.data?.content?.[0];
    if (!row2) {
      return {
        hit: null,
        annotations: [],
        traces: [trace, r2.trace],
        query: q,
      };
    }
    return mapHit(row2, q, [trace, r2.trace]);
  }

  return mapHit(row, q, [trace]);
}

function mapHit(
  row: {
    _id?: string;
    uuid?: string;
    _name?: string;
    _nameDisplay?: string;
    _substanceClass?: string;
    unii?: string;
    _approvalID?: string;
  },
  q: string,
  traces: ApiFetchTrace[]
): {
  hit: GsrsHit;
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
} {
  const unii = row.unii || row._approvalID;
  const uuid = row.uuid || row._id;
  const display = row._nameDisplay || row._name || q;
  const hit: GsrsHit = {
    unii,
    name: display,
    uuid,
    substanceClass: row._substanceClass,
    url: unii
      ? `https://precision.fda.gov/uniisearch/substance/${unii}`
      : uuid
        ? `https://gsrs.ncats.nih.gov/ginas/app/ui/substances/${uuid}`
        : `https://gsrs.ncats.nih.gov/ginas/app/ui/substances?search=${encodeURIComponent(q)}`,
  };

  const annotations: ExternalAnnotation[] = [
    {
      source: "GSRS",
      organization: "FDA",
      kind: "identity",
      title: unii ? `${display} (UNII ${unii})` : display,
      summary: [
        unii && `UNII ${unii}`,
        row._substanceClass && `Class ${row._substanceClass}`,
        "FDA substance registration identity — improves joins to labels/patents.",
      ]
        .filter(Boolean)
        .join(" · "),
      url: hit.url,
      endpointUrl: "https://gsrs.ncats.nih.gov/ginas/app/api/v1",
      fields: {
        ...(unii ? { unii } : {}),
        ...(uuid ? { uuid } : {}),
        ...(row._substanceClass ? { class: row._substanceClass } : {}),
      },
    },
  ];

  return { hit, annotations, traces, query: q };
}
