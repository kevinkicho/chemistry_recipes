/**
 * Site-fill field templates by process modality — all empty until the site fills them.
 */

import type { SiteFillFieldKey } from "@/lib/idb/siteFill";
import type { ProcessModality } from "@/lib/types/process";

export type SiteFillFieldDef = {
  key: SiteFillFieldKey;
  label: string;
  placeholder: string;
};

const COMMON: SiteFillFieldDef[] = [
  {
    key: "siteTemp",
    label: "Site temperature envelope",
    placeholder: "e.g. site-validated °C range",
  },
  {
    key: "siteTime",
    label: "Site time / cycle",
    placeholder: "e.g. site hold / reaction time",
  },
  {
    key: "sitePressure",
    label: "Site pressure",
    placeholder: "e.g. site bar / psig",
  },
  {
    key: "equipmentTag",
    label: "Equipment tag",
    placeholder: "e.g. R-2401 GLR",
  },
  {
    key: "ipcMethod",
    label: "Site IPC method",
    placeholder: "e.g. HPLC-IPC-12 (site ID)",
  },
  {
    key: "batchSize",
    label: "Batch / campaign size",
    placeholder: "e.g. pilot 50 L",
  },
];

const MAB_EXTRA: SiteFillFieldDef[] = [
  {
    key: "bioreactorId",
    label: "Bioreactor / seed train ID",
    placeholder: "e.g. BR-12 (site)",
  },
  {
    key: "captureColumn",
    label: "Capture column / resin lot",
    placeholder: "e.g. Protein A col ID (site)",
  },
  {
    key: "viralClearance",
    label: "Viral clearance step ID",
    placeholder: "e.g. VF / low-pH hold (site)",
  },
  {
    key: "mediaLot",
    label: "Media / feed lot",
    placeholder: "site media lot (empty until filled)",
  },
];

const GENE_EXTRA: SiteFillFieldDef[] = [
  {
    key: "bioreactorId",
    label: "Production vessel ID",
    placeholder: "e.g. SU bioreactor (site)",
  },
  {
    key: "vectorLot",
    label: "Vector / plasmid lot",
    placeholder: "site vector lot",
  },
  {
    key: "viralClearance",
    label: "Filtration / clearance ID",
    placeholder: "site viral filter ID",
  },
  {
    key: "mediaLot",
    label: "Media lot",
    placeholder: "site media lot",
  },
];

const CELL_EXTRA: SiteFillFieldDef[] = [
  {
    key: "bioreactorId",
    label: "Expansion vessel ID",
    placeholder: "e.g. WAVE / G-Rex (site)",
  },
  {
    key: "mediaLot",
    label: "Media / cytokine lot",
    placeholder: "site lot IDs",
  },
  {
    key: "vectorLot",
    label: "Transduction reagent lot",
    placeholder: "site lot (if applicable)",
  },
];

export function siteFillFieldsForModality(
  modality?: ProcessModality | string | null
): SiteFillFieldDef[] {
  const m = (modality || "small-molecule").toLowerCase();
  if (m.includes("mab") || m.includes("antibody") || m === "biologic") {
    return [...COMMON, ...MAB_EXTRA];
  }
  if (m.includes("gene") || m.includes("aav") || m.includes("viral-vector")) {
    return [...COMMON, ...GENE_EXTRA];
  }
  if (m.includes("cell") || m.includes("car-t") || m.includes("therapy")) {
    return [...COMMON, ...CELL_EXTRA];
  }
  if (m.includes("ferment") || m.includes("upstream")) {
    return [
      ...COMMON,
      {
        key: "bioreactorId",
        label: "Fermenter ID",
        placeholder: "e.g. F-301 (site)",
      },
      {
        key: "mediaLot",
        label: "Media / feed lot",
        placeholder: "site lot",
      },
    ];
  }
  return COMMON;
}
