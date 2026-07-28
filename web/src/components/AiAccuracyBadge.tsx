"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import type { GroundingReport } from "@/lib/dossier/quoteGrounding";
import { Tooltip } from "@/components/Tooltip";

/**
 * Honest badge: AI did not invent site numbers / ungrounded conditions stripped.
 */
export function AiAccuracyBadge({
  dossier,
  grounding,
}: {
  dossier: LiveDossier;
  grounding?: GroundingReport | null;
}) {
  const ai = dossier.synthesis;
  if (!ai.parsed && !ai.provenance) return null;

  const stripped = grounding?.strippedConditions ?? 0;
  const score = dossier.processFacts?.metrics?.accuracyScore;

  let label = "AI labeled · evidence-only";
  let cls =
    "bg-violet-500/15 text-violet-200 ring-violet-500/30";
  let detail =
    "Manufacturing numbers only when supported by free-public evidence. Not plant truth.";

  if (stripped > 0) {
    label = `Ungrounded stripped · ${stripped}`;
    cls = "bg-amber-500/15 text-amber-100 ring-amber-500/35";
    detail = grounding?.summary || detail;
  } else if (ai.parsed && (grounding?.grounded || score != null && score >= 50)) {
    label = "No invented plant numbers";
    cls = "bg-emerald-500/15 text-emerald-100 ring-emerald-500/35";
    detail =
      "Quote-grounding / uncited strip: numeric conditions either match evidence or were omitted.";
  } else if (!ai.parsed) {
    label = "Evidence shell · no AI numbers";
    cls = "bg-slate-800 text-slate-400 ring-slate-700";
  }

  return (
    <Tooltip
      multiline
      content={
        <>
          <span className="block font-semibold text-slate-100">Accuracy law</span>
          <span className="mt-0.5 block text-slate-400">{detail}</span>
          {score != null ? (
            <span className="mt-0.5 block text-slate-500">
              Process-fact accuracy {score}/100
            </span>
          ) : null}
        </>
      }
    >
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}
      >
        {label}
      </span>
    </Tooltip>
  );
}
