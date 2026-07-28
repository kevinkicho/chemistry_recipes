"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";
import {
  buildRouteHypotheses,
  buildScientificConflicts,
} from "@/lib/frontier/routeHypotheses";
import type { RouteHypothesis } from "@/lib/frontier/types";

const STATUS_STYLE: Record<RouteHypothesis["status"], string> = {
  "evidence-backed": "bg-emerald-500/15 text-emerald-100 ring-emerald-500/35",
  partial: "bg-sky-500/15 text-sky-100 ring-sky-500/30",
  "thin-lead": "bg-slate-800 text-slate-400 ring-slate-700",
  "teaching-baseline": "bg-amber-500/15 text-amber-100 ring-amber-500/35",
};

/**
 * Competing public process hypotheses with kill criteria.
 */
export function RouteHypothesesPanel({ dossier }: { dossier: LiveDossier }) {
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
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Competing public process hypotheses
      </h2>
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
            Scientific conflicts
          </h3>
          <ul className="mt-2 space-y-2">
            {conflicts.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px]"
              >
                <div className="font-medium text-amber-100/90">{c.topic}</div>
                <p className="mt-0.5 text-slate-400">
                  A: {c.sideA.slice(0, 140)}
                </p>
                <p className="text-slate-400">B: {c.sideB.slice(0, 140)}</p>
                {c.resolvingExperiment ? (
                  <p className="mt-1 text-sky-200/80">
                    Resolve: {c.resolvingExperiment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
