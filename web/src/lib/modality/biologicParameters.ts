/**
 * Educational process-parameter frameworks for chemical & biologic modalities.
 *
 * CRITICAL PRODUCT LAW:
 * - Values labeled "literatureTypical" are *illustrative educational envelopes*
 *   drawn from common public process-chemistry / bioprocess teaching practice.
 * - They are NOT site CQAs, NOT validated ranges, NOT GMP, NOT for batch records.
 * - Empty / "site-fill" parameters must stay empty until evidence or site data exists.
 * - Never treat these as inventing a validated plant procedure.
 */

import type { ProcessModality } from "@/lib/types/process";

export const PARAMETER_DISCLAIMER =
  "Educational parameter scaffolds only. Literature-typical ranges are teaching envelopes, " +
  "not validated process limits, not GMP, and not regulatory decision support. " +
  "Your site QMS, process validation, and primary sources always govern.";

export type ParameterCategory = "cpp" | "cqa" | "ipc" | "utility" | "ehs" | "hold";

export type ParameterFillStatus =
  | "literature-typical"
  | "site-fill-required"
  | "evidence-only"
  | "template-empty";

export interface ProcessParameterSpec {
  id: string;
  name: string;
  category: ParameterCategory;
  unit?: string;
  /** Illustrative public/teaching envelope — NEVER site truth */
  literatureTypical?: string;
  /** Why this parameter matters */
  rationale?: string;
  fillStatus: ParameterFillStatus;
  /** Unit-op template id this parameter usually attaches to */
  unitOpId?: string;
}

export interface ParameterSet {
  id: string;
  modality: ProcessModality;
  label: string;
  summary: string;
  disclaimer: string;
  parameters: ProcessParameterSpec[];
}

const D = PARAMETER_DISCLAIMER;

/** Shared small-molecule finishing parameters */
const SM_FINISH: ProcessParameterSpec[] = [
  {
    id: "sm-assay",
    name: "Assay / purity (HPLC)",
    category: "cqa",
    unit: "% w/w or area%",
    literatureTypical: "≥98–99.5% (grade-dependent teaching range)",
    fillStatus: "literature-typical",
    rationale: "Release identity/strength proxy in educational packages",
    unitOpId: "sm-isol",
  },
  {
    id: "sm-rs",
    name: "Related substances / impurities",
    category: "cqa",
    literatureTypical: "Per product specification (site method)",
    fillStatus: "site-fill-required",
    unitOpId: "sm-isol",
  },
  {
    id: "sm-rsv",
    name: "Residual solvents",
    category: "cqa",
    literatureTypical: "ICH Q3C class limits as starting teaching frame",
    fillStatus: "literature-typical",
    unitOpId: "sm-isol",
  },
  {
    id: "sm-t",
    name: "Reaction temperature envelope",
    category: "cpp",
    unit: "°C",
    literatureTypical: "Route-specific — omit numeric if not in evidence",
    fillStatus: "evidence-only",
    unitOpId: "sm-rxn",
  },
];

const FERMENTATION_PARAMS: ProcessParameterSpec[] = [
  {
    id: "ferm-do",
    name: "Dissolved oxygen (DO) setpoint band",
    category: "cpp",
    unit: "% air sat.",
    literatureTypical: "20–50% (organism- and process-dependent teaching band)",
    fillStatus: "literature-typical",
    rationale: "Common aerobic fermentation teaching envelope",
    unitOpId: "ferm-prod",
  },
  {
    id: "ferm-ph",
    name: "Broth pH control band",
    category: "cpp",
    unit: "pH",
    literatureTypical: "Organism-specific (often ~5–7 for many industrial yeasts/bacteria)",
    fillStatus: "literature-typical",
    unitOpId: "ferm-prod",
  },
  {
    id: "ferm-temp",
    name: "Fermentation temperature",
    category: "cpp",
    unit: "°C",
    literatureTypical: "Mesophile teaching band ~25–37 °C (strain-specific)",
    fillStatus: "literature-typical",
    unitOpId: "ferm-prod",
  },
  {
    id: "ferm-titer",
    name: "Product titer at harvest",
    category: "cqa",
    unit: "g/L or U/mL",
    literatureTypical: "Process-specific — site target only",
    fillStatus: "site-fill-required",
    unitOpId: "ferm-harvest",
  },
  {
    id: "ferm-contam",
    name: "Contamination / purity of culture",
    category: "ipc",
    literatureTypical: "No detectable adventitious growth (site method)",
    fillStatus: "site-fill-required",
    unitOpId: "ferm-prod",
  },
  {
    id: "ferm-otr",
    name: "Oxygen transfer / agitation power",
    category: "cpp",
    literatureTypical: "Scale-dependent; kLa / P/V from engineering package",
    fillStatus: "site-fill-required",
    unitOpId: "ferm-prod",
  },
];

