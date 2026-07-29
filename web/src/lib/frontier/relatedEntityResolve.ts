/**
 * Resolve related-entity PubChem CIDs when missing (name / CAS → free APIs).
 * Never invents structures — only fills cid/href when a public hit is found.
 *
 * Browser path uses queued PubChem client (503-safe). Server path uses searchPubChem.
 */

import type { RelatedEntity } from "@/lib/types/process";
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fill missing pubchemCid on related entities via PubChem free-public search.
 * Sequential + gap between names to avoid PubChem 503 storms in the browser.
 */
export async function resolveRelatedEntityCids(
  entities: RelatedEntity[],
  opts?: { maxResolve?: number; concurrency?: number; gapMs?: number }
): Promise<{
  entities: RelatedEntity[];
  report: RelatedEntityResolveReport;
}> {
  const max = opts?.maxResolve ?? 6;
  const gapMs = opts?.gapMs ?? 700;
  const out = entities.map((e) => ({ ...e }));
  const need = out
    .map((e, i) => ({ e, i }))
    .filter(
      ({ e }) =>
        !e.pubchemCid && (e.name?.trim().length >= 3 || Boolean(e.cas))
    )
    .slice(0, max);

  const report: RelatedEntityResolveReport = {
    schema: "chemistry-recipes.related-entity-resolve.v1",
    attempted: need.length,
    resolved: 0,
    failed: 0,
    details: [],
  };

  const isBrowser = typeof window !== "undefined";

  for (let n = 0; n < need.length; n++) {
    const { e, i } = need[n]!;
    const q = e.cas || e.name;
    try {
      let cid: number | undefined;
      let hitName: string | undefined;

      if (isBrowser) {
        const { searchPubChemInBrowser } = await import(
          "@/lib/api/pubchemBrowser"
        );
        const res = await searchPubChemInBrowser(q, 3);
        const hit =
          res.hits.find(
            (h) =>
              h.name.toLowerCase() === e.name.toLowerCase() ||
              (e.cas && h.cas === e.cas)
          ) || res.hits[0];
        cid = hit?.cid;
        hitName = hit?.name;
      } else {
        const { searchPubChem } = await import("@/lib/api/pubchem");
        const res = await searchPubChem(q, 3);
        const hit =
          res.hits.find(
            (h) =>
              h.name.toLowerCase() === e.name.toLowerCase() ||
              (e.cas && h.cas === e.cas)
          ) || res.hits[0];
        cid = hit?.cid;
        hitName = hit?.name;
      }

      if (cid) {
        out[i] = {
          ...out[i]!,
          pubchemCid: cid,
          href: out[i]!.href || routes.pubchem(cid),
          notes: out[i]!.notes
            ? `${out[i]!.notes} · CID resolved via free-public search`
            : "CID resolved via free-public search (PubChem)",
        };
        report.resolved += 1;
        report.details.push({
          name: e.name,
          role: e.role,
          afterCid: cid,
          source: hitName ? "pubchem" : "pubchem",
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

    // Gap between entities (queue also spaces individual HTTP calls)
    if (n < need.length - 1) await sleep(gapMs);
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
