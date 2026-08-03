/**
 * Tier-A mock dossiers removed — product is live densify + AI dual-view only.
 * Stubs keep import sites compiling; catalogs are empty.
 */

import type { CatalogEntry, MoleculeDossier } from "@/lib/types/process";

export function getExampleDossiers(): MoleculeDossier[] {
  return [];
}

export function getExampleById(id: string): MoleculeDossier | undefined {
  void id;
  return undefined;
}

export function getExampleCatalog(): CatalogEntry[] {
  return [];
}

/** Always false — example mock path retired. */
export function isExampleId(id: string): boolean {
  void id;
  return false;
}
