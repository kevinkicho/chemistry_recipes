/**
 * Lightweight hub index for client UI (search badges) — no full dossier JSON.
 */

import type { EntityRole, ProcessModality } from "@/lib/types/process";

export interface HubIndexEntry {
  name: string;
  pubchemCid: number;
  cas?: string;
  modality: ProcessModality;
  entityRole: EntityRole;
  kind: "example" | "live";
  exampleId?: string;
}

/** Static slim index — keep in sync with examples + hubCatalog live set. */
export const HUB_INDEX: HubIndexEntry[] = [
  // Tier-A examples
  { name: "Aspirin", pubchemCid: 2244, cas: "50-78-2", modality: "small-molecule", entityRole: "api", kind: "example", exampleId: "aspirin" },
  { name: "Ibuprofen", pubchemCid: 3672, cas: "15687-27-1", modality: "small-molecule", entityRole: "api", kind: "example", exampleId: "ibuprofen" },
  { name: "Paracetamol", pubchemCid: 1983, cas: "103-90-2", modality: "small-molecule", entityRole: "api", kind: "example", exampleId: "paracetamol" },
  { name: "Menthol", pubchemCid: 16666, cas: "2216-51-5", modality: "small-molecule", entityRole: "api", kind: "example", exampleId: "menthol" },
  { name: "Metformin", pubchemCid: 4091, cas: "657-24-9", modality: "small-molecule", entityRole: "api", kind: "example", exampleId: "metformin" },
  { name: "Caffeine", pubchemCid: 2519, cas: "58-08-2", modality: "small-molecule", entityRole: "api", kind: "example", exampleId: "caffeine" },
  { name: "Ethanol", pubchemCid: 702, cas: "64-17-5", modality: "fermentation", entityRole: "solvent", kind: "example", exampleId: "ethanol" },
  { name: "Amoxicillin", pubchemCid: 33613, cas: "26787-78-0", modality: "fermentation", entityRole: "api", kind: "example", exampleId: "amoxicillin" },
  { name: "Sitagliptin", pubchemCid: 4369359, cas: "486460-32-6", modality: "small-molecule", entityRole: "api", kind: "example", exampleId: "sitagliptin" },
  { name: "Penicillin G", pubchemCid: 5904, cas: "61-33-6", modality: "fermentation", entityRole: "api", kind: "example", exampleId: "penicillin-g" },
  // Live hub pointers
  { name: "Atorvastatin", pubchemCid: 60823, cas: "134523-00-5", modality: "small-molecule", entityRole: "api", kind: "live" },
  { name: "Oseltamivir", pubchemCid: 65028, cas: "196618-13-0", modality: "small-molecule", entityRole: "api", kind: "live" },
  { name: "Paclitaxel", pubchemCid: 36314, cas: "33069-62-4", modality: "small-molecule", entityRole: "api", kind: "live" },
  { name: "Remdesivir", pubchemCid: 121304016, cas: "1809249-37-3", modality: "small-molecule", entityRole: "api", kind: "live" },
  { name: "Apixaban", pubchemCid: 10182969, cas: "503612-47-3", modality: "small-molecule", entityRole: "api", kind: "live" },
  { name: "Sertraline", pubchemCid: 68617, cas: "79617-96-2", modality: "small-molecule", entityRole: "api", kind: "live" },
  { name: "6-APA", pubchemCid: 8745, cas: "551-16-6", modality: "fermentation", entityRole: "intermediate", kind: "live" },
  { name: "Salicylic acid", pubchemCid: 338, cas: "69-72-7", modality: "small-molecule", entityRole: "starting-material", kind: "live" },
  { name: "4-Aminophenol", pubchemCid: 403, cas: "123-30-8", modality: "small-molecule", entityRole: "intermediate", kind: "live" },
  { name: "Acetic anhydride", pubchemCid: 7918, cas: "108-24-7", modality: "small-molecule", entityRole: "reagent", kind: "live" },
  { name: "Lactose", pubchemCid: 440995, cas: "63-42-3", modality: "formulation", entityRole: "excipient", kind: "live" },
  { name: "Polysorbate 80", pubchemCid: 5284448, cas: "9005-65-6", modality: "formulation", entityRole: "excipient", kind: "live" },
];

export function findHubByCid(cid: number): HubIndexEntry | undefined {
  return HUB_INDEX.find((e) => e.pubchemCid === cid);
}

/** Lightweight hit shape for search fallbacks (no PubChem network). */
export type HubSearchHit = {
  cid: number;
  name: string;
  cas?: string;
};

/**
 * Resolve known hub compounds without calling PubChem.
 * Safe for client + server (static index only).
 */
export function resolveLocalHubCids(query: string, limit = 12): HubSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const hits: HubSearchHit[] = [];
  for (const h of HUB_INDEX) {
    const match =
      String(h.pubchemCid) === q ||
      (h.cas != null && h.cas === q) ||
      h.name.toLowerCase() === lower ||
      (h.exampleId != null && h.exampleId === lower) ||
      (lower.length >= 3 && h.name.toLowerCase().startsWith(lower));
    if (!match) continue;
    hits.push({ cid: h.pubchemCid, name: h.name, cas: h.cas });
    if (hits.length >= limit) break;
  }
  const seen = new Set<number>();
  return hits.filter((h) => {
    if (seen.has(h.cid)) return false;
    seen.add(h.cid);
    return true;
  });
}
