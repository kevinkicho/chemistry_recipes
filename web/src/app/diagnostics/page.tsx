"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  collectClientAnalytics,
  type ClientAnalytics,
} from "@/lib/diagnostics/clientAnalytics";
import { clearAllDossierCache, formatCacheAge } from "@/lib/idb/dossierCache";
import { routes } from "@/lib/routes";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";

type ServerDiagnostics = {
  generatedAt: string;
  app: {
    name: string;
    nodeEnv: string;
    curatedPackages: number;
    tierAExamples: number;
    registrySources: number;
  };
  env: {
    ollamaKeyConfigured: boolean;
    ollamaCanCall?: boolean;
    ollamaProvider?: string;
    ollamaKeySource: string | null;
    ollamaKeyLength: number;
    ollamaModel: string;
    ollamaFastModel: string;
    ollamaHost: string;
    patentsViewKeyConfigured: boolean;
  };
  probes: Array<{
    id: string;
    name: string;
    organization: string;
    endpointUrl: string;
    status: "ok" | "degraded" | "fail" | "skip";
    httpStatus?: number;
    latencyMs?: number;
    detail?: string;
    category: string;
  }> | null;
  probeSummary: {
    ok: number;
    degraded: number;
    fail: number;
    skip: number;
    avgLatencyMs: number | null;
  } | null;
  advice: string[];
};

