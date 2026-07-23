/**
 * Multi-modality unit-operation templates.
 * Templates are structural scaffolds only — never filled with invented
 * process parameters. Live dossiers attach evidence into these slots.
 */

import type {
  ProcessModality,
  ProcessStep,
  ScaleClass,
} from "@/lib/types/process";

export interface UnitOpTemplate {
  id: string;
  title: string;
  description: string;
  mechanismClass?: string;
  typicalScale?: ScaleClass[];
}

export interface ModalityTemplate {
  modality: ProcessModality;
  label: string;
  summary: string;
  unitOps: UnitOpTemplate[];
  cqaPlaceholders: string[];
  ehsNotes: string[];
}

export const MODALITY_TEMPLATES: Record<ProcessModality, ModalityTemplate> = {
  "small-molecule": {
    modality: "small-molecule",
    label: "Small-molecule API / intermediate",
    summary:
      "Chemical synthesis route with plant-ready dual view (mechanism + manufacturing).",
    unitOps: [
      {
        id: "sm-rxn",
        title: "Chemical transformation",
        description: "Bond-forming / functional-group step under controlled conditions.",
        mechanismClass: "organic synthesis",
        typicalScale: ["lab", "kilo", "pilot", "commercial"],
      },
      {
        id: "sm-workup",
        title: "Workup / quench",
        description: "Quench, extraction, phase split, solvent swap.",
        typicalScale: ["lab", "kilo", "pilot", "commercial"],
      },
      {
        id: "sm-isol",
        title: "Isolation / crystallization",
        description: "Crystallization, filtration, drying to solid API or intermediate.",
        typicalScale: ["kilo", "pilot", "commercial"],
      },
    ],
    cqaPlaceholders: [
      "Assay / purity (HPLC)",
      "Related substances / impurities",
      "Residual solvents",
      "Particle size / polymorphism (if critical)",
    ],
    ehsNotes: [
      "Solvent flammability and recovery",
      "Reagent corrosion / toxicity class",
      "ATEX zoning for organic vapors",
    ],
  },
  peptide: {
    modality: "peptide",
    label: "Peptide (SPPS / LPPS)",
    summary: "Solid- or liquid-phase peptide synthesis with cleavage and purification.",
    unitOps: [
      {
        id: "pep-assemble",
        title: "Chain assembly",
        description: "Iterative coupling / deprotection (SPPS or segment condensation).",
        mechanismClass: "amide coupling",
      },
      {
        id: "pep-cleave",
        title: "Cleavage / global deprotection",
        description: "Resin cleavage and side-chain deprotection under controlled acid conditions.",
      },
      {
        id: "pep-purify",
        title: "Purification",
        description: "RP-HPLC or equivalent purification; salt form adjustment.",
      },
      {
        id: "pep-lyo",
        title: "Isolation / lyophilization",
        description: "Concentration and freeze-drying to bulk peptide.",
      },
    ],
    cqaPlaceholders: [
      "Purity (HPLC)",
      "Sequence identity (MS)",
      "Counter-ion / salt form",
      "Residual TFA / scavengers",
    ],
    ehsNotes: ["Strong acids (TFA, HF where applicable)", "Solvent waste from SPPS"],
  },
  oligonucleotide: {
    modality: "oligonucleotide",
    label: "Oligonucleotide",
    summary: "Solid-phase oligo synthesis, cleavage, purification, desalting.",
    unitOps: [
      {
        id: "oligo-synth",
        title: "Solid-phase synthesis",
        description: "Phosphoramidite cycle on solid support.",
      },
      {
        id: "oligo-cleave",
        title: "Cleavage & deprotection",
        description: "Support cleavage and protecting-group removal.",
      },
      {
        id: "oligo-purify",
        title: "Purification",
        description: "IEX / RP / dual purification to target purity.",
      },
    ],
    cqaPlaceholders: ["Full-length purity", "N-1 / failure sequences", "Identity (MS)"],
    ehsNotes: ["Acetonitrile volumes", "Ammonia / amine deprotection streams"],
  },
  mab: {
    modality: "mab",
    label: "Monoclonal antibody (DS)",
    summary: "Mammalian cell culture upstream and chromatography downstream skeleton.",
    unitOps: [
      {
        id: "mab-seed",
        title: "Seed train / inoculum",
        description: "Cell expansion to production bioreactor seed.",
        typicalScale: ["lab", "pilot", "commercial"],
      },
      {
        id: "mab-prod",
        title: "Production culture",
        description: "Fed-batch or perfusion culture; harvest readiness criteria.",
      },
      {
        id: "mab-harvest",
        title: "Harvest / clarification",
        description: "Centrifugation / depth filtration clarification.",
      },
      {
        id: "mab-capture",
        title: "Capture chromatography",
        description: "Protein A or equivalent capture; viral inactivation hold.",
      },
      {
        id: "mab-polish",
        title: "Polish / UFDF",
        description: "IEX/HIC polish, viral filtration, UFDF to DS.",
      },
    ],
    cqaPlaceholders: [
      "Protein concentration",
      "Purity / aggregates",
      "Charge variants",
      "Glycan profile",
      "Host-cell protein / DNA",
      "Bioburden / endotoxin",
    ],
    ehsNotes: ["Biosafety level for host cell", "Viral clearance documentation site-owned"],
  },
  adc: {
    modality: "adc",
    label: "Antibody–drug conjugate",
    summary: "mAb intermediate + linker–payload conjugation and purification.",
    unitOps: [
      {
        id: "adc-mab",
        title: "mAb intermediate",
        description: "Qualified mAb DS as conjugation substrate.",
      },
      {
        id: "adc-conj",
        title: "Conjugation",
        description: "Controlled conjugation of linker–payload; DAR target window.",
      },
      {
        id: "adc-purify",
        title: "Purification / buffer exchange",
        description: "Remove free payload; UFDF to DP-ready DS.",
      },
    ],
    cqaPlaceholders: ["DAR", "Free payload", "Aggregates", "Potency"],
    ehsNotes: ["Highly potent payload handling / OEL", "Dedicated equipment strategy"],
  },
  "cell-therapy": {
    modality: "cell-therapy",
    label: "Cell therapy",
    summary: "Apheresis / starting cells → activation/expansion → harvest/fill skeleton.",
    unitOps: [
      {
        id: "ct-start",
        title: "Starting material receipt",
        description: "Patient or donor material intake and identity checks.",
      },
      {
        id: "ct-mod",
        title: "Modification / activation",
        description: "Genetic modification and/or activation as applicable.",
      },
      {
        id: "ct-exp",
        title: "Expansion",
        description: "Controlled culture expansion to dose.",
      },
      {
        id: "ct-fill",
        title: "Harvest / formulation / fill",
        description: "Final formulation and cryopreservation or fresh fill.",
      },
    ],
    cqaPlaceholders: ["Cell viability", "Identity / phenotype", "Potency", "Sterility"],
    ehsNotes: ["Chain of identity / custody", "Biosafety"],
  },
  "gene-therapy": {
    modality: "gene-therapy",
    label: "Gene therapy / vector",
    summary: "Vector production (viral or non-viral) and purification skeleton.",
    unitOps: [
      {
        id: "gt-prod",
        title: "Vector production",
        description: "Producer cell transfection or infection for vector harvest.",
      },
      {
        id: "gt-purify",
        title: "Purification",
        description: "Chromatography / filtration train to drug substance.",
      },
      {
        id: "gt-fill",
        title: "Formulation / fill",
        description: "Formulation and sterile fill of vector DP.",
      },
    ],
    cqaPlaceholders: ["Genome titer", "Empty/full ratio", "Impurities", "Potency"],
    ehsNotes: ["Biosafety level", "Spill and decontamination procedures"],
  },
  vaccine: {
    modality: "vaccine",
    label: "Vaccine antigen / DS",
    summary: "Antigen production, inactivation/detox where applicable, purification.",
    unitOps: [
      {
        id: "vac-prod",
        title: "Antigen production",
        description: "Fermentation, cell culture, or synthetic antigen generation.",
      },
      {
        id: "vac-inact",
        title: "Inactivation / detoxification",
        description: "Where required by product class.",
      },
      {
        id: "vac-purify",
        title: "Purification / formulation bulk",
        description: "Downstream purification to bulk intermediate.",
      },
    ],
    cqaPlaceholders: ["Antigen content", "Identity", "Purity", "Potency"],
    ehsNotes: ["Live agent handling where applicable"],
  },
  formulation: {
    modality: "formulation",
    label: "Drug product formulation",
    summary: "Dosage-form process (tablet, sterile liquid, lyophilized) — process only.",
    unitOps: [
      {
        id: "dp-blend",
        title: "Dispensing / blending",
        description: "API and excipient dispensing and blend uniformity.",
      },
      {
        id: "dp-process",
        title: "Unit dose processing",
        description: "Granulation/compression, or sterile filtration / fill, etc.",
      },
      {
        id: "dp-pack",
        title: "Primary packaging",
        description: "Blister, vial, syringe fill-finish as applicable.",
      },
    ],
    cqaPlaceholders: [
      "Assay / content uniformity",
      "Dissolution (oral)",
      "Particulates (parenteral)",
      "Sterility (sterile DP)",
    ],
    ehsNotes: ["Dust control for potent API", "Aseptic area classification"],
  },
  "sterile-compounding": {
    modality: "sterile-compounding",
    label: "Sterile compounding (process awareness)",
    summary:
      "USP-style process awareness only — not a compounding worksheet or clinical protocol.",
    unitOps: [
      {
        id: "sc-calc",
        title: "Calculation / identity check",
        description: "Source-container identity and calculation verification.",
      },
      {
        id: "sc-aseptic",
        title: "Aseptic manipulation",
        description: "Aseptic technique under appropriate ISO classification.",
      },
      {
        id: "sc-release",
        title: "Visual / release checks",
        description: "Visual inspection and beyond-use dating per site policy.",
      },
    ],
    cqaPlaceholders: ["Identity", "Sterility assurance (site)", "Beyond-use date (site)"],
    ehsNotes: ["Not a patient-care protocol", "Site SOPs always govern"],
  },
  media: {
    modality: "media",
    label: "Cell culture media / buffer",
    summary: "Media or buffer preparation and filtration skeleton.",
    unitOps: [
      {
        id: "media-dispense",
        title: "Component dispensing",
        description: "Weigh / dispense components per bill of materials.",
      },
      {
        id: "media-mix",
        title: "Mixing / pH / osmolality",
        description: "Dissolve, adjust pH and osmolality to target window.",
      },
      {
        id: "media-filter",
        title: "Sterile filtration / fill",
        description: "0.2 µm filtration and bulk fill or bagging.",
      },
    ],
    cqaPlaceholders: ["pH", "Osmolality", "Bioburden", "Endotoxin"],
    ehsNotes: ["Dusty powders", "Cold-chain for some components"],
  },
  fermentation: {
    modality: "fermentation",
    label: "Microbial fermentation",
    summary: "Seed train, production fermentation, harvest for small-molecule or protein.",
    unitOps: [
      {
        id: "ferm-seed",
        title: "Seed train",
        description: "Shake flask → seed fermenter expansion.",
      },
      {
        id: "ferm-prod",
        title: "Production fermentation",
        description: "Controlled DO, pH, feed; titer monitoring.",
      },
      {
        id: "ferm-harvest",
        title: "Harvest",
        description: "Broth harvest and primary recovery.",
      },
    ],
    cqaPlaceholders: ["Titer", "Viability / contamination", "Key impurities"],
    ehsNotes: ["Biosafety of host", "Off-gas and foam control"],
  },
  other: {
    modality: "other",
    label: "Other process",
    summary: "Generic unit-operation skeleton when modality is unspecified.",
    unitOps: [
      {
        id: "other-prep",
        title: "Preparation",
        description: "Materials preparation and line clearance.",
      },
      {
        id: "other-process",
        title: "Core process",
        description: "Primary transformation or conversion step.",
      },
      {
        id: "other-finish",
        title: "Finishing",
        description: "Isolation, packaging, or bulk hold.",
      },
    ],
    cqaPlaceholders: ["Identity", "Purity / potency", "Key process parameters"],
    ehsNotes: ["Site-specific hazard assessment required"],
  },
};

