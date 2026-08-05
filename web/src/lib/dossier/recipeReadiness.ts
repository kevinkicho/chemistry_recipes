/**
 * Product modes + "missing for a manufacturing recipe" checklist.
 *
 * Modes:
 * - scout-dossier: always valid; identity + evidence map
 * - recipe-draft: only when process-fact density supports process-recipe framing
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { CompoundEvidence } from "@/lib/dossier/types";
import type { ProcessFactBundle } from "@/lib/dossier/processFacts";

export type ProductMode = "scout-dossier" | "recipe-draft";

export type RecipeGapSeverity = "blocker" | "major" | "minor";

export interface RecipeGap {
  id: string;
  label: string;
  detail: string;
  severity: RecipeGapSeverity;
  /** How to densify (public sources / user action) */
  howToFill?: string;
}

export interface RecipeReadiness {
  mode: ProductMode;
  /** 0–100 heuristic for how close we are to a recipe draft */
  score: number;
  framing: ProcessFactBundle["framing"];
  gaps: RecipeGap[];
  strengths: string[];
  summary: string;
}

function countProcedureChars(
  evidence: Pick<
    CompoundEvidence,
    "procedureExcerpts" | "literature" | "patents" | "view"
  >
): number {
  let n = 0;
  for (const p of evidence.procedureExcerpts || []) n += p.chars || p.text.length;
  for (const h of evidence.literature || []) {
    n += h.fullTextExcerpt?.length || 0;
  }
  for (const p of evidence.patents || []) {
    n += p.procedureExcerpt?.length || 0;
  }
  for (const t of evidence.view?.manufacturingTexts || []) n += t.length;
  return n;
}

/**
 * Assess whether free-public evidence can support a recipe draft.
 */
