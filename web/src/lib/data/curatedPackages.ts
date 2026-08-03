/**
 * Curated / teaching packages retired from the live product.
 * Live work is free-public densify + AI dual-view for any CID.
 */

import type {
  ContentTier,
  EntityRole,
  ProcessModality,
  ScaleClass,
} from "@/lib/types/process";
import { routes } from "@/lib/routes";

export const PACKAGE_CATALOG_DISCLAIMER =
  "No curated mock packages in the live app. Use Search → free-public densify + AI dual-view.";

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

/** Empty — no teaching mock catalog on the live product. */
const PACKAGES: CuratedPackage[] = [];

export function getAllCuratedPackages(): CuratedPackage[] {
  return PACKAGES;
}

export function getCuratedPackageById(id: string): CuratedPackage | undefined {
  void id;
  return undefined;
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
  void opts;
  return [];
}

/** Always live PubChem densify — never mock package bodies. */
export function packageHref(p: CuratedPackage): string {
  if (p.pubchemCid) return routes.pubchem(p.pubchemCid);
  return routes.search(p.name);
}

export function curatedPackageCount(): number {
  return PACKAGES.length;
}
