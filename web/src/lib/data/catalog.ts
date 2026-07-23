import type { CatalogEntry, MoleculeDossier } from "@/lib/types/process";

/**
 * No curated dossiers. Empty by design.
 * All molecule identity comes from free public APIs (PubChem / NIH).
 */
const DOSSIERS: MoleculeDossier[] = [];

export function getAllDossiers(): MoleculeDossier[] {
  return DOSSIERS;
}

export function getDossierById(id: string): MoleculeDossier | undefined {
  void id;
  return undefined;
}

export function getCatalog(): CatalogEntry[] {
  return [];
}

export function findDossierByPubchemCid(cid: number): MoleculeDossier | undefined {
  void cid;
  return undefined;
}

export function findDossierByQuery(q: string): MoleculeDossier | undefined {
  void q;
  return undefined;
}
