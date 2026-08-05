"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import {
  assessIdealPageParity,
  type IdealFillSource,
  type IdealPageParity,
} from "@/lib/dossier/idealPage";
import { ContentProvenance } from "@/components/ContentProvenance";
import { slimTraces } from "@/lib/api/trace";

const SOURCE_STYLE: Record<IdealFillSource, string> = {
  empty: "bg-slate-800 text-slate-500 ring-slate-700",
  "live-api": "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  "process-facts": "bg-teal-500/15 text-teal-200 ring-teal-500/30",
  ai: "bg-violet-500/15 text-violet-200 ring-violet-500/30",
  "tier-a-teaching": "bg-rose-500/15 text-rose-100 ring-rose-500/35",
  "user-local": "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30",
};

const SOURCE_LABEL: Record<IdealFillSource, string> = {
  empty: "empty",
  "live-api": "live API",
  "process-facts": "process facts",
  ai: "AI",
  "tier-a-teaching": "legacy mock",
  "user-local": "local paste",
};

/**
 * Progress toward live dual-view densify ideal inventory (0–100).
 */
export function IdealPageParityPanel({
  dossier,
  onScroll,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onScroll?: (id: string) => void;
  onRegenerate?: () => void;
}) {
  const parity: IdealPageParity =
    dossier.idealParity || assessIdealPageParity(dossier);
  const weak = parity.sections
    .filter((s) => s.depth < 50)
    .sort((a, b) => a.depth - b.depth);

  return (
    <div
      id="ideal-page-parity"
      className="scroll-mt-24 rounded-xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-slate-950/80 p-4 ring-1 ring-inset ring-amber-500/15"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            Ideal page · live densify depth
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-50">
            Depth toward process dual-view complete
          </h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">
            {parity.goal}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ContentProvenance
            title="Ideal page parity"
            field="Ideal page"
            pubchemCid={dossier.cid}
            traces={slimTraces(dossier.traces || [])}
            sourceRefs={dossier.sourceRefs}
            ai={dossier.synthesis.provenance}
            showAi={Boolean(dossier.synthesis.provenance)}
            onRegenerate={onRegenerate}
          />
          <span
            className={`rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums ring-1 ring-inset ${
              parity.score >= 75
                ? "bg-emerald-500/15 text-emerald-100 ring-emerald-500/35"
                : parity.score >= 50
                  ? "bg-amber-500/15 text-amber-50 ring-amber-400/40"
                  : "bg-slate-800 text-slate-300 ring-slate-700"
            }`}
          >
            {parity.score}/100
          </span>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900 ring-1 ring-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            parity.score >= 75
              ? "bg-emerald-500/80"
              : parity.score >= 50
                ? "bg-amber-500/80"
                : "bg-sky-500/70"
          }`}
          style={{ width: `${Math.min(100, parity.score)}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-slate-300">{parity.summary}</p>
      <p className="mt-1 text-[11px] text-slate-500">
        {parity.filledCount}/{parity.totalCount} ideal sections with content
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {onScroll ? (
          <>
            <button
              type="button"
              onClick={() => onScroll("routes")}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-500/40"
            >
              Process recipe
            </button>
            <button
              type="button"
              onClick={() => onScroll("local-text-enrich")}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-500/40"
            >
              Paste to densify
            </button>
          </>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg border border-violet-500/40 bg-violet-950/40 px-2.5 py-1 text-[11px] text-violet-100"
          >
            Regenerate evidence + AI
          </button>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {parity.sections.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-1 rounded-lg border border-slate-800/90 bg-slate-950/50 px-2.5 py-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-slate-200">{s.label}</span>
              <span className="font-mono text-[10px] tabular-nums text-slate-500">
                {s.depth}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-teal-500/70"
                style={{ width: `${Math.min(100, s.depth)}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ring-1 ring-inset ${SOURCE_STYLE[s.source]}`}
              >
                {SOURCE_LABEL[s.source]}
              </span>
              <span className="text-[10px] text-slate-600">{s.detail}</span>
            </div>
            {s.depth < 50 && s.howToClose ? (
              <p className="text-[10px] leading-snug text-amber-100/70">
                {s.howToClose}
              </p>
            ) : null}
            {onScroll && s.scrollId ? (
              <button
                type="button"
                onClick={() => onScroll(s.scrollId!)}
                className="self-start text-[10px] text-teal-400/90 hover:underline"
              >
                Jump →
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {weak.length > 0 ? (
        <p className="mt-3 text-[11px] text-slate-500">
          Largest gaps vs ideal:{" "}
          <strong className="font-medium text-slate-400">
            {weak.map((w) => w.label).join(" · ")}
          </strong>
        </p>
      ) : null}
    </div>
  );
}
