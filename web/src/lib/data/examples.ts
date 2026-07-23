/**
 * Curated Tier-A example dossiers for demos on the home page only.
 * NOT wired to PubChem search — live search always uses free APIs.
 */

import type { CatalogEntry, MoleculeDossier } from "@/lib/types/process";
import aspirin from "@/data/molecules/aspirin.json";
import ibuprofen from "@/data/molecules/ibuprofen.json";
import paracetamol from "@/data/molecules/paracetamol.json";
import menthol from "@/data/molecules/menthol.json";
import metformin from "@/data/molecules/metformin.json";
import caffeine from "@/data/molecules/caffeine.json";
import ethanol from "@/data/molecules/ethanol.json";
import amoxicillin from "@/data/molecules/amoxicillin.json";
import sitagliptin from "@/data/molecules/sitagliptin.json";
import penicillinG from "@/data/molecules/penicillin-g.json";

const EXAMPLES: MoleculeDossier[] = [
  aspirin as MoleculeDossier,
  ibuprofen as MoleculeDossier,
  paracetamol as MoleculeDossier,
  menthol as MoleculeDossier,
  metformin as MoleculeDossier,
  caffeine as MoleculeDossier,
  ethanol as MoleculeDossier,
  amoxicillin as MoleculeDossier,
  sitagliptin as MoleculeDossier,
  penicillinG as MoleculeDossier,
];

export function getExampleDossiers(): MoleculeDossier[] {
  return EXAMPLES;
}

export function getExampleById(id: string): MoleculeDossier | undefined {
  const key = id.trim().toLowerCase();
  return EXAMPLES.find((d) => d.id === key);
}

export function getExampleCatalog(): CatalogEntry[] {
  return EXAMPLES.map((d) => ({
    id: d.id,
    name: d.identifiers.name,
    cas: d.identifiers.cas,
    unii: d.identifiers.unii,
    formula: d.identifiers.formula,
    tier: d.tier,
    tags: ["example", "tier-a", d.routes[0]?.type, d.modality || "small-molecule"].filter(
      Boolean
    ) as string[],
    summary: d.overview.slice(0, 180) + (d.overview.length > 180 ? "…" : ""),
    pubchemCid: d.identifiers.pubchemCid,
    modality: d.modality || "small-molecule",
    entityRole: d.entityRole || "api",
    kind: "example" as const,
    scaleHints: d.routes.map((r) => r.scaleClass).filter(Boolean),
  }));
}

/** Never used by search resolution — examples are path-only. */
export function isExampleId(id: string): boolean {
  return Boolean(getExampleById(id));
}
