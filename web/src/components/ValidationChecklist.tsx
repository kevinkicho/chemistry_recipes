"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { buildTechTransferFromLive } from "@/lib/export/techTransfer";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";

type ChecklistStatus = "ok" | "gap" | "review";

const STATUS_CLS: Record<ChecklistStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/35",
  gap: "bg-rose-500/15 text-rose-200 ring-rose-500/35",
  review: "bg-amber-500/15 text-amber-100 ring-amber-500/35",
};

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  ok: "OK",
  gap: "Gap",
  review: "Review",
};

/**
 * Pre-validation gap checklist for tech-transfer / print (not GMP claims).
 * Table layout keeps status badges and notes column-aligned.
 */
export function ValidationChecklist({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const pack = buildTechTransferFromLive(dossier);
  const items = pack.validationChecklist || [];
  if (!items.length) return null;

  const gaps = items.filter((i) => i.status === "gap").length;
  const review = items.filter((i) => i.status === "review").length;
  const ok = items.filter((i) => i.status === "ok").length;

  return (
    <div
      id="validation-checklist"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
    >
      {/* Header */}
      <div className="border-b border-slate-800/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-slate-100">
                Transfer readiness checklist
              </h2>
              <FreePublicProvenance
                dossier={dossier}
                title="Transfer readiness checklist"
                field="Validation checklist"
                onRegenerate={onRegenerate}
              />
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Educational pre-validation only — not a site batch record or GMP
              certificate. Included in tech-transfer JSON v2.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 ring-1 ring-inset ring-emerald-500/30">
              <span className="tabular-nums font-semibold">{ok}</span> ok
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100 ring-1 ring-inset ring-amber-500/30">
              <span className="tabular-nums font-semibold">{review}</span> review
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-200 ring-1 ring-inset ring-rose-500/30">
              <span className="tabular-nums font-semibold">{gaps}</span> gap
            </span>
          </div>
        </div>
      </div>

      {/* Aligned table list */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="w-[5.5rem] px-4 py-2.5 sm:px-5">Status</th>
              <th className="px-3 py-2.5 sm:px-4">Checklist item</th>
              <th className="hidden w-[30%] px-4 py-2.5 sm:table-cell sm:px-5">
                Note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {items.map((item) => {
              const status = item.status as ChecklistStatus;
              return (
                <tr
                  key={item.id}
                  className="bg-slate-950/20 transition hover:bg-slate-900/50"
                >
                  <td className="px-4 py-2.5 align-middle sm:px-5">
                    <span
                      className={`inline-flex w-[4.25rem] items-center justify-center rounded-md px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${STATUS_CLS[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-middle sm:px-4">
                    <div className="text-[13px] leading-snug text-slate-200">
                      {item.item}
                    </div>
                    {/* Note under item on narrow screens */}
                    {item.note ? (
                      <div className="mt-1 text-[11px] leading-relaxed text-slate-500 sm:hidden">
                        {item.note}
                      </div>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-2.5 align-middle text-[12px] leading-relaxed text-slate-500 sm:table-cell sm:px-5">
                    {item.note || (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pack.sourceCoverage ? (
        <div className="border-t border-slate-800/80 px-4 py-2.5 sm:px-5">
          <p className="text-[11px] leading-relaxed text-slate-600">
            <span className="font-medium text-slate-500">Source coverage</span>
            {" · "}
            {pack.sourceCoverage.summary}
          </p>
        </div>
      ) : null}
    </div>
  );
}
