"use client";

import { useState } from "react";
import Link from "next/link";
import type { LiveDossier } from "@/lib/dossier/types";
import { summarizeDossierDiagnostics } from "@/lib/diagnostics/clientAnalytics";
import { routes } from "@/lib/routes";
import { failedFamiliesFromErrors } from "@/lib/dossier/densifyDelta";

/**
 * Compact per-dossier health strip for operators / power users.
 */
export function DossierDiagnostics({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const d = summarizeDossierDiagnostics(dossier);
  const healthy = d.apiFail === 0 && (d.apiOk > 0 || d.literatureCount > 0);
  const failed = failedFamiliesFromErrors(dossier.fetchErrors);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);

  async function retryFailedOnly() {
    setRetryBusy(true);
    setRetryMsg(null);
    try {
      const res = await fetch(`/api/dossier/${dossier.cid}/retry-families`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          families: failed.map((f) => f.label),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        detail?: string;
        error?: string;
        retried?: string[];
      };
      if (!res.ok || !data.ok) {
        setRetryMsg(data.error || "Retry failed");
        return;
      }
      setRetryMsg(
        data.detail ||
          `Retried ${data.retried?.length ?? 0} family(ies) · force densify to re-render`
      );
      onRegenerate?.();
    } catch (e) {
      setRetryMsg(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetryBusy(false);
    }
  }

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
        Snapshot of free-API HTTP + evidence for this recipe (no secrets). Structured
        routes can come from free-public densify alone — that is not the same as
        “Ollama ready” on system diagnostics.
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
          <span
            className={`rounded px-2 py-0.5 ${
              d.buildMode === "ai"
                ? "bg-violet-500/15 text-violet-200"
                : d.buildMode === "evidence-shell"
                  ? "bg-teal-500/10 text-teal-200/90"
                  : "bg-slate-800 text-slate-400"
            }`}
            title={
              d.buildMode === "ai"
                ? "Dual-view routes from Ollama over densified free-public evidence"
                : d.buildMode === "evidence-shell"
                  ? "Structured free-public shell (process facts / lit leads) — Ollama not required"
                  : d.buildMode === "ai-skipped-thin-evidence"
                    ? "Ollama could run but evidence was thin — shell kept"
                    : undefined
            }
          >
            mode {d.buildMode}
            {d.buildMode === "evidence-shell"
              ? " · free-public (not Ollama)"
              : d.buildMode === "ai"
                ? " · Ollama"
                : ""}
          </span>
        ) : null}
        {d.model ? (
          <span className="rounded bg-violet-500/10 px-2 py-0.5 text-violet-200">
            model {d.model}
          </span>
        ) : d.buildMode && d.buildMode !== "ai" ? (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-500">
            no Ollama model on this build
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
        {failed.length > 0 ? (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-200">
            {failed.length} soft-fail family(ies)
          </span>
        ) : null}
      </div>

      {failed.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-[11px] text-amber-100/90">
            Soft-failed free-public families (other sources continued):{" "}
            <span className="font-mono text-[10px] text-slate-400">
              {failed.map((f) => f.label).join(", ")}
            </span>
          </p>
          <button
            type="button"
            disabled={retryBusy}
            onClick={() => void retryFailedOnly()}
            className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-40"
          >
            {retryBusy ? "Retrying failed families…" : "Retry failed families only"}
          </button>
          {retryMsg ? (
            <p className="mt-1 text-[10px] text-slate-500" role="status">
              {retryMsg}
            </p>
          ) : null}
        </div>
      ) : null}

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
