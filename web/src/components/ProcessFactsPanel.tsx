"use client";

import { ContentProvenance } from "@/components/ContentProvenance";
import { ApiProvenance } from "@/components/ApiProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import { slimTraces } from "@/lib/api/trace";
import type { SourceRef } from "@/lib/types/process";

const KIND_STYLE: Record<string, string> = {
  condition: "bg-teal-500/15 text-teal-200 ring-teal-500/30",
  "unit-op": "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  material: "bg-violet-500/15 text-violet-200 ring-violet-500/30",
  yield: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
  isolation: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  workup: "bg-emerald-500/10 text-emerald-100/90 ring-emerald-500/25",
  "hazard-process": "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  "scale-note": "bg-orange-500/15 text-orange-100 ring-orange-500/30",
  purity: "bg-amber-500/10 text-amber-100/90 ring-amber-500/25",
  "open-gap": "bg-slate-800 text-slate-500 ring-slate-700",
};

function FactRow({
  fact,
  pubchemCid,
  traces,
}: {
  fact: ProcessFact;
  pubchemCid?: number;
  traces?: ReturnType<typeof slimTraces>;
}) {
  const isGap = fact.kind === "open-gap";
  const sourceRefs: SourceRef[] | undefined =
    fact.sourceUrl || fact.sourceLabel
      ? [
          {
            type:
              fact.provenance === "patent"
                ? "patent"
                : fact.provenance === "literature"
                  ? "literature"
                  : "api",
            id: fact.sourceId || fact.id,
            label: fact.sourceLabel || fact.sourceId,
            url: fact.sourceUrl,
            note: fact.quote?.slice(0, 200),
          },
        ]
      : undefined;

  return (
    <li
      className={`rounded-lg border px-3 py-2 ${
        isGap
          ? "border-dashed border-slate-700 bg-slate-950/30"
          : "border-slate-800/90 bg-slate-950/50"
      }`}
    >
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ring-inset ${
            KIND_STYLE[fact.kind] || KIND_STYLE["open-gap"]
          }`}
        >
          {fact.kind}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className={`text-xs ${isGap ? "text-slate-500" : "text-slate-200"}`}>
              {fact.claim}
            </p>
            {!isGap && (sourceRefs?.length || pubchemCid) ? (
              <ApiProvenance
                pubchemCid={pubchemCid}
                traces={traces}
                sourceRefs={sourceRefs}
                title={`Fact: ${fact.claim.slice(0, 80)}`}
                label="API"
              />
            ) : null}
          </div>
          {fact.quote && !isGap ? (
            <p className="mt-1 border-l-2 border-teal-500/30 pl-2 text-[11px] italic leading-relaxed text-slate-500">
              “{fact.quote}”
            </p>
          ) : null}
          {!isGap ? (
            <p className="mt-1 text-[10px] text-slate-600">
              {fact.sourceUrl ? (
                <a
                  href={fact.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-teal-500/90 hover:underline"
                >
                  {fact.sourceLabel}
                </a>
              ) : (
                fact.sourceLabel
              )}
              <span className="text-slate-700"> · {fact.provenance}</span>
              {fact.value ? (
                <span className="text-slate-500">
                  {" "}
                  · {fact.value}
                  {fact.unit ? ` ${fact.unit}` : ""}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * Sourced process fact atoms + explicit open gaps (accuracy layer).
 */
export function ProcessFactsPanel({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const pf = dossier.processFacts;
  if (!pf) return null;

  const sourced = pf.facts.filter((f) => f.kind !== "open-gap");
  const gaps = pf.facts.filter((f) => f.kind === "open-gap");
  const traces = slimTraces(dossier.traces || []);
  const ai = dossier.synthesis.provenance;

  return (
    <div
      id="process-facts"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-100">
            Public process facts
          </h2>
          <ContentProvenance
            title="Public process facts"
            field="Process facts"
            pubchemCid={dossier.cid}
            traces={traces}
            sourceRefs={dossier.sourceRefs}
            ai={ai}
            showAi={Boolean(ai)}
            onRegenerate={onRegenerate}
          />
        </div>
        <p className="text-xs text-slate-500">
          {pf.sourcedConditionCount} conditions · {pf.unitOpCount} unit ops ·{" "}
          {pf.productionBriefEligible ? (
            <span className="text-teal-300/90">brief eligible</span>
          ) : (
            <span className="text-amber-200/80">thin density</span>
          )}
        </p>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {pf.summary} Manufacturing numbers below are{" "}
        <strong className="font-medium text-slate-400">only</strong> what free-public
        text supports — solid cards are sourced; open each fact&apos;s API chip for
        quote + URL. Dashed cards are explicit gaps (not plant truth).
      </p>

      {sourced.length > 0 ? (
        <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
          {sourced.slice(0, 40).map((f) => (
            <FactRow
              key={f.id}
              fact={f}
              pubchemCid={dossier.cid}
              traces={traces}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-slate-600">
          No condition / unit-op atoms extracted from titles and abstracts yet.
        </p>
      )}

      {gaps.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Open gaps (site QMS)
          </h3>
          <ul className="mt-2 space-y-1.5">
            {gaps.map((f) => (
              <FactRow key={f.id} fact={f} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
