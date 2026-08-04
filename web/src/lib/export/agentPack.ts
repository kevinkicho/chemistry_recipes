/**
 * Single agent-readable pack for external notebooks / agents.
 * Free-public densify only — never invents plant numbers.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import { DEFAULT_DOSSIER_DISCLAIMER } from "@/lib/dossier/types";
import { buildAiGuidancePackage } from "@/lib/frontier/aiGuidancePackage";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import { buildSourceFamilyReport } from "@/lib/dossier/sourceFamilyReport";
import {
  segmentCoverage,
  segmentProcedureExcerpts,
} from "@/lib/literature/procedureSegments";
import { REGULATORY_DISCLAIMER } from "@/lib/export/techTransfer";
import {
  vaultFingerprintFromDossier,
  type VaultFingerprint,
} from "@/lib/dossier/vaultFingerprint";

export const AGENT_PACK_SCHEMA = "chemistry-recipes.agent-pack.v1" as const;

export type AgentPack = {
  schema: typeof AGENT_PACK_SCHEMA;
  exportedAt: string;
  disclaimer: string;
  regulatoryNotice: string;
  entity: {
    name: string;
    pubchemCid: number;
    cas?: string;
    formula?: string;
    smiles?: string;
    inchiKey?: string;
  };
  scores: {
    evidenceScore?: number;
    evidenceConfidence?: string;
    idealParity?: number;
    ingestScore?: number;
    productionBriefEligible?: boolean;
  };
  build: {
    mode?: string;
    productMode?: string;
    model?: string;
  };
  harvestAgent?: LiveDossier["harvestAgent"];
  densifyQuality?: NonNullable<LiveDossier["buildAudit"]>["densifyQuality"];
  procedureSegmentCoverage?: Record<string, number>;
  /**
   * Densify vault fingerprint — procedure-window bag id for agents/notebooks.
   * Continue densify when windowCount is low; re-export when fingerprint changes.
   */
  vaultFingerprint: VaultFingerprint;
  /** Compact AI guidance (densify-first) */
  aiGuidance: ReturnType<typeof buildAiGuidancePackage>;
  /** Process knowledge (atlas / hypotheses / experiments) — may be heavy */
  processKnowledge: ReturnType<typeof buildProcessKnowledgePackage>;
  /** Free-API family matrix */
  sourceFamilies: ReturnType<typeof buildSourceFamilyReport>;
  openGaps: string[];
  densifyNext: ReturnType<typeof buildAiGuidancePackage>["densifyNext"];
};

/**
 * Build one JSON artifact external agents can load without the UI.
 */
export function buildAgentPack(dossier: LiveDossier): AgentPack {
  const guidance = buildAiGuidancePackage(dossier);
  const knowledge =
    dossier.processKnowledge || buildProcessKnowledgePackage(dossier);
  const families = buildSourceFamilyReport({
    traces: dossier.traces,
    literatureCount: dossier.literature?.length,
    patentCount: dossier.patents?.length,
    annotationSources: (dossier.annotations || []).map((a) => a.source),
    manufacturingCount: dossier.manufacturingTexts?.length,
    fetchErrors: dossier.fetchErrors,
  });
  const segments = segmentProcedureExcerpts(
    (dossier.procedureExcerpts || []).map((p) => ({
      id: p.id,
      text: p.text,
      label: p.label,
      chars: p.chars,
    })),
    { maxTotal: 36, maxPerExcerpt: 8 }
  );

  return {
    schema: AGENT_PACK_SCHEMA,
    exportedAt: new Date().toISOString(),
    disclaimer: dossier.disclaimer || DEFAULT_DOSSIER_DISCLAIMER,
    regulatoryNotice: REGULATORY_DISCLAIMER,
    entity: {
      name: dossier.identity?.name || `CID ${dossier.cid}`,
      pubchemCid: dossier.cid,
      cas: dossier.identity?.cas,
      formula: dossier.identity?.formula,
      smiles: dossier.identity?.smiles,
      inchiKey: dossier.identity?.inchiKey,
    },
    scores: {
      evidenceScore: dossier.evidenceScore?.score,
      evidenceConfidence: dossier.evidenceScore?.confidence,
      idealParity: dossier.idealParity?.score,
      ingestScore: guidance.ingestScore,
      productionBriefEligible: dossier.processFacts?.productionBriefEligible,
    },
    build: {
      mode: dossier.buildMode,
      productMode: dossier.productMode,
      model: dossier.synthesis?.model || dossier.synthesis?.provenance?.model,
    },
    harvestAgent: dossier.harvestAgent,
    densifyQuality: dossier.buildAudit?.densifyQuality,
    procedureSegmentCoverage: segmentCoverage(segments),
    vaultFingerprint: vaultFingerprintFromDossier(dossier),
    aiGuidance: guidance,
    processKnowledge: knowledge,
    sourceFamilies: families,
    openGaps: [
      ...(dossier.processFacts?.openGaps || []),
      ...(dossier.synthesis?.gaps || []),
    ].slice(0, 24),
    densifyNext: guidance.densifyNext,
  };
}
