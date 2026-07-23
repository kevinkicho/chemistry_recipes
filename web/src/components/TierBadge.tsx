import type { ContentTier } from "@/lib/types/process";

const labels: Record<ContentTier, { title: string; className: string }> = {
  A: {
    title: "Tier A · Curated dossier",
    className: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  },
  B: {
    title: "Tier B · API + AI composite",
    className: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  },
  C: {
    title: "Tier C · Identity stub",
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
