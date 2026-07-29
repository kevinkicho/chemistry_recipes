"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";

/**
 * North-star CTA: thin scout → densify → job aid. Always actionable.
 */
export function ThinToUsefulBanner({
  dossier,
  onScroll,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onScroll: (id: string) => void;
  onRegenerate?: () => void;
}) {
  const score = dossier.evidenceScore?.score ?? 0;
  const ideal = dossier.idealParity?.score ?? 0;
  const mode = dossier.productMode || dossier.recipeReadiness?.mode || "scout-dossier";
  const facts = dossier.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ?? 0;
  const thin =
    mode === "scout-dossier" ||
    dossier.processFraming === "evidence-lead-pack" ||
    score < 50 ||
    ideal < 55 ||
    facts < 3;

  if (!thin) {
    return (
      <div
        id="thin-to-useful"
        className="print:hidden scroll-mt-24 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3"
      >
        <div className="mb-1">
          <FreePublicProvenance
            dossier={dossier}
            title="Toward curated ideal"
            field="Thin-to-useful"
            onRegenerate={onRegenerate}
          />
        </div>
        <p className="text-xs text-emerald-100/90">
          <strong className="font-semibold">Toward curated ideal:</strong> evidence{" "}
          {score}/100 · ideal depth {ideal}/100 · {facts} process facts · {mode}. Save a shift
          pack or print Monday pack for handoff — still not GMP.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn onClick={() => onScroll("ideal-page-parity")} label="Ideal page gaps" />
          <Btn onClick={() => onScroll("shift-pack")} label="Shift pack" />
          <Btn onClick={() => onScroll("monday-pack")} label="Monday pack" />
          <Btn onClick={() => onScroll("operator-job-aid")} label="Job aid" />
        </div>
      </div>
    );
  }

  return (
    <div
      id="thin-to-useful"
      className="print:hidden scroll-mt-24 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 ring-1 ring-amber-400/20"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
          Thin → curated ideal (primary path)
        </p>
        <FreePublicProvenance
          dossier={dossier}
          title="Thin to useful"
          field="Thin-to-useful"
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-sm text-slate-200">
        Live depth is below the Tier-A ideal page (evidence {score}/100 · ideal {ideal}/100 ·{" "}
        {facts} facts · {mode}). Curated dual-view is the goal — densify public procedure text
        without inventing plant limits.
      </p>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[11px] text-slate-400">
        <li>See ideal-page gaps (recipe, apparatus, environment, …)</li>
        <li>Paste public patent/paper experimental text</li>
        <li>Regenerate so densify + AI re-package toward dual-view</li>
        <li>Use Monday pack / job aid / shift pack for handoff</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Btn primary onClick={() => onScroll("ideal-page-parity")} label="1 · Ideal gaps" />
        <Btn onClick={() => onScroll("local-text-enrich")} label="2 · Paste wizard" />
        {onRegenerate ? (
          <Btn onClick={onRegenerate} label="3 · Regenerate" />
        ) : null}
        <Btn onClick={() => onScroll("operator-job-aid")} label="Job aid" />
        <Btn onClick={() => onScroll("monday-pack")} label="Monday pack" />
      </div>
    </div>
  );
}

function Btn({
  onClick,
  label,
  primary,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
          : "rounded-lg border border-slate-700 bg-slate-950/50 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-500/40"
      }
    >
      {label}
    </button>
  );
}
