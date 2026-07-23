/**
 * Faceted hub catalog: curated Tier-A examples + live PubChem pointers
 * for high-demand APIs / modalities (long-tail still via search).
 */

import type { CatalogEntry, ProcessModality, EntityRole } from "@/lib/types/process";
import { getExampleCatalog } from "@/lib/data/examples";

export interface HubCatalogEntry extends CatalogEntry {
  modality: ProcessModality;
  entityRole: EntityRole;
  kind: "example" | "live";
}

/** High-demand live CIDs (evidence via free APIs when opened). */
const LIVE_HUB: Array<{
  name: string;
  pubchemCid: number;
  cas?: string;
  unii?: string;
  formula?: string;
  modality: ProcessModality;
  entityRole: EntityRole;
  tags: string[];
  summary: string;
  scaleHints?: CatalogEntry["scaleHints"];
}> = [
  {
    name: "Atorvastatin",
    pubchemCid: 60823,
    cas: "134523-00-5",
    formula: "C33H35FN2O5",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["statin", "api", "industrial"],
    summary: "HMG-CoA reductase inhibitor API — live PubChem + process literature.",
    scaleHints: ["kilo", "pilot", "commercial"],
  },
  {
    name: "Oseltamivir",
    pubchemCid: 65028,
    cas: "196618-13-0",
    formula: "C16H28N2O4",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["antiviral", "api"],
    summary: "Neuraminidase inhibitor; shikimate / process chemistry case study.",
  },
  {
    name: "Sitagliptin",
    pubchemCid: 4369359,
    cas: "486460-32-6",
    formula: "C16H15F6N5O",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["dpp-4", "api", "biocatalytic"],
    summary: "DPP-4 inhibitor; famous biocatalytic industrial route literature.",
  },
  {
    name: "Paclitaxel",
    pubchemCid: 36314,
    cas: "33069-62-4",
    formula: "C47H51NO14",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["oncology", "semi-synthesis"],
    summary: "Complex natural-product / semi-synthetic oncology API.",
  },
  {
    name: "Insulin (human)",
    pubchemCid: 16129672,
    modality: "formulation",
    entityRole: "api",
    tags: ["biologic-adjacent", "peptide"],
    summary: "Protein hormone — identity/public data; process is biotech modality.",
  },
  {
    name: "Amoxicillin",
    pubchemCid: 33613,
    cas: "26787-78-0",
    formula: "C16H19N3O5S",
    modality: "fermentation",
    entityRole: "api",
    tags: ["beta-lactam", "semi-synthetic"],
    summary: "β-lactam antibiotic; fermentation + chemical steps literature.",
  },
  {
    name: "Ethanol",
    pubchemCid: 702,
    cas: "64-17-5",
    formula: "C2H6O",
    modality: "small-molecule",
    entityRole: "solvent",
    tags: ["solvent", "utility"],
    summary: "Common process solvent / utility — EHS and recovery focus.",
  },
  {
    name: "Acetonitrile",
    pubchemCid: 6342,
    cas: "75-05-8",
    formula: "C2H3N",
    modality: "small-molecule",
    entityRole: "solvent",
    tags: ["solvent", "hplc"],
    summary: "Aprotic solvent widely used in synthesis and peptide workup.",
  },
  {
    name: "Lactose",
    pubchemCid: 440995,
    cas: "63-42-3",
    formula: "C12H22O11",
    modality: "formulation",
    entityRole: "excipient",
    tags: ["excipient", "oral-solid"],
    summary: "Common oral solid-dose excipient (formulation process context).",
  },
  {
    name: "Microcrystalline cellulose",
    pubchemCid: 14055602,
    cas: "9004-34-6",
    modality: "formulation",
    entityRole: "excipient",
    tags: ["excipient", "diluent"],
    summary: "Tablet diluent / binder class — formulation modality.",
  },
  {
    name: "Sodium chloride",
    pubchemCid: 5234,
    cas: "7647-14-5",
    formula: "ClNa",
    modality: "media",
    entityRole: "media-component",
    tags: ["buffer", "media", "injectable"],
    summary: "Buffer / isotonicity component for media and parenteral systems.",
  },
  {
    name: "Polysorbate 80",
    pubchemCid: 5284448,
    cas: "9005-65-6",
    modality: "formulation",
    entityRole: "excipient",
    tags: ["surfactant", "biologic-formulation"],
    summary: "Surfactant common in biologic and small-molecule formulations.",
  },
  {
    name: "Remdesivir",
    pubchemCid: 121304016,
    cas: "1809249-37-3",
    formula: "C27H35N6O8P",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["antiviral", "prodrug"],
    summary: "Nucleotide prodrug API — process literature via live APIs.",
  },
  {
    name: "Apixaban",
    pubchemCid: 10182969,
    cas: "503612-47-3",
    formula: "C25H25N5O4",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["anticoagulant", "api"],
    summary: "Factor Xa inhibitor API for process scouting.",
  },
  {
    name: "Sertraline",
    pubchemCid: 68617,
    cas: "79617-96-2",
    formula: "C17H17Cl2N",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["cns", "api"],
    summary: "SSRI API with well-documented industrial chemistry literature.",
  },
  {
    name: "Penicillin G",
    pubchemCid: 5904,
    cas: "61-33-6",
    formula: "C16H18N2O4S",
    modality: "fermentation",
    entityRole: "api",
    tags: ["beta-lactam", "fermentation", "intermediate-source"],
    summary: "Fermentation β-lactam; upstream to 6-APA / semi-synthetics.",
  },
  {
    name: "6-APA",
    pubchemCid: 8745,
    cas: "551-16-6",
    formula: "C8H12N2O3S",
    modality: "fermentation",
    entityRole: "intermediate",
    tags: ["beta-lactam", "intermediate", "6-apa"],
    summary: "6-Aminopenicillanic acid — key intermediate for amoxicillin-class APIs.",
  },
  {
    name: "Insulin glargine (reference)",
    pubchemCid: 118984454,
    modality: "formulation",
    entityRole: "api",
    tags: ["biologic", "peptide", "injectable"],
    summary: "Biologic-adjacent identity pointer — process is multi-modality DS/DP.",
  },
  {
    name: "Acetic anhydride",
    pubchemCid: 7918,
    cas: "108-24-7",
    formula: "C4H6O3",
    modality: "small-molecule",
    entityRole: "reagent",
    tags: ["reagent", "acetylation"],
    summary: "Common acetylation reagent (aspirin / paracetamol trains).",
  },
  {
    name: "Salicylic acid",
    pubchemCid: 338,
    cas: "69-72-7",
    formula: "C7H6O3",
    modality: "small-molecule",
    entityRole: "starting-material",
    tags: ["starting-material", "aspirin"],
    summary: "Aspirin acetylation substrate — linked from ASA Tier-A dossier.",
  },
  {
    name: "4-Aminophenol",
    pubchemCid: 403,
    cas: "123-30-8",
    formula: "C6H7NO",
    modality: "small-molecule",
    entityRole: "intermediate",
    tags: ["intermediate", "paracetamol", "impurity-theme"],
    summary: "Paracetamol intermediate / residual impurity control theme.",
  },
  {
    name: "Mannitol",
    pubchemCid: 6251,
    cas: "69-65-8",
    formula: "C6H14O6",
    modality: "formulation",
    entityRole: "excipient",
    tags: ["excipient", "lyophilization", "osmotic"],
    summary: "Formulation / lyophilization bulking agent.",
  },
  {
    name: "Histidine",
    pubchemCid: 6274,
    cas: "71-00-1",
    formula: "C6H9N3O2",
    modality: "media",
    entityRole: "media-component",
    tags: ["buffer", "biologic-formulation", "amino-acid"],
    summary: "Common buffer component in biologic formulations.",
  },
];

