/**
 * Assemble process-knowledge.v1 package for a live dossier.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";
import {
  buildRouteHypotheses,
  buildScientificConflicts,
} from "@/lib/frontier/routeHypotheses";
import {
  buildNextExperiments,
  buildSeedAnswers,
} from "@/lib/frontier/evidenceQa";
import type { ProcessKnowledgePackage } from "@/lib/frontier/types";
import { buildReactionNetwork } from "@/lib/frontier/reactionNetwork";
import { mergeEdgeExperiments } from "@/lib/frontier/edgeExperiments";
import { buildLiteratureDepthReport } from "@/lib/frontier/literatureDepth";

const DISCLAIMER =
  "Process-knowledge package from free-public evidence only. " +
  "Not a GMP procedure, batch record, or regulatory filing. " +
  "Condition distributions and hypotheses are research structures — not plant setpoints. " +
  "Validate every claim against primary sources under your QMS.";

function procedureChars(d: LiveDossier): number {
  let n = 0;
  for (const h of d.literature || []) n += h.fullTextExcerpt?.length || 0;
  for (const p of d.patents || []) n += p.procedureExcerpt?.length || 0;
  for (const t of d.manufacturingTexts || []) n += t.length;
  return n;
}

/**
 * Build frontier process-knowledge package (condition atlas, hypotheses, experiments).
 */
export function buildProcessKnowledgePackage(
  dossier: LiveDossier
): ProcessKnowledgePackage {
  const conditionAtlas = buildConditionAtlas(dossier);
  const routeHypotheses = buildRouteHypotheses(dossier, conditionAtlas);
  const conflicts = buildScientificConflicts(
    dossier,
    conditionAtlas,
    routeHypotheses
  );
  const baseExperiments = buildNextExperiments(
    dossier,
    conditionAtlas,
    routeHypotheses,
    conflicts
  );
  const seedAnswers = buildSeedAnswers(dossier, conditionAtlas, routeHypotheses);
  const reactionNetwork = buildReactionNetwork(dossier, conditionAtlas);
  const nextExperiments = mergeEdgeExperiments(
    baseExperiments,
    reactionNetwork,
    [dossier]
  );
  const litDepth = buildLiteratureDepthReport(dossier);

  return {
    schema: "chemistry-recipes.process-knowledge.v1",
    cid: dossier.cid,
    moleculeName: dossier.identity?.name,
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    conditionAtlas,
    routeHypotheses,
    conflicts,
    nextExperiments,
    seedAnswers,
    reactionNetwork,
    metrics: {
      observationCount: conditionAtlas.observationCount,
      hypothesisCount: routeHypotheses.length,
      conflictCount: conflicts.length,
      experimentCount: nextExperiments.length,
      procedureChars: procedureChars(dossier),
      processFactConditions: dossier.processFacts?.sourcedConditionCount ?? 0,
      networkNodes: reactionNetwork.nodes.length,
      networkEdges: reactionNetwork.edges.length,
      literatureDepthScore: litDepth.depthScore,
      procedureRichWindows: litDepth.procedureRichWindows,
    },
  };
}

/** Attach package to dossier for UI + export */
export function withProcessKnowledge(dossier: LiveDossier): LiveDossier {
  const processKnowledge = buildProcessKnowledgePackage(dossier);
  return {
    ...dossier,
    processKnowledge,
  };
}