const MAB_PARAMS: ProcessParameterSpec[] = [
  {
    id: "mab-vcd",
    name: "Viable cell density (production)",
    category: "cpp",
    unit: "×10⁶ cells/mL",
    literatureTypical: "Fed-batch CHO teaching peaks often ~10–30×10⁶ (clone-specific)",
    fillStatus: "literature-typical",
    unitOpId: "mab-prod",
  },
  {
    id: "mab-viab",
    name: "Culture viability at harvest readiness",
    category: "ipc",
    unit: "%",
    literatureTypical: "Often ≥70–90% depending on process design (teaching)",
    fillStatus: "literature-typical",
    unitOpId: "mab-harvest",
  },
  {
    id: "mab-titer",
    name: "Antibody titer",
    category: "cqa",
    unit: "g/L",
    literatureTypical: "Modern fed-batch teaching examples often multi-g/L; clone-specific",
    fillStatus: "literature-typical",
    unitOpId: "mab-prod",
  },
  {
    id: "mab-do",
    name: "Dissolved oxygen",
    category: "cpp",
    unit: "% air sat.",
    literatureTypical: "~30–60% common teaching setpoints",
    fillStatus: "literature-typical",
    unitOpId: "mab-prod",
  },
  {
    id: "mab-ph",
    name: "Culture pH",
    category: "cpp",
    unit: "pH",
    literatureTypical: "~6.8–7.2 teaching band for many CHO processes",
    fillStatus: "literature-typical",
    unitOpId: "mab-prod",
  },
  {
    id: "mab-temp",
    name: "Culture temperature",
    category: "cpp",
    unit: "°C",
    literatureTypical: "~36–37 °C with optional temperature shift (process-specific)",
    fillStatus: "literature-typical",
    unitOpId: "mab-prod",
  },
  {
    id: "mab-prota",
    name: "Protein A step yield / residual HCP post-capture",
    category: "cqa",
    literatureTypical: "Site validation targets only",
    fillStatus: "site-fill-required",
    unitOpId: "mab-capture",
  },
  {
    id: "mab-agg",
    name: "Aggregate content (SEC)",
    category: "cqa",
    unit: "%",
    literatureTypical: "Often controlled to low single-digit % (spec site-owned)",
    fillStatus: "site-fill-required",
    unitOpId: "mab-polish",
  },
  {
    id: "mab-glyco",
    name: "Glycan / charge variant profile",
    category: "cqa",
    literatureTypical: "Comparability ranges from development (site)",
    fillStatus: "site-fill-required",
    unitOpId: "mab-polish",
  },
  {
    id: "mab-viral",
    name: "Viral clearance / inactivation hold",
    category: "hold",
    literatureTypical: "Low-pH hold times/temps are process-validated — do not invent",
    fillStatus: "site-fill-required",
    unitOpId: "mab-capture",
  },
  {
    id: "mab-endo",
    name: "Endotoxin / bioburden",
    category: "cqa",
    literatureTypical: "Pharmacopeial / site limits",
    fillStatus: "site-fill-required",
    unitOpId: "mab-polish",
  },
];

const PEPTIDE_PARAMS: ProcessParameterSpec[] = [
  {
    id: "pep-coupling",
    name: "Coupling completion (Kaiser / HPLC)",
    category: "ipc",
    literatureTypical: "Complete by site method before next cycle",
    fillStatus: "site-fill-required",
    unitOpId: "pep-assemble",
  },
  {
    id: "pep-purity",
    name: "Crude / purified peptide purity",
    category: "cqa",
    unit: "HPLC area%",
    literatureTypical: "Therapeutic peptides often ≥95–98% after purify (product-specific)",
    fillStatus: "literature-typical",
    unitOpId: "pep-purify",
  },
  {
    id: "pep-ms",
    name: "Mass identity (MS)",
    category: "cqa",
    literatureTypical: "Matches theoretical monoisotopic mass within method tolerance",
    fillStatus: "literature-typical",
    unitOpId: "pep-purify",
  },
  {
    id: "pep-tfa",
    name: "Residual TFA / counter-ion",
    category: "cqa",
    literatureTypical: "Spec per salt form (site)",
    fillStatus: "site-fill-required",
    unitOpId: "pep-lyo",
  },
];

