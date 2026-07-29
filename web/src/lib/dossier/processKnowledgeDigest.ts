/**
 * Compact process-knowledge digest for AI packing (pre-atlas / evidence-time).
 * Free-public facts only — never invents plant setpoints.
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import { scoreProcedureWindow } from "@/lib/literature/procedureWindowScore";

export type ProcessKnowledgeDigest = {
  framing: string;
  productionBriefEligible: boolean;
  sourcedConditionCount: number;
  unitOpCount: number;
  openGaps: string[];
  managerRisks: string[];
  exampleDenseSources: string[];
  ipPointers: string[];
  /** Top condition claims with quotes for structure */
  conditionSummaries: string[];
  unitOpSummaries: string[];
  topProcedureLabels: string[];
  instruction: string;
};

/**
 * Build a densify-first knowledge digest from evidence (no LiveDossier required).
 */
export function buildProcessKnowledgeDigest(
  ev: CompoundEvidence
): ProcessKnowledgeDigest {
  const pf = ev.processFacts;
  const facts = (pf?.facts || []).filter((f) => f.kind !== "open-gap");

  const conditionSummaries = facts
    .filter((f) => f.kind === "condition" || f.kind === "yield" || f.kind === "purity")
    .slice(0, 12)
    .map((f) => formatFactLine(f));

  const unitOpSummaries = facts
    .filter((f) => f.kind === "unit-op" || f.kind === "workup" || f.kind === "isolation")
    .slice(0, 10)
    .map((f) => formatFactLine(f));

  const topProcedureLabels = [...(ev.procedureExcerpts || [])]
    .map((p) => ({
      label: p.label,
      score: scoreProcedureWindow(p.text) + Math.min(10, (p.chars || p.text.length) / 200),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.label.slice(0, 80));

  return {
    framing: pf?.framing || "evidence-lead-pack",
    productionBriefEligible: pf?.productionBriefEligible || false,
    sourcedConditionCount: pf?.sourcedConditionCount ?? 0,
    unitOpCount: pf?.unitOpCount ?? 0,
    openGaps: (pf?.openGaps || []).slice(0, 8),
    managerRisks: (pf?.managerRisks || []).slice(0, 6),
    exampleDenseSources: (pf?.exampleDenseSources || []).slice(0, 6),
    ipPointers: (pf?.ipPointers || []).slice(0, 6),
    conditionSummaries,
    unitOpSummaries,
    topProcedureLabels,
    instruction:
      "Use processKnowledgeDigest only as structure cues (gaps, risks, dense sources, condition summaries). " +
      "Do not invent plant setpoints or CPP numbers from gaps. Prefer processFacts.atoms quotes for numbers.",
  };
}

function formatFactLine(f: ProcessFact): string {
  const val =
    f.value != null
      ? ` = ${f.value}${f.unit ? ` ${f.unit}` : ""}`
      : "";
  const q = f.quote ? ` “${f.quote.slice(0, 100)}”` : "";
  const src = f.sourceLabel ? ` [${f.sourceLabel}]` : "";
  return `${f.kind}: ${f.claim}${val}${q}${src}`.slice(0, 220);
}
