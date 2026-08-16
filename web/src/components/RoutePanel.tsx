"use client";

import { useState } from "react";
import { AiProvenance } from "@/components/AiProvenance";
import { ApiProvenance } from "@/components/ApiProvenance";
import type { AiProvenanceRecord } from "@/lib/dossier/types";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import type { ProcessRoute, ProcessStep } from "@/lib/types/process";
import type { ApiFetchTrace } from "@/lib/api/trace";
import { formatProcessFactsEmptyCopy } from "@/lib/dossier/sectionHonesty";
import { ViewToggle, type AudienceView } from "./ViewToggle";

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 ring-1 ring-slate-700">
      {children}
    </span>
  );
}

function isJunkLine(s: string | undefined | null): boolean {
  if (!s?.trim()) return true;
  return /not specified in public excerpt|define ipc\/cqas|validate on site|placeholder class|not a validated plant step|extracted from pubchem pug view|public manufacturing \/ use note/i.test(
    s
  );
}

function cleanLines(arr?: string[]): string[] | undefined {
  if (!arr?.length) return undefined;
  const out = arr.map((s) => s.trim()).filter((s) => !isJunkLine(s));
  return out.length ? out : undefined;
}

const CONDITION_LABELS: Record<string, string> = {
  temperatureC: "Temp",
  pressure: "Pressure",
  time: "Time",
  ph: "pH",
  atmosphere: "Atm",
  agitation: "Agitation",
  other: "Other",
};

