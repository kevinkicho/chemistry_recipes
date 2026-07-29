"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCampaigns,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";
import {
  compareScienceCampaigns,
  type CampaignCompareResult,
} from "@/lib/frontier/campaignCompare";
import { downloadJson } from "@/lib/export/techTransfer";
import { FreePublicBadge } from "@/components/FreePublicProvenance";

/**
 * Side-by-side campaign densify / ideal depth compare.
 */
export function CampaignComparePanel() {
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [result, setResult] = useState<CampaignCompareResult | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!idA && rows[0]) setIdA(rows[0].id);
    if (!idB && rows[1]) setIdB(rows[1].id);
    else if (!idB && rows[0]) setIdB(rows[0].id);
  }, [idA, idB]);

  useEffect(() => {
    reload();
    return subscribeCampaigns(reload);
  }, [reload]);

  async function run() {
    const a = campaigns.find((c) => c.id === idA);
    const b = campaigns.find((c) => c.id === idB);
    if (!a || !b) {
      setStatus("Select two campaigns.");
      return;
    }
    setBusy(true);
    setStatus("Comparing densify metrics…");
    try {
      const r = await compareScienceCampaigns(a, b);
      setResult(r);
      setStatus(r.summary);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Compare failed");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function exportCompare() {
    if (!result) return;
    downloadJson(
      `campaign-compare-${result.a.name
        .slice(0, 20)
        .replace(/[^a-z0-9]+/gi, "-")}-vs-${result.b.name
        .slice(0, 20)
        .replace(/[^a-z0-9]+/gi, "-")}.json`,
      result
    );
    setStatus("Exported campaign-compare.v1");
  }

  function sideCard(
    label: string,
    side: CampaignCompareResult["a"]
  ) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <p className="text-[10px] font-semibold uppercase text-slate-500">
          {label}
        </p>
        <h3 className="mt-0.5 text-sm font-semibold text-slate-100">
          {side.name}
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
          <div>
            <dt className="text-slate-600">Densified</dt>
            <dd className="font-mono text-slate-200">
              {side.densifiedCount}/{side.cids.length}
            </dd>
          </div>
          <div>
            <dt className="text-slate-600">Mean ideal</dt>
            <dd className="font-mono text-amber-100">{side.meanIdeal}/100</dd>
          </div>
          <div>
            <dt className="text-slate-600">Min / max ideal</dt>
            <dd className="font-mono text-slate-300">
              {side.minIdeal} / {side.maxIdeal}
            </dd>
          </div>
          <div>
            <dt className="text-slate-600">Atlas obs</dt>
            <dd className="font-mono text-slate-200">{side.totalObs}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Condition kinds</dt>
            <dd className="font-mono text-slate-200">{side.conditionKinds}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Lit depth (mean)</dt>
            <dd className="font-mono text-slate-200">{side.meanLitDepth}/100</dd>
          </div>
          <div>
            <dt className="text-slate-600">Brief depth</dt>
            <dd className="font-mono text-indigo-100">{side.depthScore}/100</dd>
          </div>
          <div>
            <dt className="text-slate-600">Cross-CID conflicts</dt>
            <dd className="font-mono text-slate-200">
              {side.crossCidConflicts}
            </dd>
          </div>
        </dl>
        {side.topWeakSections.length > 0 ? (
          <ul className="mt-2 space-y-0.5 text-[10px] text-amber-200/70">
            {side.topWeakSections.map((g) => (
              <li key={g}>· {g}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div
      id="campaign-compare"
      className="scroll-mt-24 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-300/90">
        Frontier · campaign compare
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-50">
          Side-by-side densify depth
        </h2>
        <FreePublicBadge note="free-public densify metrics · not GMP" />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Compare two local science campaigns on Ideal score, atlas depth, and
        literature densify — free-public metrics only.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-[10px] font-semibold uppercase text-slate-500">
          Campaign A
          <select
            value={idA}
            onChange={(e) => setIdA(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="">—</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.cids.length})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[10px] font-semibold uppercase text-slate-500">
          Campaign B
          <select
            value={idB}
            onChange={(e) => setIdB(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="">—</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.cids.length})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !idA || !idB}
          onClick={() => void run()}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40"
        >
          {busy ? "Comparing…" : "Compare campaigns"}
        </button>
        <button
          type="button"
          disabled={!result}
          onClick={exportCompare}
          className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs text-rose-100 disabled:opacity-40"
        >
          Export compare JSON
        </button>
      </div>

      {status ? (
        <p className="mt-2 text-[11px] text-slate-400" role="status">
          {status}
        </p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            {sideCard("A", result.a)}
            {sideCard("B", result.b)}
          </div>
          <div className="rounded border border-slate-800 px-3 py-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">Deltas (A − B):</span>{" "}
            ideal {result.deltas.meanIdeal > 0 ? "+" : ""}
            {result.deltas.meanIdeal} · obs {result.deltas.totalObs > 0 ? "+" : ""}
            {result.deltas.totalObs} · depth {result.deltas.depthScore > 0 ? "+" : ""}
            {result.deltas.depthScore} · lit{" "}
            {result.deltas.meanLitDepth > 0 ? "+" : ""}
            {result.deltas.meanLitDepth}
            <div className="mt-1 font-mono text-[10px] text-slate-600">
              shared CIDs: {result.sharedCids.join(", ") || "—"} · only A:{" "}
              {result.onlyInA.slice(0, 8).join(", ") || "—"} · only B:{" "}
              {result.onlyInB.slice(0, 8).join(", ") || "—"}
            </div>
            <p className="mt-1 text-[10px] text-slate-600">{result.disclaimer}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
