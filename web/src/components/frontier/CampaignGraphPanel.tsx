"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  listCampaigns,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";
import {
  buildMergedCampaignKnowledge,
  formatIdealDelta,
  thinOrMissingCids,
  type MergedCampaignKnowledge,
} from "@/lib/frontier/campaignKnowledge";
import {
  buildCampaignKnowledgeExport,
  downloadCampaignKnowledge,
} from "@/lib/frontier/campaignExport";
import { streamBatchDensifyCids } from "@/lib/dossier/batchClient";
import { NetworkEdgeComparePanel } from "@/components/frontier/NetworkEdgeComparePanel";
import { routes } from "@/lib/routes";

/**
 * Merge multi-CID campaign graph from IndexedDB caches; stream densify thin/missing.
 */
export function CampaignGraphPanel() {
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [selected, setSelected] = useState("");
  const [merged, setMerged] = useState<MergedCampaignKnowledge | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [idealDeltaMsg, setIdealDeltaMsg] = useState<string | null>(null);

  const reloadList = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [selected]);

  useEffect(() => {
    reloadList();
    return subscribeCampaigns(reloadList);
  }, [reloadList]);

  const loadMerge = useCallback(async (camp: ScienceCampaign) => {
    setStatus("Loading cached campaign dossiers…");
    const m = await buildMergedCampaignKnowledge(camp.cids, camp.labels);
    setMerged(m);
    setStatus(m.summary);
  }, []);

  useEffect(() => {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) {
      setMerged(null);
      return;
    }
    void loadMerge(camp);
  }, [selected, campaigns, loadMerge]);

  async function exportCampaign() {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) return;
    setStatus("Building campaign-knowledge export…");
    try {
      const data = await buildCampaignKnowledgeExport(camp);
      downloadCampaignKnowledge(data);
      setStatus(
        `Exported campaign-knowledge.v1 · ${data.metrics.packageCount} packages · ${data.totalObservations} obs`
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function densifyThinOrMissing() {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) return;
    const statuses = merged?.statuses || [];
    const thinMissing = thinOrMissingCids(statuses);
    // Prefer thin/missing queue; if package looks dense, re-densify all (user intent)
    const cids = (thinMissing.length ? thinMissing : camp.cids).slice(0, 12);
    if (!cids.length) {
      setStatus("No CIDs to densify");
      return;
    }
    const beforeIdeal = new Map(
      statuses.map((s) => [s.cid, s.idealScore ?? 0] as const)
    );
    setBusy(true);
    setLog([]);
    setIdealDeltaMsg(null);
    setStatus(
      thinMissing.length
        ? `Queue thin/missing: ${cids.join(", ")}`
        : `Re-densify all: ${cids.join(", ")}`
    );
    const deltas: string[] = [];
    try {
      await streamBatchDensifyCids(cids, {
        includeDossiers: true,
        cacheLocal: true,
        force: thinMissing.length === 0,
        onProgress: (m) => setStatus(m),
        onEvent: (ev) => {
          if (ev.type === "cid_complete" && ev.cid != null) {
            const b = beforeIdeal.get(ev.cid);
            const a = ev.summary?.idealScore;
            const idealPart =
              b != null || a != null
                ? ` · ideal ${formatIdealDelta(b, a)}`
                : "";
            const line = `CID ${ev.cid}: ${
              ev.ok ? "ok" : ev.error || "fail"
            } · ${ev.summary?.observationCount ?? "—"} obs${idealPart}`;
            setLog((prev) => [...prev, line]);
            if (ev.ok && (b != null || a != null)) {
              deltas.push(`CID ${ev.cid} ideal ${formatIdealDelta(b, a)}`);
            }
          }
        },
      });
      await loadMerge(camp);
      if (deltas.length) {
        setIdealDeltaMsg(`Ideal deltas · ${deltas.join(" · ")}`);
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Stream densify failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="campaign-graph"
      className="scroll-mt-24 rounded-xl border border-teal-500/25 bg-teal-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300/90">
        Frontier · campaign graph
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Multi-CID merged network
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Loads IndexedDB caches for a science campaign, merges reaction networks and
        condition atlases. Stream-densify thin/missing CIDs with Ideal score deltas.
      </p>

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">
        Campaign
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="">— select —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.cids.length})
            </option>
          ))}
        </select>
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => {
            const camp = campaigns.find((c) => c.id === selected);
            if (camp) void loadMerge(camp);
          }}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40"
        >
          Refresh merge
        </button>
        <button
          type="button"
          disabled={busy || !selected}
          onClick={() => void densifyThinOrMissing()}
          className="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
        >
          {busy
            ? "Streaming densify…"
            : merged
              ? `Stream densify thin/missing (${thinOrMissingCids(merged.statuses).length || "all"})`
              : "Stream densify thin/missing"}
        </button>
        <button
          type="button"
          disabled={!selected || (merged?.cachedCount ?? 0) === 0}
          onClick={() => void exportCampaign()}
          className="rounded-lg border border-teal-500/40 bg-teal-950/40 px-2.5 py-1 text-[11px] font-medium text-teal-100 disabled:opacity-40"
        >
          Export campaign-knowledge.v1
        </button>
      </div>

      {status ? (
        <p className="mt-2 text-[11px] text-slate-400" role="status">
          {status}
        </p>
      ) : null}
      {idealDeltaMsg ? (
        <p
          className="mt-1 rounded border border-teal-500/30 bg-teal-500/10 px-2 py-1.5 text-[11px] text-teal-100/90"
          role="status"
        >
          {idealDeltaMsg}
        </p>
      ) : null}

      {log.length > 0 ? (
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}

      {merged ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {merged.statuses.map((s) => (
              <div
                key={s.cid}
                className={`rounded border px-2 py-1.5 text-[11px] ${
                  s.cached
                    ? "border-emerald-500/25 bg-emerald-500/5 text-slate-300"
                    : "border-slate-800 bg-slate-950/50 text-slate-500"
                }`}
              >
                {s.cached && s.cid ? (
                  <Link
                    href={routes.pubchem(s.cid)}
                    className="font-medium text-teal-300 hover:underline"
                  >
                    {s.name || `CID ${s.cid}`}
                  </Link>
                ) : (
                  <span>CID {s.cid} · not cached</span>
                )}
                {s.cached ? (
                  <div className="font-mono text-[10px] text-slate-600">
                    evid {s.evidenceScore ?? "—"} · atlas {s.observationCount ?? 0} ·
                    ideal {s.idealScore ?? "—"}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-[10px] font-semibold uppercase text-slate-500">
              Merged network · {merged.network.nodes.length} nodes ·{" "}
              {merged.network.edges.length} edges
            </h3>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[11px]">
              {merged.network.nodes.slice(0, 30).map((n) => (
                <li key={n.id} className="text-slate-400">
                  <span className="text-[9px] uppercase text-slate-600">{n.role}</span>{" "}
                  {n.pubchemCid ? (
                    <Link
                      href={routes.pubchem(n.pubchemCid)}
                      className="text-teal-300 hover:underline"
                    >
                      {n.label}
                    </Link>
                  ) : (
                    n.label
                  )}
                </li>
              ))}
            </ul>
          </div>

          {merged.atlasByKind.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Campaign-merged condition kinds · {merged.totalObservations} obs
              </h3>
              <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                {merged.atlasByKind.map((d) => (
                  <li key={d.kind}>
                    <span className="font-medium text-slate-300">{d.kind}</span> ·{" "}
                    {d.summary}
                    {d.conflict ? (
                      <span className="text-amber-200/80"> · conflict</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {merged.network.edges.length >= 2 ? (
            <NetworkEdgeComparePanel
              network={merged.network}
              dossiers={merged.dossiers}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
