/**
 * MyChem.info — free BioThings aggregated chemical annotation.
 * Docs: https://mychem.info/
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const MYCHEM = "https://mychem.info/v1";

export interface MyChemHit {
  id: string;
  name?: string;
  unii?: string;
  chemblId?: string;
  drugbankId?: string;
  inchikey?: string;
  cas?: string;
  summary?: string;
  url: string;
}

export async function fetchMyChemByName(
  name: string
): Promise<{ hit: MyChemHit | null; traces: ApiFetchTrace[]; query: string }> {
  const q = name.trim();
  if (!q) return { hit: null, traces: [], query: "" };

  // Free-text query across common chem fields
  const url =
    `${MYCHEM}/query?q=${encodeURIComponent(q)}` +
    `&fields=chembl.molecule_chembl_id,chembl.pref_name,unii.unii,drugbank.id,drugbank.name,` +
    `pubchem.cid,chebi.id,chebi.name,ginas.unii,` +
    `pharmgkb.id&size=3`;

  const { data, trace } = await fetchJsonWithTrace<{
    hits?: Array<{
      _id?: string;
      chembl?: { molecule_chembl_id?: string; pref_name?: string };
      unii?: { unii?: string };
      ginas?: { unii?: string };
      drugbank?: { id?: string; name?: string };
      chebi?: { id?: string; name?: string };
      pharmgkb?: { id?: string };
    }>;
  }>(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json" },
  });

  const h = data?.hits?.[0];
  if (!h) return { hit: null, traces: [trace], query: q };

  const unii = h.unii?.unii || h.ginas?.unii;
  const chemblId = h.chembl?.molecule_chembl_id;
  const nameOut = h.chembl?.pref_name || h.drugbank?.name || h.chebi?.name || q;

  const parts = [
    chemblId && `ChEMBL ${chemblId}`,
    unii && `UNII ${unii}`,
    h.drugbank?.id && `DrugBank ${h.drugbank.id}`,
    h.chebi?.id && `ChEBI ${h.chebi.id}`,
  ].filter(Boolean);

  return {
    hit: {
      id: h._id || chemblId || unii || q,
      name: nameOut,
      unii,
      chemblId,
      drugbankId: h.drugbank?.id,
      summary: parts.join(" · ") || undefined,
      url: chemblId
        ? `https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/`
        : `https://mychem.info/v1/query?q=${encodeURIComponent(q)}`,
    },
    traces: [trace],
    query: q,
  };
}
