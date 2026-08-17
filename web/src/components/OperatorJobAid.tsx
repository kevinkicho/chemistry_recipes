"use client";

import { useMemo } from "react";
import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import type { ProcessStep, SourceRef } from "@/lib/types/process";
import { slimTraces } from "@/lib/api/trace";
import {
  formatProcessFactsEmptyCopy,
  formatSectionEmptyCopy,
  isStubOnlyProcessSequence,
  isProcessFactSourceRef,
  isProcessFactTrace,
  honestProcessFactsCountHeader,
} from "@/lib/dossier/sectionHonesty";

type StepEvidence = {
  step: ProcessStep;
  facts: ProcessFact[];
  /** Literature / patent / API refs with URLs */
  sources: SourceRef[];
  hasNumericConditions: boolean;
  conditionLines: string[];
  materialLines: string[];
  apparatusLines: string[];
  controlLines: string[];
  evidenceKind: "sourced-step" | "literature-lead" | "patent-lead" | "scaffold";
  plantBody: string;
};

function classifyStep(step: ProcessStep): StepEvidence["evidenceKind"] {
  const m = `${step.mechanismClass || ""} ${step.title || ""}`.toLowerCase();
  if (/patent process lead|patent/i.test(m)) return "patent-lead";
  if (/literature process lead|literature/i.test(m)) return "literature-lead";
  if (step.factIds?.length) return "sourced-step";
  if (step.conditions?.temperatureC || step.conditions?.time || step.conditions?.pressure) {
    return "sourced-step";
  }
  return "scaffold";
}

function conditionLines(step: ProcessStep, facts: ProcessFact[]): string[] {
  const lines: string[] = [];
  const c = step.conditions;
  if (c?.temperatureC) lines.push(`Temperature (public text): ${c.temperatureC}`);
  if (c?.time) lines.push(`Time (public text): ${c.time}`);
  if (c?.pressure) lines.push(`Pressure (public text): ${c.pressure}`);
  if (c?.ph) lines.push(`pH (public text): ${c.ph}`);
  if (c?.atmosphere) lines.push(`Atmosphere: ${c.atmosphere}`);
  if (c?.agitation) lines.push(`Agitation: ${c.agitation}`);
  if (c?.other) lines.push(c.other);

  for (const f of facts) {
    if (f.kind !== "condition" && f.kind !== "isolation" && f.kind !== "workup") continue;
    const val =
      f.value && f.unit
        ? `${f.value} ${f.unit}`
        : f.value || f.claim;
    if (val && !lines.some((l) => l.includes(val))) {
      lines.push(`${f.kind}: ${val}`);
    }
  }
  return lines;
}

