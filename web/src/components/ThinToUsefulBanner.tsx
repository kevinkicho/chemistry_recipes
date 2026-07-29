"use client";

import type { LiveDossier } from "@/lib/dossier/types";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";
import { downloadSiteHandoff } from "@/lib/export/siteHandoff";
import { failedFamiliesFromErrors } from "@/lib/dossier/densifyDelta";

/**
 * Monday path: thin scout → densify → job aid / handoff. Always actionable.
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

  const softN = failedFamiliesFromErrors(dossier.fetchErrors).length;

  if (!thin) {
    return (
      <div
        id="thin-to-useful"
        className="print:hidden scroll-mt-24 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3"
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
            Monday path · ready for handoff pack
          </p>
          <FreePublicProvenance
            dossier={dossier}
            title="Toward curated ideal"
            field="Thin-to-useful"
            onRegenerate={onRegenerate}
          />
        </div>
        <p className="text-xs text-emerald-100/90">
          <strong className="font-semibold">Toward curated ideal:</strong> evidence{" "}
          {score}/100 · ideal depth {ideal}/100 · {facts} process facts · {mode}
          {softN ? ` · ${softN} soft-fail family(ies)` : ""}. Still not GMP.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Btn onClick={() => onScroll("monday-pack")} label="Monday pack" />
          <Btn onClick={() => onScroll("operator-job-aid")} label="Job aid" />
          <Btn onClick={() => onScroll("shift-pack")} label="Shift pack" />
          <Btn onClick={() => downloadSiteHandoff(dossier)} label="Site handoff .md" />
          <Btn onClick={() => onScroll("ideal-page-parity")} label="Ideal gaps" />
          <Btn onClick={() => onScroll("diagnostics")} label="Diagnostics" />
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
          Monday path · densify first (primary)
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
        {facts} facts · {mode}
        {softN ? ` · ${softN} soft-fail family(ies)` : ""}). Densify free-public procedure text
        without inventing plant limits — research panels are secondary until density rises.
      </p>
      <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[11px] text-slate-400">
        <li>Force densify / paste public experimental text</li>
        <li>Check Ideal gaps (recipe, apparatus, environment, …)</li>
        <li>Retry failed free-API families if diagnostics show soft-fails</li>
        <li>Monday pack / job aid / site handoff for the plant team</li>
      </ol>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {onRegenerate ? (
          <Btn primary onClick={onRegenerate} label="1 · Force densify" />
        ) : null}
        <Btn onClick={() => onScroll("local-text-enrich")} label="2 · Paste wizard" />
        <Btn onClick={() => onScroll("ideal-page-parity")} label="3 · Ideal gaps" />
        <Btn onClick={() => onScroll("diagnostics")} label="4 · Retry soft-fails" />
        <Btn onClick={() => onScroll("monday-pack")} label="Monday pack" />
        <Btn onClick={() => onScroll("operator-job-aid")} label="Job aid" />
        <Btn onClick={() => downloadSiteHandoff(dossier)} label="Site handoff .md" />
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
