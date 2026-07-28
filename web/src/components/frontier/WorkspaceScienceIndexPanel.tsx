"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listCampaigns, subscribeCampaigns } from "@/lib/workspace/campaigns";
import {
  buildWorkspaceScienceIndex,
  downloadWorkspaceScienceIndex,
  type WorkspaceScienceIndex,
} from "@/lib/frontier/workspaceScienceIndex";
import { streamBatchDensifyCids } from "@/lib/dossier/batchClient";
import { formatIdealDelta } from "@/lib/frontier/campaignKnowledge";
import { routes } from "@/lib/routes";

/**
 * Cross-campaign densify inventory + global thin queue.
 */
export function WorkspaceScienceIndexPanel() {
  const [index, setIndex] = useState<WorkspaceScienceIndex | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setStatus("Building workspace science index…");
    try {
      const idx = await buildWorkspaceScienceIndex(listCampaigns());
      setIndex(idx);
      setStatus(idx.summary);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Index failed");
    }
  }, []);

  useEffect(() => {
    void reload();
    return subscribeCampaigns(() => {
      void reload();
    });
  }, [reload]);

  async function densifyGlobalQueue() {
    if (!index?.densifyQueue.length) return;
    const cids = index.densifyQueue.slice(0, 12);
    const before = new Map(
      index.cids.map((r) => [r.cid, r.idealScore ?? 0] as const)
    );
    setBusy(true);
    setLog([]);
    setStatus(`Global queue densify · ${cids.length} CID(s)`);
    try {
      await streamBatchDensifyCids(cids, {
        includeDossiers: true,
        cacheLocal: true,
        concurrency: 2,
        retries: 2,
        onProgress: (m) => setStatus(m),
        onEvent: (ev) => {
          if (ev.type === "cid_complete" && ev.cid != null) {
            const b = before.get(ev.cid);
            const a = ev.summary?.idealScore;
            const ideal =
              b != null || a != null
                ? ` · ideal ${formatIdealDelta(b, a)}`
                : "";
            setLog((prev) =>
              [
                ...prev,
                `CID ${ev.cid}: ${ev.ok ? "ok" : ev.error || "fail"} · obs ${
                  ev.summary?.observationCount ?? "—"
                }${ideal}`,
              ].slice(-30)
            );
          }
        },
      });
      await reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Global densify failed");
    } finally {
      setBusy(false);
    }
  }

  function exportIndex() {
    if (!index) return;
    downloadWorkspaceScienceIndex(index);
    setStatus("Exported workspace-science-index.v1");
  }

  return (
    <div
      id="workspace-science-index"
      className="scroll-mt-24 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
        Frontier · workspace science index
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Cross-campaign densify depth
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Local inventory of all science campaigns: unique CIDs, atlas depth,
        condition-kind histogram, and a global thin densify queue (multi-campaign
        CIDs first). Not GMP.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void reload()}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40"
        >
          Refresh index
        </button>
        <button
          type="button"
          disabled={busy || !index?.densifyQueue.length}
          onClick={() => void densifyGlobalQueue()}
          className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {busy
            ? "Densifying queue…"
            : `Densify global thin queue (${index?.densifyQueue.length ?? 0})`}
        </button>
        <button
          type="button"
          disabled={!index}
          onClick={exportIndex}
          className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-2.5 py-1 text-[11px] text-sky-100 disabled:opacity-40"
        >
          Export index JSON
        </button>
      </div>

      {status ? (
        <p className="mt-2 text-[11px] text-slate-400" role="status">
          {status}
        </p>
      ) : null}

      {index ? (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Campaigns</dt>
              <dd className="font-mono text-slate-200">
                {index.metrics.campaignCount}
              </dd>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Unique CIDs</dt>
              <dd className="font-mono text-slate-200">
                {index.metrics.uniqueCids} · {index.metrics.cachedCids} cached
              </dd>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Atlas obs</dt>
              <dd className="font-mono text-slate-200">
                {index.metrics.totalObservations}
              </dd>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Thin queue</dt>
              <dd className="font-mono text-amber-100/90">
                {index.metrics.queueLength}
              </dd>
            </div>
          </dl>

          {index.conditionKindHistogram.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Condition kinds (workspace)
              </h3>
              <ul className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                {index.conditionKindHistogram.slice(0, 12).map((k) => (
                  <li
                    key={k.kind}
                    className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-slate-400"
                  >
                    {k.kind} · n={k.n} · {k.cidCount} cid
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {index.campaigns.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Campaigns
              </h3>
              <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-400">
                {index.campaigns.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-slate-300">{c.name}</span> ·{" "}
                    {c.cachedCount}/{c.cidCount} densified · {c.totalObs} obs ·{" "}
                    {c.thinCount} thin
                    {c.avgIdeal != null ? ` · avg ideal ${c.avgIdeal}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-[10px] font-semibold uppercase text-slate-500">
              CIDs (thin first)
            </h3>
            <ul className="mt-1 max-h-36 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
              {index.cids.slice(0, 24).map((r) => (
                <li
                  key={r.cid}
                  className={r.thin ? "text-amber-200/70" : undefined}
                >
                  {r.cached ? (
                    <Link
                      href={routes.pubchem(r.cid)}
                      className="text-sky-300 hover:underline"
                    >
                      CID {r.cid}
                    </Link>
                  ) : (
                    <span>CID {r.cid}</span>
                  )}
                  {r.name ? ` ${r.name.slice(0, 20)}` : ""} · obs{" "}
                  {r.observationCount} · ideal {r.idealScore ?? "—"} · camps{" "}
                  {r.campaigns.length}
                  {r.thin ? " · queue" : ""}
                  {r.conditionKinds.length
                    ? ` · [${r.conditionKinds.slice(0, 4).join(",")}]`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {log.length > 0 ? (
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
