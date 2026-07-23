"use client";

import Link from "next/link";
import type { LiveDossier } from "@/lib/dossier/types";
import { summarizeDossierDiagnostics } from "@/lib/diagnostics/clientAnalytics";
import { routes } from "@/lib/routes";

/**
 * Compact per-dossier health strip for operators / power users.
 */
export function DossierDiagnostics({ dossier }: { dossier: LiveDossier }) {
  const d = summarizeDossierDiagnostics(dossier);
  const healthy = d.apiFail === 0 && (d.apiOk > 0 || d.literatureCount > 0);

  return (
    <div
      id="diagnostics"
      className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Build diagnostics</h2>
        <Link
          href={routes.diagnostics()}
          className="text-[11px] text-teal-400 hover:underline"
        >
          Full system diagnostics →
        </Link>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Snapshot of free-API HTTP + evidence for this recipe (no secrets).
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="HTTP calls"
          value={`${d.apiOk}/${d.apiTotal} ok`}
          tone={d.apiFail ? "warn" : healthy ? "ok" : "muted"}
        />
        <Stat
          label="Evidence score"
          value={
            d.evidenceScore != null
              ? `${d.evidenceScore} · ${d.confidence || "—"}`
              : "—"
          }
          tone={
            d.evidenceScore != null && d.evidenceScore >= 40
              ? "ok"
              : d.evidenceScore != null
                ? "warn"
                : "muted"
          }
        />
        <Stat
          label="Literature / patents"
          value={`${d.literatureCount} · ${d.patentCount}`}
          tone={d.literatureCount + d.patentCount > 0 ? "ok" : "muted"}
        />
        <Stat
          label="Multi-source APIs"
          value={
            d.annotationCount
              ? `${d.annotationCount} · ${d.annotationSources.slice(0, 3).join(", ")}`
              : "none yet"
          }
          tone={d.annotationCount ? "ok" : "muted"}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
        {d.buildMode ? (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
            mode {d.buildMode}
          </span>
        ) : null}
        {d.model ? (
          <span className="rounded bg-violet-500/10 px-2 py-0.5 text-violet-200">
            model {d.model}
          </span>
        ) : null}
        {d.durationMs != null ? (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
            {(d.durationMs / 1000).toFixed(1)}s build
          </span>
        ) : null}
        {d.apiFail > 0 ? (
          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-rose-200">
            {d.apiFail} failed call(s)
          </span>
        ) : null}
      </div>

      {d.hosts.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-[11px] text-slate-400">
            <thead className="text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="py-1 pr-2">Host</th>
                <th className="py-1 pr-2">OK</th>
                <th className="py-1 pr-2">Fail</th>
                <th className="py-1">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {d.hosts.slice(0, 8).map((h) => (
                <tr key={h.host}>
                  <td className="py-1 pr-2 font-mono text-slate-300">{h.host}</td>
                  <td className="py-1 pr-2 text-emerald-400/90">{h.ok}</td>
                  <td className="py-1 pr-2 text-rose-400/90">{h.fail}</td>
                  <td className="py-1">{h.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "ok"
      ? "border-teal-500/25 bg-teal-500/5"
      : tone === "warn"
        ? "border-amber-500/25 bg-amber-500/5"
        : "border-slate-800 bg-slate-950/40";
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${color}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium text-slate-200">{value}</div>
    </div>
  );
}
