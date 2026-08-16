"use client";

import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import { assessRecipeReadiness } from "@/lib/dossier/recipeReadiness";
import { slimTraces } from "@/lib/api/trace";
import { formatSectionEmptyCopy } from "@/lib/dossier/sectionHonesty";

/**
 * Pinned "Monday morning" worker pack — EHS, steps, gaps, actions under 2 minutes.
 */
export function MondayMorningPack({
  dossier,
  onPrint,
  onScrollEnrich,
  onScrollAid,
  onScrollGaps,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onPrint?: () => void;
  onScrollEnrich?: () => void;
  onScrollAid?: () => void;
  onScrollGaps?: () => void;
  onRegenerate?: () => void;
}) {
  const readiness =
    dossier.recipeReadiness ||
    assessRecipeReadiness({
      processFacts: dossier.processFacts,
      literature: dossier.literature,
      patents: dossier.patents,
      view: {
        cid: dossier.cid,
        manufacturingTexts: dossier.manufacturingTexts,
        descriptionTexts: dossier.descriptionTexts,
        propertyTexts: dossier.propertyTexts,
        blocks: [],
        hazards: {
          pictograms: [],
          hazardStatements: dossier.hazards.hazardStatements || [],
          precautionaryStatements: [],
          rawBlocks: [],
        },
        traces: [],
      },
      annotations: dossier.annotations,
      identity: dossier.identity,
    });

  const name = dossier.identity?.name || `CID ${dossier.cid}`;
  const ehs = [
    ...(dossier.synthesis.ehsHighlights || []),
    ...(dossier.hazards.hazardStatements || []).slice(0, 4),
  ].slice(0, 5);

  const preferred =
    dossier.processRoutes.find((r) => r.preference === 1) ||
    dossier.processRoutes[0];
  const steps = (preferred?.steps || []).slice(0, 8);

  const gaps = [
    ...(readiness.gaps || [])
      .filter((g) => g.severity === "blocker" || g.severity === "major")
      .map((g) => g.label),
    ...(dossier.processFacts?.openGaps || []).slice(0, 4),
  ].slice(0, 6);

  const mode = dossier.productMode || readiness.mode;
  const isScout = mode === "scout-dossier" || readiness.framing === "evidence-lead-pack";

  return (
    <section
      id="monday-pack"
      className="monday-pack scroll-mt-24 rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 sm:p-5 print:border-slate-400 print:bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/90 print:text-teal-800">
              Monday morning pack
            </p>
            <ContentProvenance
              title="Monday morning pack"
              field="Monday pack"
              pubchemCid={dossier.cid}
              traces={slimTraces(dossier.traces || [])}
              sourceRefs={dossier.sourceRefs}
              ai={dossier.synthesis.provenance}
              showAi={Boolean(dossier.synthesis.provenance)}
              onRegenerate={onRegenerate}
            />
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-50 print:text-slate-900">
            {name}
          </h2>
          <p className="mt-1 text-xs text-slate-400 print:text-slate-600">
            Public-evidence scouting pack for process teams —{" "}
            <strong className="font-medium text-slate-300 print:text-slate-800">
              not a GMP batch record
            </strong>
            . Validate under your site QMS.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 print:hidden">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
              isScout
                ? "bg-sky-500/15 text-sky-100 ring-sky-500/35"
                : "bg-teal-500/20 text-teal-50 ring-teal-400/40"
            }`}
          >
            {mode === "recipe-draft" ? "Recipe draft" : "Scout dossier"}
          </span>
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 font-mono text-[11px] text-slate-400 ring-1 ring-inset ring-slate-700">
            {readiness.score}/100
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3 print:border-rose-300">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-200 print:text-rose-800">
            EHS callouts
          </h3>
          {ehs.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300 print:text-slate-800">
              {ehs.map((e, i) => (
                <li key={i} className="leading-snug">
                  {e}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              {
                formatSectionEmptyCopy({
                  family: "hazards",
                  traces: slimTraces(dossier.traces),
                  fetchErrors: dossier.fetchErrors,
                }).message
              }{" "}
              Check PubChem Safety before any plant use.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 print:border-amber-300">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-100 print:text-amber-900">
            Site must fill
          </h3>
          {gaps.length ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300 print:text-slate-800">
              {gaps.map((g, i) => (
                <li key={i} className="leading-snug">
                  {g}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              No major public-evidence blockers listed — still complete site CPPs / IPCs under QMS.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-950/40 p-3 print:border-slate-300 print:bg-white">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 print:text-slate-700">
          Preferred path ({steps.length || 0} step{steps.length === 1 ? "" : "s"})
        </h3>
        {steps.length ? (
          <ol className="mt-2 space-y-2">
            {steps.map((s, i) => (
              <li
                key={s.id || i}
                className="flex gap-2 text-sm text-slate-200 print:text-slate-900"
              >
                <span className="font-mono text-xs tabular-nums text-teal-400/90 print:text-teal-700">
                  {i + 1}.
                </span>
                <span>
                  <span className="font-medium">{s.title}</span>
                  {s.description ? (
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 print:text-slate-600">
                      {s.description.slice(0, 180)}
                      {s.description.length > 180 ? "…" : ""}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Not enough public procedure density for a plant sequence. Paste public patent
            procedure windows via Local enrich (paste public experimental text).
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={() => onPrint?.() ?? window.print()}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          Print pack / job aid
        </button>
        <button
          type="button"
          onClick={onScrollAid}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-900"
        >
          Open operator job aid
        </button>
        <button
          type="button"
          onClick={onScrollGaps}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-900"
        >
          Site fill &amp; checklist
        </button>
        {isScout ? (
          <button
            type="button"
            onClick={onScrollEnrich}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15"
          >
            Paste public procedure (densify)
          </button>
        ) : null}
      </div>
    </section>
  );
}
