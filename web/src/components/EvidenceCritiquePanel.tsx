"use client";

/**
 * Critique pass over free-public evidence — each gap maps to an action.
 */

import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import type { GroundingReport } from "@/lib/dossier/quoteGrounding";
import { slimTraces } from "@/lib/api/trace";
import { formatProcessFactsEmptyCopy } from "@/lib/dossier/sectionHonesty";

type ActionId =
  | "local-text-enrich"
  | "monday-pack"
  | "site-fill"
  | "literature"
  | "patents"
  | "pubchem-manufacturing"
  | "operator-job-aid"
  | "shift-pack"
  | "regenerate";

type CritiqueItem = {
  severity: "info" | "warn" | "good";
  text: string;
  action?: { id: ActionId; label: string };
};

export function EvidenceCritiquePanel({
  dossier,
  onRegenerate,
  onScroll,
  grounding,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
  onScroll?: (id: string) => void;
  grounding?: GroundingReport | null;
}) {
  const contradictions = dossier.contradictions || [];
  const readiness = dossier.recipeReadiness;
  const gaps = readiness?.gaps || [];
  const pf = dossier.processFacts;
  const ai = dossier.synthesis;
  const prov = ai.provenance;

  const items: CritiqueItem[] = [];

  if (ai.parsed) {
    items.push({
      severity: "good",
      text: `AI synthesis parsed (${prov?.model || ai.model || "model"} · ${
        prov ? `${prov.responseTimeMs} ms` : "timing n/a"
      }).`,
    });
  } else if (prov) {
    items.push({
      severity: "warn",
      text: `AI call attempted but incomplete: ${prov.error || ai.rawError || "parse failed"}.`,
      action: onRegenerate
        ? { id: "regenerate", label: "Regenerate AI" }
        : { id: "local-text-enrich", label: "Densify first" },
    });
  } else {
    items.push({
      severity: "info",
      text: "No AI synthesis on this capture — evidence shell only.",
      action: onRegenerate
        ? { id: "regenerate", label: "Run free APIs + AI" }
        : undefined,
    });
  }

  if (grounding && grounding.strippedConditions > 0) {
    items.push({
      severity: "warn",
      text: grounding.summary,
      action: { id: "local-text-enrich", label: "Paste denser public text" },
    });
  } else if (grounding?.grounded && ai.parsed) {
    items.push({
      severity: "good",
      text: grounding.summary,
    });
  }

  const score = dossier.evidenceScore?.score;
  if (score != null) {
    items.push({
      severity: score >= 55 ? "good" : score >= 35 ? "info" : "warn",
      text: `Evidence score ${score}/100 · ${dossier.evidenceScore?.confidence || "n/a"} confidence.`,
      action:
        score < 55
          ? { id: "local-text-enrich", label: "Paste public procedure" }
          : { id: "shift-pack", label: "Save shift pack" },
    });
  }

  if (pf) {
    items.push({
      severity: pf.productionBriefEligible ? "good" : "warn",
      text: `Process facts: ${pf.sourcedConditionCount} conditions · ${pf.unitOpCount} unit ops · accuracy ${pf.metrics?.accuracyScore ?? "—"}/100.`,
      action: !pf.productionBriefEligible
        ? { id: "local-text-enrich", label: "Densify facts" }
        : { id: "operator-job-aid", label: "Open job aid" },
    });
  }

  // Procedure-window critique comes from literature / patent / manufacturing
  // harvest. Harvest failure is not "No procedure windows densified".
  // Leftover identity / annotation HTTP is not a critique miss.
  // Provenance chips still pass all traces on purpose (composite critique).
  const allTraces = slimTraces(dossier.traces || []);
  const windowsEmpty = formatProcessFactsEmptyCopy({
    traces: allTraces,
    fetchErrors: dossier.fetchErrors,
  });

  const litProc = (dossier.literature || []).filter(
    (h) => (h.fullTextExcerpt?.length || 0) >= 80
  ).length;
  const patProc = (dossier.patents || []).filter(
    (h) => (h.procedureExcerpt?.length || 0) >= 80
  ).length;
  if (litProc + patProc > 0) {
    items.push({
      severity: "good",
      text: `Procedure densify signal: ${litProc} OA lit · ${patProc} patent window(s).`,
      action: { id: "literature", label: "Open literature" },
    });
  } else {
    items.push({
      severity: "warn",
      text:
        windowsEmpty.kind === "error"
          ? windowsEmpty.message
          : "No procedure windows densified — paste public full text or re-run densify/refresh.",
      action: { id: "local-text-enrich", label: "Paste wizard" },
    });
  }

  for (const g of gaps
    .filter((x) => x.severity === "blocker" || x.severity === "major")
    .slice(0, 6)) {
    const action = inferGapAction(g.label);
    items.push({
      severity: g.severity === "blocker" ? "warn" : "info",
      text: `Readiness ${g.severity}: ${g.label}`,
      action,
    });
  }

  for (const c of contradictions.slice(0, 4)) {
    items.push({
      severity: c.severity === "warning" ? "warn" : "info",
      text: `Tension · ${c.topic}: ${c.sideA.slice(0, 72)}… vs ${c.sideB.slice(0, 72)}…`,
      action: { id: "patents", label: "Review patents" },
    });
  }

  function runAction(id: ActionId) {
    if (id === "regenerate") {
      onRegenerate?.();
      return;
    }
    onScroll?.(id);
  }

  return (
    <div
      id="evidence-critique"
      className="scroll-mt-24 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-violet-100">
          Evidence critique pass
        </h2>
        <ContentProvenance
          title="Evidence critique"
          field="Critique"
          pubchemCid={dossier.cid}
          traces={allTraces}
          sourceRefs={dossier.sourceRefs}
          ai={prov}
          showAi={Boolean(prov)}
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Automated review with next actions — tensions and gaps are surfaced, not resolved.
        Not a QA release decision.
      </p>
      <ul className="mt-3 space-y-1.5">
        {items.map((b, i) => (
          <li
            key={i}
            className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed ${
              b.severity === "good"
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-100/90"
                : b.severity === "warn"
                  ? "border-amber-500/25 bg-amber-500/5 text-amber-100/90"
                  : "border-slate-800 bg-slate-950/40 text-slate-400"
            }`}
          >
            <span className="min-w-0 flex-1">{b.text}</span>
            {b.action ? (
              <button
                type="button"
                onClick={() => runAction(b.action!.id)}
                className="shrink-0 rounded border border-violet-500/30 bg-violet-950/40 px-2 py-0.5 text-[10px] font-medium text-violet-100 hover:bg-violet-900/50"
              >
                {b.action.label} →
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function inferGapAction(label: string): CritiqueItem["action"] {
  const l = label.toLowerCase();
  if (/paste|procedure|full.?text|densif|example/i.test(l)) {
    return { id: "local-text-enrich", label: "Paste public text" };
  }
  if (/ipc|equipment|site|cqa|cpp|hold/i.test(l)) {
    return { id: "site-fill", label: "Site fill blank" };
  }
  if (/patent/i.test(l)) return { id: "patents", label: "Open patents" };
  if (/literature|paper|oa/i.test(l)) return { id: "literature", label: "Open literature" };
  if (/manufactur|use and/i.test(l)) {
    return { id: "pubchem-manufacturing", label: "PubChem mfg text" };
  }
  if (/ehs|hazard|ghs/i.test(l)) return { id: "monday-pack", label: "Monday EHS" };
  return { id: "local-text-enrich", label: "Improve density" };
}
