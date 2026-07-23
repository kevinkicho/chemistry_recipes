"use client";

import { Tooltip } from "@/components/Tooltip";

export function ConfidenceBadge({
  level,
  score,
  reasons,
}: {
  level?: "low" | "medium" | "high" | null;
  score?: number;
  reasons?: string[];
}) {
  if (!level) return null;
  const style =
    level === "high"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : level === "medium"
        ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
        : "bg-slate-500/15 text-slate-400 ring-slate-500/30";

  const tip = [
    `Evidence confidence: ${level}`,
    score != null ? `Score: ${score}/100` : null,
    reasons?.length ? reasons.slice(0, 6).join(" · ") : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Tooltip content={tip} multiline>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${style}`}
      >
        Evidence · {level}
        {score != null ? ` · ${score}` : ""}
      </span>
    </Tooltip>
  );
}
