/**
 * Rhea — expert-curated enzyme-catalyzed reactions (SIB / EMBL-EBI).
 * Free REST: https://www.rhea-db.org/help/rest-api
 *
 * Useful for biocatalytic / pathway context — not plant organic routes.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface RheaHit {
  rheaId: string;
  equation?: string;
  url: string;
}

export async function fetchRheaByName(
  name: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: RheaHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  const limit = Math.min(opts.limit ?? 6, 12);
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };

  // Rhea REST search (TSV/JSON flavours vary; use JSON columns)
  const url =
    `https://www.rhea-db.org/rhea/?query=${encodeURIComponent(q)}` +
    `&columns=rhea-id,equation,chebi-id&format=json&limit=${limit}`;

  const { data, trace } = await fetchJsonWithTrace<{
    results?: Array<{
      "rhea-id"?: string | number;
      rheaId?: string | number;
      equation?: string;
      Equation?: string;
    }>;
    // Alternate shape: array at top level
  } | Array<Record<string, unknown>>>(url, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });

  const rows: Array<Record<string, unknown>> = Array.isArray(data)
    ? data
    : Array.isArray((data as { results?: unknown })?.results)
      ? ((data as { results: Array<Record<string, unknown>> }).results as Array<
          Record<string, unknown>
        >)
      : [];

  const hits: RheaHit[] = [];
  for (const r of rows.slice(0, limit)) {
    const id = String(r["rhea-id"] ?? r.rheaId ?? r.id ?? "").trim();
    if (!id) continue;
    const equation = String(r.equation ?? r.Equation ?? "").trim() || undefined;
    hits.push({
      rheaId: id.startsWith("RHEA:") ? id : `RHEA:${id}`,
      equation,
      url: `https://www.rhea-db.org/rhea/${String(id).replace(/^RHEA:/i, "")}`,
    });
  }

  const annotations: ExternalAnnotation[] = hits.slice(0, 4).map((h) => ({
    source: "Rhea",
    organization: "SIB / EMBL-EBI",
    kind: "pathway" as const,
    title: h.rheaId,
    summary:
      h.equation ||
      "Curated enzyme-catalyzed reaction (lab/biosynthetic context — not a plant SOP).",
    url: h.url,
    endpointUrl: "https://www.rhea-db.org/rhea",
    fields: {
      ...(h.equation ? { equation: h.equation } : {}),
      role: "enzyme-reaction",
    },
  }));

  if (!hits.length && trace.ok) {
    annotations.push({
      source: "Rhea",
      organization: "SIB / EMBL-EBI",
      kind: "pathway",
      title: "Rhea search (no equation hits)",
      summary: `No Rhea reactions matched “${q}”. Useful mainly for biocatalytic steps.`,
      url: `https://www.rhea-db.org/rhea?query=${encodeURIComponent(q)}`,
      endpointUrl: "https://www.rhea-db.org/rhea",
    });
  }

  return { hits, annotations, traces: [trace], query: q };
}
