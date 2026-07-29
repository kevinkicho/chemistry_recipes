/**
 * Bind AI route step conditions to process-fact quotes / densify windows.
 * Does not invent numbers — only attaches provenance when a token matches.
 */

import type { ProcessRoute, SourceRef } from "@/lib/types/process";
import type { ProcessFact } from "@/lib/dossier/processFacts";

export type QuoteBindReport = {
  boundSteps: number;
  boundConditions: number;
  unboundNumericSteps: number;
  summary: string;
};

function numCore(s: string): string {
  const m = s.match(/\d+(?:\.\d+)?/);
  return m?.[0] || "";
}

function factMatchesCondition(fact: ProcessFact, condText: string): boolean {
  const core = numCore(condText);
  if (!core) return false;
  const blob = `${fact.claim} ${fact.value || ""} ${fact.quote || ""} ${fact.unit || ""}`.toLowerCase();
  if (!blob.includes(core)) return false;
  // Unit family soft match
  if (/°\s*c|temp/i.test(condText) && /°\s*c|temp|celsius/i.test(blob)) return true;
  if (/\b(h|hr|hour|min)/i.test(condText) && /\b(h|hr|hour|min)/i.test(blob))
    return true;
  if (/bar|psi|atm|mpa/i.test(condText) && /bar|psi|atm|mpa|press/i.test(blob))
    return true;
  if (/equiv|eq\./i.test(condText) && /equiv|eq\./i.test(blob)) return true;
  if (/%|yield/i.test(condText) && /%|yield/i.test(blob)) return true;
  // Number alone matched in claim
  return blob.includes(core) && (fact.kind === "condition" || fact.kind === "yield");
}

function sourceRefFromFact(f: ProcessFact): SourceRef {
  return {
    type: "literature",
    id: f.sourceId || f.id,
    label: f.sourceLabel || f.sourceId || "process-fact",
    url: f.sourceUrl,
    note: f.claim.slice(0, 80),
    capturedSnippet: (f.quote || f.claim).slice(0, 280),
    capturedAt: new Date().toISOString(),
    relevanceTier: "process",
  };
}

/**
 * Attach sourceRefs on steps when condition numerics match process-fact atoms.
 */
export function attachQuotesToRoutes(
  routes: ProcessRoute[],
  facts: ProcessFact[] | undefined
): { routes: ProcessRoute[]; report: QuoteBindReport } {
  const atoms = (facts || []).filter((f) => f.kind !== "open-gap");
  let boundSteps = 0;
  let boundConditions = 0;
  let unboundNumericSteps = 0;

  const out = routes.map((route) => ({
    ...route,
    steps: (route.steps || []).map((step) => {
      const cond = step.conditions;
      if (!cond) return step;
      const pieces = [
        cond.temperatureC,
        cond.pressure,
        cond.time,
        cond.atmosphere,
        cond.other,
      ].filter(Boolean) as string[];
      if (!pieces.length) return step;

      const matched: ProcessFact[] = [];
      let hasNumeric = false;
      for (const p of pieces) {
        if (/\d/.test(p)) hasNumeric = true;
        for (const f of atoms) {
          if (factMatchesCondition(f, p) && !matched.some((m) => m.id === f.id)) {
            matched.push(f);
          }
        }
      }

      if (matched.length) {
        boundSteps += 1;
        boundConditions += matched.length;
        const refs = [
          ...(step.sourceRefs || []),
          ...matched.map(sourceRefFromFact),
        ];
        // Dedupe by id
        const seen = new Set<string>();
        const sourceRefs = refs.filter((r) => {
          const k = r.id;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return {
          ...step,
          sourceRefs,
          description: step.description,
          // Keep quote on step notes for operators when thin
          scaleNotes:
            step.scaleNotes ||
            matched
              .map((f) => (f.quote ? `“${f.quote.slice(0, 100)}”` : f.claim))
              .slice(0, 2)
              .join(" · ") ||
            step.scaleNotes,
        };
      }
      if (hasNumeric) unboundNumericSteps += 1;
      return step;
    }),
  }));

  return {
    routes: out,
    report: {
      boundSteps,
      boundConditions,
      unboundNumericSteps,
      summary: `Quote-bind · ${boundSteps} step(s) · ${boundConditions} fact link(s) · ${unboundNumericSteps} numeric step(s) still unbound`,
    },
  };
}
