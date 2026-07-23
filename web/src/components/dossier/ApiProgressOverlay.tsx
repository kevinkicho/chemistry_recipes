"use client";

import { useEffect, useMemo, useState } from "react";
import type { DossierProgressEvent } from "@/lib/dossier/progress";
import { formatMs } from "@/lib/dossier/progress";

export interface ApiProgressOverlayProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  events: DossierProgressEvent[];
  /** Live wall-clock ms while running */
  elapsedMs: number;
  error?: string | null;
  onCancel?: () => void;
}

/** Friendly recipe-step labels (hide API jargon from the default view). */
const RECIPE_STEPS: Array<{
  id: string;
  title: string;
  hint: string;
}> = [
  {
    id: "gather",
    title: "Gather ingredients",
    hint: "Multi-API: PubChem, ChEMBL, openFDA, literature, patents…",
  },
  {
    id: "score",
    title: "Check the pantry",
    hint: "How much multi-source process evidence we have",
  },
  {
    id: "scaffold",
    title: "Draft the recipe card",
    hint: "Shell from public sources only",
  },
  {
    id: "ollama",
    title: "Cook dual-view routes",
    hint: "Mechanism + manufacturing steps",
  },
];

type StepState = "pending" | "active" | "done" | "error" | "skipped";

function resolveStepStates(events: DossierProgressEvent[]): {
  states: Record<string, StepState>;
  currentId: string | null;
  currentLabel: string | null;
} {
  const states: Record<string, StepState> = {};
  for (const s of RECIPE_STEPS) states[s.id] = "pending";

  let currentId: string | null = null;
  let currentLabel: string | null = null;

  for (const ev of events) {
    const id = ev.stepId;
    if (!id || !(id in states)) {
      if (ev.type === "complete") {
        for (const s of RECIPE_STEPS) {
          if (states[s.id] === "active" || states[s.id] === "pending") {
            // leave skipped only if never started; mark incomplete pending as done if complete
          }
        }
      }
      continue;
    }

    if (ev.type === "step_start") {
      states[id] = "active";
      currentId = id;
      currentLabel = ev.label || null;
    } else if (ev.type === "step_done") {
      states[id] = ev.ok === false ? "error" : "done";
      if (currentId === id) currentId = null;
    } else if (ev.type === "step_error") {
      states[id] = "error";
      if (currentId === id) currentId = null;
    } else if (ev.type === "log" && states[id] === "active") {
      currentLabel = ev.label || currentLabel;
    }
  }

  // If pipeline completed, pending never-started → skipped; active → done
  const finished = events.some((e) => e.type === "complete");
  if (finished) {
    for (const s of RECIPE_STEPS) {
      if (states[s.id] === "pending") states[s.id] = "skipped";
      if (states[s.id] === "active") states[s.id] = "done";
    }
    currentId = null;
  }

  // Ollama skip often arrives as step_done with skip detail
  const ollamaDone = events.find(
    (e) => e.stepId === "ollama" && (e.type === "step_done" || e.type === "step_error")
  );
  if (ollamaDone?.detail && /skipped/i.test(ollamaDone.detail)) {
    states.ollama = ollamaDone.ok === false ? "error" : "skipped";
  }

  return { states, currentId, currentLabel };
}

function stepIcon(state: StepState): string {
  switch (state) {
    case "done":
      return "✓";
    case "error":
      return "!";
    case "active":
      return "→";
    case "skipped":
      return "–";
    default:
      return "";
  }
}

/**
 * Simple recipe-style progress while the dossier is built.
 * Technical HTTP details stay behind an optional toggle.
 */
