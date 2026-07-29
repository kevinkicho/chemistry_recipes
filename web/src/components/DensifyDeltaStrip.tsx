"use client";

/**
 * Universal densify outcome strip — Ideal / evidence / conditions / soft-fails.
 */

import type { DensifySnapshot } from "@/lib/dossier/densifyDelta";
import { formatDensifyDelta } from "@/lib/dossier/densifyDelta";

export function DensifyDeltaStrip({
  before,
  after,
  title = "Densify outcome",
  className = "",
}: {
  before: DensifySnapshot;
  after: DensifySnapshot;
  title?: string;
  className?: string;
}) {
  const line = formatDensifyDelta(before, after);
  const improved =
    after.idealScore > before.idealScore ||
    after.procedureChars > before.procedureChars ||
    after.processFactConditions > before.processFactConditions;

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
        improved
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100/90"
          : "border-slate-700 bg-slate-900/50 text-slate-400"
      } ${className}`}
      data-densify-delta=""
      role="status"
    >
      <span className="font-semibold text-slate-300">{title}: </span>
      {line}
      <span className="mt-0.5 block text-[10px] text-slate-600">
        Free-public densify metrics only — not plant setpoints or GMP validation.
      </span>
    </div>
  );
}
