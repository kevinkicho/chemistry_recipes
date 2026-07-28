"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCampaigns,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";
import { runCampaignAgent } from "@/lib/frontier/campaignAgent";
import {
  campaignStatuses,
  type CampaignCidStatus,
} from "@/lib/frontier/campaignKnowledge";
import { recordDensifyRun } from "@/lib/dossier/densifyTelemetry";
import { batchDensifyCids } from "@/lib/dossier/batchClient";

/**
 * Campaign-level quote-bound Q&A over merged multi-CID caches.
 */
export function CampaignAgentPanel() {
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [selected, setSelected] = useState("");
  const [q, setQ] = useState(
    "What condition ranges appear across this campaign? Any edge conflicts?"
  );
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [exps, setExps] = useState<string[]>([]);
  const [useServer, setUseServer] = useState(false);
  const [force, setForce] = useState(false);
  const [health, setHealth] = useState<CampaignCidStatus[] | null>(null);
  const [healthMsg, setHealthMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [selected]);

  useEffect(() => {
    reload();
    return subscribeCampaigns(reload);
  }, [reload]);

  // Preflight: how dense is the local campaign package?
  useEffect(() => {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) {
      setHealth(null);
      setHealthMsg(null);
      return;
    }
    let cancelled = false;
    void campaignStatuses(camp.cids, camp.labels).then((statuses) => {
      if (cancelled) return;
      setHealth(statuses);
      const cached = statuses.filter((s) => s.cached).length;
      const obs = statuses.reduce((n, s) => n + (s.observationCount || 0), 0);
      const thin = statuses.filter(
        (s) => s.cached && (s.observationCount || 0) < 2
      ).length;
      const missing = statuses.filter((s) => !s.cached).length;
      setHealthMsg(
        `Local package: ${cached}/${camp.cids.length} cached · ${obs} atlas obs` +
          (missing ? ` · ${missing} not densified` : "") +
          (thin ? ` · ${thin} thin` : "")
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selected, campaigns]);

  async function run() {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp || q.trim().length < 4) return;
    setBusy(true);
    setOut(null);
    setSteps([]);
    setExps([]);
    const t0 = Date.now();
    try {
      let res: Awaited<ReturnType<typeof runCampaignAgent>>;
      let densify: Array<{ cid: number; ok: boolean; error?: string }> | undefined;
      if (useServer) {
        const r = await fetch("/api/ai/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cids: camp.cids,
            question: q,
            name: camp.name,
            concurrency: 2,
            force,
          }),
        });
        const data = (await r.json()) as Awaited<
          ReturnType<typeof runCampaignAgent>
        > & {
          error?: string;
          densify?: Array<{ cid: number; ok: boolean; error?: string }>;
        };
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        res = data;
        densify = data.densify;
        const ok = densify?.filter((d) => d.ok).length ?? 0;
        const fail = densify?.filter((d) => !d.ok).length ?? 0;
        recordDensifyRun({
          kind: "campaign-server",
          cids: camp.cids,
          concurrency: 2,
          ok,
          fail,
          durationMs: Date.now() - t0,
          detail: force ? "force densify + campaign answer" : "campaign densify + answer",
        });
      } else {
        res = await runCampaignAgent(camp, q);
      }
      setSteps(res.steps.map((s) => `[${s.role}] ${s.detail}`));
      setExps(
        res.nextExperiments
          .slice(0, 5)
          .map((e) => `${e.priority}: ${e.question}`)
      );
      const densifyLine =
        densify && densify.length
          ? `densify ${densify.filter((d) => d.ok).length}/${densify.length}${
              densify.some((d) => !d.ok)
                ? ` · fail: ${densify
                    .filter((d) => !d.ok)
                    .map((d) => d.cid)
                    .join(",")}`
                : ""
            }`
          : null;
      setOut(
        [
          useServer
            ? `mode: server densify + merge${force ? " (force)" : ""}`
            : "mode: local IndexedDB cache",
          densifyLine,
          res.answer.insufficientEvidence
            ? "⚠ insufficient free-public evidence"
            : "✓ campaign-grounded",
          `cached ${res.metrics.cachedCount}/${res.metrics.requestedCount} · obs ${res.metrics.totalObservations} · edges ${res.metrics.networkEdges}`,
          "",
          res.answer.answer,
        ]
          .filter(Boolean)
          .join("\n")
      );
      // Warm local IndexedDB from server batch (uses evidence cache when possible)
      // so preflight + local-mode re-asks see densified packages.
      if (useServer && densify?.some((d) => d.ok)) {
        const warmCids = densify.filter((d) => d.ok).map((d) => d.cid);
        setSteps((prev) => [
          ...prev,
          `[densify] Warming local cache for ${warmCids.length} CID(s)…`,
        ]);
        try {
          await batchDensifyCids(warmCids, {
            cacheLocal: true,
            concurrency: 2,
            force: false,
            includeDossiers: false,
          });
          const statuses = await campaignStatuses(camp.cids, camp.labels);
          setHealth(statuses);
          const cached = statuses.filter((s) => s.cached).length;
          const obs = statuses.reduce(
            (n, s) => n + (s.observationCount || 0),
            0
          );
          setHealthMsg(
            `Local package: ${cached}/${camp.cids.length} cached · ${obs} atlas obs (warmed after server)`
          );
          setSteps((prev) => [
            ...prev,
            `[densify] Local cache warm complete · ${cached}/${camp.cids.length}`,
          ]);
        } catch {
          setSteps((prev) => [
            ...prev,
            "[densify] Local cache warm skipped (answer still valid from server package)",
          ]);
        }
      }
    } catch (e) {
      setOut(e instanceof Error ? e.message : "Campaign agent failed");
    } finally {
      setBusy(false);
    }
  }

  const camp = campaigns.find((c) => c.id === selected);
  const missingCids =
    health?.filter((s) => !s.cached).map((s) => s.cid) || [];

  return (
    <div
      id="campaign-agent"
      className="scroll-mt-24 rounded-xl border border-violet-500/25 bg-violet-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">
        Frontier · campaign agent
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Multi-CID science agent
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Answers only from campaign densify (merged atlas + network). No plant
        invention. Stream densify first if local cache is empty, or use server mode.
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
              {c.name} ({c.cids.length} CIDs)
            </option>
          ))}
        </select>
      </label>

      {healthMsg ? (
        <p
          className={`mt-2 text-[11px] ${
            missingCids.length || (health && health.every((s) => !s.cached))
              ? "text-amber-200/90"
              : "text-slate-400"
          }`}
          role="status"
        >
          {healthMsg}
          {missingCids.length > 0 && !useServer ? (
            <span className="block text-[10px] text-amber-200/70">
              Tip: enable server densify, or stream densify missing CIDs in Campaign
              graph ({missingCids.slice(0, 6).join(", ")}
              {missingCids.length > 6 ? "…" : ""}).
            </span>
          ) : null}
        </p>
      ) : null}

      {health && health.length > 0 ? (
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-600">
          {health.map((s) => (
            <li key={s.cid}>
              CID {s.cid}
              {s.name ? ` ${s.name.slice(0, 24)}` : ""} ·{" "}
              {s.cached ? `obs ${s.observationCount ?? 0}` : "not cached"} · ideal{" "}
              {s.idealScore ?? "—"}
            </li>
          ))}
        </ul>
      ) : null}

      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
      <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        <input
          type="checkbox"
          checked={useServer}
          onChange={(e) => setUseServer(e.target.checked)}
        />
        Server densify CIDs then answer (slower, fresher free-public data)
      </label>
      {useServer ? (
        <label className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          Force re-gather (skip server evidence cache)
        </label>
      ) : null}
      <button
        type="button"
        disabled={busy || !selected || q.trim().length < 4}
        onClick={() => void run()}
        className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
      >
        {busy
          ? useServer
            ? "Densifying + answering…"
            : "Running…"
          : "Ask campaign package"}
      </button>
      {camp && !useServer && missingCids.length === camp.cids.length ? (
        <p className="mt-1 text-[10px] text-amber-200/80">
          No local densify yet — answer will refuse until you densify.
        </p>
      ) : null}

      {steps.length > 0 ? (
        <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[10px] text-slate-500">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : null}
      {out ? (
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-2 font-sans text-[11px] text-slate-300">
          {out}
        </pre>
      ) : null}
      {exps.length > 0 ? (
        <div className="mt-2">
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">
            Edge / campaign experiments
          </h3>
          <ul className="mt-1 space-y-1 text-[10px] text-slate-400">
            {exps.map((e) => (
              <li key={e}>· {e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
