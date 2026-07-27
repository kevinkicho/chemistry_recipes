/**
 * ClinicalTrials.gov API v2 — free public study metadata.
 * Manufacturing relevance is limited (formulation / scale context only).
 * Docs: https://clinicaltrials.gov/data-api/about-api
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface ClinicalTrialHit {
  nctId: string;
  title: string;
  status?: string;
  phase?: string;
  url: string;
}

/**
 * Search studies mentioning the compound (for regulatory / clinical scale context).
 */
export async function fetchClinicalTrialsByName(
  name: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: ClinicalTrialHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  const limit = Math.min(opts.limit ?? 5, 10);
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };

  const url =
    `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(q)}` +
    `&pageSize=${limit}&format=json`;

  const { data, trace } = await fetchJsonWithTrace<{
    studies?: Array<{
      protocolSection?: {
        identificationModule?: {
          nctId?: string;
          briefTitle?: string;
          officialTitle?: string;
        };
        statusModule?: { overallStatus?: string };
        designModule?: { phases?: string[] };
      };
    }>;
  }>(url, {
    next: { revalidate: 3600 },
    timeoutMs: 12_000,
    headers: { Accept: "application/json" },
  });

  const hits: ClinicalTrialHit[] = [];
  for (const s of data?.studies ?? []) {
    const id = s.protocolSection?.identificationModule?.nctId;
    const title =
      s.protocolSection?.identificationModule?.briefTitle ||
      s.protocolSection?.identificationModule?.officialTitle;
    if (!id || !title) continue;
    hits.push({
      nctId: id,
      title,
      status: s.protocolSection?.statusModule?.overallStatus,
      phase: s.protocolSection?.designModule?.phases?.join(", "),
      url: `https://clinicaltrials.gov/study/${id}`,
    });
  }

  const annotations: ExternalAnnotation[] = hits.slice(0, 4).map((h) => ({
    source: "ClinicalTrials.gov",
    organization: "NLM (NIH)",
    kind: "regulatory",
    title: `${h.nctId}: ${h.title}`.slice(0, 140),
    summary: [
      h.phase,
      h.status,
      "Clinical study metadata — formulation/scale context only, not a plant synthesis route",
    ]
      .filter(Boolean)
      .join(" · "),
    url: h.url,
    endpointUrl: "https://clinicaltrials.gov/api/v2",
    fields: {
      nctId: h.nctId,
      ...(h.phase ? { phase: h.phase } : {}),
      ...(h.status ? { status: h.status } : {}),
    },
  }));

  return { hits, annotations, traces: [trace], query: q };
}