export function assessRecipeReadiness(
  evidence: Pick<
    CompoundEvidence,
    | "processFacts"
    | "procedureExcerpts"
    | "literature"
    | "patents"
    | "view"
    | "annotations"
    | "identity"
  >
): RecipeReadiness {
  const pf = evidence.processFacts;
  const framing = pf?.framing || "evidence-lead-pack";
  const cond = pf?.sourcedConditionCount ?? 0;
  const ops = pf?.unitOpCount ?? 0;
  const isolation = pf?.metrics?.isolationCount ?? 0;
  const examples = pf?.exampleDenseSources?.length ?? 0;
  const patents = evidence.patents?.length ?? 0;
  const lit = evidence.literature?.length ?? 0;
  const procedureChars = countProcedureChars(evidence);
  const materials =
    pf?.facts?.filter((f) => f.kind === "material").length ?? 0;
  const workup = pf?.facts?.filter((f) => f.kind === "workup").length ?? 0;

  const gaps: RecipeGap[] = [];
  const strengths: string[] = [];

  if (cond < 3) {
    gaps.push({
      id: "conditions",
      label: "Numeric process conditions",
      detail: `Only ${cond} sourced condition atom(s) (°C, time, P, pH, atmosphere).`,
      severity: cond === 0 ? "blocker" : "major",
      howToFill:
        "Open OA full text / patent examples, or paste public experimental text via Local full-text enrich.",
    });
  } else {
    strengths.push(`${cond} sourced condition atoms`);
  }

  if (ops < 2) {
    gaps.push({
      id: "unit-ops",
      label: "Unit operations",
      detail: `Only ${ops} unit-op cue(s) extracted (charge, crystallize, filter, …).`,
      severity: ops === 0 ? "blocker" : "major",
      howToFill: "Need process literature/patents that name unit operations.",
    });
  } else {
    strengths.push(`${ops} unit-op cues`);
  }

  if (isolation < 1) {
    gaps.push({
      id: "isolation",
      label: "Isolation / crystallization",
      detail: "No isolation language in free-public excerpts.",
      severity: "major",
      howToFill: "Patent examples and OA methods sections often carry isolation.",
    });
  } else {
    strengths.push("Isolation language present");
  }

  if (materials < 1) {
    gaps.push({
      id: "bom-materials",
      label: "BOM / stoichiometry",
      detail: "No stoichiometry or material charges extracted.",
      severity: "major",
      howToFill: "Look for eq / mol / solvent charges in procedures.",
    });
  } else {
    strengths.push("Material / stoich cues");
  }

  if (workup < 1) {
    gaps.push({
      id: "workup",
      label: "Workup / quench",
      detail: "No workup language extracted.",
      severity: "minor",
    });
  }

  if (procedureChars < 1200) {
    gaps.push({
      id: "procedure-depth",
      label: "Procedure-bearing text depth",
      detail: `~${procedureChars.toLocaleString()} chars of procedure windows (OA full text + patent + mfg). Thin for AI recipe drafting.`,
      severity: procedureChars < 400 ? "blocker" : "major",
      howToFill:
        "Europe PMC OA full text, patent examples, ORD browse, or Local enrich paste.",
    });
  } else {
    strengths.push(
      `${Math.round(procedureChars / 100) / 10}k chars procedure windows`
    );
  }

  if (examples < 1 && patents < 2) {
    gaps.push({
      id: "examples",
      label: "Worked examples / patent density",
      detail: "Few example-dense sources or process patents.",
      severity: "minor",
    });
  } else if (examples >= 1) {
    strengths.push(`${examples} example-dense source(s)`);
  }

  if (lit + patents < 3) {
    gaps.push({
      id: "source-breadth",
      label: "Literature / patent breadth",
      detail: `Only ${lit} literature + ${patents} patent hit(s).`,
      severity: "minor",
    });
  }

  gaps.push({
    id: "site-qms",
    label: "Site CPPs / IPCs / cleaning",
    detail:
      "Validated plant limits are never taken from free APIs — always site QMS.",
    severity: "minor",
  });

  const blockers = gaps.filter((g) => g.severity === "blocker").length;
  const majors = gaps.filter((g) => g.severity === "major").length;

  let score = 15;
  score += Math.min(30, cond * 8);
  score += Math.min(20, ops * 6);
  score += Math.min(12, isolation * 8);
  score += Math.min(12, materials * 4);
  score += Math.min(15, Math.floor(procedureChars / 400));
  score += Math.min(10, examples * 5);
  if (framing === "process-recipe") score += 12;
  score = Math.max(0, Math.min(100, score - blockers * 12 - majors * 4));

  const canDraft =
    framing === "process-recipe" &&
    blockers === 0 &&
    cond >= 3 &&
    ops >= 2 &&
    procedureChars >= 800;

  const mode: ProductMode = canDraft ? "recipe-draft" : "scout-dossier";

  const summary = canDraft
    ? `Recipe-draft mode: public density supports a sourced process outline (${score}/100 readiness). Still not GMP.`
    : `Scout-dossier mode: evidence map + leads only (${score}/100 readiness). Fill blockers before treating AI text as a recipe.`;

  return {
    mode,
    score,
    framing,
    gaps,
    strengths,
    summary,
  };
}

/** Attach readiness onto a live dossier (idempotent). */
export function withRecipeReadiness(dossier: LiveDossier): LiveDossier {
  const readiness = assessRecipeReadiness({
    processFacts: dossier.processFacts,
    literature: dossier.literature,
    patents: dossier.patents,
    view: {
      cid: dossier.cid,
      manufacturingTexts: dossier.manufacturingTexts,
      descriptionTexts: dossier.descriptionTexts,
      propertyTexts: dossier.propertyTexts,
      blocks: [],
      hazards: {
        pictograms: [],
        hazardStatements: dossier.hazards.hazardStatements || [],
        precautionaryStatements: [],
        rawBlocks: [],
      },
      traces: [],
    },
    annotations: dossier.annotations,
    identity: dossier.identity,
  });
  return {
    ...dossier,
    productMode: readiness.mode,
    recipeReadiness: readiness,
  };
}
