/**
 * ChEBI — Chemical Entities of Biological Interest (EMBL-EBI).
 * Free public search for ontology / roles (identity + biological role context).
 *
 * Lite search often works via OLS / public search endpoints.
 * Primary: EBI OLS4 + ChEBI web search JSON where available.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface ChebiHit {
  chebiId: string;
  name: string;
  definition?: string;
  formula?: string;
  url: string;
}

/**
 * Search ChEBI by compound name (OLS4 ontology lookup + ChEBI fallback).
 */
export async function fetchChebiByName(
  name: string
): Promise<{
  hit: ChebiHit | null;
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  if (!q) return { hit: null, annotations: [], traces: [], query: "" };

  const traces: ApiFetchTrace[] = [];

  // OLS4 free search over chebi ontology
  const olsUrl =
    `https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(q)}` +
    `&ontology=chebi&rows=5&queryFields=label,synonym`;
  const ols = await fetchJsonWithTrace<{
    response?: {
      docs?: Array<{
        iri?: string;
        label?: string;
        short_form?: string;
        obo_id?: string;
        description?: string[];
      }>;
    };
  }>(olsUrl, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });
  traces.push(ols.trace);

  const doc = ols.data?.response?.docs?.[0];
  if (doc) {
    const rawId =
      doc.obo_id ||
      doc.short_form ||
      (doc.iri?.match(/CHEBI[_:](\d+)/i)?.[0] ?? "");
    const chebiId = String(rawId)
      .replace(/_/g, ":")
      .replace(/^CHEBI/i, "CHEBI")
      .replace(/^(\d+)$/, "CHEBI:$1");
    const idNum = chebiId.replace(/^CHEBI:/i, "");
    const hit: ChebiHit = {
      chebiId: chebiId.startsWith("CHEBI") ? chebiId : `CHEBI:${idNum}`,
      name: doc.label || q,
      definition: doc.description?.[0],
      url: `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:${idNum}`,
    };
    const annotations: ExternalAnnotation[] = [
      {
        source: "ChEBI",
        organization: "EMBL-EBI",
        kind: "identity",
        title: `${hit.name} (${hit.chebiId})`,
        summary:
          hit.definition?.slice(0, 400) ||
          "Ontology identity / biological role context (not a plant route).",
        url: hit.url,
        endpointUrl: "https://www.ebi.ac.uk/ols4/api",
        fields: {
          chebiId: hit.chebiId,
          ...(hit.definition ? { definition: hit.definition.slice(0, 200) } : {}),
        },
      },
    ];
    return { hit, annotations, traces, query: q };
  }

  // Fallback: ChEBI 2.0 public lite search (best-effort)
  const liteUrl = `https://www.ebi.ac.uk/chebi/backend/api/public/compounds?search=${encodeURIComponent(q)}&size=3`;
  const lite = await fetchJsonWithTrace<{
    content?: Array<{
      chebiId?: string | number;
      chebiAsciiName?: string;
      definition?: string;
      formula?: string;
    }>;
    // alt shapes
    compounds?: Array<Record<string, unknown>>;
  }>(liteUrl, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });
  traces.push(lite.trace);

  const row =
    lite.data?.content?.[0] ||
    (Array.isArray(lite.data?.compounds)
      ? (lite.data!.compounds![0] as {
          chebiId?: string | number;
          chebiAsciiName?: string;
          definition?: string;
          formula?: string;
        })
      : undefined);

  if (row?.chebiId != null) {
    const idNum = String(row.chebiId).replace(/^CHEBI:/i, "");
    const hit: ChebiHit = {
      chebiId: `CHEBI:${idNum}`,
      name: row.chebiAsciiName || q,
      definition: row.definition,
      formula: row.formula,
      url: `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:${idNum}`,
    };
    return {
      hit,
      annotations: [
        {
          source: "ChEBI",
          organization: "EMBL-EBI",
          kind: "identity",
          title: `${hit.name} (${hit.chebiId})`,
          summary: [
            hit.formula && `Formula ${hit.formula}`,
            hit.definition?.slice(0, 300),
          ]
            .filter(Boolean)
            .join(" · ") || "ChEBI compound hit",
          url: hit.url,
          endpointUrl: "https://www.ebi.ac.uk/chebi/backend/api",
          fields: {
            chebiId: hit.chebiId,
            ...(hit.formula ? { formula: hit.formula } : {}),
          },
        },
      ],
      traces,
      query: q,
    };
  }

  return { hit: null, annotations: [], traces, query: q };
}
