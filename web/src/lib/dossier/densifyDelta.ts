/**
 * Universal densify outcome strip — before/after Ideal, process facts, soft-fails.
 * Honest metrics only; never invents plant numbers.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { CompoundEvidence } from "@/lib/dossier/types";
import { countSoftFailures } from "@/lib/dossier/gatherResilience";
import { countProcedureChars } from "@/lib/dossier/gatherResilience";

export type DensifySnapshot = {
  idealScore: number;
  evidenceScore: number;
  processFactConditions: number;
  procedureChars: number;
  procedureExcerpts: number;
  softFails: number;
  atlasObs: number;
  literatureWithBody: number;
};

export function snapshotFromDossier(d: LiveDossier): DensifySnapshot {
  const facts = d.processFacts?.facts || [];
  const conditions = facts.filter(
    (f) => f.kind === "condition" || f.kind === "yield"
  ).length;
  const lit = d.literature || [];
  const withBody = lit.filter(
    (h) =>
      (h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) ||
      (h.abstract && h.abstract.length >= 120)
  ).length;
  return {
    idealScore: d.idealParity?.score ?? 0,
    evidenceScore: d.evidenceScore?.score ?? 0,
    processFactConditions: conditions,
    procedureChars: countProcedureChars({
      procedureExcerpts: d.procedureExcerpts,
      literature: d.literature,
      patents: d.patents,
      manufacturingTexts: d.manufacturingTexts || [],
    }),
    procedureExcerpts: d.procedureExcerpts?.length ?? 0,
    softFails: countSoftFailures(d.fetchErrors),
    atlasObs: d.processKnowledge?.conditionAtlas?.observationCount ?? 0,
    literatureWithBody: withBody,
  };
}

export function snapshotFromEvidence(ev: CompoundEvidence): DensifySnapshot {
  const facts = ev.processFacts?.facts || [];
  const conditions = facts.filter(
    (f) => f.kind === "condition" || f.kind === "yield"
  ).length;
  const lit = ev.literature || [];
  return {
    idealScore: 0,
    evidenceScore: 0,
    processFactConditions: conditions,
    procedureChars: countProcedureChars({
      procedureExcerpts: ev.procedureExcerpts,
      literature: ev.literature,
      patents: ev.patents,
      manufacturingTexts: ev.view?.manufacturingTexts,
    }),
    procedureExcerpts: ev.procedureExcerpts?.length ?? 0,
    softFails: countSoftFailures(ev.fetchErrors),
    atlasObs: 0,
    literatureWithBody: lit.filter(
      (h) =>
        (h.fullTextExcerpt && h.fullTextExcerpt.length >= 80) ||
        (h.abstract && h.abstract.length >= 120)
    ).length,
  };
}

export function formatDensifyDelta(
  before: DensifySnapshot,
  after: DensifySnapshot
): string {
  const parts: string[] = [];
  const dIdeal = after.idealScore - before.idealScore;
  const dEv = after.evidenceScore - before.evidenceScore;
  const dFacts = after.processFactConditions - before.processFactConditions;
  const dChars = after.procedureChars - before.procedureChars;
  const dSoft = after.softFails - before.softFails;
  const dAtlas = after.atlasObs - before.atlasObs;
  const dLit = after.literatureWithBody - before.literatureWithBody;

  parts.push(
    `Ideal ${before.idealScore}→${after.idealScore}` +
      (dIdeal ? ` (${dIdeal > 0 ? "+" : ""}${dIdeal})` : "")
  );
  parts.push(
    `evidence ${before.evidenceScore}→${after.evidenceScore}` +
      (dEv ? ` (${dEv > 0 ? "+" : ""}${dEv})` : "")
  );
  parts.push(
    `conditions ${before.processFactConditions}→${after.processFactConditions}` +
      (dFacts ? ` (${dFacts > 0 ? "+" : ""}${dFacts})` : "")
  );
  parts.push(
    `procedure ~${before.procedureChars}→${after.procedureChars} chars` +
      (dChars ? ` (${dChars > 0 ? "+" : ""}${dChars})` : "")
  );
  if (before.atlasObs || after.atlasObs) {
    parts.push(
      `atlas ${before.atlasObs}→${after.atlasObs} obs` +
        (dAtlas ? ` (${dAtlas > 0 ? "+" : ""}${dAtlas})` : "")
    );
  }
  parts.push(
    `lit bodies ${before.literatureWithBody}→${after.literatureWithBody}` +
      (dLit ? ` (${dLit > 0 ? "+" : ""}${dLit})` : "")
  );
  parts.push(
    `soft-fails ${before.softFails}→${after.softFails}` +
      (dSoft ? ` (${dSoft > 0 ? "+" : ""}${dSoft})` : "")
  );
  return parts.join(" · ");
}

export type FailedFamily = {
  label: string;
  detail: string;
};

/** Parse soft-fail / api-fail labels from fetchErrors for retry UI. */
export function failedFamiliesFromErrors(
  fetchErrors: string[] | undefined
): FailedFamily[] {
  const map = new Map<string, string>();
  for (const e of fetchErrors || []) {
    const m = e.match(/^(?:soft-fail|api-fail) · ([a-z0-9-]+)/i);
    if (!m?.[1]) continue;
    const label = m[1].replace(/-retry$/, "");
    if (!map.has(label)) map.set(label, e);
  }
  return [...map.entries()].map(([label, detail]) => ({ label, detail }));
}
