import type { ContentTier } from "@/lib/types/process";

const labels: Record<ContentTier, { title: string; className: string }> = {
  A: {
    /** Legacy label only — live product never emits Tier A (mocks retired). */
    title: "Tier A · Legacy (unused)",
    className: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  },
  B: {
    title: "Tier B · Live densify + AI",
    className: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  },
  C: {
    title: "Tier C · Identity / thin evidence",
    className: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  },
};

export function TierBadge({ tier }: { tier: ContentTier }) {
  const l = labels[tier];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${l.className}`}
    >
      {l.title}
    </span>
  );
}