const OLIGO_PARAMS: ProcessParameterSpec[] = [
  {
    id: "oligo-flp",
    name: "Full-length purity",
    category: "cqa",
    unit: "%",
    literatureTypical: "Therapeutic oligos often high FLP targets (site-spec)",
    fillStatus: "site-fill-required",
    unitOpId: "oligo-purify",
  },
  {
    id: "oligo-n1",
    name: "N−1 / failure sequences",
    category: "cqa",
    literatureTypical: "Controlled per impurity qualification",
    fillStatus: "site-fill-required",
    unitOpId: "oligo-purify",
  },
  {
    id: "oligo-ms",
    name: "Identity by MS",
    category: "cqa",
    fillStatus: "site-fill-required",
    unitOpId: "oligo-purify",
  },
];

const CELL_PARAMS: ProcessParameterSpec[] = [
  {
    id: "ct-viab",
    name: "Cell viability (final)",
    category: "cqa",
    unit: "%",
    literatureTypical: "Often ≥70–90% depending on product class (teaching)",
    fillStatus: "literature-typical",
    unitOpId: "ct-fill",
  },
  {
    id: "ct-dose",
    name: "Dose / cell number",
    category: "cqa",
    unit: "cells / dose",
    literatureTypical: "Product-specific clinical dose — never invent",
    fillStatus: "site-fill-required",
    unitOpId: "ct-fill",
  },
  {
    id: "ct-id",
    name: "Identity / phenotype markers",
    category: "cqa",
    literatureTypical: "Panel defined in development (site)",
    fillStatus: "site-fill-required",
    unitOpId: "ct-exp",
  },
  {
    id: "ct-sterile",
    name: "Sterility / mycoplasma",
    category: "cqa",
    literatureTypical: "Compendial / validated methods — site",
    fillStatus: "site-fill-required",
    unitOpId: "ct-fill",
  },
  {
    id: "ct-coi",
    name: "Chain of identity / custody",
    category: "ehs",
    literatureTypical: "Procedural control — no numeric range",
    fillStatus: "site-fill-required",
    unitOpId: "ct-start",
  },
];

const GENE_PARAMS: ProcessParameterSpec[] = [
  {
    id: "gt-titer",
    name: "Genome titer (vg/mL or similar)",
    category: "cqa",
    literatureTypical: "Product-specific; site assay",
    fillStatus: "site-fill-required",
    unitOpId: "gt-purify",
  },
  {
    id: "gt-empty",
    name: "Empty/full capsid ratio",
    category: "cqa",
    literatureTypical: "Process- and serotype-specific targets (site)",
    fillStatus: "site-fill-required",
    unitOpId: "gt-purify",
  },
  {
    id: "gt-pot",
    name: "Potency / infectivity",
    category: "cqa",
    literatureTypical: "Method defined in development",
    fillStatus: "site-fill-required",
    unitOpId: "gt-fill",
  },
  {
    id: "gt-imp",
    name: "Host-cell protein / DNA residuals",
    category: "cqa",
    literatureTypical: "Platform + product limits (site)",
    fillStatus: "site-fill-required",
    unitOpId: "gt-purify",
  },
  {
    id: "gt-bsl",
    name: "Biosafety level & spill controls",
    category: "ehs",
    literatureTypical: "BSL assignment per risk assessment — site",
    fillStatus: "site-fill-required",
    unitOpId: "gt-prod",
  },
];

