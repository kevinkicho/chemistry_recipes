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

type UnichemRow = {
  src_id?: string | number;
  src_compound_id?: string | string[];
  name?: string;
  name_long?: string;
};

function rowsToXrefs(rows: UnichemRow[]): UniChemXref[] {
  const xrefs: UniChemXref[] = [];
  for (const row of rows) {
    const srcId = Number(row.src_id);
    const raw = row.src_compound_id;
    const compoundId = Array.isArray(raw)
      ? String(raw[0] || "").trim()
      : String(raw || "").trim();
    if (!Number.isFinite(srcId) || !compoundId) continue;
    // Skip self PubChem
    if (srcId === 22) continue;
    xrefs.push({
      sourceId: srcId,
      sourceName:
        SOURCE_LABEL[srcId] ||
        row.name_long ||
        row.name ||
        `UniChem:${srcId}`,
      srcCompoundId: compoundId,
      url: deepLink(srcId, compoundId),
    });
  }
  const priority = [7, 14, 1, 15, 29, 6, 34, 2, 31];
  xrefs.sort((a, b) => {
    const pa = priority.indexOf(a.sourceId);
    const pb = priority.indexOf(b.sourceId);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });
  return xrefs;
}

/**
 * Map a PubChem CID to other free DB identifiers via UniChem.
 * Primary: legacy CID path. Fallback: InChIKey verbose map (CID path retired 2025–26).
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

  const traces: ApiFetchTrace[] = [];

  // 1) Legacy CID/src path (source 22 = PubChem CID) — may 404 after UniChem migration
  const urlCid = `${UNICHEM}/src_compound_id/${cid}/22`;
  const cidRes = await fetchJsonWithTrace<
    Array<Array<{ src_id?: string | number; src_compound_id?: string }>>
  >(urlCid, {
    next: { revalidate: 86400 },
    timeoutMs: 10_000,
    headers: { Accept: "application/json" },
  });
  traces.push(cidRes.trace);

  let xrefs = rowsToXrefs(
    Array.isArray(cidRes.data) ? (cidRes.data.flat() as UnichemRow[]) : []
  );

  // 2) Fallback: resolve InChIKey from PubChem, then verbose_inchikey (still works)
  if (!xrefs.length) {
    const ikUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/InChIKey/JSON`;
    const ik = await fetchJsonWithTrace<{
      PropertyTable?: { Properties?: Array<{ InChIKey?: string }> };
    }>(ikUrl, {
      next: { revalidate: 86400 },
      timeoutMs: 10_000,
      headers: { Accept: "application/json" },
    });
    traces.push(ik.trace);
    const inchiKey = ik.data?.PropertyTable?.Properties?.[0]?.InChIKey?.trim();
    if (inchiKey) {
      const urlIk = `${UNICHEM}/verbose_inchikey/${encodeURIComponent(inchiKey)}`;
      const ikMap = await fetchJsonWithTrace<UnichemRow[]>(urlIk, {
        next: { revalidate: 86400 },
        timeoutMs: 10_000,
        headers: { Accept: "application/json" },
      });
      traces.push(ikMap.trace);
      xrefs = rowsToXrefs(Array.isArray(ikMap.data) ? ikMap.data : []);
    }
  }

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

  return { xrefs: top, annotations, traces };
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
