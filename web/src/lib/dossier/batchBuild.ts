/**
 * Shared batch densify build helper — slim summary + optional force.
 */

import { buildLiveDossierWithProgress } from "@/lib/dossier/pipeline";
import type { LiveDossier } from "@/lib/dossier/types";
import { ensureDossierKnowledge } from "@/lib/frontier/knowledgeFingerprint";

export type BatchCidSummary = {
  name?: string;
  evidenceScore?: number;
  idealScore?: number;
  observationCount?: number;
  procedureChars?: number;
  productMode?: string;
  fromCache?: boolean;
};

export function slimDossierSummary(
  d: LiveDossier,
  extra?: { fromCache?: boolean }
): BatchCidSummary {
  const pack = d.processKnowledge;
  return {
    name: d.identity?.name,
    evidenceScore: d.evidenceScore?.score,
    idealScore: d.idealParity?.score,
    observationCount: pack?.metrics.observationCount,
    procedureChars: pack?.metrics.procedureChars,
    productMode: d.productMode,
    fromCache: extra?.fromCache,
  };
}

/**
 * Full pipeline build for one CID (server). Knowledge attached if missing.
 */
export async function buildOneCidForBatch(
  cid: number,
  opts?: {
    model?: string;
    fastModel?: string;
    onProgress?: (label: string) => void;
  }
): Promise<LiveDossier> {
  const dossier = await buildLiveDossierWithProgress(
    cid,
    (ev) => {
      if (ev.label) opts?.onProgress?.(ev.label);
    },
    { model: opts?.model, fastModel: opts?.fastModel }
  );
  return ensureDossierKnowledge(dossier);
}