const FORM_PARAMS: ProcessParameterSpec[] = [
  {
    id: "dp-cu",
    name: "Content uniformity",
    category: "cqa",
    literatureTypical: "USP/Ph.Eur. style acceptance as teaching frame",
    fillStatus: "literature-typical",
    unitOpId: "dp-process",
  },
  {
    id: "dp-diss",
    name: "Dissolution (oral solids)",
    category: "cqa",
    literatureTypical: "Method/spec site-owned",
    fillStatus: "site-fill-required",
    unitOpId: "dp-process",
  },
  {
    id: "dp-part",
    name: "Particulate matter (parenteral)",
    category: "cqa",
    literatureTypical: "Pharmacopeial limits as teaching frame",
    fillStatus: "literature-typical",
    unitOpId: "dp-process",
  },
  {
    id: "dp-sterile",
    name: "Sterility (sterile DP)",
    category: "cqa",
    literatureTypical: "Compendial / validated — site",
    fillStatus: "site-fill-required",
    unitOpId: "dp-process",
  },
  {
    id: "dp-blend",
    name: "Blend uniformity",
    category: "ipc",
    literatureTypical: "RSD targets per development (site)",
    fillStatus: "site-fill-required",
    unitOpId: "dp-blend",
  },
];

const MEDIA_PARAMS: ProcessParameterSpec[] = [
  {
    id: "media-ph",
    name: "Final pH",
    category: "cqa",
    unit: "pH",
    literatureTypical: "Target ±0.1–0.2 typical teaching tolerance (formula-specific)",
    fillStatus: "literature-typical",
    unitOpId: "media-mix",
  },
  {
    id: "media-osmo",
    name: "Osmolality",
    category: "cqa",
    unit: "mOsm/kg",
    literatureTypical: "Formula-specific window",
    fillStatus: "site-fill-required",
    unitOpId: "media-mix",
  },
  {
    id: "media-endo",
    name: "Endotoxin",
    category: "cqa",
    literatureTypical: "Grade-dependent limit (site)",
    fillStatus: "site-fill-required",
    unitOpId: "media-filter",
  },
  {
    id: "media-filter",
    name: "0.2 µm filtration integrity",
    category: "ipc",
    literatureTypical: "Pass filter integrity test per SOP",
    fillStatus: "site-fill-required",
    unitOpId: "media-filter",
  },
];

const STERILE_COMPOUND: ProcessParameterSpec[] = [
  {
    id: "sc-bud",
    name: "Beyond-use date",
    category: "cqa",
    literatureTypical: "Per USP <797> policy & stability — site only",
    fillStatus: "site-fill-required",
    unitOpId: "sc-release",
  },
  {
    id: "sc-iso",
    name: "ISO classification / aseptic technique",
    category: "ehs",
    literatureTypical: "Facility policy — not invented here",
    fillStatus: "site-fill-required",
    unitOpId: "sc-aseptic",
  },
];

const ADC_PARAMS: ProcessParameterSpec[] = [
  ...MAB_PARAMS.filter((p) =>
    ["mab-agg", "mab-endo", "mab-prota"].includes(p.id)
  ).map((p) => ({ ...p, id: `adc-${p.id}` })),
  {
    id: "adc-dar",
    name: "Drug-to-antibody ratio (DAR)",
    category: "cqa",
    literatureTypical: "Target window is conjugate-specific (e.g. teaching examples ~2–8) — site owns",
    fillStatus: "literature-typical",
    unitOpId: "adc-conj",
  },
  {
    id: "adc-free",
    name: "Free payload / linker residuals",
    category: "cqa",
    literatureTypical: "Strict site limits for potent payloads",
    fillStatus: "site-fill-required",
    unitOpId: "adc-purify",
  },
  {
    id: "adc-oel",
    name: "Occupational exposure control (payload)",
    category: "ehs",
    literatureTypical: "OEL/band from industrial hygiene — site",
    fillStatus: "site-fill-required",
    unitOpId: "adc-conj",
  },
];