/** Convert modality unit ops into empty ProcessStep shells (no invented conditions). */
export function modalityTemplateToSteps(modality: ProcessModality): ProcessStep[] {
  const t = MODALITY_TEMPLATES[modality] || MODALITY_TEMPLATES.other;
  return t.unitOps.map((op, i) => ({
    id: op.id,
    order: i + 1,
    title: op.title,
    description: op.description,
    mechanismClass: op.mechanismClass,
    controls: {
      cqaTargets: [],
      criticalParameters: [],
      ipcMethods: [],
      notes: "Fill only from public evidence or site validation — template is structural only.",
    },
  }));
}

export function listModalities(): ModalityTemplate[] {
  return Object.values(MODALITY_TEMPLATES);
}

export function inferModalityFromText(text: string): ProcessModality {
  const t = text.toLowerCase();
  if (/monoclonal|mab\b|antibody|cho cell|protein a/.test(t)) return "mab";
  if (/antibody.?drug|adc\b|linker.?payload|dar\b/.test(t)) return "adc";
  if (/peptide|spps|fmoc|solid.phase peptide/.test(t)) return "peptide";
  if (/oligonucleotide|aso\b|sirna|phosphoramidite/.test(t)) return "oligonucleotide";
  if (/car.?t|cell therapy|apheresis/.test(t)) return "cell-therapy";
  if (/aav|lentivirus|gene therapy|viral vector/.test(t)) return "gene-therapy";
  if (/vaccine|antigen|inactivat/.test(t)) return "vaccine";
  if (/tablet|capsule|lyophiliz|fill.?finish|formulation/.test(t)) return "formulation";
  if (/ferment|bioreactor|microbial/.test(t)) return "fermentation";
  if (/compounding|usp <797>|aseptic prep/.test(t)) return "sterile-compounding";
  if (/cell culture media|basal medium/.test(t)) return "media";
  return "small-molecule";
}
