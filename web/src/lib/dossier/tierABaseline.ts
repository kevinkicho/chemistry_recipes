/**
 * Merge curated Tier-A teaching content into live dossiers for hub CIDs.
 * Labeled as educational baseline — never claimed as live API evidence.
 */

import { getExampleById } from "@/lib/data/examples";
import { findHubByCid } from "@/lib/data/hubIndex";
import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessRoute, RelatedEntity, SourceRef } from "@/lib/types/process";
import { mergeRelatedEntities } from "@/lib/dossier/relatedEntities";

const TIER_A_REF: SourceRef = {
  type: "editorial",
  id: "tier-a-teaching-baseline",
  label: "Tier-A curated teaching baseline",
  note: "Educational dual-view package — not live free-API extraction; not GMP",
};

/**
 * When this CID has a curated example, add teaching routes + related entities
 * so the live page approaches mock depth while keeping live multi-API facts.
 */
export function applyTierABaseline(dossier: LiveDossier): LiveDossier {
  const hub = findHubByCid(dossier.cid);
  if (!hub?.exampleId) return dossier;
  const ex = getExampleById(hub.exampleId);
  if (!ex) return dossier;

  const liveRoutes = dossier.processRoutes || [];
  const curatedRoutes: ProcessRoute[] = (ex.routes || []).map((r, i) => ({
    ...r,
    id: `tier-a-${r.id || i}`,
    name: `${r.name} (Tier-A teaching)`,
    preference: 100 + i, // sort after live preferred
    sourceRefs: [...(r.sourceRefs || []), TIER_A_REF],
    summary: `${r.summary} [Tier-A educational baseline — verify against live evidence above.]`,
    steps: (r.steps || []).map((s) => ({
      ...s,
      sourceRefs: [...(s.sourceRefs || []), TIER_A_REF],
    })),
  }));

  // Prefer live routes first; append curated teaching routes
  const byId = new Map<string, ProcessRoute>();
  for (const r of liveRoutes) byId.set(r.id, r);
  for (const r of curatedRoutes) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }
  const processRoutes = [...byId.values()].sort(
    (a, b) => (a.preference || 99) - (b.preference || 99)
  );

  const curatedRelated: RelatedEntity[] = (ex.relatedEntities || []).map((e) => ({
    ...e,
    notes: e.notes
      ? `${e.notes} (Tier-A teaching)`
      : "From Tier-A curated teaching package",
  }));

  const relatedEntities = mergeRelatedEntities(
    dossier.relatedEntities || [],
    curatedRelated
  );

  // Fill empty plant cards from curated when live still empty
  const apparatusCatalog =
    dossier.synthesis.apparatusCatalog?.length
      ? dossier.synthesis.apparatusCatalog
      : (ex.apparatusCatalog || []).map((a) => ({
          ...a,
          notes: a.notes
            ? `${a.notes} (Tier-A teaching)`
            : "Tier-A teaching apparatus class",
        }));

  const environmentBaseline =
    dossier.synthesis.environmentBaseline ||
    (ex.environmentBaseline
      ? {
          ...ex.environmentBaseline,
          notes: [
            ex.environmentBaseline.notes,
            "Tier-A teaching environment baseline — confirm with live evidence / site QMS",
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : undefined);

  const ehsHighlights =
    dossier.synthesis.ehsHighlights?.length
      ? dossier.synthesis.ehsHighlights
      : (ex.ehsHighlights || []).map((e) => `${e} (Tier-A teaching)`);

  const manufacturingSummary =
    dossier.synthesis.manufacturingSummary ||
    (ex.manufacturingSummary
      ? `${ex.manufacturingSummary} [Tier-A teaching narrative — live multi-API facts may refine this.]`
      : undefined);

  const overview =
    dossier.synthesis.overview ||
    (ex.overview
      ? `${ex.overview} [Live build: multi-API evidence + process facts apply on this page.]`
      : undefined);

  const applications =
    dossier.synthesis.applications?.length
      ? dossier.synthesis.applications
      : ex.applications;

  return {
    ...dossier,
    processRoutes,
    relatedEntities,
    synthesis: {
      ...dossier.synthesis,
      overview: overview || dossier.synthesis.overview,
      applications: applications || dossier.synthesis.applications,
      manufacturingSummary:
        manufacturingSummary || dossier.synthesis.manufacturingSummary,
      apparatusCatalog: apparatusCatalog?.length
        ? apparatusCatalog
        : dossier.synthesis.apparatusCatalog,
      environmentBaseline:
        environmentBaseline || dossier.synthesis.environmentBaseline,
      ehsHighlights: ehsHighlights?.length
        ? ehsHighlights
        : dossier.synthesis.ehsHighlights,
      gaps: [
        ...(dossier.synthesis.gaps || []),
        `Tier-A teaching baseline “${ex.id}” merged for plant depth — labeled editorial, not free-API extraction.`,
      ].filter((g, i, a) => a.indexOf(g) === i),
    },
    sourceRefs: [
      ...dossier.sourceRefs,
      {
        ...TIER_A_REF,
        id: `tier-a:${ex.id}`,
        label: `Tier-A example · ${ex.identifiers.name}`,
        url: undefined,
      },
    ],
  };
}
