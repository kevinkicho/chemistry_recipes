/**
 * PubChem classification / MeSH / PharmAction free endpoints for denser identity.
 * Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";
import type { ProcedureExcerpt } from "@/lib/dossier/types";

/**
 * Fetch PubChem PharmAction / MeSH headings for a CID (use/class context).
 */
export async function fetchPubchemClassifications(
  cid: number
): Promise<{
  annotations: ExternalAnnotation[];
  texts: string[];
  procedureExcerpts: ProcedureExcerpt[];
  traces: ApiFetchTrace[];
}> {
  if (!Number.isFinite(cid) || cid <= 0) {
    return { annotations: [], texts: [], procedureExcerpts: [], traces: [] };
  }

  const traces: ApiFetchTrace[] = [];
  const annotations: ExternalAnnotation[] = [];
  const texts: string[] = [];
  const procedureExcerpts: ProcedureExcerpt[] = [];

  // Classification nodes (PharmAction etc.)
  const classUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/classification/JSON`;
  const cls = await fetchJsonWithTrace<{
    Hierarchies?: {
      Hierarchy?: Array<{
        SourceName?: string;
        Information?: Array<{ Name?: string; Description?: string }>;
        Node?: Array<{
          Information?: Array<{ Name?: string; Description?: string }>;
        }>;
      }>;
    };
  }>(classUrl, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
  });
  traces.push(cls.trace);

  const names: string[] = [];
  for (const h of cls.data?.Hierarchies?.Hierarchy ?? []) {
    const src = h.SourceName || "Classification";
    for (const info of h.Information ?? []) {
      if (info.Name) names.push(`${src}: ${info.Name}`);
    }
    for (const node of h.Node ?? []) {
      for (const info of node.Information ?? []) {
        if (info.Name) names.push(`${src}: ${info.Name}`);
      }
    }
  }

  const unique = [...new Set(names)].slice(0, 24);
  if (unique.length) {
    const body = unique.join("; ");
    texts.push(body);
    annotations.push({
      source: "PubChem Classification",
      organization: "NCBI (NIH)",
      kind: "identity",
      title: `${unique.length} classification heading(s)`,
      summary: body.slice(0, 500),
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Classification`,
      endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
      fields: { count: String(unique.length) },
    });
  }

  // xrefs for MeSH / PharmGKB style when available
  // PubChem rejects multi-type xrefs with invalid types (e.g. MeSH) — request one type at a time
  const pmUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/xrefs/PubMedID/JSON`;
  const pm = await fetchJsonWithTrace<{
    InformationList?: {
      Information?: Array<{ PubMedID?: number[] }>;
    };
  }>(pmUrl, { next: { revalidate: 86400 }, timeoutMs: 12_000 });
  traces.push(pm.trace);
  const pmids = pm.data?.InformationList?.Information?.[0]?.PubMedID || [];
  if (pmids.length) {
    annotations.push({
      source: "PubChem PubMed xrefs",
      organization: "NCBI (NIH)",
      kind: "literature",
      title: `${pmids.length} PubMed cross-reference(s)`,
      summary: `Sample PMIDs: ${pmids.slice(0, 8).join(", ")}`,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Literature`,
      endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
      fields: {
        sample: pmids.slice(0, 10).join(", "),
        count: String(pmids.length),
      },
    });
  }

  return { annotations, texts, procedureExcerpts, traces };
}
