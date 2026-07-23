/**
 * ChEMBL REST (EMBL-EBI) — free public molecule + mechanism data.
 * Docs: https://chembl.gitbook.io/chembl-interface-documentation/web-services
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const CHEMBL = "https://www.ebi.ac.uk/chembl/api/data";

export interface ChemblMolecule {
  chemblId: string;
  prefName?: string;
  maxPhase?: number;
  molecularFormula?: string;
  molecularWeight?: number;
  smiles?: string;
  inchiKey?: string;
  therapeuticFlag?: boolean;
  url: string;
}

export interface ChemblMechanism {
  mechanismOfAction?: string;
  targetName?: string;
  actionType?: string;
  directInteraction?: boolean;
}

export interface ChemblResult {
  molecule: ChemblMolecule | null;
  mechanisms: ChemblMechanism[];
  traces: ApiFetchTrace[];
  query: string;
}

/**
 * Resolve molecule by preferred name (or free text) via ChEMBL molecule search.
 */
export async function fetchChemblByName(
  name: string
): Promise<ChemblResult> {
  const q = name.trim();
  if (!q) return { molecule: null, mechanisms: [], traces: [], query: "" };

  const traces: ApiFetchTrace[] = [];
  const searchUrl =
    `${CHEMBL}/molecule/search.json?q=${encodeURIComponent(q)}&limit=5`;

  const { data, trace } = await fetchJsonWithTrace<{
    molecules?: Array<{
      molecule_chembl_id?: string;
      pref_name?: string;
      max_phase?: number;
      molecule_properties?: {
        full_mwt?: string | number;
        full_molformula?: string;
      };
      molecule_structures?: {
        canonical_smiles?: string;
        standard_inchi_key?: string;
      };
      therapeutic_flag?: boolean;
    }>;
  }>(searchUrl, { next: { revalidate: 3600 } });
  traces.push(trace);

  const first = data?.molecules?.[0];
  if (!first?.molecule_chembl_id) {
    return { molecule: null, mechanisms: [], traces, query: q };
  }

  const chemblId = first.molecule_chembl_id;
  const mw = first.molecule_properties?.full_mwt;
  const molecule: ChemblMolecule = {
    chemblId,
    prefName: first.pref_name || undefined,
    maxPhase: first.max_phase,
    molecularFormula: first.molecule_properties?.full_molformula,
    molecularWeight:
      typeof mw === "string" ? parseFloat(mw) : typeof mw === "number" ? mw : undefined,
    smiles: first.molecule_structures?.canonical_smiles,
    inchiKey: first.molecule_structures?.standard_inchi_key,
    therapeuticFlag: first.therapeutic_flag,
    url: `https://www.ebi.ac.uk/chembl/compound_report_card/${chemblId}/`,
  };

  const mechUrl = `${CHEMBL}/mechanism.json?molecule_chembl_id=${encodeURIComponent(chemblId)}&limit=8`;
  const mech = await fetchJsonWithTrace<{
    mechanisms?: Array<{
      mechanism_of_action?: string;
      target_name?: string;
      action_type?: string;
      direct_interaction?: boolean;
    }>;
  }>(mechUrl, { next: { revalidate: 3600 } });
  traces.push(mech.trace);

  const mechanisms: ChemblMechanism[] = (mech.data?.mechanisms ?? []).map((m) => ({
    mechanismOfAction: m.mechanism_of_action,
    targetName: m.target_name,
    actionType: m.action_type,
    directInteraction: m.direct_interaction,
  }));

  return { molecule, mechanisms, traces, query: q };
}
