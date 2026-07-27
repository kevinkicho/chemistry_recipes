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
  const xrefUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/xrefs/PubMedID,MeSH,PatentID/JSON`;
  const xr = await fetchJsonWithTrace<{
    InformationList?: {
      Information?: Array<{
        PubMedID?: number[];
        MeSH?: string[];
        PatentID?: string[];
      }>;
    };
  }>(xrefUrl, { next: { revalidate: 86400 }, timeoutMs: 10_000 });
  traces.push(xr.trace);

  const info = xr.data?.InformationList?.Information?.[0];
  if (info?.MeSH?.length) {
    const mesh = info.MeSH.slice(0, 12);
    annotations.push({
      source: "PubChem MeSH",
      organization: "NCBI (NIH)",
      kind: "identity",
      title: `MeSH: ${mesh.slice(0, 4).join(", ")}`,
      summary: mesh.join("; "),
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
      fields: { mesh: mesh.slice(0, 8).join(", ") },
    });
  }
  if (info?.PubMedID?.length) {
    annotations.push({
      source: "PubChem PubMed xrefs",
      organization: "NCBI (NIH)",
      kind: "literature",
      title: `${info.PubMedID.length} PubMed cross-reference(s)`,
      summary: `Sample PMIDs: ${info.PubMedID.slice(0, 8).join(", ")}`,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Literature`,
      endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
      fields: {
        sample: info.PubMedID.slice(0, 10).join(", "),
        count: String(info.PubMedID.length),
      },
    });
  }

  return { annotations, texts, procedureExcerpts, traces };
}
