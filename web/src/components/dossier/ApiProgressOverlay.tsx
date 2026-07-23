"use client";

import { useEffect } from "react";
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

function statusIcon(type: DossierProgressEvent["type"], ok?: boolean): string {
  if (type === "step_start" || type === "hello" || type === "log") return "…";
  if (type === "complete") return "✓";
  if (type === "error" || type === "step_error") return "!";
  if (type === "step_done") return ok === false ? "!" : "✓";
  return "·";
}

function statusColor(type: DossierProgressEvent["type"], ok?: boolean): string {
  if (type === "step_start" || type === "hello" || type === "log") return "text-sky-300";
  if (type === "complete") return "text-emerald-300";
  if (type === "error" || type === "step_error" || ok === false) return "text-rose-300";
  return "text-emerald-300";
}

/**
 * Full-screen freeze overlay while multi-API dossier transactions run.
 * Explains each call, elapsed time, status, and response previews in realtime.
 */
export function ApiProgressOverlay({
  open,
  title = "Building live dossier",
  subtitle,
  events,
  elapsedMs,
  error,
  onCancel,
}: ApiProgressOverlayProps) {
  // Freeze page scroll / interaction under overlay
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const latest = events[events.length - 1];

  // Progress must be monotonic. Heartbeat `log` events (e.g. Ollama stream)
  // often omit stepsDone — never treat missing as 0 or the bar resets mid-run.
  let stepsTotal = 7;
  let stepsDone = 0;
  for (const ev of events) {
    if (typeof ev.stepsTotal === "number" && ev.stepsTotal > 0) {
      stepsTotal = ev.stepsTotal;
    }
    if (typeof ev.stepsDone === "number" && ev.stepsDone > stepsDone) {
      stepsDone = ev.stepsDone;
    }
  }
  // While a step is in flight, show fractional progress into the next slot
  // without dropping the completed count.
  const inFlight =
    latest?.type === "step_start" || latest?.type === "log" || latest?.type === "hello";
  const displayDone =
    latest?.type === "complete"
      ? stepsTotal
      : inFlight && stepsDone < stepsTotal
        ? stepsDone + 0.35
        : stepsDone;
  const pct = Math.min(
    100,
    Math.round((displayDone / Math.max(1, stepsTotal)) * 100)
  );

  const running = inFlight && latest?.type !== "complete" && latest?.type !== "error";

  // Reverse chronological for feed, keep step timeline chronological below
  const feed = [...events].reverse();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-busy={running}
      aria-labelledby="api-progress-title"
    >
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm" aria-hidden />

      <div className="relative z-[201] flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/60">
        <header className="shrink-0 border-b border-slate-800 px-4 py-4 sm:px-5">
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
                  id="api-progress-title"
                  className="text-base font-semibold tracking-tight text-slate-50"
                >
                  {title}
                </h2>
              </div>
              {subtitle ? (
                <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-lg tabular-nums text-teal-300">
                {formatMs(elapsedMs)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600">elapsed</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>
                Step {Math.min(stepsDone, stepsTotal)} / {stepsTotal}
                {inFlight && stepsDone < stepsTotal ? " · in progress" : ""}
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-600 to-sky-500 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {latest?.label ? (
            <p className="mt-3 text-xs text-slate-400">
              <span className="text-slate-600">Current: </span>
              <span className="text-slate-200">{latest.label}</span>
              {latest.detail ? (
                <span className="mt-0.5 block text-slate-500 line-clamp-2">{latest.detail}</span>
              ) : null}
            </p>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {error ? (
            <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <ol className="space-y-2">
            {feed.map((ev, i) => {
              // Stable-ish key from content
              const key = `${ev.type}-${ev.stepId ?? ""}-${ev.t}-${i}`;
              return (
                <li
                  key={key}
                  className="rounded-xl border border-slate-800/90 bg-slate-900/50 px-3 py-2.5"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold ${statusColor(
                        ev.type,
                        ev.ok
                      )}`}
                    >
                      {statusIcon(ev.type, ev.ok)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-slate-100">
                          {ev.label || ev.type}
                        </span>
                        {ev.organization ? (
                          <span className="text-[10px] text-slate-600">{ev.organization}</span>
                        ) : null}
                        <span className="ml-auto font-mono text-[10px] tabular-nums text-slate-600">
                          +{formatMs(ev.t)}
                          {ev.durationMs != null ? ` · ${formatMs(ev.durationMs)}` : ""}
                        </span>
                      </div>

                      {ev.endpointUrl ? (
                        <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-sky-400/80 [overflow-wrap:anywhere]">
                          {ev.method ? `${ev.method} ` : ""}
                          {ev.endpointUrl}
                        </p>
                      ) : null}

                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                        {ev.httpStatus != null ? (
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono ring-1 ring-inset ${
                              ev.ok === false || (ev.httpStatus >= 400)
                                ? "bg-rose-500/10 text-rose-300 ring-rose-500/25"
                                : "bg-slate-800 text-slate-400 ring-slate-700"
                            }`}
                          >
                            HTTP {ev.httpStatus}
                          </span>
                        ) : null}
                        {ev.hits != null ? (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400 ring-1 ring-slate-700">
                            {ev.hits} hit{ev.hits === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {ev.type === "step_start" ? (
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-300 ring-1 ring-sky-500/25">
                            in flight
                          </span>
                        ) : null}
                      </div>

                      {ev.detail ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{ev.detail}</p>
                      ) : null}

                      {ev.responsePreview ? (
                        <pre className="mt-2 max-h-24 overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 p-2 font-mono text-[10px] leading-relaxed text-slate-500 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {ev.responsePreview}
                        </pre>
                      ) : null}

                      {ev.error ? (
                        <p className="mt-1 text-xs text-rose-300">{ev.error}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-600 sm:px-5">
          <span>Screen frozen until free public APIs + Ollama finish. No mock data.</span>
          {onCancel && error ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-900"
            >
              Dismiss
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