function ConditionChips({
  conditions,
  sourced,
  citationHint,
}: {
  conditions: ProcessStep["conditions"];
  /** When true, style as sourced fact; when false hide in manufacturing-strict mode */
  sourced?: boolean;
  /** Quote / source label for citation graph */
  citationHint?: string;
}) {
  if (!conditions) return null;
  const entries = Object.entries(conditions).filter(
    ([, v]) => v && !isJunkLine(String(v))
  );
  if (!entries.length) return null;
  const tip =
    citationHint ||
    (sourced ? "Sourced or fact-aligned condition — verify primary source" : "Condition");
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          title={tip}
          className={`inline-flex items-baseline gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
            sourced
              ? "border-teal-500/35 bg-teal-500/10"
              : "border-slate-700 bg-slate-950/70"
          }`}
        >
          <span className="font-medium text-slate-500">
            {CONDITION_LABELS[k] || k}
          </span>
          <span className="text-slate-200">{v}</span>
          {sourced ? (
            <span className="text-[9px] font-semibold uppercase text-teal-400/90">
              src
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function StepCard({
  step,
  view,
  aiProvenance,
  factHints,
  onRegenerate,
  pubchemCid,
  traces,
}: {
  step: ProcessStep;
  view: AudienceView;
  aiProvenance?: AiProvenanceRecord | null;
  /** factId → short citation string */
  factHints?: Map<string, string>;
  onRegenerate?: () => void;
  pubchemCid?: number;
  traces?: ApiFetchTrace[];
}) {
  const showMech = view === "mechanism" || view === "dual";
  const showMfg = view === "manufacturing" || view === "dual";

  const hasStepSource = Boolean(step.sourceRefs?.some((s) => s.type !== "editorial"));
  const citationHint =
    step.factIds
      ?.map((id) => factHints?.get(id))
      .filter(Boolean)
      .slice(0, 3)
      .join(" · ") ||
    step.sourceRefs
      ?.filter((s) => s.type !== "editorial")
      .map((s) => s.label || s.id)
      .slice(0, 2)
      .join(" · ") ||
    undefined;
  const critical = cleanLines(step.controls?.criticalParameters);
  // Manufacturing accuracy: never show AI IPC/CQA as plant methods
  const ipc = showMfg ? undefined : cleanLines(step.controls?.ipcMethods);
  const cqa = showMfg ? undefined : cleanLines(step.controls?.cqaTargets);
  const envNotes =
    step.environment?.notes && !isJunkLine(step.environment.notes)
      ? step.environment.notes
      : undefined;
  const hasEnv =
    step.environment &&
    (step.environment.atmosphere ||
      step.environment.containment ||
      step.environment.atexZone ||
      (step.environment.utilities && step.environment.utilities.length > 0) ||
      envNotes);
  const hasControls = Boolean(critical?.length || ipc?.length || cqa?.length);
  const hasApparatus = Boolean(step.apparatus && step.apparatus.length > 0);
  const hasMfgBody =
    hasApparatus ||
    hasEnv ||
    hasControls ||
    (step.scaleNotes && !isJunkLine(step.scaleNotes)) ||
    step.workup;

  const mechNotes =
    step.mechanismNotes && !isJunkLine(step.mechanismNotes)
      ? step.mechanismNotes
      : undefined;

  return (
    <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-sm font-bold text-teal-300 ring-1 ring-teal-500/30">
          {step.order}
        </span>
        <h4 className="text-base font-semibold text-slate-100">{step.title}</h4>
        {step.mechanismClass && showMech ? <Tag>{step.mechanismClass}</Tag> : null}
        {hasStepSource ? (
          <span className="rounded bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-200/90 ring-1 ring-teal-500/25">
            Sourced lead
          </span>
        ) : null}
        {(pubchemCid || (traces && traces.length) || step.sourceRefs?.length) ? (
          <ApiProvenance
            pubchemCid={pubchemCid}
            traces={traces}
            sourceRefs={step.sourceRefs}
            title={`Step: ${step.title}`}
            label="API"
          />
        ) : null}
        {aiProvenance ? (
          <AiProvenance
            provenance={aiProvenance}
            field={`Route step: ${step.title}`}
            label="AI"
            onRegenerate={onRegenerate}
          />
        ) : null}
      </header>

      {/* Conditions: shown as sourced chips when step has non-editorial sources */}
      {step.conditions &&
      Object.values(step.conditions).some((v) => v && !isJunkLine(String(v))) ? (
        <div className="border-b border-slate-800/80 bg-slate-950/40 px-4 py-2.5">
          <ConditionChips
            conditions={step.conditions}
            sourced={hasStepSource}
            citationHint={citationHint}
          />
          {hasStepSource && step.sourceRefs?.[0]?.url ? (
            <p className="mt-1.5 text-[10px] text-slate-600">
              Verify:{" "}
              <a
                href={step.sourceRefs[0].url}
                target="_blank"
                rel="noreferrer"
                className="text-teal-500/90 hover:underline"
              >
                {step.sourceRefs[0].label || step.sourceRefs[0].id}
              </a>
              {citationHint ? (
                <span className="text-slate-600"> · {citationHint.slice(0, 160)}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={`grid gap-0 ${
          view === "dual" && hasMfgBody ? "lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {showMech ? (
          <div
            className={`space-y-3 p-4 ${
              view === "dual" && hasMfgBody
                ? "border-b border-slate-800 lg:border-b-0 lg:border-r"
                : ""
            }`}
          >
            {view === "dual" ? (
              <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-400">
                Chemistry
              </div>
            ) : null}
            <p className="text-sm leading-relaxed text-slate-300">{step.description}</p>
            {mechNotes ? (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <div className="mb-1 text-xs font-medium text-violet-300">
                  Why it works
                </div>
                <p className="text-sm leading-relaxed text-slate-300">{mechNotes}</p>
              </div>
            ) : null}
            {step.materials && step.materials.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">
                  This step uses
                </div>
                <p className="text-xs text-slate-400">
                  {step.materials.map((m) => m.name).join(" · ")}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {showMfg ? (
          <div className="space-y-3 p-4">
            {view === "dual" ? (
              <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-400">
                Plant
              </div>
            ) : null}
            {view === "manufacturing" ? (
              <p className="text-sm leading-relaxed text-slate-300">{step.description}</p>
            ) : null}
            {!hasMfgBody && view === "dual" ? (
              <p className="text-xs leading-relaxed text-slate-500">
                Plant details appear when evidence lists equipment, environment, or controls.
              </p>
            ) : null}
            {hasApparatus ? (
              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">Equipment</div>
                <ul className="space-y-1">
                  {step.apparatus!.map((a, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline gap-x-2 text-sm text-slate-300"
                    >
                      <code className="rounded bg-slate-950/80 px-1.5 py-0.5 text-xs text-teal-300/90">
                        {a.equipmentClass}
                      </code>
                      {a.materialOfConstruction ? (
                        <span className="text-xs text-slate-500">
                          {a.materialOfConstruction}
                        </span>
                      ) : null}
                      {a.notes && !isJunkLine(a.notes) ? (
                        <span className="text-xs text-slate-500">— {a.notes}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hasEnv ? (
              <div className="space-y-1 rounded-lg border border-teal-500/20 bg-teal-500/5 p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-teal-300">Environment</div>
                {step.environment!.atmosphere ? (
                  <p className="text-slate-300">
                    Atmosphere: {step.environment!.atmosphere}
                  </p>
                ) : null}
                {step.environment!.containment ? (
                  <p className="text-slate-300">
                    Containment: {step.environment!.containment}
                  </p>
                ) : null}
                {step.environment!.atexZone ? (
                  <p className="text-slate-300">
                    Zoning: {step.environment!.atexZone}
                  </p>
                ) : null}
                {step.environment!.utilities?.length ? (
                  <p className="text-xs text-slate-400">
                    Utilities: {step.environment!.utilities.join(" · ")}
                  </p>
                ) : null}
                {envNotes ? <p className="text-xs text-slate-400">{envNotes}</p> : null}
              </div>
            ) : null}
            {hasControls ? (
              <div className="flex flex-wrap gap-2">
                {critical?.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-200 ring-1 ring-rose-500/25"
                  >
                    CPP · {c}
                  </span>
                ))}
                {ipc?.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200 ring-1 ring-sky-500/25"
                  >
                    IPC · {c}
                  </span>
                ))}
                {cqa?.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-200 ring-1 ring-teal-500/25"
                  >
                    CQA · {c}
                  </span>
                ))}
              </div>
            ) : null}
            {step.workup ? (
              <p className="text-xs text-slate-400">
                <span className="font-medium text-slate-500">Workup · </span>
                {step.workup}
              </p>
            ) : null}
            {step.scaleNotes && !isJunkLine(step.scaleNotes) ? (
              <p className="border-l-2 border-amber-500/40 pl-2 text-xs text-amber-200/80">
                Scale-up · {step.scaleNotes}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function RoutePanel({
  routes,
  emptyMessage,
  aiProvenance,
  processFacts,
  onRegenerate,
  pubchemCid,
  traces,
  fetchErrors,
}: {
  routes: ProcessRoute[];
  emptyMessage?: string;
  aiProvenance?: AiProvenanceRecord | null;
  processFacts?: ProcessFact[];
  onRegenerate?: () => void;
  pubchemCid?: number;
  traces?: ApiFetchTrace[];
  fetchErrors?: string[];
}) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [view, setView] = useState<AudienceView>("manufacturing");
  const route = routes.find((r) => r.id === routeId) ?? routes[0];
  const factHints = new Map<string, string>();
  for (const f of processFacts || []) {
    if (f.kind === "open-gap") continue;
    factHints.set(
      f.id,
      [f.sourceLabel, f.exampleRef, f.quote?.slice(0, 80)].filter(Boolean).join(" · ")
    );
  }
  // Process recipe is lit / patent / manufacturing evidence. Harvest
  // failure is not "wait for public process literature". Leftover
  // identity / annotation HTTP is not a process-recipe miss.
  const recipeEmpty = formatProcessFactsEmptyCopy({
    traces,
    fetchErrors,
  });

  if (!route) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-500">
        {recipeEmpty.kind === "error"
          ? recipeEmpty.message
          : emptyMessage ||
            "No process recipe yet. Configure Ollama Cloud or wait for public process literature."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Recipe
            {(pubchemCid || (traces && traces.length)) ? (
              <ApiProvenance
                pubchemCid={pubchemCid}
                traces={traces}
                title={`Process routes · ${route.name}`}
                label="API"
              />
            ) : null}
            {aiProvenance ? (
              <AiProvenance
                provenance={aiProvenance}
                field={`Process routes · ${route.name}`}
                label="AI"
                onRegenerate={onRegenerate}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {routes.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRouteId(r.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  r.id === route.id
                    ? "border-teal-500/50 bg-teal-500/10 text-teal-100"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                }`}
              >
                <div className="font-medium">
                  {routes.length > 1 ? (
                    <span className="mr-1.5 text-teal-500/80">{i + 1}.</span>
                  ) : null}
                  {r.name}
                </div>
                <div className="text-[11px] opacity-80">
                  {r.type} · {r.scaleClass}
                  {r.preference === 1 ? " · preferred" : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
        <ViewToggle value={view} onChange={setView} compact />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-sm leading-relaxed text-slate-300">{route.summary}</p>
        <div className="flex flex-wrap gap-2">
          <Tag>{route.type}</Tag>
          <Tag>{route.scaleClass} scale</Tag>
          {route.overallYieldTypical ? (
            <Tag>yield {route.overallYieldTypical}</Tag>
          ) : null}
        </div>
        {(route.advantages?.length || route.disadvantages?.length) ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {route.advantages && route.advantages.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-emerald-400/90">
                  Why this path
                </div>
                <ul className="list-inside list-disc space-y-0.5 text-slate-400">
                  {route.advantages.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {route.disadvantages && route.disadvantages.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-rose-400/90">
                  Watch-outs
                </div>
                <ul className="list-inside list-disc space-y-0.5 text-slate-400">
                  {route.disadvantages.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {route.materials.length > 0 ? (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <span className="text-teal-400/90">Ingredients</span>
            <span className="text-[11px] font-normal text-slate-600">
              bill of materials
            </span>
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">CAS</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {route.materials.map((m, i) => (
                  <tr key={i} className="bg-slate-950/40">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-teal-300/90">
                      {m.role}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-200">{m.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                      {m.cas ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{m.stoich ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {m.notes ?? m.puritySpec ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className="text-teal-400/90">Method</span>
          <span className="text-[11px] font-normal text-slate-600">
            {route.steps.length} step{route.steps.length === 1 ? "" : "s"}
          </span>
        </h3>
        {route.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => (
            <StepCard
              key={step.id}
              step={step}
              view={view}
              aiProvenance={aiProvenance}
              factHints={factHints}
              onRegenerate={onRegenerate}
              pubchemCid={pubchemCid}
              traces={traces}
            />
          ))}
      </div>

      {route.isolation ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
          <span className="font-medium text-slate-300">Finish · </span>
          {route.isolation}
        </div>
      ) : null}

      {route.scaleUp ? (
        <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold text-amber-200">Scale-up notes</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {route.scaleUp.labToKilo ? (
              <div>
                <dt className="text-xs text-amber-500/80">Lab → kilo</dt>
                <dd className="text-slate-300">{route.scaleUp.labToKilo}</dd>
              </div>
            ) : null}
            {route.scaleUp.kiloToPilot ? (
              <div>
                <dt className="text-xs text-amber-500/80">Kilo → pilot</dt>
                <dd className="text-slate-300">{route.scaleUp.kiloToPilot}</dd>
              </div>
            ) : null}
            {route.scaleUp.pilotToCommercial ? (
              <div>
                <dt className="text-xs text-amber-500/80">Pilot → commercial</dt>
                <dd className="text-slate-300">{route.scaleUp.pilotToCommercial}</dd>
              </div>
            ) : null}
            {route.scaleUp.safetyScaleUp ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-amber-500/80">Safety</dt>
                <dd className="text-slate-300">{route.scaleUp.safetyScaleUp}</dd>
              </div>
            ) : null}
            {route.scaleUp.greenChemistryNotes ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-amber-500/80">Green chemistry</dt>
                <dd className="text-slate-300">{route.scaleUp.greenChemistryNotes}</dd>
              </div>
            ) : null}
          </dl>
          {route.scaleUp.wasteStreams?.length ? (
            <p className="text-xs text-slate-400">
              Waste: {route.scaleUp.wasteStreams.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
