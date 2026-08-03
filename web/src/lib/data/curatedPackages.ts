/**
 * Single curated teaching package entry (Aspirin) pointing at LIVE densify.
 * Not a mock dossier body — links to free-public PubChem CID only.
 */

import type {
  ContentTier,
  EntityRole,
  ProcessModality,
  ScaleClass,
} from "@/lib/types/process";
import { routes } from "@/lib/routes";

export const PACKAGE_CATALOG_DISCLAIMER =
  "Single teaching pointer (Aspirin → live PubChem densify). Not GMP, not a mock plant package. " +
  "Live work is free-public multi-API densify + AI dual-view for any CID.";

export type PackageDepth = "deep" | "standard" | "pointer";

export interface CuratedPackage {
  id: string;
  name: string;
  tier: ContentTier;
  depth: PackageDepth;
  modality: ProcessModality;
  entityRole: EntityRole;
  cas?: string;
  unii?: string;
  formula?: string;
  pubchemCid?: number;
  summary: string;
  tags: string[];
  scaleHints?: ScaleClass[];
  parameterSetId: string;
  related?: Array<{
    role: EntityRole;
    name: string;
    cas?: string;
    pubchemCid?: number;
  }>;
}

const PACKAGES: CuratedPackage[] = [
  {
    id: "pkg-aspirin",
    name: "Aspirin",
    tier: "B",
    depth: "standard",
    modality: "small-molecule",
    entityRole: "api",
    cas: "50-78-2",
    formula: "C9H8O4",
    pubchemCid: 2244,
    tags: ["teaching-pointer", "live-densify"],
    summary:
      "Teaching pointer only — opens live free-public densify + AI dual-view for PubChem CID 2244 (not a mock dossier body).",
    scaleHints: ["kilo", "pilot", "commercial"],
    parameterSetId: "small-molecule",
    related: [
      {
        role: "starting-material",
        name: "Salicylic acid",
        cas: "69-72-7",
        pubchemCid: 338,
      },
      {
        role: "reagent",
        name: "Acetic anhydride",
        cas: "108-24-7",
        pubchemCid: 7918,
      },
    ],
  },
];

export function getAllCuratedPackages(): CuratedPackage[] {
  return PACKAGES;
}

export function getCuratedPackageById(id: string): CuratedPackage | undefined {
  const key = id.trim().toLowerCase();
  return PACKAGES.find((p) => p.id.toLowerCase() === key);
}

export function filterCuratedPackages(
  opts: {
    q?: string;
    modality?: string;
    role?: string;
    tier?: string;
    depth?: string;
  } = {}
): CuratedPackage[] {
  const q = opts.q?.trim().toLowerCase() || "";
  return PACKAGES.filter((p) => {
    if (opts.modality && p.modality !== opts.modality) return false;
    if (opts.role && p.entityRole !== opts.role) return false;
    if (opts.tier && p.tier !== opts.tier) return false;
    if (opts.depth && p.depth !== opts.depth) return false;
    if (!q) return true;
    const hay = [p.name, p.cas, p.summary, p.formula, ...(p.tags || [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Always live PubChem densify — never mock example routes. */
export function packageHref(p: CuratedPackage): string {
  if (p.pubchemCid) return routes.pubchem(p.pubchemCid);
  return routes.search(p.name);
}

export function curatedPackageCount(): number {
  return PACKAGES.length;
}
