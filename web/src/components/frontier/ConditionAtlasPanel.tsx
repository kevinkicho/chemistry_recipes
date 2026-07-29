"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";
import type { ConditionDistribution } from "@/lib/frontier/types";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";

function DistCard({ d }: { d: ConditionDistribution }) {
  return (
    <li
      className={`rounded-lg border px-3 py-2 ${
        d.conflict
          ? "border-amber-500/35 bg-amber-500/5"
          : "border-slate-800 bg-slate-950/50"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-300/90">
          {d.kind}
        </span>
        <span className="font-mono text-[11px] text-slate-500">n={d.n}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{d.summary}</p>
      {d.numeric ? (
        <p className="mt-1 font-mono text-[11px] text-slate-300">
          {d.numeric.min}–{d.numeric.max}
          {d.numeric.unit ? ` ${d.numeric.unit}` : ""} · median ~
          {Number(d.numeric.median.toFixed(2))}
        </p>
      ) : null}
      {d.conflict ? (
        <p className="mt-1 text-[11px] font-medium text-amber-200/90">
          Conflict · {d.conflictNote}
        </p>
      ) : null}
      <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto">
        {d.observations.slice(0, 5).map((o) => (
          <li key={o.id} className="border-l-2 border-slate-700 pl-2 text-[10px] text-slate-500">
            <span className="font-medium text-slate-400">{o.raw}</span>
            {" · "}
            {o.sourceUrl ? (
              <a
                href={o.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-teal-500/90 hover:underline"
              >
                {o.sourceLabel.slice(0, 40)}
              </a>
            ) : (
              o.sourceLabel.slice(0, 40)
            )}
            <span className="mt-0.5 block italic text-slate-600">
              “{o.quote.slice(0, 120)}
              {o.quote.length > 120 ? "…" : ""}”
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Public condition-space atlas — distributions with quotes, not plant setpoints.
 */
export function ConditionAtlasPanel({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  // Always recompute from free-public windows so extraction quality fixes
  // (e.g. BUN≠atmosphere, quote dedupe) apply without forcing re-densify.
  // processKnowledge.conditionAtlas remains for export/agent packages until next densify.
  const atlas = buildConditionAtlas(dossier);

  return (
    <div
      id="condition-atlas"
      className="scroll-mt-24 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
            Frontier · condition space
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-50">
              Public condition atlas
            </h2>
            <FreePublicProvenance
              dossier={dossier}
              title="Public condition atlas"
              field="Condition atlas"
              onRegenerate={onRegenerate}
            />
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">
            {atlas.disclaimer}
          </p>
        </div>
        <span className="rounded-full bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-400 ring-1 ring-slate-700">
          {atlas.observationCount} obs
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-300">{atlas.summary}</p>

      {atlas.distributions.length === 0 ? (
        <p className="mt-3 text-xs text-slate-600">
          No conditions extracted — densify OA/patent procedure text or use paste wizard.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {atlas.distributions
            .filter((d) => d.kind !== "solvent" && d.kind !== "catalyst")
            .map((d) => (
              <DistCard key={d.kind} d={d} />
            ))}
        </ul>
      )}

      {(atlas.solvents.length > 0 || atlas.catalysts.length > 0) ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[11px] text-slate-400">
          {atlas.solvents.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Solvent cues
              </h3>
              <ul className="mt-1 space-y-0.5">
                {atlas.solvents.slice(0, 8).map((s) => (
                  <li key={s.name}>
                    {s.name}{" "}
                    <span className="font-mono text-slate-600">n={s.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {atlas.catalysts.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Catalyst / reagent cues
              </h3>
              <ul className="mt-1 space-y-0.5">
                {atlas.catalysts.slice(0, 8).map((s) => (
                  <li key={s.name}>
                    {s.name}{" "}
                    <span className="font-mono text-slate-600">n={s.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
