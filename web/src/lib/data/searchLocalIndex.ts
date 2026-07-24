/**
 * Client-safe local name → CID index for search when PubChem cloud path is down.
 * Combines hub index + curated package identities (static data only).
 */

import { resolveLocalHubCids, type HubSearchHit } from "@/lib/data/hubIndex";
import { getAllCuratedPackages } from "@/lib/data/curatedPackages";

export type LocalSearchHit = HubSearchHit & {
  formula?: string;
};

let packageIndex: LocalSearchHit[] | null = null;

function packageHits(): LocalSearchHit[] {
  if (packageIndex) return packageIndex;
  const out: LocalSearchHit[] = [];
  const seen = new Set<number>();
  for (const p of getAllCuratedPackages()) {
    if (p.pubchemCid == null || seen.has(p.pubchemCid)) continue;
    seen.add(p.pubchemCid);
    out.push({
      cid: p.pubchemCid,
      name: p.name,
      cas: p.cas,
      formula: p.formula,
    });
    for (const r of p.related ?? []) {
      if (r.pubchemCid == null || seen.has(r.pubchemCid)) continue;
      seen.add(r.pubchemCid);
      out.push({
        cid: r.pubchemCid,
        name: r.name,
        cas: r.cas,
      });
    }
  }
  packageIndex = out;
  return out;
}

/**
 * Resolve query against hub + package catalog without network.
 */
export function resolveLocalSearchHits(
  query: string,
  limit = 12
): LocalSearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const hits: LocalSearchHit[] = [];
  const seen = new Set<number>();

  for (const h of resolveLocalHubCids(q, limit)) {
    if (seen.has(h.cid)) continue;
    seen.add(h.cid);
    hits.push(h);
  }

  for (const h of packageHits()) {
    if (hits.length >= limit) break;
    const match =
      String(h.cid) === q ||
      (h.cas != null && h.cas === q) ||
      h.name.toLowerCase() === lower ||
      (lower.length >= 3 && h.name.toLowerCase().startsWith(lower)) ||
      (lower.length >= 4 && h.name.toLowerCase().includes(lower));
    if (!match || seen.has(h.cid)) continue;
    seen.add(h.cid);
    hits.push(h);
  }

  return hits.slice(0, limit);
}
