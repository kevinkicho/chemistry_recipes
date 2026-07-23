"use client";

import type { LiveDossier } from "@/lib/dossier/types";

/**
 * Shift-brief style one-pager for operators / supervisors.
 * Print-friendly; sourced steps only; gaps explicit.
 */
export function OperatorJobAid({ dossier }: { dossier: LiveDossier }) {
  const pf = dossier.processFacts;
  const framing = dossier.processFraming || pf?.framing || "evidence-lead-pack";
  const route = dossier.processRoutes[0];
  const hazards = (dossier.hazards.hazardStatements || []).slice(0, 8);
  const gaps = pf?.openGaps?.slice(0, 8) || [];

  return (
    <div
      id="operator-job-aid"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-white/95 p-5 text-slate-900 shadow-sm print:border-slate-400 print:shadow-none"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Operator / supervisor job aid
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            {dossier.identity?.name || `CID ${dossier.cid}`}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-slate-600">
            {dossier.identity?.cas ? `CAS ${dossier.identity.cas} · ` : ""}
            CID {dossier.cid}
            {dossier.identity?.formula ? ` · ${dossier.identity.formula}` : ""}
          </p>
        </div>
        <div className="text-right text-[11px]">
          <span
            className={`inline-block rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${
              framing === "process-recipe"
                ? "bg-teal-50 text-teal-800 ring-teal-200"
                : "bg-amber-50 text-amber-900 ring-amber-200"
            }`}
          >
            {framing === "process-recipe"
              ? "Public process recipe (sourced)"
              : "Evidence-lead pack — not a recipe"}
          </span>
          <p className="mt-1 text-slate-500 print:hidden">Use Print / PDF for handout</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        Educational public-evidence brief only.{" "}
        <strong className="font-semibold">Not</strong> a batch record, SOP, or GMP
        procedure. Follow site procedures and QMS for all plant work.
      </p>

      <section className="mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Public sequence (verify sources)
        </h3>
        {route?.steps?.length ? (
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-800">
            {route.steps.slice(0, 8).map((s) => (
              <li key={s.id}>
                <span className="font-medium">{s.title}</span>
                {s.conditions?.temperatureC ||
                s.conditions?.time ||
                s.conditions?.pressure ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-teal-800">
                    {[
                      s.conditions.temperatureC && `T ${s.conditions.temperatureC}`,
                      s.conditions.time && `t ${s.conditions.time}`,
                      s.conditions.pressure && `P ${s.conditions.pressure}`,
                      s.conditions.atmosphere && s.conditions.atmosphere,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {s.factIds?.length ? " · fact-linked" : ""}
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    No numeric conditions extracted — open primary source
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No public sequence available.</p>
        )}
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Handling / EHS (public)
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {hazards.length
              ? hazards.map((h) => (
                  <li key={h} className="flex gap-1.5">
                    <span className="text-rose-600">!</span>
                    <span>{h}</span>
                  </li>
                ))
              : (
                <li className="text-slate-500">No GHS statements on file</li>
              )}
            {(pf?.managerRisks || []).slice(0, 4).map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="text-amber-600">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Site owner must fill
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {gaps.map((g) => (
              <li key={g} className="flex gap-1.5">
                <span className="text-slate-400">□</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-4 border-t border-slate-200 pt-2 text-[10px] text-slate-500">
        Generated {new Date(dossier.generatedAt).toLocaleString()} · Chemistry Recipes
        public process brief · accuracy{" "}
        {pf?.metrics?.accuracyScore ?? "—"}/100
      </p>
    </div>
  );
}
