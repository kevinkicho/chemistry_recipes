/**
 * Client-side merge of user-pasted public text into process facts.
 */

import type { CompoundEvidence, LiveDossier } from "@/lib/dossier/types";
import {
  extractProcessFacts,
  type ProcessFactBundle,
} from "@/lib/dossier/processFacts";
import { applyPlantDeliverables } from "@/lib/dossier/plantDeliverables";
import { applyTierABaseline } from "@/lib/dossier/tierABaseline";
import { getUserSupplementsForCid } from "@/lib/idb/userSupplements";

/**
 * Rebuild processFacts for a live dossier including local user supplements.
 * Uses identity/lit/patents/texts already on the dossier (no network).
 */
export function reextractFactsWithLocalSupplements(
  dossier: LiveDossier
): ProcessFactBundle {
  const evidence: CompoundEvidence = {
    cid: dossier.cid,
    identity: dossier.identity,
    view: {
      cid: dossier.cid,
      blocks: [],
      hazards: {
        signalWord: dossier.hazards.signalWord,
        pictograms: dossier.hazards.ghsPictograms || [],
        hazardStatements: dossier.hazards.hazardStatements || [],
        precautionaryStatements: dossier.hazards.precautionaryStatements || [],
        rawBlocks: [],
      },
      manufacturingTexts: dossier.manufacturingTexts,
      descriptionTexts: dossier.descriptionTexts,
      propertyTexts: dossier.propertyTexts,
      traces: [],
    },
    literature: dossier.literature,
    patents: dossier.patents,
    annotations: dossier.annotations || [],
    traces: dossier.traces || [],
    sourceRefs: dossier.sourceRefs || [],
    fetchErrors: [],
  };

  const userTexts = getUserSupplementsForCid(dossier.cid).map((u) => ({
    text: u.text,
    label: u.label,
  }));

  return extractProcessFacts(evidence, userTexts);
}

export function applyLocalFactEnrichment(dossier: LiveDossier): LiveDossier {
  const processFacts = reextractFactsWithLocalSupplements(dossier);
  const withFacts: LiveDossier = {
    ...dossier,
    processFacts,
    processFraming: processFacts.framing,
    synthesis: {
      ...dossier.synthesis,
      gaps: [
        processFacts.summary,
        ...processFacts.openGaps.slice(0, 4),
        ...(dossier.synthesis.gaps || []).slice(0, 6),
      ].filter((g, i, a) => a.indexOf(g) === i),
    },
  };
  let next = applyPlantDeliverables(withFacts);
  next = applyTierABaseline(next);
  next = applyPlantDeliverables(next);
  return next;
}
