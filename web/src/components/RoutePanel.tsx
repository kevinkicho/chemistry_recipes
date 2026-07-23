"use client";

import { useState } from "react";
import { AiProvenance } from "@/components/AiProvenance";
import type { AiProvenanceRecord } from "@/lib/dossier/types";
import type { ProcessRoute, ProcessStep } from "@/lib/types/process";
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

function StepCard({
  step,
  view,
  aiProvenance,
}: {
  step: ProcessStep;
  view: AudienceView;
  aiProvenance?: AiProvenanceRecord | null;
}) {
  const showMech = view === "mechanism" || view === "dual";
  const showMfg = view === "manufacturing" || view === "dual";

  const critical = cleanLines(step.controls?.criticalParameters);
  const ipc = cleanLines(step.controls?.ipcMethods);
  const cqa = cleanLines(step.controls?.cqaTargets);
  const envNotes = step.environment?.notes && !isJunkLine(step.environment.notes)
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
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-300">
          {step.order}
        </span>
        <h4 className="font-semibold text-slate-100">{step.title}</h4>
        {step.mechanismClass && showMech ? <Tag>{step.mechanismClass}</Tag> : null}
        {aiProvenance ? (
          <AiProvenance
            provenance={aiProvenance}
            field={`Route step: ${step.title}`}
            label="AI"
          />
        ) : null}
      </header>

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
                Mechanism / R&amp;D
              </div>
            ) : null}
            <p className="text-sm leading-relaxed text-slate-300">{step.description}</p>
            {mechNotes ? (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <div className="mb-1 text-xs font-medium text-violet-300">Mechanism notes</div>
                <p className="text-sm leading-relaxed text-slate-300">{mechNotes}</p>
              </div>
            ) : null}
            {step.conditions ? (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(step.conditions).map(([k, v]) =>
                  v && !isJunkLine(String(v)) ? (
                    <div key={k} className="rounded bg-slate-950/60 px-2 py-1.5">
                      <dt className="capitalize text-slate-500">
                        {k.replace(/([A-Z])/g, " $1")}
                      </dt>
                      <dd className="mt-0.5 text-slate-200">{v}</dd>
                    </div>
                  ) : null
                )}
              </dl>
            ) : null}
            {step.materials && step.materials.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">Materials (step)</div>
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
                Manufacturing / plant
              </div>
            ) : null}
            {view === "manufacturing" ? (
              <p className="text-sm leading-relaxed text-slate-300">{step.description}</p>
            ) : null}
            {!hasMfgBody && view === "dual" ? (
              <p className="text-xs leading-relaxed text-slate-500">
                Plant apparatus, environment, and IPC/CQAs appear here when process evidence or AI
                synthesis provides them — placeholders are omitted.
              </p>
            ) : null}
            {hasApparatus ? (
              <div>
                <div className="mb-1.5 text-xs font-medium text-slate-500">Apparatus</div>
                <ul className="space-y-1">
                  {step.apparatus!.map((a, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline gap-x-2 text-sm text-slate-300"
                    >
                      <code className="text-xs text-teal-300/90">{a.equipmentClass}</code>
                      {a.materialOfConstruction ? (
                        <span className="text-xs text-slate-500">{a.materialOfConstruction}</span>
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
                  <p className="text-slate-300">Atmosphere: {step.environment!.atmosphere}</p>
                ) : null}
                {step.environment!.containment ? (
                  <p className="text-slate-300">Containment: {step.environment!.containment}</p>
                ) : null}
                {step.environment!.atexZone ? (
                  <p className="text-slate-300">ATEX / zoning: {step.environment!.atexZone}</p>
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
              <div className="space-y-2 text-sm">
                {critical?.length ? (
                  <div>
                    <div className="text-xs font-medium text-slate-500">Critical parameters</div>
                    <p className="text-slate-300">{critical.join(" · ")}</p>
                  </div>
                ) : null}
                {ipc?.length ? (
                  <div>
                    <div className="text-xs font-medium text-slate-500">IPC</div>
                    <p className="text-slate-300">{ipc.join(" · ")}</p>
                  </div>
                ) : null}
                {cqa?.length ? (
                  <div>
                    <div className="text-xs font-medium text-slate-500">CQA targets</div>
                    <ul className="list-inside list-disc text-slate-300">
                      {cqa.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {step.scaleNotes && !isJunkLine(step.scaleNotes) ? (
              <p className="border-l-2 border-amber-500/40 pl-2 text-xs text-amber-200/80">
                Scale-up: {step.scaleNotes}
              </p>
            ) : null}
            {step.workup ? (
              <p className="text-xs text-slate-400">Workup: {step.workup}</p>
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
}: {
  routes: ProcessRoute[];
  emptyMessage?: string;
  /** When set, every AI-generated route/step shows an AI provenance chip */
  aiProvenance?: AiProvenanceRecord | null;
}) {
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const [view, setView] = useState<AudienceView>("dual");
  const route = routes.find((r) => r.id === routeId) ?? routes[0];

  if (!route) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-500">
        {emptyMessage ||
          "No process routes synthesized yet. Ensure Ollama Cloud is configured and public literature/manufacturing evidence exists for this compound."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Process route
            {aiProvenance ? (
              <AiProvenance
                provenance={aiProvenance}
                field={`Process routes · ${route.name}`}
                label="AI"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => (
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
                <div className="font-medium">{r.name}</div>
                <div className="text-[11px] opacity-80">
                  {r.type} · {r.scaleClass}
                  {r.preference === 1 ? " · preferred" : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="text-sm leading-relaxed text-slate-300">{route.summary}</p>
        <div className="flex flex-wrap gap-2">
          <Tag>{route.type}</Tag>
          <Tag>scale: {route.scaleClass}</Tag>
          {route.overallYieldTypical ? <Tag>yield: {route.overallYieldTypical}</Tag> : null}
        </div>
        {(route.advantages || route.disadvantages) && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {route.advantages && route.advantages.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-emerald-400/90">Advantages</div>
                <ul className="list-inside list-disc space-y-0.5 text-slate-400">
                  {route.advantages.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {route.disadvantages && route.disadvantages.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-medium text-rose-400/90">Trade-offs</div>
                <ul className="list-inside list-disc space-y-0.5 text-slate-400">
                  {route.disadvantages.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {route.materials.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Bill of materials</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">CAS</th>
                  <th className="px-3 py-2">Stoich</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {route.materials.map((m, i) => (
                  <tr key={i} className="bg-slate-950/40">
                    <td className="whitespace-nowrap px-3 py-2 text-teal-300/90">{m.role}</td>
                    <td className="px-3 py-2 text-slate-200">{m.name}</td>
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
        <h3 className="text-sm font-semibold text-slate-200">Process steps</h3>
        {route.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => (
            <StepCard
              key={step.id}
              step={step}
              view={view}
              aiProvenance={aiProvenance}
            />
          ))}
      </div>

      {route.scaleUp ? (
        <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold text-amber-200">Scale-up envelope</h3>
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
            {route.scaleUp.heatMassTransfer ? (
              <div>
                <dt className="text-xs text-amber-500/80">Heat / mass transfer</dt>
                <dd className="text-slate-300">{route.scaleUp.heatMassTransfer}</dd>
              </div>
            ) : null}
            {route.scaleUp.safetyScaleUp ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-amber-500/80">Process safety</dt>
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
          {route.scaleUp.wasteStreams ? (
            <p className="text-xs text-slate-400">
              Waste streams: {route.scaleUp.wasteStreams.join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {route.isolation ? (
        <p className="text-sm text-slate-400">
          <span className="font-medium text-slate-300">Isolation: </span>
          {route.isolation}
        </p>
      ) : null}
    </div>
  );
}
