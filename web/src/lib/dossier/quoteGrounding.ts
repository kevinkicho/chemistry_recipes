/**
 * Second-pass critique: ensure AI route numeric claims appear in evidence text.
 * Strips ungrounded condition-like tokens from steps; records grounding stats.
 * Does not invent replacements — honest thin beats fake rich.
 */

import type { ProcessRoute } from "@/lib/types/process";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import type { AiSynthesis } from "@/lib/dossier/types";

export interface GroundingReport {
  checkedSteps: number;
  strippedConditions: number;
  ungroundedSnippets: string[];
  grounded: boolean;
  summary: string;
}

const NUMERICISH =
  /\b\d+(?:\.\d+)?\s*(?:°\s*C|C\b|bar|psi|psig|h\b|hr|hrs|min|equiv|eq\.?|M\b|mL|L\b|%|kPa|atm)\b/gi;

function evidenceBlob(opts: {
  facts?: ProcessFact[];
  dataFed?: string;
  mfgTexts?: string[];
  procedureTexts?: string[];
}): string {
  const parts: string[] = [];
  if (opts.dataFed) parts.push(opts.dataFed);
  for (const f of opts.facts || []) {
    parts.push(f.claim, f.quote || "", f.value || "");
  }
  for (const t of opts.mfgTexts || []) parts.push(t);
  for (const t of opts.procedureTexts || []) parts.push(t);
  return parts.join("\n").toLowerCase();
}

function normalizeNumToken(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** True if every significant numeric token in `text` appears (loosely) in evidence. */
export function isTextGroundedInEvidence(text: string, evidenceLower: string): boolean {
  const matches = text.match(NUMERICISH);
  if (!matches?.length) return true;
  for (const m of matches) {
    const token = normalizeNumToken(m);
    const core = token.replace(/[^0-9.]/g, "");
    if (core.length < 1) continue;
    // Require the number to appear in evidence (unit may differ)
    if (!evidenceLower.includes(core)) return false;
  }
  return true;
}

/**
 * Strip condition fields that contain ungrounded numeric claims.
 * Mutates a deep copy of routes.
 */
export function groundRoutesAgainstEvidence(
  routes: ProcessRoute[],
  opts: {
    facts?: ProcessFact[];
    dataFed?: string;
    mfgTexts?: string[];
    procedureTexts?: string[];
  }
): { routes: ProcessRoute[]; report: GroundingReport } {
  const evidence = evidenceBlob(opts);
  const ungrounded: string[] = [];
  let stripped = 0;
  let checked = 0;

  const out: ProcessRoute[] = routes.map((r) => ({
    ...r,
    steps: (r.steps || []).map((step) => {
      checked += 1;
      const next = { ...step };
      if (next.conditions) {
        const c = { ...next.conditions };
        for (const key of Object.keys(c) as Array<keyof typeof c>) {
          const val = c[key];
          if (typeof val !== "string" || !val.trim()) continue;
          if (!isTextGroundedInEvidence(val, evidence)) {
            ungrounded.push(`${step.title}: ${key}=${val}`);
            delete c[key];
            stripped += 1;
          }
        }
        next.conditions = c;
      }
      // Scale notes with ungrounded numbers → drop
      if (next.scaleNotes && !isTextGroundedInEvidence(next.scaleNotes, evidence)) {
        ungrounded.push(`${step.title}: scaleNotes`);
        next.scaleNotes = undefined;
        stripped += 1;
      }
      return next;
    }),
  }));

  const report: GroundingReport = {
    checkedSteps: checked,
    strippedConditions: stripped,
    ungroundedSnippets: ungrounded.slice(0, 24),
    grounded: stripped === 0,
    summary:
      stripped === 0
        ? `Quote-grounding OK · ${checked} step(s) checked`
        : `Quote-grounding stripped ${stripped} ungrounded condition(s) from ${checked} step(s)`,
  };

  return { routes: out, report };
}

/** Soft check on free-text AI fields (overview, mfg summary) for reporting only. */
export function critiqueAiTextGrounding(
  synthesis: AiSynthesis,
  evidenceLower: string
): string[] {
  const flags: string[] = [];
  if (synthesis.overview && !isTextGroundedInEvidence(synthesis.overview, evidenceLower)) {
    flags.push("Overview contains numeric claims not found in evidence package");
  }
  if (
    synthesis.manufacturingSummary &&
    !isTextGroundedInEvidence(synthesis.manufacturingSummary, evidenceLower)
  ) {
    flags.push("Manufacturing summary contains numeric claims not found in evidence package");
  }
  return flags;
}

export function buildEvidenceLowerFromPackage(dataFed?: string, facts?: ProcessFact[]): string {
  return evidenceBlob({ dataFed, facts });
}
