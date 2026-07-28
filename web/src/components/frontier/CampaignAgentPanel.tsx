"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCampaigns,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";
import { runCampaignAgent } from "@/lib/frontier/campaignAgent";

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

  const reload = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [selected]);

  useEffect(() => {
    reload();
    return subscribeCampaigns(reload);
  }, [reload]);

  async function run() {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp || q.trim().length < 4) return;
    setBusy(true);
    setOut(null);
    setSteps([]);
    setExps([]);
    try {
      const res = await runCampaignAgent(camp, q);
      setSteps(res.steps.map((s) => `[${s.role}] ${s.detail}`));
      setExps(
        res.nextExperiments
          .slice(0, 5)
          .map((e) => `${e.priority}: ${e.question}`)
      );
      setOut(
        [
          res.answer.insufficientEvidence
            ? "⚠ insufficient free-public evidence"
            : "✓ campaign-grounded",
          `cached ${res.metrics.cachedCount}/${res.metrics.requestedCount} · obs ${res.metrics.totalObservations} · edges ${res.metrics.networkEdges}`,
          "",
          res.answer.answer,
        ].join("\n")
      );
    } catch (e) {
      setOut(e instanceof Error ? e.message : "Campaign agent failed");
    } finally {
      setBusy(false);
    }
  }

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
        Answers only from cached campaign densify (merged atlas + network). No plant
        invention. Stream densify first if cache is empty.
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

      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        rows={2}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
      <button
        type="button"
        disabled={busy || !selected || q.trim().length < 4}
        onClick={() => void run()}
        className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
      >
        {busy ? "Running…" : "Ask campaign package"}
      </button>

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
