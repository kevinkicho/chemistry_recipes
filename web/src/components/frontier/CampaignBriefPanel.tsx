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
import {
  buildCampaignRouteHypotheses,
  type CampaignRouteHypothesesPackage,
} from "@/lib/frontier/campaignRouteHypotheses";
import {
  buildCampaignIdealRollup,
  type CampaignIdealRollup,
} from "@/lib/frontier/campaignIdealRollup";
import { downloadJson } from "@/lib/export/techTransfer";
import {
  downloadMarkdown,
  formatCampaignBriefMarkdown,
  formatCampaignIdealRollupMarkdown,
  formatCampaignRoutesMarkdown,
} from "@/lib/frontier/exportMarkdown";
import { streamBatchDensifyCids } from "@/lib/dossier/batchClient";
import Link from "next/link";
import { routes } from "@/lib/routes";

/**
 * Multi-CID scientific brief: condition landscape, cross-CID conflicts, experiments.
 */
export function CampaignBriefPanel() {
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [selected, setSelected] = useState("");
  const [brief, setBrief] = useState<CampaignScientificBrief | null>(null);
  const [routePack, setRoutePack] =
    useState<CampaignRouteHypothesesPackage | null>(null);
  const [ideal, setIdeal] = useState<CampaignIdealRollup | null>(null);
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
      const r = buildCampaignRouteHypotheses(merged.dossiers, {
        campaignName: camp.name,
      });
      const roll = buildCampaignIdealRollup(merged.dossiers, {
        campaignName: camp.name,
        requestedCount: camp.cids.length,
      });
      setBrief(b);
      setRoutePack(r);
      setIdeal(roll);
      setStatus(`${b.summary} · ${r.summary} · ${roll.summary}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Brief failed");
      setBrief(null);
      setRoutePack(null);
      setIdeal(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const camp = campaigns.find((c) => c.id === selected);
    if (!camp) {
      setBrief(null);
      setRoutePack(null);
      setIdeal(null);
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
      { brief, routeHypotheses: routePack, idealRollup: ideal }
    );
    setStatus("Exported campaign-brief.v1 (+ routes + ideal rollup)");
  }

  function exportMarkdownNotebook() {
    if (!brief) return;
    const slug = (brief.campaignName || "campaign")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    let md = formatCampaignBriefMarkdown(brief);
    if (routePack) {
      md += "\n---\n\n" + formatCampaignRoutesMarkdown(routePack);
    }
    if (ideal) {
      md += "\n---\n\n" + formatCampaignIdealRollupMarkdown(ideal);
    }
    downloadMarkdown(`campaign-brief-${slug}.md`, md);
    setStatus("Exported notebook Markdown (brief + routes + ideal)");
  }

  async function densifyWeakIdeal() {
    if (!ideal?.densifyPriorityCids.length) return;
    const cids = ideal.densifyPriorityCids.slice(0, 8);
    setBusy(true);
    setStatus(`Densifying weak-ideal CIDs: ${cids.join(", ")}`);
    try {
      await streamBatchDensifyCids(cids, {
        includeDossiers: true,
        cacheLocal: true,
        concurrency: 2,
        force: true,
        retries: 2,
        onProgress: (m) => setStatus(m),
      });
      const camp = campaigns.find((c) => c.id === selected);
      if (camp) await loadBrief(camp);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Ideal densify failed");
    } finally {
      setBusy(false);
    }
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
        <button
          type="button"
          disabled={!brief}
          onClick={exportMarkdownNotebook}
          className="rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-2.5 py-1 text-[11px] text-indigo-100 disabled:opacity-40"
        >
          Export notebook Markdown
        </button>
        {ideal && ideal.densifyPriorityCids.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void densifyWeakIdeal()}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 disabled:opacity-40"
          >
            Densify weak-ideal CIDs ({Math.min(8, ideal.densifyPriorityCids.length)})
          </button>
        ) : null}
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

          {routePack && routePack.sharedSteps.some((s) => s.n >= 2) ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-slate-500">
                Shared multi-CID route steps
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-600">{routePack.summary}</p>
              <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
                {routePack.sharedSteps
                  .filter((s) => s.n >= 2)
                  .slice(0, 12)
                  .map((s) => (
                    <li key={s.key}>
                      {s.label} · {s.n} CIDs ({s.cids.join(", ")})
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {ideal ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase text-amber-200/80">
                Ideal page rollup (Tier-A goal)
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-400">{ideal.summary}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded border border-slate-800 px-2 py-1">
                  <dt className="text-slate-600">Mean ideal</dt>
                  <dd className="font-mono text-amber-100">
                    {ideal.meanScore}/100
                  </dd>
                </div>
                <div className="rounded border border-slate-800 px-2 py-1">
                  <dt className="text-slate-600">Min / max</dt>
                  <dd className="font-mono text-slate-200">
                    {ideal.minScore} / {ideal.maxScore}
                  </dd>
                </div>
                <div className="rounded border border-slate-800 px-2 py-1">
                  <dt className="text-slate-600">Systemic gaps</dt>
                  <dd className="font-mono text-slate-200">
                    {ideal.systemicGaps.length}
                  </dd>
                </div>
              </dl>
              <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
                {ideal.rows.slice(0, 10).map((r) => (
                  <li key={r.cid}>
                    <Link
                      href={routes.pubchem(r.cid)}
                      className="text-indigo-300 hover:underline"
                    >
                      CID {r.cid}
                    </Link>{" "}
                    {r.name?.slice(0, 16) || ""} · ideal {r.score}
                    {r.weakSections[0]
                      ? ` · weak ${r.weakSections[0].label}`
                      : ""}
                  </li>
                ))}
              </ul>
              {ideal.systemicGaps.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-[10px] text-amber-200/70">
                  {ideal.systemicGaps.slice(0, 4).map((g) => (
                    <li key={g}>· {g}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-[10px] text-slate-600">{ideal.disclaimer}</p>
            </div>
          ) : null}

          <p className="text-[10px] text-slate-600">{brief.disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}
