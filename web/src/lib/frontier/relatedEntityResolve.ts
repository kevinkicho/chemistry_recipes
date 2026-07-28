/**
 * Resolve related-entity PubChem CIDs when missing (name / CAS → free APIs).
 * Never invents structures — only fills cid/href when a public hit is found.
 */

import type { RelatedEntity } from "@/lib/types/process";
import { searchPubChem } from "@/lib/api/pubchem";
import { routes } from "@/lib/routes";

export interface RelatedEntityResolveReport {
  schema: "chemistry-recipes.related-entity-resolve.v1";
  attempted: number;
  resolved: number;
  failed: number;
  details: Array<{
    name: string;
    role: string;
    beforeCid?: number;
    afterCid?: number;
    source?: string;
  }>;
}

/**
 * Fill missing pubchemCid on related entities via PubChem free-public search.
 */
export async function resolveRelatedEntityCids(
  entities: RelatedEntity[],
  opts?: { maxResolve?: number; concurrency?: number }
): Promise<{
  entities: RelatedEntity[];
  report: RelatedEntityResolveReport;
}> {
  const max = opts?.maxResolve ?? 8;
  const out = entities.map((e) => ({ ...e }));
  const need = out
    .map((e, i) => ({ e, i }))
    .filter(
      ({ e }) =>
        !e.pubchemCid &&
        (e.name?.trim().length >= 3 || Boolean(e.cas))
    )
    .slice(0, max);

  const report: RelatedEntityResolveReport = {
    schema: "chemistry-recipes.related-entity-resolve.v1",
    attempted: need.length,
    resolved: 0,
    failed: 0,
    details: [],
  };

  // Sequential with short budget — avoid rate-limit storms
  for (const { e, i } of need) {
    const q = e.cas || e.name;
    try {
      const res = await searchPubChem(q, 3);
      const hit =
        res.hits.find(
          (h) =>
            h.name.toLowerCase() === e.name.toLowerCase() ||
            (e.cas && h.cas === e.cas)
        ) || res.hits[0];
      if (hit?.cid) {
        out[i] = {
          ...out[i]!,
          pubchemCid: hit.cid,
          href: out[i]!.href || routes.pubchem(hit.cid),
          notes: out[i]!.notes
            ? `${out[i]!.notes} · CID resolved via free-public search`
            : "CID resolved via free-public search (PubChem)",
        };
        report.resolved += 1;
        report.details.push({
          name: e.name,
          role: e.role,
          afterCid: hit.cid,
          source: "pubchem",
        });
      } else {
        report.failed += 1;
        report.details.push({
          name: e.name,
          role: e.role,
          source: "none",
        });
      }
    } catch {
      report.failed += 1;
      report.details.push({
        name: e.name,
        role: e.role,
        source: "error",
      });
    }
  }

  return { entities: out, report };
}

/**
 * Sync helper for entities that already have CIDs — ensure href.
 */
export function ensureRelatedEntityHrefs(
  entities: RelatedEntity[]
): RelatedEntity[] {
  return entities.map((e) =>
    e.pubchemCid && !e.href
      ? { ...e, href: routes.pubchem(e.pubchemCid) }
      : e
  );
}
