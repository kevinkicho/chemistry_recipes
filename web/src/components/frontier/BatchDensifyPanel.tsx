"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCampaigns,
  updateCampaign,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";
import { streamBatchDensifyCids } from "@/lib/dossier/batchClient";
import Link from "next/link";
import { routes } from "@/lib/routes";

/**
 * Batch densify for science campaigns (server sequential builds).
 */
export function BatchDensifyPanel({ seedCids }: { seedCids?: number[] }) {
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [manual, setManual] = useState(
    seedCids?.length ? seedCids.join(", ") : ""
  );
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [concurrency, setConcurrency] = useState(2);
  const [force, setForce] = useState(false);

  const reload = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [selected]);

  useEffect(() => {
    reload();
    return subscribeCampaigns(reload);
  }, [reload]);

  function parseCids(): number[] {
    if (selected) {
      const c = campaigns.find((x) => x.id === selected);
      if (c?.cids.length) return c.cids;
    }
    return manual
      .split(/[\s,;]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 12);
  }

  async function run() {
    const cids = parseCids();
    if (!cids.length) {
      setStatus("Enter 1–12 PubChem CIDs or select a campaign.");
      return;
    }
    setBusy(true);
    setStatus(null);
    setStreamLog([]);
    try {
      const res = await streamBatchDensifyCids(cids, {
        includeDossiers: true,
        cacheLocal: true,
        concurrency,
        force,
        retries: 2,
        onProgress: (m) => setStatus(m),
        onEvent: (ev) => {
          if (ev.type === "start" && ev.total != null) {
            setStreamLog((prev) =>
              [...prev, `pool start · ${ev.total} CIDs`].slice(-40)
            );
          }
          if (ev.type === "cid_start" || ev.type === "cid_complete") {
            setStreamLog((prev) =>
              [
                ...prev,
                ev.type === "cid_start"
                  ? `→ CID ${ev.cid} starting…`
                  : `✓ CID ${ev.cid}: ${
                      ev.summary?.fromCache
                        ? "cache"
                        : ev.ok
                          ? "ok"
                          : ev.error || "fail"
                    } (${ev.summary?.observationCount ?? "—"} obs)`,
              ].slice(-40)
            );
          }
        },
      });
      setLast(
        JSON.stringify(
          {
            mode: "sse-stream-parallel",
            concurrency,
            force,
            skippedCache: res.skipped,
            ok: res.ok,
            fail: res.fail,
            durationMs: res.durationMs,
            results: (res.results || []).map((r) => ({
              cid: r.cid,
              ok: r.ok,
              name: r.summary?.name,
              evidence: r.summary?.evidenceScore,
              atlas: r.summary?.observationCount,
              error: r.error,
            })),
          },
          null,
          2
        )
      );
      if (selected) {
        updateCampaign(selected, {
          lastBatch: {
            at: new Date().toISOString(),
            ok: res.ok,
            fail: res.fail,
            detail: res.error,
          },
        });
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="batch-densify"
      className="scroll-mt-24 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200/90">
        Frontier · batch densify
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Multi-CID densify (server)
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Sequential free-public builds (max 12). Caches dossiers locally when successful.
        Not GMP.
      </p>

      <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500">
        Campaign
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="">— manual CIDs —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.cids.length} CIDs)
            </option>
          ))}
        </select>
      </label>

      <label className="mt-2 block text-[10px] font-semibold uppercase text-slate-500">
        CIDs (comma-separated)
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="2244, 3672, 702"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100"
        />
      </label>

      <div className="mt-2 flex flex-wrap items-end gap-4">
        <label className="block text-[10px] font-semibold uppercase text-slate-500">
          Concurrency (1–4)
          <input
            type="number"
            min={1}
            max={4}
            value={concurrency}
            onChange={(e) =>
              setConcurrency(Math.min(4, Math.max(1, Number(e.target.value) || 1)))
            }
            className="mt-1 w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm text-slate-100"
          />
        </label>
        <label className="flex items-center gap-2 pb-1 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          Force rebuild (ignore warm local cache)
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {busy ? "Streaming densify…" : "Stream batch densify"}
        </button>
        <Link
          href={routes.workspace()}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
        >
          Manage campaigns
        </Link>
      </div>
      {status ? (
        <p className="mt-2 text-[11px] text-slate-400" role="status">
          {status}
        </p>
      ) : null}
      {streamLog.length > 0 ? (
        <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
          {streamLog.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}
      {last ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] text-slate-500">
          {last}
        </pre>
      ) : null}
    </div>
  );
}
