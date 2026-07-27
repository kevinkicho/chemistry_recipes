/**
 * UniChem — EMBL-EBI chemical identifier cross-mapping (free public REST).
 * Docs: https://www.ebi.ac.uk/unichem/info/wsoverview
 *
 * Source IDs commonly used: 22 = PubChem CID, 7 = ChEBI, 14 = FDA SRS/UNII, etc.
 * https://www.ebi.ac.uk/unichem/info/sources
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

const UNICHEM = "https://www.ebi.ac.uk/unichem/rest";

/** UniChem source number → short label */
const SOURCE_LABEL: Record<number, string> = {
  1: "ChEMBL",
  2: "DrugBank",
  3: "PDB",
  4: "IUPHAR",
  5: "PubChem_DotF",
  6: "KEGG_Ligand",
  7: "ChEBI",
  8: "NIH_ncc",
  9: "ZINC",
  10: "eMolecules",
  11: "IBM_patents",
  12: "Atlas",
  14: "FDA_SRS",
  15: "SureChEMBL",
  17: "PharmGKB",
  18: "HMDB",
  20: "Selleck",
  21: "PubChem_tpharma",
  22: "PubChem_CID",
  23: "MCULE",
  24: "NMRShiftDB",
  25: "LINCS",
  27: "BindingDB",
  29: "CompTox",
  31: "DrugCentral",
  32: "CarotenoidDB",
  33: "Metabolights",
  34: "Rhea",
};

export interface UniChemXref {
  sourceId: number;
  sourceName: string;
  srcCompoundId: string;
  url?: string;
}

/**
 * Map a PubChem CID to other free DB identifiers via UniChem.
 */
export async function fetchUnichemByPubchemCid(
  cid: number
): Promise<{
  xrefs: UniChemXref[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
}> {
  if (!Number.isFinite(cid) || cid <= 0) {
    return { xrefs: [], annotations: [], traces: [] };
  }

  // src_compound_id / src_id  — PubChem CID is source 22
  const url = `${UNICHEM}/src_compound_id/${cid}/22`;
  const { data, trace } = await fetchJsonWithTrace<
    Array<Array<{ src_id?: string | number; src_compound_id?: string }>>
  >(url, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });

  const xrefs: UniChemXref[] = [];
  const rows = Array.isArray(data) ? data.flat() : [];
  for (const row of rows) {
    const srcId = Number(row.src_id);
    const compoundId = String(row.src_compound_id || "").trim();
    if (!Number.isFinite(srcId) || !compoundId) continue;
    // Skip self PubChem
    if (srcId === 22) continue;
    xrefs.push({
      sourceId: srcId,
      sourceName: SOURCE_LABEL[srcId] || `UniChem:${srcId}`,
      srcCompoundId: compoundId,
      url: deepLink(srcId, compoundId),
    });
  }

  // Prefer recipe-useful sources first
  const priority = [7, 14, 1, 15, 29, 6, 34, 2, 31];
  xrefs.sort((a, b) => {
    const pa = priority.indexOf(a.sourceId);
    const pb = priority.indexOf(b.sourceId);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });

  const top = xrefs.slice(0, 16);
  const annotations: ExternalAnnotation[] = [];
  if (top.length) {
    annotations.push({
      source: "UniChem",
      organization: "EMBL-EBI",
      kind: "identity",
      title: `${top.length} cross-database identifier(s)`,
      summary: top
        .slice(0, 10)
        .map((x) => `${x.sourceName}:${x.srcCompoundId}`)
        .join(" · "),
      url: `https://www.ebi.ac.uk/unichem/compound/${cid}?type=pubchem`,
      endpointUrl: UNICHEM,
      fields: {
        pubchemCid: String(cid),
        count: String(top.length),
        sample: top
          .slice(0, 8)
          .map((x) => `${x.sourceName}:${x.srcCompoundId}`)
          .join(", "),
      },
    });
    for (const x of top.slice(0, 6)) {
      annotations.push({
        source: "UniChem",
        organization: "EMBL-EBI",
        kind: "identity",
        title: `${x.sourceName} ${x.srcCompoundId}`,
        summary: `Mapped from PubChem CID ${cid} via UniChem source ${x.sourceId}.`,
        url: x.url,
        endpointUrl: UNICHEM,
        fields: {
          source: x.sourceName,
          id: x.srcCompoundId,
        },
      });
    }
  }

  return { xrefs: top, annotations, traces: [trace] };
}

function deepLink(srcId: number, id: string): string | undefined {
  switch (srcId) {
    case 1:
      return `https://www.ebi.ac.uk/chembl/compound_report_card/${id}/`;
    case 7:
      return `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:${id.replace(/^CHEBI:/i, "")}`;
    case 14:
      return `https://gsrs.ncats.nih.gov/ginas/app/ui/substances?search=${encodeURIComponent(id)}`;
    case 6:
      return `https://www.kegg.jp/entry/${id}`;
    case 15:
      return `https://www.surechembl.org/search/?q=${encodeURIComponent(id)}`;
    case 29:
      return `https://comptox.epa.gov/dashboard/chemical/details/${id}`;
    case 34:
      return `https://www.rhea-db.org/rhea/${id.replace(/^RHEA:/i, "")}`;
    case 2:
      return `https://go.drugbank.com/drugs/${id}`;
    default:
      return undefined;
  }
}
