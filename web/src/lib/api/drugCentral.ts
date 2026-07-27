/**
 * DrugCentral — free drug cards (targets, structure links).
 * Public API: https://drugcentral.org/
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface DrugCentralHit {
  id: string;
  name: string;
  cas?: string;
  unii?: string;
  url: string;
  summary?: string;
}

/**
 * Search DrugCentral by drug/compound name.
 */
export async function fetchDrugCentralByName(
  name: string
): Promise<{
  hit: DrugCentralHit | null;
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  if (!q) return { hit: null, annotations: [], traces: [], query: "" };

  // Public search endpoint variants
  const url = `https://drugcentral.org/api/v1/structures/?filter=name,${encodeURIComponent(q)}&page_size=3`;

  const { data, trace } = await fetchJsonWithTrace<{
    results?: Array<{
      id?: number | string;
      name?: string;
      cas_reg_no?: string;
      unii?: string;
      smiles?: string;
      inchikey?: string;
    }>;
    // alt
    objects?: Array<Record<string, unknown>>;
  }>(url, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });

  const row =
    data?.results?.[0] ||
    (Array.isArray(data?.objects)
      ? (data!.objects![0] as {
          id?: number | string;
          name?: string;
          cas_reg_no?: string;
          unii?: string;
        })
      : undefined);

  if (!row?.id && !row?.name) {
    // Fallback HTML-free deep link annotation only
    return {
      hit: null,
      annotations: [
        {
          source: "DrugCentral",
          organization: "UNM / DrugCentral",
          kind: "identity",
          title: `DrugCentral search: ${q}`,
          summary: "No structured hit — open DrugCentral for drug card context.",
          url: `https://drugcentral.org/drugcard?q=${encodeURIComponent(q)}`,
          endpointUrl: "https://drugcentral.org/api/v1",
        },
      ],
      traces: [trace],
      query: q,
    };
  }

  const id = String(row.id ?? q);
  const hit: DrugCentralHit = {
    id,
    name: row.name || q,
    cas: row.cas_reg_no,
    unii: row.unii,
    url: `https://drugcentral.org/drugcard/${id}`,
    summary: [row.cas_reg_no && `CAS ${row.cas_reg_no}`, row.unii && `UNII ${row.unii}`]
      .filter(Boolean)
      .join(" · "),
  };

  const annotations: ExternalAnnotation[] = [
    {
      source: "DrugCentral",
      organization: "UNM / DrugCentral",
      kind: "identity",
      title: hit.name,
      summary:
        hit.summary ||
        "Drug card identity / target context (not a manufacturing route).",
      url: hit.url,
      endpointUrl: "https://drugcentral.org/api/v1",
      fields: {
        id: hit.id,
        ...(hit.cas ? { cas: hit.cas } : {}),
        ...(hit.unii ? { unii: hit.unii } : {}),
      },
    },
  ];

  return { hit, annotations, traces: [trace], query: q };
}
