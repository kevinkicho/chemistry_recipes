"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import {
  buildSourceCoverage,
  type SourceSlotStatus,
} from "@/lib/dossier/sourceCoverage";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";

const STATUS_STYLE: Record<SourceSlotStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  empty: "bg-slate-800 text-slate-500 ring-slate-700",
  fail: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  partial: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
};

/**
 * Free-API coverage strip: N APIs · ok / empty / fail.
 */
export function SourceCoverageMap({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const report = buildSourceCoverage(dossier);

  return (
    <div
      id="source-coverage"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Source coverage</h2>
          {/* Composite all-traces hydration. Empty traces must not
              live-fetch leftover PubChem identity HTTP labeled as
              source coverage. */}
          <FreePublicProvenance
            dossier={dossier}
            title="Source coverage"
            field="Source coverage"
            liveFetch={false}
            onRegenerate={onRegenerate}
          />
        </div>
        <p className="text-xs font-medium text-teal-300/90">{report.summary}</p>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Free public APIs called for this build — not only PubChem.
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {report.slots.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2"
          >
            <span
              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ring-inset ${STATUS_STYLE[s.status]}`}
            >
              {s.status}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-200">
                {s.label}
              </div>
              <div className="truncate text-[10px] text-slate-600">
                {s.organization}
                {s.detail ? ` · ${s.detail}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
