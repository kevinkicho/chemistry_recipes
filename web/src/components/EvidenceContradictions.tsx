import type { EvidenceContradiction } from "@/lib/dossier/types";

/** Professional review panel — tensions between public sources. */
export function EvidenceContradictions({
  items,
}: {
  items: EvidenceContradiction[];
}) {
  if (!items?.length) return null;

  return (
    <div
      id="contradictions"
      className="scroll-mt-24 space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
    >
      <div>
        <h2 className="text-lg font-semibold text-amber-100">
          Evidence tensions
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
          Public sources disagree or emphasize different routes. Review both sides —
          this app does not choose a commercial path.
        </p>
      </div>
      <ul className="space-y-3">
        {items.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  c.severity === "warning"
                    ? "bg-amber-500/20 text-amber-200"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {c.severity}
              </span>
              <span className="text-sm font-medium text-slate-200">{c.topic}</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-xs text-slate-400">
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-500/80">
                  Side A
                </div>
                {c.sideA}
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/60 px-2.5 py-2 text-xs text-slate-400">
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400/80">
                  Side B
                </div>
                {c.sideB}
              </div>
            </div>
            {c.sourceHint ? (
              <p className="mt-2 text-[11px] text-slate-600">{c.sourceHint}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
