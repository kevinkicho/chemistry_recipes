/**
 * MassBank API — free MS reference spectra (IPC / analytical helper context).
 * Docs: https://massbank.eu/MassBank-api
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface MassBankHit {
  accession: string;
  title: string;
  formula?: string;
  url: string;
}

/**
 * Search MassBank records by compound name (supports IPC method design notes).
 */
export async function fetchMassBankByName(
  name: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: MassBankHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  const limit = Math.min(opts.limit ?? 5, 10);
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };

  // MassBank EU REST search
  const url = `https://massbank.eu/MassBank-api/search?compound.name=${encodeURIComponent(q)}`;

  const { data, trace } = await fetchJsonWithTrace<{
    data?: Array<{
      accession?: string;
      record_title?: string;
      title?: string;
      formula?: string;
    }>;
    // alt shapes
    results?: Array<Record<string, unknown>>;
  }>(url, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });

  let rows: Array<Record<string, unknown>> = [];
  if (Array.isArray(data?.data)) {
    rows = data!.data as Array<Record<string, unknown>>;
  } else if (Array.isArray(data?.results)) {
    rows = data!.results as Array<Record<string, unknown>>;
  } else if (Array.isArray(data)) {
    rows = data as Array<Record<string, unknown>>;
  }

  const hits: MassBankHit[] = [];
  for (const r of rows.slice(0, limit)) {
    const accession = String(r.accession || r.id || "").trim();
    const title = String(
      r.record_title || r.title || r.name || accession || ""
    ).trim();
    if (!accession && !title) continue;
    hits.push({
      accession: accession || title.slice(0, 40),
      title: title || accession,
      formula: r.formula ? String(r.formula) : undefined,
      url: accession
        ? `https://massbank.eu/MassBank/RecordDisplay?id=${encodeURIComponent(accession)}`
        : "https://massbank.eu/",
    });
  }

  const annotations: ExternalAnnotation[] = hits.slice(0, 4).map((h) => ({
    source: "MassBank",
    organization: "MassBank",
    kind: "other",
    title: h.title,
    summary: [
      h.accession,
      h.formula && `Formula ${h.formula}`,
      "MS reference spectrum — analytical / IPC method design helper (not synthesis steps)",
    ]
      .filter(Boolean)
      .join(" · "),
    url: h.url,
    endpointUrl: "https://massbank.eu/MassBank-api",
    fields: {
      accession: h.accession,
      ...(h.formula ? { formula: h.formula } : {}),
      role: "analytical-ipc",
    },
  }));

  return { hits, annotations, traces: [trace], query: q };
}