export const PARAMETER_SETS: Record<string, ParameterSet> = {
  "small-molecule": {
    id: "small-molecule",
    modality: "small-molecule",
    label: "Small-molecule API parameters",
    summary: "Reaction / isolation CQAs and CPPs for chemical APIs.",
    disclaimer: D,
    parameters: SM_FINISH,
  },
  fermentation: {
    id: "fermentation",
    modality: "fermentation",
    label: "Microbial fermentation parameters",
    summary: "DO, pH, temperature, titer, contamination controls.",
    disclaimer: D,
    parameters: FERMENTATION_PARAMS,
  },
  mab: {
    id: "mab",
    modality: "mab",
    label: "mAb DS process parameters",
    summary: "Upstream culture + downstream quality attributes (educational).",
    disclaimer: D,
    parameters: MAB_PARAMS,
  },
  adc: {
    id: "adc",
    modality: "adc",
    label: "ADC conjugation parameters",
    summary: "DAR, free payload, containment — high-potency aware.",
    disclaimer: D,
    parameters: ADC_PARAMS,
  },
  peptide: {
    id: "peptide",
    modality: "peptide",
    label: "Peptide (SPPS) parameters",
    summary: "Coupling IPC, purity, MS identity, residual counter-ion.",
    disclaimer: D,
    parameters: PEPTIDE_PARAMS,
  },
  oligonucleotide: {
    id: "oligonucleotide",
    modality: "oligonucleotide",
    label: "Oligonucleotide parameters",
    summary: "Full-length purity, N−1, MS identity.",
    disclaimer: D,
    parameters: OLIGO_PARAMS,
  },
  "cell-therapy": {
    id: "cell-therapy",
    modality: "cell-therapy",
    label: "Cell therapy parameters",
    summary: "Viability, identity, sterility, chain of identity.",
    disclaimer: D,
    parameters: CELL_PARAMS,
  },
  "gene-therapy": {
    id: "gene-therapy",
    modality: "gene-therapy",
    label: "Gene therapy / vector parameters",
    summary: "Genome titer, empty/full, potency, residuals, biosafety.",
    disclaimer: D,
    parameters: GENE_PARAMS,
  },
  vaccine: {
    id: "vaccine",
    modality: "vaccine",
    label: "Vaccine antigen parameters",
    summary: "Shares fermentation/culture themes plus antigen potency.",
    disclaimer: D,
    parameters: [
      ...FERMENTATION_PARAMS.slice(0, 3),
      {
        id: "vac-pot",
        name: "Antigen content / potency",
        category: "cqa",
        literatureTypical: "Assay site-defined",
        fillStatus: "site-fill-required",
        unitOpId: "vac-purify",
      },
      {
        id: "vac-inact",
        name: "Inactivation completeness (if applicable)",
        category: "cqa",
        literatureTypical: "Validated kill criteria — site only",
        fillStatus: "site-fill-required",
        unitOpId: "vac-inact",
      },
    ],
  },
  formulation: {
    id: "formulation",
    modality: "formulation",
    label: "Drug product formulation parameters",
    summary: "CU, dissolution, sterility, blend uniformity.",
    disclaimer: D,
    parameters: FORM_PARAMS,
  },
  media: {
    id: "media",
    modality: "media",
    label: "Media / buffer parameters",
    summary: "pH, osmolality, endotoxin, filter integrity.",
    disclaimer: D,
    parameters: MEDIA_PARAMS,
  },
  "sterile-compounding": {
    id: "sterile-compounding",
    modality: "sterile-compounding",
    label: "Sterile compounding awareness parameters",
    summary: "BUD and aseptic controls — process awareness only.",
    disclaimer: D,
    parameters: STERILE_COMPOUND,
  },
  other: {
    id: "other",
    modality: "other",
    label: "Generic process parameters",
    summary: "Identity, purity, key process parameters.",
    disclaimer: D,
    parameters: [
      {
        id: "other-id",
        name: "Identity",
        category: "cqa",
        fillStatus: "site-fill-required",
      },
      {
        id: "other-purity",
        name: "Purity / potency",
        category: "cqa",
        fillStatus: "site-fill-required",
      },
    ],
  },
};

export function getParameterSetForModality(
  modality: ProcessModality | string | undefined
): ParameterSet {
  const key = (modality || "small-molecule") as string;
  return PARAMETER_SETS[key] || PARAMETER_SETS["small-molecule"];
}

export function listParameterSets(): ParameterSet[] {
  return Object.values(PARAMETER_SETS);
}

/** Merge evidence-only note onto parameters when dossier has no numeric evidence. */
export function annotateParametersForDossier(
  set: ParameterSet,
  opts: { hasAiRoutes?: boolean; evidenceScore?: number } = {}
): ParameterSet {
  return {
    ...set,
    parameters: set.parameters.map((p) => {
      if (p.fillStatus === "literature-typical") return p;
      if (p.fillStatus === "evidence-only" && !opts.hasAiRoutes) {
        return {
          ...p,
          literatureTypical:
            p.literatureTypical ||
            "Await evidence-backed synthesis or site data — field left open",
          fillStatus: "template-empty" as const,
        };
      }
      return p;
    }),
  };
}
