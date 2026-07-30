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

  /** PubChem often returns a single object instead of a 1-element array. */
  function asArray<T>(v: T | T[] | null | undefined): T[] {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  }

  // Classification nodes (PharmAction etc.) — soft; shape varies and tree can 503
  const classUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/classification/JSON`;
  try {
    const cls = await fetchJsonWithTrace<{
      Fault?: unknown;
      Hierarchies?: {
        Hierarchy?:
          | {
              SourceName?: string;
              Information?:
                | Array<{ Name?: string; Description?: string }>
                | { Name?: string; Description?: string };
              Node?:
                | Array<{
                    Information?:
                      | Array<{ Name?: string; Description?: string }>
                      | { Name?: string; Description?: string };
                  }>
                | {
                    Information?:
                      | Array<{ Name?: string; Description?: string }>
                      | { Name?: string; Description?: string };
                  };
            }
          | Array<{
              SourceName?: string;
              Information?:
                | Array<{ Name?: string; Description?: string }>
                | { Name?: string; Description?: string };
              Node?:
                | Array<{
                    Information?:
                      | Array<{ Name?: string; Description?: string }>
                      | { Name?: string; Description?: string };
                  }>
                | {
                    Information?:
                      | Array<{ Name?: string; Description?: string }>
                      | { Name?: string; Description?: string };
                  };
            }>;
      };
    }>(classUrl, {
      next: { revalidate: 86400 },
      timeoutMs: 10_000,
    });
    traces.push(cls.trace);

    const names: string[] = [];
    if (cls.trace.ok && cls.data && !cls.data.Fault) {
      for (const h of asArray(cls.data.Hierarchies?.Hierarchy)) {
        const src = h.SourceName || "Classification";
        for (const info of asArray(h.Information)) {
          if (info.Name) names.push(`${src}: ${info.Name}`);
        }
        for (const node of asArray(h.Node)) {
          for (const info of asArray(node.Information)) {
            if (info.Name) names.push(`${src}: ${info.Name}`);
          }
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
  } catch {
    // Classification is optional densify — never abort PubMedID xrefs
  }

  // xrefs for MeSH / PharmGKB style when available
  // PubChem rejects multi-type xrefs with invalid types (e.g. MeSH) — request one type at a time
  const pmUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/xrefs/PubMedID/JSON`;
  const pm = await fetchJsonWithTrace<{
    InformationList?: {
      Information?: Array<{ PubMedID?: number[] }> | { PubMedID?: number[] };
    };
  }>(pmUrl, { next: { revalidate: 86400 }, timeoutMs: 12_000 });
  traces.push(pm.trace);
  const info0 = asArray(pm.data?.InformationList?.Information)[0];
  const rawPmids = info0?.PubMedID;
  const pmidList: number[] = Array.isArray(rawPmids)
    ? rawPmids.filter((n): n is number => typeof n === "number" && n > 0)
    : typeof rawPmids === "number" && rawPmids > 0
      ? [rawPmids]
      : [];
  if (pmidList.length) {
    annotations.push({
      source: "PubChem PubMed xrefs",
      organization: "NCBI (NIH)",
      kind: "literature",
      title: `${pmidList.length} PubMed cross-reference(s)`,
      summary: `Sample PMIDs: ${pmidList.slice(0, 8).join(", ")}`,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Literature`,
      endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
      fields: {
        sample: pmidList.slice(0, 10).join(", "),
        count: String(pmidList.length),
      },
    });
  }

  return { annotations, texts, procedureExcerpts, traces };
}
