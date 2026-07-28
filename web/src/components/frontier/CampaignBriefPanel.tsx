"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCampaigns,
  type ScienceCampaign,
  subscribeCampaigns,
} from "@/lib/workspace/campaigns";
import { buildMergedCampaignKnowledge } from "@/lib/frontier/campaignKnowledge";
import {
  buildCampaignScientificBrief,
  type CampaignScientificBrief,
} from "@/lib/frontier/campaignBrief";
import { downloadJson } from "@/lib/export/techTransfer";

/**
 * Multi-CID scientific brief: condition landscape, cross-CID conflicts, experiments.
 */
export function CampaignBriefPanel() {
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [selected, setSelected] = useState("");
  const [brief, setBrief] = useState<CampaignScientificBrief | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadList = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [selected]);

  useEffect(() => {
    reloadList();
    return subscribeCampaigns(reloadList);
  }, [reloadList]);

  const loadBrief = useCallback(async (camp: ScienceCampaign) => {
    setBusy(true);
    setStatus("Building campaign scientific brief…");
    try {
      const merged = await buildMergedCampaignKnowledge(
        camp.cids,
        camp.labels
      );
      const b = buildCampaignScientificBrief(merged, {
        campaignName: camp.name,
      });
      setBrief(b);
      setStatus(b.summary);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Brief failed");
      setBrief(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) {
      setBrief(null);
      return;
    }
    void loadBrief(camp);
  }, [selected, campaigns, loadBrief]);

  function exportBrief() {
    if (!brief) return;
    downloadJson(
      `campaign-brief-${(brief.campaignName || "campaign")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)}.json`,
      brief
    );
    setStatus("Exported campaign-brief.v1");
  }

  return (
    <div
      id="campaign-brief"
      className="scroll-mt-24 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-300/90">
        Frontier · campaign scientific brief
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Multi-CID condition landscape
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Depth score, cross-CID range conflicts, and research experiments from
        densified free-public packages. Not plant setpoints.
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
            if (camp) void loadBrief(camp);
          }}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40"
        >
          {busy ? "Building…" : "Rebuild brief"}
        </button>
        <button
          type="button"
          disabled={!brief}
          onClick={exportBrief}
          className="rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-2.5 py-1 text-[11px] text-indigo-100 disabled:opacity-40"
        >
          Export campaign-brief.v1
        </button>
      </div>

      {status ? (
        <p className="mt-2 text-[11px] text-slate-400" role="status">
          {status}
        </p>
      ) : null}

      {brief ? (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Depth</dt>
              <dd className="font-mono text-indigo-100">
                {brief.depthScore}/100
              </dd>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Obs / kinds</dt>
              <dd className="font-mono text-slate-200">
                {brief.metrics.totalObservations} /{" "}
                {brief.metrics.conditionKinds}
              </dd>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Cross-CID conflicts</dt>
              <dd className="font-mono text-amber-100/90">
                {brief.metrics.crossCidConflicts}
              </dd>
            </div>
            <div className="rounded border border-slate-800 px-2 py-1.5">
              <dt className="text-slate-600">Thin CIDs</dt>
              <dd className="font-mono text-slate-200">
                {brief.metrics.thinCidCount}
              </dd>
            </div>
          </dl>

          {brief.crossCidSpans.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Per-CID condition spans
              </h3>
              <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
                {brief.crossCidSpans.slice(0, 16).map((s, i) => (
                  <li key={`${s.cid}-${s.kind}-${i}`}>
                    CID {s.cid}
                    {s.name ? ` ${s.name.slice(0, 16)}` : ""} · {s.kind} ·{" "}
                    {s.min != null && s.max != null
                      ? `${s.min}–${s.max}${s.unit ? ` ${s.unit}` : ""}`
                      : "—"}{" "}
                    · n={s.n}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {brief.crossCidConflicts.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-amber-200/80">
                Cross-CID range conflicts
              </h3>
              <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                {brief.crossCidConflicts.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-amber-100/90">
                      {c.kind}
                    </span>{" "}
                    · CID {c.cidA} ({c.rangeA}) vs CID {c.cidB} ({c.rangeB})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {brief.topExperiments.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Research experiments
              </h3>
              <ul className="mt-1 space-y-1 text-[10px] text-slate-400">
                {brief.topExperiments.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    · [{e.priority}] {e.question}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {brief.openGaps.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Open gaps
              </h3>
              <ul className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                {brief.openGaps.map((g) => (
                  <li key={g}>· {g}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[10px] text-slate-600">{brief.disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}
