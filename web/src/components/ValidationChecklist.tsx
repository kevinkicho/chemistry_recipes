"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { buildTechTransferFromLive } from "@/lib/export/techTransfer";

const STATUS_CLS = {
  ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  gap: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  review: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
} as const;

/**
 * Pre-validation gap checklist for tech-transfer / print (not GMP claims).
 */
export function ValidationChecklist({ dossier }: { dossier: LiveDossier }) {
  const pack = buildTechTransferFromLive(dossier);
  const items = pack.validationChecklist || [];
  if (!items.length) return null;

  const gaps = items.filter((i) => i.status === "gap").length;
  const review = items.filter((i) => i.status === "review").length;
  const ok = items.filter((i) => i.status === "ok").length;

  return (
    <div
      id="validation-checklist"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">
          Transfer readiness checklist
        </h2>
        <p className="text-xs text-slate-500">
          {ok} ok · {review} review · {gaps} gap
        </p>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Educational pre-validation only — not a site batch record or GMP certificate.
        Included in tech-transfer JSON v2.
      </p>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2 text-xs"
          >
            <span
              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ring-inset ${STATUS_CLS[item.status]}`}
            >
              {item.status}
            </span>
            <div className="min-w-0">
              <div className="text-slate-200">{item.item}</div>
              {item.note ? (
                <div className="mt-0.5 text-[10px] text-slate-600">{item.note}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {pack.sourceCoverage ? (
        <p className="mt-3 text-[11px] text-slate-600">
          Source coverage: {pack.sourceCoverage.summary}
        </p>
      ) : null}
    </div>
  );
}
