"use client";

import { useCallback, useEffect, useState } from "react";
import {
  densifyTelemetrySummary,
  listDensifyRuns,
  subscribeDensifyTelemetry,
  type DensifyRunRecord,
} from "@/lib/dossier/densifyTelemetry";

/**
 * Local densify/batch run observability (concurrency, ok/fail, duration).
 */
export function DensifyTelemetryPanel() {
  const [runs, setRuns] = useState<DensifyRunRecord[]>([]);
  const [summary, setSummary] = useState(densifyTelemetrySummary());

  const reload = useCallback(() => {
    setRuns(listDensifyRuns().slice(0, 12));
    setSummary(densifyTelemetrySummary());
  }, []);

  useEffect(() => {
    reload();
    return subscribeDensifyTelemetry(reload);
  }, [reload]);

  if (!runs.length) {
    return (
      <div
        id="densify-telemetry"
        className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-[11px] text-slate-600"
      >
        No densify telemetry yet — run stream batch densify to record concurrency and
        timings (local only).
      </div>
    );
  }

  return (
    <div
      id="densify-telemetry"
      className="scroll-mt-24 rounded-xl border border-slate-700 bg-slate-900/40 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Densify telemetry (local)
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-100">
        Batch / agent densify runs
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Observability only — not a GMP audit trail. Stored in this browser.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div className="rounded border border-slate-800 px-2 py-1.5">
          <dt className="text-slate-600">Runs</dt>
          <dd className="font-mono text-slate-200">{summary.runs}</dd>
        </div>
        <div className="rounded border border-slate-800 px-2 py-1.5">
          <dt className="text-slate-600">OK / fail</dt>
          <dd className="font-mono text-slate-200">
            {summary.totalOk} / {summary.totalFail}
          </dd>
        </div>
        <div className="rounded border border-slate-800 px-2 py-1.5">
          <dt className="text-slate-600">Avg duration</dt>
          <dd className="font-mono text-slate-200">
            {Math.round(summary.avgDurationMs / 1000)}s
          </dd>
        </div>
        <div className="rounded border border-slate-800 px-2 py-1.5">
          <dt className="text-slate-600">Last concurrency</dt>
          <dd className="font-mono text-slate-200">
            {summary.lastConcurrency ?? "—"}
          </dd>
        </div>
      </dl>
      <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto font-mono text-[10px] text-slate-500">
        {runs.map((r) => (
          <li key={r.id}>
            {r.at.slice(0, 19)} · {r.kind} · c={r.concurrency ?? "—"} · {r.ok}ok/
            {r.fail}fail · {Math.round(r.durationMs / 1000)}s · [
            {r.cids.slice(0, 6).join(",")}
            {r.cids.length > 6 ? "…" : ""}]
          </li>
        ))}
      </ul>
    </div>
  );
}