export function ApiProgressOverlay({
  open,
  title = "Preparing recipe",
  subtitle,
  events,
  elapsedMs,
  error,
  onCancel,
}: ApiProgressOverlayProps) {
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setShowLog(false);
  }, [open]);

  const { states, currentId, currentLabel } = useMemo(
    () => resolveStepStates(events),
    [events]
  );

  if (!open) return null;

  const latest = events[events.length - 1];
  let stepsTotal = RECIPE_STEPS.length;
  let stepsDone = 0;
  for (const ev of events) {
    if (typeof ev.stepsTotal === "number" && ev.stepsTotal > 0) {
      stepsTotal = Math.min(ev.stepsTotal, RECIPE_STEPS.length) || RECIPE_STEPS.length;
    }
    if (typeof ev.stepsDone === "number" && ev.stepsDone > stepsDone) {
      stepsDone = ev.stepsDone;
    }
  }
  // Prefer counting recipe steps for display
  const recipeDone = RECIPE_STEPS.filter(
    (s) => states[s.id] === "done" || states[s.id] === "skipped"
  ).length;
  const recipeActive = RECIPE_STEPS.some((s) => states[s.id] === "active");
  const displayDone = recipeActive
    ? recipeDone + 0.4
    : Math.max(recipeDone, Math.min(stepsDone, RECIPE_STEPS.length));
  const pct = Math.min(
    100,
    Math.round((displayDone / RECIPE_STEPS.length) * 100)
  );

  const running =
    !error &&
    latest?.type !== "complete" &&
    latest?.type !== "error" &&
    (recipeActive || latest?.type === "hello" || latest?.type === "log");

  const currentRecipe = RECIPE_STEPS.find((s) => s.id === currentId);
  const headline =
    currentRecipe?.title ||
    (error ? "Something went wrong" : running ? "Working…" : "Almost ready");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-busy={running}
      aria-labelledby="recipe-progress-title"
    >
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" aria-hidden />

      <div className="relative z-[201] flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/60">
        <header className="shrink-0 border-b border-slate-800 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                    error
                      ? "bg-rose-400"
                      : running
                        ? "animate-pulse bg-teal-400"
                        : "bg-emerald-400"
                  }`}
                />
                <h2
                  id="recipe-progress-title"
                  className="text-lg font-semibold tracking-tight text-slate-50"
                >
                  {title}
                </h2>
              </div>
              <p className="mt-1.5 text-sm text-slate-400">
                {subtitle || "Assembling a process recipe from free public sources"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-base tabular-nums text-teal-300">
                {formatMs(elapsedMs)}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
              <span className="truncate text-slate-300">
                {error ? "Failed" : headline}
                {currentLabel && running && !currentRecipe ? (
                  <span className="text-slate-500"> · {currentLabel}</span>
                ) : null}
              </span>
              <span className="ml-2 shrink-0 tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all duration-500"
                style={{ width: `${error ? Math.max(pct, 8) : pct}%` }}
              />
            </div>
          </div>
        </header>

        <div className="px-5 py-5">
          {error ? (
            <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {/* Simple numbered recipe steps */}
          <ol className="space-y-0">
            {RECIPE_STEPS.map((step, index) => {
              const state = states[step.id] || "pending";
              const isActive = state === "active";
              const isDone = state === "done";
              const isErr = state === "error";
              const isSkip = state === "skipped";

              return (
                <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < RECIPE_STEPS.length - 1 ? (
                    <span
                      className={`absolute left-[0.95rem] top-8 h-[calc(100%-1.25rem)] w-px ${
                        isDone || isSkip
                          ? "bg-teal-500/40"
                          : isActive
                            ? "bg-teal-500/20"
                            : "bg-slate-800"
                      }`}
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-2 ring-offset-2 ring-offset-slate-950 ${
                      isDone
                        ? "bg-teal-500/20 text-teal-200 ring-teal-500/40"
                        : isActive
                          ? "animate-pulse bg-teal-500/25 text-teal-100 ring-teal-400/50"
                          : isErr
                            ? "bg-rose-500/20 text-rose-200 ring-rose-500/40"
                            : isSkip
                              ? "bg-slate-800 text-slate-500 ring-slate-700"
                              : "bg-slate-900 text-slate-500 ring-slate-800"
                    }`}
                  >
                    {stepIcon(state) || index + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <div
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-teal-100"
                          : isDone
                            ? "text-slate-200"
                            : isErr
                              ? "text-rose-200"
                              : "text-slate-500"
                      }`}
                    >
                      {step.title}
                      {isSkip ? (
                        <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-slate-600">
                          skipped
                        </span>
                      ) : null}
                      {isActive ? (
                        <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-teal-400/80">
                          now
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{step.hint}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setShowLog((v) => !v)}
              className="text-[11px] text-slate-500 hover:text-slate-300"
            >
              {showLog ? "Hide technical log" : "Show technical log"}
            </button>
            {showLog ? (
              <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto text-[11px] text-slate-500">
                {[...events].reverse().slice(0, 24).map((ev, i) => (
                  <li
                    key={`${ev.type}-${ev.t}-${i}`}
                    className="rounded border border-slate-800/80 bg-slate-900/40 px-2 py-1.5"
                  >
                    <span className="text-slate-400">{ev.label || ev.type}</span>
                    {ev.detail ? (
                      <span className="mt-0.5 block line-clamp-1 text-slate-600">
                        {ev.detail}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 px-5 py-3 text-[11px] text-slate-600">
          <span>Like a recipe card — free public sources only, no invented steps.</span>
          {onCancel && error ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:bg-slate-900"
            >
              Retry
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