export function getHubCatalog(): HubCatalogEntry[] {
  const examples: HubCatalogEntry[] = getExampleCatalog().map((e) => ({
    ...e,
    modality: (e.modality || "small-molecule") as ProcessModality,
    entityRole: (e.entityRole || "api") as EntityRole,
    kind: "example" as const,
    tags: [...(e.tags || []), "tier-a", "curated"],
  }));

  const live: HubCatalogEntry[] = LIVE_HUB.map((e) => ({
    id: `live-${e.pubchemCid}`,
    name: e.name,
    cas: e.cas,
    unii: e.unii,
    formula: e.formula,
    tier: "B" as const,
    tags: e.tags,
    summary: e.summary,
    pubchemCid: e.pubchemCid,
    modality: e.modality,
    entityRole: e.entityRole,
    scaleHints: e.scaleHints,
    kind: "live" as const,
  }));

  return [...examples, ...live];
}

export function filterHubCatalog(
  entries: HubCatalogEntry[],
  opts: {
    q?: string;
    modality?: string;
    role?: string;
    tier?: string;
    kind?: string;
  }
): HubCatalogEntry[] {
  const q = opts.q?.trim().toLowerCase() || "";
  return entries.filter((e) => {
    if (opts.modality && e.modality !== opts.modality) return false;
    if (opts.role && e.entityRole !== opts.role) return false;
    if (opts.tier && e.tier !== opts.tier) return false;
    if (opts.kind && e.kind !== opts.kind) return false;
    if (!q) return true;
    const hay = [
      e.name,
      e.cas,
      e.unii,
      e.formula,
      e.summary,
      ...(e.tags || []),
      e.modality,
      e.entityRole,
      e.pubchemCid != null ? String(e.pubchemCid) : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export const MODALITY_OPTIONS: { value: ProcessModality; label: string }[] = [
  { value: "small-molecule", label: "Small molecule" },
  { value: "peptide", label: "Peptide" },
  { value: "oligonucleotide", label: "Oligonucleotide" },
  { value: "mab", label: "mAb" },
  { value: "adc", label: "ADC" },
  { value: "fermentation", label: "Fermentation" },
  { value: "formulation", label: "Formulation" },
  { value: "media", label: "Media / buffer" },
  { value: "sterile-compounding", label: "Sterile compounding" },
  { value: "cell-therapy", label: "Cell therapy" },
  { value: "gene-therapy", label: "Gene therapy" },
  { value: "vaccine", label: "Vaccine" },
];

export const ROLE_OPTIONS: { value: EntityRole; label: string }[] = [
  { value: "api", label: "API" },
  { value: "intermediate", label: "Intermediate" },
  { value: "impurity", label: "Impurity" },
  { value: "excipient", label: "Excipient" },
  { value: "solvent", label: "Solvent" },
  { value: "reagent", label: "Reagent" },
  { value: "drug-product", label: "Drug product" },
  { value: "media-component", label: "Media component" },
];
