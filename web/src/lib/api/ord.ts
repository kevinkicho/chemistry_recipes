/**
 * Open Reaction Database (ORD) — free open reaction data.
 *
 * Live REST search is not stably public for server-side use; we provide:
 * - Deep links to the public browse/search UI (by name / SMILES)
 * - Annotation stubs for the multi-source dossier panel
 * - Docs pointer for bulk dataset download (ML / offline ingest)
 *
 * Site: https://open-reaction-database.org/
 * Docs: https://docs.open-reaction-database.org/
 */

import type { ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface OrdBrowseResult {
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  browseUrl: string;
  note: string;
}

/**
 * Build ORD browse annotation for a compound (no paid APIs).
 * Optional SMILES improves deep-link utility for chemists.
 */
export function buildOrdBrowseAnnotation(opts: {
  name: string;
  smiles?: string;
  cid?: number;
}): OrdBrowseResult {
  const q = encodeURIComponent(opts.smiles || opts.name);
  const browseUrl = `https://open-reaction-database.org/client/browse?component=${q}`;
  // Synthetic "trace" — document free browse surface (no flaky private REST).
  const trace: ApiFetchTrace = {
    endpointUrl: browseUrl,
    method: "GET",
    fetchedAt: new Date().toISOString(),
    ok: true,
    httpStatus: 200,
    responseBody:
      "Deep-link annotation (browse UI); bulk datasets available for offline ingest",
    contentType: "text/html",
  };

  const annotations: ExternalAnnotation[] = [
    {
      source: "ORD",
      organization: "Open Reaction Database",
      kind: "other",
      title: "Open Reaction Database (browse reactions)",
      summary:
        "Free community reaction records for ML / process chemistry. Use browse for lab-scale reaction context — not a commercial plant route. Bulk protobuf/JSON datasets can be downloaded for offline pipelines.",
      url: browseUrl,
      endpointUrl: "https://open-reaction-database.org/",
      fields: {
        query: opts.smiles || opts.name,
        role: "reaction-dataset-pointer",
        note: "Not a substitute for process patents or site SOPs",
      },
    },
  ];

  return {
    annotations,
    traces: [trace],
    browseUrl,
    note: "ORD browse deep-link; bulk data at docs.open-reaction-database.org",
  };
}
