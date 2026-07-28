/**
 * Merge curated Tier-A teaching content into live dossiers for hub CIDs.
 *
 * Product goal: curated ExampleDossierView is the *ideal depth* we chase.
 * When live preferred routes are thin, promote labeled Tier-A teaching routes
 * so the page approaches that ideal without claiming free-API extraction.
 */

import { getExampleById } from "@/lib/data/examples";
import { findHubByCid } from "@/lib/data/hubIndex";
import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessRoute, RelatedEntity, SourceRef } from "@/lib/types/process";
import { mergeRelatedEntities } from "@/lib/dossier/relatedEntities";
import { isPreferredRouteThin } from "@/lib/dossier/idealPage";

const TIER_A_REF: SourceRef = {
  type: "editorial",
  id: "tier-a-teaching-baseline",
  label: "Tier-A curated teaching baseline",
  note: "Educational dual-view package — ideal-page depth target; not live free-API extraction; not GMP",
};

function isTeachingRoute(r: ProcessRoute): boolean {
  return (
    r.id.startsWith("tier-a-") ||
    /tier-a teaching/i.test(r.name || "") ||
    (r.sourceRefs || []).some((x) => x.id?.includes("tier-a"))
  );
}

/**
 * When this CID has a curated example, add teaching routes + related entities
 * so the live page approaches curated ideal depth while keeping multi-API facts.
 */
export function applyTierABaseline(dossier: LiveDossier): LiveDossier {
  const hub = findHubByCid(dossier.cid);
  if (!hub?.exampleId) return dossier;
  const ex = getExampleById(hub.exampleId);
  if (!ex) return dossier;

  const liveRoutes = dossier.processRoutes || [];
  const thinLive = isPreferredRouteThin({
    ...dossier,
    processRoutes: liveRoutes.filter((r) => !isTeachingRoute(r)),
  });

  const curatedRoutes: ProcessRoute[] = (ex.routes || []).map((r, i) => ({
    ...r,
    id: `tier-a-${r.id || i}`,
    name: `${r.name} (Tier-A teaching)`,
    // When live is thin, promote teaching toward preferred (ideal-page goal).
    // When live is dense, keep teaching as secondary reference.
    preference: thinLive ? 1 + i : 100 + i,
    sourceRefs: [...(r.sourceRefs || []), TIER_A_REF],
    summary: `${r.summary} [Tier-A educational baseline — ideal-page depth target; verify against live free-API evidence.]`,
    steps: (r.steps || []).map((s) => ({
      ...s,
      sourceRefs: [...(s.sourceRefs || []), TIER_A_REF],
    })),
  }));

  // Demote thin live leads so teaching can sit first when promoted
  const adjustedLive: ProcessRoute[] = liveRoutes.map((r, i) => {
    if (isTeachingRoute(r)) return r;
    if (!thinLive) return r;
    return {
      ...r,
      preference: Math.max(r.preference || 10, 20 + i),
      name: /live|evidence|lead/i.test(r.name)
        ? r.name
        : `${r.name} (live evidence lead)`,
    };
  });

  const byId = new Map<string, ProcessRoute>();
  for (const r of adjustedLive) byId.set(r.id, r);
  for (const r of curatedRoutes) {
    byId.set(r.id, r);
  }
  const processRoutes = [...byId.values()].sort(
    (a, b) => (a.preference || 99) - (b.preference || 99)
  );

  const curatedRelated: RelatedEntity[] = (ex.relatedEntities || []).map((e) => ({
    ...e,
    notes: e.notes
      ? `${e.notes} (Tier-A teaching)`
      : "From Tier-A curated teaching package (ideal-page target)",
  }));

  const relatedEntities = mergeRelatedEntities(
    dossier.relatedEntities || [],
    curatedRelated
  );

  // Fill plant cards from curated when live still empty OR only thin placeholder
  const liveApparatus = dossier.synthesis.apparatusCatalog || [];
  const apparatusCatalog =
    liveApparatus.length >= 3
      ? liveApparatus
      : (ex.apparatusCatalog || []).map((a) => ({
          ...a,
          notes: a.notes
            ? `${a.notes} (Tier-A teaching · ideal-page target)`
            : "Tier-A teaching apparatus class · ideal-page target",
        }));

  const environmentBaseline =
    dossier.synthesis.environmentBaseline?.atmosphere ||
    dossier.synthesis.environmentBaseline?.utilities?.length
      ? dossier.synthesis.environmentBaseline
      : ex.environmentBaseline
        ? {
            ...ex.environmentBaseline,
            notes: [
              ex.environmentBaseline.notes,
              "Tier-A teaching environment baseline (ideal-page target) — confirm with live evidence / site QMS",
            ]
              .filter(Boolean)
              .join(" · "),
          }
        : dossier.synthesis.environmentBaseline;

  const liveEhs = dossier.synthesis.ehsHighlights || [];
  const ehsHighlights =
    liveEhs.length >= 2
      ? liveEhs
      : (ex.ehsHighlights || []).map(
          (e) => `${e} (Tier-A teaching · ideal-page target)`
        );

  const manufacturingSummary =
    (dossier.synthesis.manufacturingSummary &&
      dossier.synthesis.manufacturingSummary.length >= 80)
      ? dossier.synthesis.manufacturingSummary
      : ex.manufacturingSummary
        ? `${ex.manufacturingSummary} [Tier-A teaching narrative — ideal-page depth target; live multi-API facts may refine this.]`
        : dossier.synthesis.manufacturingSummary;

  const overview =
    (dossier.synthesis.overview && dossier.synthesis.overview.length >= 100)
      ? dossier.synthesis.overview
      : ex.overview
        ? `${ex.overview} [Ideal-page target from Tier-A; live multi-API evidence + process facts also apply.]`
        : dossier.synthesis.overview;

  const applications =
    dossier.synthesis.applications?.length
      ? dossier.synthesis.applications
      : ex.applications;

  const gaps = [
    ...(dossier.synthesis.gaps || []),
    thinLive
      ? `Live preferred route was thin — Tier-A teaching route promoted toward curated ideal-page depth for “${ex.id}” (labeled editorial, not free-API extraction).`
      : `Tier-A teaching baseline “${ex.id}” merged as secondary ideal-page reference — labeled editorial, not free-API extraction.`,
  ].filter((g, i, a) => a.indexOf(g) === i);

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
      gaps,
    },
    sourceRefs: [
      ...dossier.sourceRefs,
      {
        ...TIER_A_REF,
        id: `tier-a:${ex.id}`,
        label: `Tier-A ideal-page twin · ${ex.identifiers.name}`,
        url: undefined,
      },
    ],
  };
}
