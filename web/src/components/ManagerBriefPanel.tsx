"use client";

import type { LiveDossier } from "@/lib/dossier/types";

/**
 * MSAT / manager planning brief — preferred path, alternatives, risks, IP pointers, gaps.
 * Not regulatory or legal advice.
 */
export function ManagerBriefPanel({ dossier }: { dossier: LiveDossier }) {
  const pf = dossier.processFacts;
  const framing = dossier.processFraming || pf?.framing || "evidence-lead-pack";
  const routes = dossier.processRoutes || [];
  const preferred = routes[0];
  const alternatives = routes.slice(1, 3);
  const score = dossier.evidenceScore;
  const hazards = dossier.hazards.hazardStatements?.slice(0, 5) || [];
  const risks = [
    ...(pf?.managerRisks || []),
    ...hazards.map((h) => `GHS: ${h}`),
  ].slice(0, 12);
  const gaps = pf?.openGaps?.slice(0, 6) || dossier.synthesis.gaps?.slice(0, 6) || [];
  const contradictions = (dossier.contradictions || []).slice(0, 4);
  const impurities = (dossier.relatedEntities || [])
    .filter((e) =>
      ["impurity", "intermediate", "starting-material", "solvent", "reagent"].includes(
        e.role
      )
    )
    .slice(0, 10);

  return (
    <div
      id="manager-brief"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-4 ring-1 ring-inset ring-slate-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            Manager / MSAT brief
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Planning handout from free-public evidence — not a batch record, not legal
            advice.
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-500">
          <div>
            Evidence{" "}
            <span className="font-semibold text-slate-300">
              {score?.score ?? "—"}/100
            </span>
            {pf?.metrics ? (
              <>
                {" "}
                · accuracy{" "}
                <span className="font-semibold text-slate-300">
                  {pf.metrics.accuracyScore}/100
                </span>
              </>
            ) : null}
          </div>
          <div>
            {framing === "process-recipe" ? (
              <span className="text-teal-300/90">Process-recipe framing</span>
            ) : (
              <span className="text-amber-200/80">Evidence-lead pack</span>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Preferred public path
          </dt>
          <dd className="mt-1 text-sm font-medium text-slate-100">
            {preferred?.name || "No route assembled"}
          </dd>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {preferred?.summary ||
              "Await process literature/patents or fact-dense public text."}
          </p>
          {preferred?.steps?.length ? (
            <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[11px] text-slate-400">
              {preferred.steps.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <span className="text-slate-300">{s.title}</span>
                  {s.conditions?.temperatureC ? (
                    <span className="text-teal-400/80">
                      {" "}
                      · {s.conditions.temperatureC}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Alternatives / tensions
          </dt>
          <dd className="mt-2 space-y-2 text-[11px] text-slate-400">
            {alternatives.length ? (
              alternatives.map((r) => (
                <div key={r.id}>
                  <span className="font-medium text-slate-300">{r.name}</span>
                  <p className="text-slate-500">{r.summary?.slice(0, 160)}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-600">No alternate public route assembled.</p>
            )}
            {contradictions.map((c) => (
              <div
                key={c.id}
                className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5"
              >
                <div className="font-medium text-amber-100/90">{c.topic}</div>
                <div className="text-slate-500">A: {c.sideA}</div>
                <div className="text-slate-500">B: {c.sideB}</div>
              </div>
            ))}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Scale-up / process risks (public cues)
          </dt>
          <dd className="mt-2">
            {risks.length ? (
              <ul className="space-y-1 text-[11px] text-slate-400">
                {risks.map((r) => (
                  <li key={r} className="flex gap-1.5">
                    <span className="text-rose-400/80">·</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-600">
                No process-specific risk language extracted.
              </p>
            )}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            IP pointers (not legal advice)
          </dt>
          <dd className="mt-2">
            {(pf?.ipPointers || []).length ? (
              <ul className="space-y-1 text-[11px] text-slate-400">
                {pf!.ipPointers.map((p) => (
                  <li key={p} className="font-mono text-[10px] text-slate-400">
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-600">
                No patent numbers in harvest — check Patents panel.
              </p>
            )}
            {(pf?.exampleDenseSources || []).length ? (
              <p className="mt-2 text-[10px] text-teal-400/80">
                Example-dense sources: {pf!.exampleDenseSources.join("; ")}
              </p>
            ) : null}
          </dd>
        </div>

        {impurities.length ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Related materials / impurities (public)
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {impurities.map((e) => (
                <span
                  key={`${e.role}-${e.name}`}
                  className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 ring-1 ring-slate-700"
                >
                  <span className="text-slate-500">{e.role}</span> {e.name}
                  {e.cas ? ` · ${e.cas}` : ""}
                </span>
              ))}
            </dd>
          </div>
        ) : null}

        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-3 sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Open for site process owner
          </dt>
          <dd className="mt-2">
            <ul className="space-y-1 text-[11px] text-slate-500">
              {gaps.map((g) => (
                <li key={g} className="flex gap-1.5">
                  <span className="text-amber-500/70">□</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </div>
  );
}
