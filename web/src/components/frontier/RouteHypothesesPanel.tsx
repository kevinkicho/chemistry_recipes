"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";
import {
  buildRouteHypotheses,
  buildScientificConflicts,
} from "@/lib/frontier/routeHypotheses";
import type { RouteHypothesis } from "@/lib/frontier/types";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";

const STATUS_STYLE: Record<RouteHypothesis["status"], string> = {
  "evidence-backed": "bg-emerald-500/15 text-emerald-100 ring-emerald-500/35",
  partial: "bg-sky-500/15 text-sky-100 ring-sky-500/30",
  "thin-lead": "bg-slate-800 text-slate-400 ring-slate-700",
  "teaching-baseline": "bg-amber-500/15 text-amber-100 ring-amber-500/35",
};

/**
 * Competing public process hypotheses with kill criteria.
 */
export function RouteHypothesesPanel({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const pack = dossier.processKnowledge;
  const atlas = pack?.conditionAtlas || buildConditionAtlas(dossier);
  const hypotheses =
    pack?.routeHypotheses || buildRouteHypotheses(dossier, atlas);
  const conflicts =
    pack?.conflicts || buildScientificConflicts(dossier, atlas, hypotheses);

  return (
    <div
      id="route-hypotheses"
      className="scroll-mt-24 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">
        Frontier · route hypotheses
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-50">
          Competing public process hypotheses
        </h2>
        <FreePublicProvenance
          dossier={dossier}
          title="Route hypotheses"
          field="Route hypotheses"
          aiField="routes"
          aiMode="field-or-parsed"
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Research structures from free-public evidence — kill criteria included. Not a site
        process selection.
      </p>

      <ul className="mt-3 space-y-3">
        {hypotheses.map((h) => (
          <li
            key={h.id}
            className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-100">{h.name}</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_STYLE[h.status]}`}
                >
                  {h.status}
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  evid {h.evidenceScore}/100
                </span>
              </div>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{h.summary}</p>
            {h.steps.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-slate-500">
                {h.steps.slice(0, 6).map((s) => (
                  <li key={s.order}>
                    <span className="text-slate-300">{s.title}</span>
                    {s.missing.length ? (
                      <span className="text-amber-200/70">
                        {" "}
                        — missing: {s.missing[0]}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <h4 className="text-[10px] font-semibold uppercase text-rose-300/80">
                  Kill criteria
                </h4>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[10px] text-slate-500">
                  {h.killCriteria.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-semibold uppercase text-sky-300/80">
                  Open questions
                </h4>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[10px] text-slate-500">
                  {h.openQuestions.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {conflicts.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
            Scientific conflicts · research experiments
          </h3>
          <p className="mt-0.5 text-[10px] text-slate-600">
            Free-public ranges disagree — not plant setpoints. Resolve experimentally under fixed
            other variables.
          </p>
          <ul className="mt-2 space-y-2">
            {conflicts.slice(0, 8).map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-amber-100/90">{c.topic}</div>
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-200/90">
                    act
                  </span>
                </div>
                <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                  <p className="rounded border border-slate-800/80 bg-slate-950/40 px-2 py-1 text-slate-400">
                    <span className="text-[9px] font-semibold uppercase text-slate-600">
                      Side A
                    </span>
                    <span className="mt-0.5 block">{c.sideA.slice(0, 160)}</span>
                  </p>
                  <p className="rounded border border-slate-800/80 bg-slate-950/40 px-2 py-1 text-slate-400">
                    <span className="text-[9px] font-semibold uppercase text-slate-600">
                      Side B
                    </span>
                    <span className="mt-0.5 block">{c.sideB.slice(0, 160)}</span>
                  </p>
                </div>
                {c.resolvingExperiment ? (
                  <p className="mt-2 rounded border border-sky-500/25 bg-sky-500/5 px-2 py-1.5 text-sky-100/90">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-sky-300/80">
                      Next experiment
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed">
                      {c.resolvingExperiment}
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-600">
                    No auto experiment text — densify more OA/patent procedure windows.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
