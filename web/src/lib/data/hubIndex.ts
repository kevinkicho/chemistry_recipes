/**
 * Optional local CID resilience when PubChem is congested.
 * No teaching/example mocks — live densify is the product.
 * Empty by default: all identity comes from free-public APIs.
 */

import type { EntityRole, ProcessModality } from "@/lib/types/process";

export interface HubIndexEntry {
  name: string;
  pubchemCid: number;
  cas?: string;
  modality: ProcessModality;
  entityRole: EntityRole;
  kind: "live";
}

/** Empty: fortify live PubChem / multi-API path; no sample catalog. */
export const HUB_INDEX: HubIndexEntry[] = [];

export function findHubByCid(cid: number): HubIndexEntry | undefined {
  return HUB_INDEX.find((e) => e.pubchemCid === cid);
}

export type HubSearchHit = {
  cid: number;
  name: string;
  cas?: string;
};

/**
 * Local hub resolve (empty unless HUB_INDEX is populated later for resilience).
 */
export function resolveLocalHubCids(query: string, limit = 12): HubSearchHit[] {
  const q = query.trim();
  if (!q || HUB_INDEX.length === 0) return [];
  const lower = q.toLowerCase();
  const hits: HubSearchHit[] = [];
  for (const h of HUB_INDEX) {
    const match =
      String(h.pubchemCid) === q ||
      (h.cas != null && h.cas === q) ||
      h.name.toLowerCase() === lower ||
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
