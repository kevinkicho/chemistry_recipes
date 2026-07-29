/**
 * Multi-CID related process context for AI — impurities / intermediates only
 * from free-public densified signals on the center dossier (no invented plant data).
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import type { LiveDossier } from "@/lib/dossier/types";
import { scoreProcessRelevance } from "@/lib/literature/rank";

export type RelatedProcessContext = {
  relatedEntities: Array<{
    role: string;
    name: string;
    cas?: string;
    pubchemCid?: number;
    notes?: string;
  }>;
  impurityMentions: string[];
  processHints: string[];
  summary: string;
};

/**
 * Build compact related-process context from evidence/dossier free-public fields.
 */
export function buildRelatedProcessContext(
  source: CompoundEvidence | LiveDossier
): RelatedProcessContext {
  const entities =
    "relatedEntities" in source && Array.isArray((source as LiveDossier).relatedEntities)
      ? (source as LiveDossier).relatedEntities || []
      : [];

  let relatedEntities = entities.slice(0, 16).map((e) => ({
    role: e.role,
    name: e.name,
    cas: e.cas,
    pubchemCid: e.pubchemCid,
    notes: e.notes?.slice(0, 160),
  }));

  // When shell has no relatedEntities yet, mine annotation / lit titles for names
  if (!relatedEntities.length) {
    const mined: typeof relatedEntities = [];
    for (const a of source.annotations || []) {
      if (
        /impur|intermediate|metabolite|degrad|by[- ]product/i.test(
          `${a.kind} ${a.title} ${a.summary || ""}`
        )
      ) {
        mined.push({
          role: /impur|degrad|by[- ]product/i.test(`${a.title} ${a.summary || ""}`)
            ? "impurity"
            : "intermediate",
          name: a.title.slice(0, 80),
          cas: undefined,
          pubchemCid: undefined,
          notes: a.summary?.slice(0, 160),
        });
      }
      if (mined.length >= 12) break;
    }
    relatedEntities = mined;
  }

  const impurityMentions = relatedEntities
    .filter((e) => /impur/i.test(e.role))
    .map((e) => `${e.name}${e.cas ? ` (CAS ${e.cas})` : ""}${e.pubchemCid ? ` CID ${e.pubchemCid}` : ""}`);

  const processHints: string[] = [];
  const lit = source.literature || [];
  for (const h of lit.slice(0, 12)) {
    const blob = `${h.title} ${h.abstract || ""}`;
    if (/impur|by[- ]product|residual|starting material|intermediate/i.test(blob)) {
      const snip = (h.abstract || h.title).slice(0, 220);
      if (scoreProcessRelevance(h.title, h.abstract) >= 15) {
        processHints.push(snip);
      }
    }
  }
  for (const a of source.annotations || []) {
    if (
      /impur|intermediate|metabolite|degrad/i.test(
        `${a.title} ${a.summary || ""}`
      )
    ) {
      processHints.push(
        `${a.source}: ${(a.summary || a.title).slice(0, 200)}`
      );
    }
  }

  const summary =
    relatedEntities.length === 0 && processHints.length === 0
      ? "No related-entity densify context yet — densify impurities / intermediates when CIDs resolve."
      : `Related process context · ${relatedEntities.length} entities · ${impurityMentions.length} impurity · ${processHints.length} text hint(s)`;

  return {
    relatedEntities,
    impurityMentions: impurityMentions.slice(0, 10),
    processHints: processHints.slice(0, 8),
    summary,
  };
}

export function formatRelatedContextForPrompt(ctx: RelatedProcessContext): string {
  if (!ctx.relatedEntities.length && !ctx.processHints.length) {
    return "";
  }
  return JSON.stringify(
    {
      relatedProcessContext: {
        summary: ctx.summary,
        entities: ctx.relatedEntities.slice(0, 12),
        impurityMentions: ctx.impurityMentions,
        processHints: ctx.processHints,
        instruction:
          "Use only for relatedEntities / impurity awareness. Do not invent plant impurity specs or control limits.",
      },
    },
    null,
    0
  );
}