function StatusDot({
  status,
}: {
  status: "ok" | "degraded" | "fail" | "skip" | boolean | null;
}) {
  const s =
    status === true || status === "ok"
      ? "ok"
      : status === "degraded"
        ? "degraded"
        : status === false || status === "fail"
          ? "fail"
          : "skip";
  const cls =
    s === "ok"
      ? "bg-emerald-400"
      : s === "degraded"
        ? "bg-amber-400"
        : s === "fail"
          ? "bg-rose-400"
          : "bg-slate-600";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

export default function DiagnosticsPage() {
  const [server, setServer] = useState<ServerDiagnostics | null>(null);
  const [client, setClient] = useState<ClientAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async (withProbe: boolean) => {
    setLoading(true);
    setError(null);
    if (withProbe) setProbing(true);
    try {
      const [sRes, c] = await Promise.all([
        fetch(`/api/diagnostics?probe=${withProbe ? "1" : "0"}`, {
          cache: "no-store",
        }),
        collectClientAnalytics(),
      ]);
      if (!sRes.ok) throw new Error(`Diagnostics API HTTP ${sRes.status}`);
      const s = (await sRes.json()) as ServerDiagnostics;
      setServer(s);
      setClient(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diagnostics");
    } finally {
      setLoading(false);
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
            Diagnostics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Operator view of free-API health, Ollama readiness, browser cache, and
            recent dossier builds. No secrets are shown.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading || probing}
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {probing ? "Probing APIs…" : "Refresh + probe APIs"}
          </button>
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-50"
          >
            Refresh (no probe)
          </button>
        </div>
      </div>

      <div className="mt-4">
        <RegulatoryDisclaimer compact />
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading && !server ? (
        <p className="mt-8 text-sm text-slate-500">Loading diagnostics…</p>
      ) : null}

      {server ? (
        <div className="mt-8 space-y-8">
          {/* Advice */}
          <section className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
            <h2 className="text-sm font-semibold text-sky-100">Diagnosis tips</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-sky-100/80">
              {server.advice.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>

          {/* Summary cards */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              title="Ollama"
              value={
                server.env.ollamaCanCall
                  ? server.env.ollamaProvider === "ollama-local"
                    ? "Local ready"
                    : "Cloud ready"
                  : server.env.ollamaKeyConfigured
                    ? "Key set"
                    : "Not ready"
              }
              ok={Boolean(server.env.ollamaCanCall || server.env.ollamaKeyConfigured)}
              hint={
                server.env.ollamaCanCall
                  ? `${server.env.ollamaProvider || "cloud"} · ${server.env.ollamaHost}`
                  : "Set OLLAMA_CLOUD_API_KEY or OLLAMA_HOST=http://127.0.0.1:11434"
              }
            />
            <Card
              title="API probes"
              value={
                server.probeSummary
                  ? `${server.probeSummary.ok} ok · ${server.probeSummary.fail} fail`
                  : "Not run"
              }
              ok={
                server.probeSummary
                  ? server.probeSummary.fail === 0
                  : null
              }
              hint={
                server.probeSummary?.avgLatencyMs != null
                  ? `avg ${server.probeSummary.avgLatencyMs} ms · ${server.probeSummary.degraded} slow · ${server.probeSummary.skip} skip`
                  : "Click Refresh + probe APIs"
              }
            />
            <Card
              title="Browser cache"
              value={
                client
                  ? `${client.cache.dossierCount} dossier(s)`
                  : "—"
              }
              ok={client ? client.browser.indexedDb : null}
              hint={
                client
                  ? `avg evidence ${client.aggregates.avgEvidenceScore ?? "—"} · ${client.cache.snapshotSamples} snapshots`
                  : ""
              }
            />
            <Card
              title="Catalog"
              value={`${server.app.curatedPackages} packages`}
              ok
              hint={`${server.app.tierAExamples} Tier-A · ${server.app.registrySources} registry APIs · ${server.app.nodeEnv}`}
            />
          </section>

          {/* Env detail */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-100">Server environment</h2>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Row k="Ollama host" v={server.env.ollamaHost} />
              <Row k="Provider" v={server.env.ollamaProvider || "—"} />
              <Row
                k="Can call AI"
                v={server.env.ollamaCanCall ? "yes" : "no"}
              />
              <Row k="Primary model" v={server.env.ollamaModel} mono />
              <Row k="Fast model" v={server.env.ollamaFastModel} mono />
              <Row
                k="Cloud key"
                v={
                  server.env.ollamaKeyConfigured
                    ? `set · len ${server.env.ollamaKeyLength}`
                    : "not set"
                }
              />
              <Row
                k="PatentsView key"
                v={server.env.patentsViewKeyConfigured ? "set" : "not set (optional)"}
              />
              <Row k="Snapshot time" v={new Date(server.generatedAt).toLocaleString()} />
            </dl>
          </section>

          {/* Live probes */}
          {server.probes ? (
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Free API health probes
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Lightweight live GETs (aspirin/CID 2244). Failures often mean network or
                upstream rate limits — not always an app bug.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-left text-xs text-slate-300">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1.5 pr-2">Status</th>
                      <th className="py-1.5 pr-2">API</th>
                      <th className="py-1.5 pr-2">Org</th>
                      <th className="py-1.5 pr-2">HTTP</th>
                      <th className="py-1.5 pr-2">Latency</th>
                      <th className="py-1.5">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {server.probes.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-2">
                          <span className="inline-flex items-center gap-1.5">
                            <StatusDot status={p.status} />
                            <span className="uppercase text-[10px] text-slate-500">
                              {p.status}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 pr-2 font-medium text-slate-200">{p.name}</td>
                        <td className="py-2 pr-2 text-slate-500">{p.organization}</td>
                        <td className="py-2 pr-2 font-mono">{p.httpStatus ?? "—"}</td>
                        <td className="py-2 pr-2 font-mono tabular-nums">
                          {p.latencyMs != null ? `${p.latencyMs} ms` : "—"}
                        </td>
                        <td className="max-w-[14rem] truncate py-2 text-slate-500" title={p.detail}>
                          {p.detail || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Client analytics */}
          {client ? (
            <>
              <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Browser state
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Mini
                    title="IndexedDB"
                    body={client.browser.indexedDb ? "Available" : "Unavailable"}
                    ok={client.browser.indexedDb}
                  />
                  <Mini
                    title="Browser AI config"
                    body={
                      client.aiBrowser.configured
                        ? `Ready · ${client.aiBrowser.provider} · ${client.aiBrowser.model}`
                        : client.aiBrowser.hasLocalKey
                          ? "Key present but AI disabled"
                          : "Using server key / local host if set"
                    }
                    ok={client.aiBrowser.configured || !client.aiBrowser.hasLocalKey}
                  />
                  <Mini
                    title="Workspace"
                    body={`${client.workspace.projects} projects · ${client.workspace.pinnedItems} pins`}
                    ok
                  />
                  <Mini
                    title="History"
                    body={`${client.history.entries} entries`}
                    ok
                  />
                  <Mini
                    title="Avg evidence score"
                    body={
                      client.aggregates.avgEvidenceScore != null
                        ? String(client.aggregates.avgEvidenceScore)
                        : "No cached dossiers"
                    }
                    ok={
                      client.aggregates.avgEvidenceScore == null ||
                      client.aggregates.avgEvidenceScore >= 30
                    }
                  />
                  <Mini
                    title="Build modes"
                    body={
                      Object.entries(client.aggregates.buildModes)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ") || "—"
                    }
                    ok
                  />
                </div>
              </section>

              {client.idbHealth ? (
                <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        IndexedDB health
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Local-only dossier cache (
                        <code className="text-slate-400">{client.idbHealth.dbName}</code>
                        ). Schema v{client.idbHealth.schemaVersion}. Not shared /
                        not multi-user.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={clearing || client.idbHealth.dossierCount === 0}
                      onClick={async () => {
                        if (
                          !confirm(
                            "Clear all cached live dossiers on this device? Snapshots may remain."
                          )
                        ) {
                          return;
                        }
                        setClearing(true);
                        try {
                          await clearAllDossierCache();
                          await load(false);
                        } finally {
                          setClearing(false);
                        }
                      }}
                      className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
                    >
                      {clearing ? "Clearing…" : "Clear dossier cache"}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Mini
                      title="Open"
                      body={client.idbHealth.openOk ? "OK" : "Fail"}
                      ok={client.idbHealth.openOk}
                    />
                    <Mini
                      title="Read"
                      body={client.idbHealth.readOk ? "OK" : "Fail"}
                      ok={client.idbHealth.readOk}
                    />
                    <Mini
                      title="Write probe"
                      body={client.idbHealth.writeOk ? "OK" : "Fail"}
                      ok={client.idbHealth.writeOk}
                    />
                    <Mini
                      title="Current schema rows"
                      body={String(client.idbHealth.dossierCount)}
                      ok
                    />
                    <Mini
                      title="Stale schema rows"
                      body={String(client.idbHealth.staleSchemaCount)}
                      ok={client.idbHealth.staleSchemaCount === 0}
                    />
                    <Mini
                      title="Newest cache"
                      body={
                        client.idbHealth.newestSavedAt
                          ? formatCacheAge(client.idbHealth.newestSavedAt)
                          : "—"
                      }
                      ok
                    />
                    <Mini
                      title="Oldest cache"
                      body={
                        client.idbHealth.oldestSavedAt
                          ? formatCacheAge(client.idbHealth.oldestSavedAt)
                          : "—"
                      }
                      ok
                    />
                    <Mini
                      title="AI host (browser)"
                      body={client.aiBrowser.host || "—"}
                      ok
                    />
                  </div>
                  {client.idbHealth.error ? (
                    <p className="mt-3 text-xs text-rose-400" role="alert">
                      {client.idbHealth.error}
                    </p>
                  ) : null}
                </section>
              ) : null}

              {Object.keys(client.aggregates.annotationSourceCounts).length > 0 ? (
                <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Multi-source hits (cached dossiers)
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(client.aggregates.annotationSourceCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([src, n]) => (
                        <span
                          key={src}
                          className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200 ring-1 ring-sky-500/25"
                        >
                          {src} · {n}
                        </span>
                      ))}
                  </div>
                </section>
              ) : null}

              {client.aggregates.apiHosts.length > 0 ? (
                <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <h2 className="text-sm font-semibold text-slate-100">
                    HTTP hosts in cached builds
                  </h2>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-xs text-slate-300">
                      <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-1.5 pr-2">Host</th>
                          <th className="py-1.5 pr-2">OK</th>
                          <th className="py-1.5 pr-2">Fail</th>
                          <th className="py-1.5">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {client.aggregates.apiHosts.map((h) => (
                          <tr key={h.host}>
                            <td className="py-1.5 pr-2 font-mono text-slate-200">
                              {h.host}
                            </td>
                            <td className="py-1.5 pr-2 text-emerald-400/90">{h.ok}</td>
                            <td className="py-1.5 pr-2 text-rose-400/90">{h.fail}</td>
                            <td className="py-1.5">{h.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {client.cache.dossiers.length > 0 ? (
                <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Cached dossiers
                  </h2>
                  <ul className="mt-3 divide-y divide-slate-800">
                    {client.cache.dossiers.map((d) => (
                      <li
                        key={d.cid}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <Link
                            href={routes.pubchem(d.cid)}
                            className="font-medium text-teal-300 hover:underline"
                          >
                            {d.name || `CID ${d.cid}`}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                            <span>CID {d.cid}</span>
                            <span>· {d.age}</span>
                            {d.buildMode ? <span>· {d.buildMode}</span> : null}
                            {d.evidenceScore != null ? (
                              <span>· score {d.evidenceScore}</span>
                            ) : null}
                            <span>
                              · {d.literatureCount} lit · {d.patentCount} patents
                            </span>
                            <span>
                              · HTTP {d.apiOk}/{d.apiOk + d.apiFail}
                            </span>
                          </div>
                        </div>
                        {d.apiFail > 0 ? (
                          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">
                            {d.apiFail} fail
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                            healthy
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="text-sm text-slate-500">
                  No cached dossiers yet.{" "}
                  <Link href={routes.search()} className="text-teal-400 hover:underline">
                    Search
                  </Link>{" "}
                  and open a compound to populate local analytics.
                </p>
              )}
            </>
          ) : null}

          <p className="text-xs text-slate-600">
            Also see{" "}
            <Link href={routes.sources()} className="text-teal-400 hover:underline">
              API sources registry
            </Link>
            {" · "}
            <Link href={routes.aiSettings()} className="text-teal-400 hover:underline">
              AI settings
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Card({
  title,
  value,
  hint,
  ok,
}: {
  title: string;
  value: string;
  hint?: string;
  ok: boolean | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <StatusDot status={ok} />
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-50">{value}</div>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Mini({
  title,
  body,
  ok,
}: {
  title: string;
  body: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
        <StatusDot status={ok} />
        {title}
      </div>
      <p className="mt-1 text-xs text-slate-300">{body}</p>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-slate-600">{k}</dt>
      <dd className={`mt-0.5 text-slate-200 ${mono ? "font-mono text-[11px]" : ""}`}>
        {v}
      </dd>
    </div>
  );
}
