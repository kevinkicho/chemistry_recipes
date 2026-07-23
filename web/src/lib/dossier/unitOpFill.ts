/**
 * Map process steps onto modality template unit ops (evidence fill only).
 */

import type { UnitOpFill } from "@/lib/dossier/types";
import type { ProcessModality, ProcessRoute } from "@/lib/types/process";
import { MODALITY_TEMPLATES } from "@/lib/modality/templates";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function overlapScore(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = tokenize(b);
  if (!ta.size || !tb.length) return 0;
  let hit = 0;
  for (const w of tb) if (ta.has(w)) hit += 1;
  return hit / Math.max(tb.length, 1);
}

/**
 * For each modality unit-op slot, find best-matching route step titles/descriptions.
 * Empty slots stay empty — never invents content.
 */
export function fillModalityUnitOps(
  modality: ProcessModality,
  processRoutes: ProcessRoute[]
): UnitOpFill[] {
  const template = MODALITY_TEMPLATES[modality] || MODALITY_TEMPLATES.other;
  const steps = processRoutes.flatMap((r) =>
    (r.steps || []).map((s) => ({
      id: s.id,
      hay: `${s.title} ${s.description} ${s.mechanismClass || ""}`,
    }))
  );

  return template.unitOps.map((op) => {
    const opHay = `${op.title} ${op.description}`;
    let best: { id: string; score: number } | null = null;
    const matched: string[] = [];
    for (const s of steps) {
      const score = overlapScore(opHay, s.hay);
      if (score >= 0.15) matched.push(s.id);
      if (!best || score > best.score) best = { id: s.id, score };
    }
    if (!best || best.score < 0.12) {
      return {
        templateOpId: op.id,
        title: op.title,
        status: "empty" as const,
        notes: "No evidence-backed step matched this unit-op slot",
      };
    }
    const filledFromStepIds = [...new Set(matched.length ? matched : [best.id])];
    return {
      templateOpId: op.id,
      title: op.title,
      filledFromStepIds,
      status: (best.score >= 0.28 ? "filled" : "partial") as UnitOpFill["status"],
      notes:
        best.score >= 0.28
          ? `Matched step(s): ${filledFromStepIds.join(", ")}`
          : `Weak match — review step ${best.id} before treating as filled`,
    };
  });
}
