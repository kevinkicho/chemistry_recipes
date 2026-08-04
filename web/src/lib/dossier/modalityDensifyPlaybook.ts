/**
 * Modality densify playbooks — preferred free-public families + AI framing
 * for non-small-molecule densify (still quote-bound, never invents CPPs).
 */

import type { ProcessModality } from "@/lib/types/process";

export type ModalityDensifyPlaybook = {
  modality: ProcessModality;
  label: string;
  /** Preferred soft-family labels for retry / densify emphasis */
  preferredFamilies: string[];
  /** Boost process lit scoring when titles match */
  litBoostTerms: RegExp;
  /** Extra agentic instruction for dual-view (appended) */
  aiInstruction: string;
  /** Ideal sections that matter most for this modality */
  priorityIdealSections: string[];
};

const DEFAULT: ModalityDensifyPlaybook = {
  modality: "small-molecule",
  label: "Small-molecule API",
  preferredFamilies: [
    "europepmc",
    "pubmed",
    "openalex",
    "patentsview",
    "europepmc-pat",
    "orgsyn",
    "pubchem-patents",
  ],
  litBoostTerms:
    /\b(synthes|preparat|manufactur|crystal|hydrogen|work[- ]?up|process chemistry)\b/i,
  aiInstruction:
    "Prefer organic synthesis / isolation unit ops from procedure segments.",
  priorityIdealSections: [
    "process-recipe",
    "manufacturing-summary",
    "critical-params",
    "related-entities",
  ],
};

const PLAYBOOKS: Partial<Record<ProcessModality, ModalityDensifyPlaybook>> = {
  "small-molecule": DEFAULT,
  peptide: {
    modality: "peptide",
    label: "Peptide",
    preferredFamilies: [
      "europepmc",
      "pubmed",
      "openalex",
      "europepmc-pat",
      "chembl",
    ],
    litBoostTerms:
      /\b(peptide|SPPS|Fmoc|cleavage|coupling|resin|solid[- ]phase)\b/i,
    aiInstruction:
      "Frame dual-view around chain assembly / cleavage / purification when evidence supports; never invent resin loadings or cleavage setpoints.",
    priorityIdealSections: [
      "process-recipe",
      "related-entities",
      "manufacturing-summary",
    ],
  },
  oligonucleotide: {
    modality: "oligonucleotide",
    label: "Oligonucleotide",
    preferredFamilies: ["europepmc", "pubmed", "openalex", "europepmc-pat"],
    litBoostTerms:
      /\b(oligonucleotide|ASO|siRNA|amidite|solid[- ]phase|deprotect)\b/i,
    aiInstruction:
      "Prefer solid-phase assembly / deprotection / purification language from densified text only.",
    priorityIdealSections: ["process-recipe", "manufacturing-summary", "ehs"],
  },
  mab: {
    modality: "mab",
    label: "mAb / biologic",
    preferredFamilies: [
      "europepmc",
      "pubmed",
      "openalex",
      "reactome",
      "clinicaltrials",
      "openfda",
    ],
    litBoostTerms:
      /\b(monoclonal|mAb|CHO|bioreactor|capture|Protein A|downstream|upstream|fermentation)\b/i,
    aiInstruction:
      "Prefer upstream culture / capture / polish unit-op language when present; do not invent titers, media recipes, or CPP setpoints.",
    priorityIdealSections: [
      "process-recipe",
      "manufacturing-summary",
      "critical-params",
      "environment",
    ],
  },
  fermentation: {
    modality: "fermentation",
    label: "Fermentation",
    preferredFamilies: [
      "europepmc",
      "pubmed",
      "openalex",
      "kegg",
      "rhea",
      "europepmc-pat",
    ],
    litBoostTerms:
      /\b(ferment|bioreactor|fed[- ]batch|titer|downstream|purification|microbial)\b/i,
    aiInstruction:
      "Structure manufacturing view around culture / recovery / purification only from densified free-public text.",
    priorityIdealSections: [
      "process-recipe",
      "manufacturing-summary",
      "environment",
      "ehs",
    ],
  },
  formulation: {
    modality: "formulation",
    label: "Formulation",
    preferredFamilies: [
      "europepmc",
      "pubmed",
      "openfda",
      "dailymed",
      "europepmc-pat",
    ],
    litBoostTerms:
      /\b(formulation|excipient|lyophil|tablet|capsule|parenteral|stability)\b/i,
    aiInstruction:
      "Prefer formulation / dosage-form manufacturing cues from labels and process lit; never invent site composition.",
    priorityIdealSections: [
      "manufacturing-summary",
      "process-recipe",
      "ehs",
      "applications",
    ],
  },
  adc: {
    modality: "adc",
    label: "ADC",
    preferredFamilies: ["europepmc", "pubmed", "openalex", "europepmc-pat", "chembl"],
    litBoostTerms: /\b(ADC|antibody[- ]drug|conjugat|linker|DAR)\b/i,
    aiInstruction:
      "Separate antibody process cues from conjugation / linker chemistry when evidence allows; no invented DAR targets.",
    priorityIdealSections: [
      "process-recipe",
      "related-entities",
      "critical-params",
    ],
  },
};

export function getModalityDensifyPlaybook(
  modality?: ProcessModality | string | null
): ModalityDensifyPlaybook {
  if (!modality) return DEFAULT;
  const key = modality as ProcessModality;
  return PLAYBOOKS[key] || DEFAULT;
}

/** Score boost for literature/patent text under a modality playbook. */
export function modalityLitBoost(
  title: string,
  body: string | undefined,
  modality?: ProcessModality | string | null
): number {
  const pb = getModalityDensifyPlaybook(modality);
  const hay = `${title} ${body || ""}`;
  return pb.litBoostTerms.test(hay) ? 12 : 0;
}

export function modalityAiInstruction(
  modality?: ProcessModality | string | null
): string {
  return getModalityDensifyPlaybook(modality).aiInstruction;
}
