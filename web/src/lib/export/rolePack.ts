/**
 * Role-primary export packs — one JSON per worker role for Monday morning use.
 * Free-public densify only; site-fill remains empty by design.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { WorkerRole } from "@/lib/worker/roleMode";
import {
  buildOperatorJobAidExport,
  buildPublicProcessBrief,
  buildTechTransferFromLive,
  REGULATORY_DISCLAIMER,
} from "@/lib/export/techTransfer";
import { buildAgentPack } from "@/lib/export/agentPack";
import { buildShiftPackFromDossier } from "@/lib/workspace/shiftPacks";

export const ROLE_PACK_SCHEMA = "chemistry-recipes.role-pack.v1" as const;

export type RolePack = {
  schema: typeof ROLE_PACK_SCHEMA;
  role: WorkerRole;
  exportedAt: string;
  regulatoryNotice: string;
  entity: {
    name: string;
    pubchemCid: number;
  };
  /** Role-shaped payload */
  pack: Record<string, unknown>;
};

/**
 * Build a single role-focused export (primary deliverable for that persona).
 */
export function buildRolePack(
  dossier: LiveDossier,
  role: WorkerRole
): RolePack {
  const entity = {
    name: dossier.identity?.name || `CID ${dossier.cid}`,
    pubchemCid: dossier.cid,
  };
  const tech = buildTechTransferFromLive(dossier);
  const brief = buildPublicProcessBrief(dossier);
  const jobAid = buildOperatorJobAidExport(dossier);
  const agent = buildAgentPack(dossier);
  const shift = buildShiftPackFromDossier(dossier);

  let pack: Record<string, unknown>;
  switch (role) {
    case "operator":
      pack = {
        kind: "operator",
        jobAid,
        shiftPack: shift,
        ehs: dossier.hazards,
        siteFillReminder:
          "Site-fill fields are empty by design — plant QMS owns setpoints.",
      };
      break;
    case "manager":
      pack = {
        kind: "manager",
        publicProcessBrief: brief,
        evidenceScore: dossier.evidenceScore,
        idealParity: dossier.idealParity?.score,
        openGaps: dossier.processFacts?.openGaps?.slice(0, 12),
        managerRisks: dossier.processFacts?.managerRisks?.slice(0, 12),
        notGmp: true,
      };
      break;
    case "msat":
      pack = {
        kind: "msat",
        techTransfer: tech,
        agentPack: agent,
        recipeReadiness: dossier.recipeReadiness,
        idealParity: dossier.idealParity,
        densifyNext: agent.densifyNext,
      };
      break;
    case "chemist":
    default:
      pack = {
        kind: "chemist",
        publicProcessBrief: brief,
        processRoutes: dossier.processRoutes,
        literature: (dossier.literature || []).slice(0, 12).map((h) => ({
          title: h.title,
          url: h.url,
          source: h.source,
        })),
        patents: (dossier.patents || []).slice(0, 8).map((p) => ({
          title: p.title,
          patentNumber: p.patentNumber,
          url: p.url,
        })),
        relatedEntities: dossier.relatedEntities,
      };
      break;
  }

  return {
    schema: ROLE_PACK_SCHEMA,
    role,
    exportedAt: new Date().toISOString(),
    regulatoryNotice: REGULATORY_DISCLAIMER,
    entity,
    pack,
  };
}