function buildStepEvidence(
  step: ProcessStep,
  allFacts: ProcessFact[]
): StepEvidence {
  const facts = (step.factIds || [])
    .map((id) => allFacts.find((f) => f.id === id))
    .filter(Boolean) as ProcessFact[];

  // Also attach facts that quote-match the step body when factIds empty
  if (!facts.length && allFacts.length) {
    const hay = `${step.title} ${step.description}`.toLowerCase();
    for (const f of allFacts) {
      if (f.kind === "open-gap") continue;
      const needle = (f.claim || f.quote || "").slice(0, 40).toLowerCase();
      if (needle.length >= 12 && hay.includes(needle.slice(0, 24))) {
        facts.push(f);
      }
      if (facts.length >= 4) break;
    }
  }

  const sources: SourceRef[] = [...(step.sourceRefs || [])];
  for (const f of facts) {
    if (f.sourceUrl || f.sourceLabel) {
      sources.push({
        type:
          f.provenance === "patent"
            ? "patent"
            : f.provenance === "literature"
              ? "literature"
              : "api",
        id: f.sourceId || f.id,
        label: f.sourceLabel || f.sourceId,
        url: f.sourceUrl,
        note: f.quote?.slice(0, 160),
      });
    }
  }
  // de-dupe by url/label
  const seen = new Set<string>();
  const uniqueSources = sources.filter((s) => {
    const k = s.url || s.id || s.label || "";
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const conds = conditionLines(step, facts);
  const materialLines = (step.materials || []).map((m) => {
    const bits = [m.role, m.name, m.stoich, m.cas && `CAS ${m.cas}`].filter(Boolean);
    return bits.join(" · ");
  });
  const apparatusLines = (step.apparatus || []).map((a) => {
    const bits = [
      a.equipmentClass,
      a.materialOfConstruction,
      a.capacityHint,
      a.notes,
    ].filter(Boolean);
    return bits.join(" · ");
  });
  const controlLines = [
    ...(step.controls?.criticalParameters || []).map((x) => `CPP cue: ${x}`),
    ...(step.controls?.ipcMethods || []).map((x) => `IPC cue: ${x}`),
    ...(step.controls?.holdPoints || []).map((x) => `Hold: ${x}`),
    ...(step.controls?.cqaTargets || []).map((x) => `CQA cue: ${x}`),
  ];

  const plantBody =
    step.description?.trim() ||
    step.mechanismNotes?.trim() ||
    facts.map((f) => f.claim).filter(Boolean).join(" ") ||
    "";

  return {
    step,
    facts,
    sources: uniqueSources,
    hasNumericConditions: conds.length > 0,
    conditionLines: conds,
    materialLines,
    apparatusLines,
    controlLines,
    evidenceKind: classifyStep(step),
    plantBody,
  };
}

const KIND_BADGE: Record<
  StepEvidence["evidenceKind"],
  { label: string; cls: string }
> = {
  "sourced-step": {
    label: "Sourced step",
    cls: "bg-teal-50 text-teal-800 ring-teal-200",
  },
  "literature-lead": {
    label: "Literature lead",
    cls: "bg-sky-50 text-sky-900 ring-sky-200",
  },
  "patent-lead": {
    label: "Patent lead",
    cls: "bg-orange-50 text-orange-900 ring-orange-200",
  },
  scaffold: {
    label: "Scaffold / thin",
    cls: "bg-slate-100 text-slate-700 ring-slate-300",
  },
};

/**
 * Shift-brief style one-pager for operators / supervisors.
 * Surfaces real public evidence per step — does not invent plant numbers.
 */
export function OperatorJobAid({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const pf = dossier.processFacts;
  const framing = dossier.processFraming || pf?.framing || "evidence-lead-pack";
  const route = dossier.processRoutes[0];
  const allFacts = useMemo(() => pf?.facts || [], [pf?.facts]);
  const hazards = (dossier.hazards.hazardStatements || []).slice(0, 10);
  const precautions = (dossier.hazards.precautionaryStatements || []).slice(0, 6);
  const gaps = pf?.openGaps?.slice(0, 10) || [];
  const materials = route?.materials || [];

  const sequence = useMemo(() => {
    const steps = route?.steps || [];
    return steps.slice(0, 12).map((s) => buildStepEvidence(s, allFacts));
  }, [route?.steps, allFacts]);

  const sourcedCount = sequence.filter(
    (s) => s.hasNumericConditions || s.facts.length > 0 || s.sources.length > 0
  ).length;

  const conditionFacts = allFacts
    .filter(
      (f) =>
        f.kind === "condition" ||
        f.kind === "unit-op" ||
        f.kind === "isolation" ||
        f.kind === "workup"
    )
    .slice(0, 12);

  // Job aid is process-fact / public-sequence / GHS. Leftover identity
  // / annotation HTTP is not job-aid provenance, and the chip must
  // not live-fetch identity.
  const allTraces = slimTraces(dossier.traces || []);
  const traces = allTraces.filter((tr) =>
    isProcessFactTrace(tr.endpointUrl)
  );
  const sourceRefs = (dossier.sourceRefs || []).filter(isProcessFactSourceRef);
  const hazardEmpty = formatSectionEmptyCopy({
    family: "hazards",
    traces: allTraces,
    fetchErrors: dossier.fetchErrors,
  });
  const sequenceEmpty = formatProcessFactsEmptyCopy({
    traces: allTraces,
    fetchErrors: dossier.fetchErrors,
  });
  const factCounts = honestProcessFactsCountHeader({
    conditionCount: pf?.sourcedConditionCount ?? 0,
    unitOpCount: pf?.unitOpCount ?? 0,
    traces: allTraces,
    fetchErrors: dossier.fetchErrors,
  });
  // Cached await-ai / await-facts stubs are not a public sequence.
  // Harvest failure is not "No public sequence available".
  const showSequence =
    sequence.length > 0 &&
    !(
      isStubOnlyProcessSequence(sequence.map((ev) => ev.step)) &&
      sequenceEmpty.kind === "error"
    );

  return (
    <div
      id="operator-job-aid"
      className="operator-job-aid scroll-mt-24 rounded-xl border border-slate-800 bg-white/95 p-5 text-slate-900 shadow-sm print:border-slate-400 print:shadow-none"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Operator / supervisor job aid
            </p>
            <ContentProvenance
              title="Operator job aid"
              field="Operator job aid"
              traces={traces}
              sourceRefs={sourceRefs}
              ai={dossier.synthesis.provenance}
              showAi={Boolean(dossier.synthesis.provenance)}
              onRegenerate={onRegenerate}
            />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {dossier.identity?.name || `CID ${dossier.cid}`}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-slate-600">
            {dossier.identity?.cas ? `CAS ${dossier.identity.cas} · ` : ""}
            CID {dossier.cid}
            {dossier.identity?.formula ? ` · ${dossier.identity.formula}` : ""}
          </p>
          {route?.name ? (
            <p className="mt-1 text-xs font-medium text-slate-700">{route.name}</p>
          ) : null}
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
          <p className="mt-1 text-slate-500">
            {sourcedCount}/{sequence.length || 0} steps with public evidence · accuracy{" "}
            {pf?.metrics?.accuracyScore ?? "—"}/100
          </p>
          <p className="mt-0.5 text-slate-500 print:hidden">Use Print / PDF for handout</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        Educational public-evidence brief only.{" "}
        <strong className="font-semibold">Not</strong> a batch record, SOP, or GMP
        procedure. Every number below is either extracted from free-public text or
        explicitly marked missing — verify against primary sources and site QMS before
        any plant work.
      </p>

      {route?.summary ? (
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-800">Route summary: </span>
          {route.summary}
        </p>
      ) : null}

      {/* BOM if present */}
      {materials.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Materials (public BOM cues)
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[20rem] text-left text-xs">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2.5 py-1.5">Role</th>
                  <th className="px-2.5 py-1.5">Name</th>
                  <th className="px-2.5 py-1.5">Stoich / notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.slice(0, 16).map((m, i) => (
                  <tr key={`${m.name}-${i}`}>
                    <td className="px-2.5 py-1.5 font-medium text-slate-600">
                      {m.role}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-900">
                      {m.name}
                      {m.cas ? (
                        <span className="ml-1 font-mono text-[10px] text-slate-500">
                          {m.cas}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-600">
                      {[m.stoich, m.puritySpec, m.notes].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Detailed sequence */}
      <section className="mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Public sequence (evidence per step)
        </h3>
        {showSequence ? (
          <ol className="mt-2 space-y-3">
            {sequence.map((ev, idx) => {
              const badge = KIND_BADGE[ev.evidenceKind];
              return (
                <li
                  key={ev.step.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/80 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="mr-2 font-mono text-[11px] text-slate-500">
                        {idx + 1}.
                      </span>
                      <span className="font-semibold text-slate-900">
                        {ev.step.title}
                      </span>
                      {ev.step.mechanismClass ? (
                        <span className="ml-2 text-[11px] text-slate-500">
                          {ev.step.mechanismClass}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {ev.plantBody ? (
                    <p className="mt-2 text-xs leading-relaxed text-slate-700">
                      {ev.plantBody.length > 500
                        ? `${ev.plantBody.slice(0, 500)}…`
                        : ev.plantBody}
                    </p>
                  ) : null}

                  {/* Conditions — only when real */}
                  {ev.hasNumericConditions ? (
                    <div className="mt-2 rounded-md border border-teal-200 bg-teal-50/80 px-2.5 py-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                        Conditions in public text
                      </p>
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-teal-900">
                        {ev.conditionLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-950">
                      <strong className="font-semibold">No numeric plant setpoints</strong>{" "}
                      in free-public extraction for this step
                      {ev.evidenceKind === "literature-lead" ||
                      ev.evidenceKind === "patent-lead"
                        ? " — this row is a literature/patent lead, not a verified procedure."
                        : "."}{" "}
                      Open the primary source below for experimental detail. Do not invent
                      T / t / P from the title alone.
                    </div>
                  )}

                  {ev.materialLines.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Materials
                      </p>
                      <ul className="mt-0.5 list-inside list-disc text-[11px] text-slate-700">
                        {ev.materialLines.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {ev.apparatusLines.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Apparatus cues
                      </p>
                      <ul className="mt-0.5 list-inside list-disc text-[11px] text-slate-700">
                        {ev.apparatusLines.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {ev.controlLines.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Control cues (public)
                      </p>
                      <ul className="mt-0.5 list-inside list-disc text-[11px] text-slate-700">
                        {ev.controlLines.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/* Fact quotes */}
                  {ev.facts.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Supporting public claims
                      </p>
                      {ev.facts.slice(0, 4).map((f) => (
                        <blockquote
                          key={f.id}
                          className="rounded border-l-2 border-slate-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-700"
                        >
                          <span className="font-medium text-slate-900">{f.claim}</span>
                          {f.quote ? (
                            <span className="mt-0.5 block italic text-slate-600">
                              “{f.quote.slice(0, 220)}
                              {f.quote.length > 220 ? "…" : ""}”
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-[10px] text-slate-500">
                            {f.sourceLabel}
                            {f.provenance ? ` · ${f.provenance}` : ""}
                            {f.sourceUrl ? (
                              <>
                                {" · "}
                                <a
                                  href={f.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-teal-700 underline"
                                >
                                  open source
                                </a>
                              </>
                            ) : null}
                          </span>
                        </blockquote>
                      ))}
                    </div>
                  ) : null}

                  {/* Primary sources */}
                  {ev.sources.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ev.sources.slice(0, 5).map((s) =>
                        s.url ? (
                          <a
                            key={s.id || s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex max-w-full items-center rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-slate-700"
                            title={s.note || s.label}
                          >
                            <span className="truncate">
                              {s.type}: {s.label || s.id}
                            </span>
                          </a>
                        ) : (
                          <span
                            key={s.id || s.label}
                            className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[10px] text-slate-700"
                          >
                            {s.type}: {s.label || s.id}
                          </span>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] text-slate-500">
                      No deep-linkable primary source attached to this step — use the
                      literature / patents tables on this dossier.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            {sequenceEmpty.kind === "error"
              ? sequenceEmpty.message
              : "No public sequence available. Re-run the live dossier build or open literature / patents panels for process leads."}
          </p>
        )}
      </section>

      {/* Cross-cutting public conditions from process facts */}
      {conditionFacts.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Extracted public conditions & unit ops (all sources)
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2.5 py-1.5">Kind</th>
                  <th className="px-2.5 py-1.5">Claim</th>
                  <th className="px-2.5 py-1.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conditionFacts.map((f) => (
                  <tr key={f.id}>
                    <td className="px-2.5 py-1.5 font-medium text-slate-600">
                      {f.kind}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-900">
                      {f.claim}
                      {f.value ? (
                        <span className="ml-1 font-mono text-teal-800">
                          {f.value}
                          {f.unit ? ` ${f.unit}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-600">
                      {f.sourceUrl ? (
                        <a
                          href={f.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 underline"
                        >
                          {f.sourceLabel}
                        </a>
                      ) : (
                        f.sourceLabel
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800">
            Handling / EHS (public)
          </h3>
          {dossier.hazards.signalWord ? (
            <p className="mt-1 text-xs font-semibold text-rose-900">
              Signal word: {dossier.hazards.signalWord}
            </p>
          ) : null}
          <ul className="mt-2 space-y-1 text-xs text-slate-800">
            {hazards.length ? (
              hazards.map((h) => (
                <li key={h} className="flex gap-1.5">
                  <span className="shrink-0 font-bold text-rose-600">H</span>
                  <span>{h}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-500">{hazardEmpty.message}</li>
            )}
            {precautions.slice(0, 4).map((p) => (
              <li key={p} className="flex gap-1.5">
                <span className="shrink-0 font-bold text-amber-700">P</span>
                <span>{p}</span>
              </li>
            ))}
            {(pf?.managerRisks || []).slice(0, 5).map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="text-amber-600">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Site owner must fill (not public)
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            {(gaps.length
              ? gaps
              : [
                  "Validated CPP / IPC limits under site QMS",
                  "Equipment train and capacity for intended scale",
                  "Hold times, cleaning, and change control",
                  "Primary experimental procedure from literature or internal knowledge",
                ]
            ).map((g) => (
              <li key={g} className="flex gap-1.5">
                <span className="text-slate-400">□</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="mt-4 border-t border-slate-200 pt-2 text-[10px] leading-relaxed text-slate-500">
        Generated {new Date(dossier.generatedAt).toLocaleString()} · Chemistry Recipes
        public process brief · framing{" "}
        <span className="font-medium">{framing}</span> · process facts{" "}
        {factCounts.value}
        {factCounts.harvestFail ? null : (
          <>
            {" "}· accuracy {pf?.metrics?.accuracyScore ?? "—"}/100
          </>
        )}{" "}· Not GMP
      </p>
    </div>
  );
}
