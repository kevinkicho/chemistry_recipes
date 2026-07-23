"use client";

import type { LiveDossier } from "@/lib/dossier/types";

/**
 * Human-readable evidence score breakdown for trust / AI gating.
 */
export function EvidenceScoreExplainer({ dossier }: { dossier: LiveDossier }) {
  const es = dossier.evidenceScore;
  if (!es) return null;

  const lines =
    es.explainer?.length
      ? es.explainer
      : [
          `Score ${es.score}/100 (${es.confidence})`,
          ...es.reasons.slice(0, 8),
        ];

  return (
    <div
      id="evidence-explainer"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Evidence score</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
            es.confidence === "high"
              ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
              : es.confidence === "medium"
                ? "bg-amber-500/15 text-amber-100 ring-amber-500/30"
                : "bg-slate-800 text-slate-400 ring-slate-700"
          }`}
        >
          {es.score}/100 · {es.confidence}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Why this score — and whether dual-view AI synthesis is warranted.
      </p>
      <ul className="mt-3 space-y-1 text-xs text-slate-400">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-teal-500/70">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {es.aiRecommendation ? (
        <p
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            es.shouldSynthesize
              ? "border-teal-500/25 bg-teal-500/5 text-teal-100/90"
              : "border-amber-500/25 bg-amber-500/5 text-amber-100/90"
          }`}
        >
          {es.aiRecommendation}
        </p>
      ) : null}
    </div>
  );
}
