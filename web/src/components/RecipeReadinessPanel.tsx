"use client";

import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import type {
  ProductMode,
  RecipeGap,
  RecipeReadiness,
} from "@/lib/dossier/recipeReadiness";
import { assessRecipeReadiness } from "@/lib/dossier/recipeReadiness";
import { slimTraces } from "@/lib/api/trace";

const MODE_LABEL: Record<ProductMode, string> = {
  "scout-dossier": "Scout dossier",
  "recipe-draft": "Recipe draft",
  "teaching-package": "Legacy (unused)",
};

const MODE_STYLE: Record<ProductMode, string> = {
  "scout-dossier": "bg-sky-500/15 text-sky-100 ring-sky-500/35",
  "recipe-draft": "bg-teal-500/20 text-teal-50 ring-teal-400/40",
  "teaching-package": "bg-violet-500/15 text-violet-100 ring-violet-500/35",
};

const SEV_STYLE: Record<RecipeGap["severity"], string> = {
  blocker: "bg-rose-500/15 text-rose-100 ring-rose-500/35",
  major: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
  minor: "bg-slate-800 text-slate-400 ring-slate-700",
};

function readinessFromDossier(dossier: LiveDossier): RecipeReadiness {
  if (dossier.recipeReadiness) return dossier.recipeReadiness;
  return assessRecipeReadiness({
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
}

/**
 * Product mode banner + missing-for-recipe checklist.
 */
export function RecipeReadinessPanel({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const r = readinessFromDossier(dossier);
  const mode = dossier.productMode || r.mode;

  return (
    <div
      id="recipe-readiness"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">
          Recipe readiness
        </h2>
        <ContentProvenance
          title="Recipe readiness"
          field="Recipe readiness"
          pubchemCid={dossier.cid}
          traces={slimTraces(dossier.traces || [])}
          sourceRefs={dossier.sourceRefs}
          ai={dossier.synthesis.provenance}
          showAi={Boolean(dossier.synthesis.provenance)}
          onRegenerate={onRegenerate}
        />
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${MODE_STYLE[mode]}`}
        >
          {MODE_LABEL[mode]}
        </span>
        <span className="font-mono text-xs tabular-nums text-slate-500">
          {r.score}/100
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{r.summary}</p>

      {r.strengths.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {r.strengths.map((s) => (
            <li
              key={s}
              className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-200/90 ring-1 ring-inset ring-teal-500/25"
            >
              {s}
            </li>
          ))}
        </ul>
      ) : null}

      <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Missing for a manufacturing recipe
      </h3>
      <ul className="mt-2 space-y-2">
        {r.gaps.map((g) => (
          <li
            key={g.id}
            className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${SEV_STYLE[g.severity]}`}
              >
                {g.severity}
              </span>
              <span className="text-sm font-medium text-slate-200">{g.label}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{g.detail}</p>
            {g.howToFill ? (
              <p className="mt-1 text-[11px] text-teal-400/80">
                How to densify: {g.howToFill}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
        Modes: <strong className="font-medium text-slate-500">Scout</strong> =
        evidence map always.{" "}
        <strong className="font-medium text-slate-500">Recipe draft</strong> =
        only when public process-fact density clears blockers.{" "}
        <strong className="font-medium text-slate-500">Teaching package</strong> =
        live densify dual-view inventory. Never GMP.
      </p>
    </div>
  );
}
