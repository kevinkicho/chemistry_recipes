/**
 * Faceted hub catalog — live work only.
 * Sample / Tier-A mock entries removed; day-to-day work starts at Search.
 * Optional LIVE_HUB may be re-added later as resilience pointers (not teaching mocks).
 */

import type { CatalogEntry, ProcessModality, EntityRole } from "@/lib/types/process";

export interface HubCatalogEntry extends CatalogEntry {
  modality: ProcessModality;
  entityRole: EntityRole;
  kind: "live";
}

/** Empty by default — fortify live PubChem / multi-API path. */
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
}> = [];

export function getHubCatalog(): HubCatalogEntry[] {
  return LIVE_HUB.map((e) => ({
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
