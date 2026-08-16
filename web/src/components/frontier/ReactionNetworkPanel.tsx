"use client";

import Link from "next/link";
import type { LiveDossier } from "@/lib/dossier/types";
import { buildReactionNetwork } from "@/lib/frontier/reactionNetwork";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";
import { buildNeighborDensifyGraph } from "@/lib/frontier/neighborDensifyGraph";
import { routes } from "@/lib/routes";
import {
  addCidToCampaign,
  createCampaign,
  listCampaigns,
} from "@/lib/workspace/campaigns";
import { NetworkEdgeComparePanel } from "@/components/frontier/NetworkEdgeComparePanel";
import { streamBatchDensifyCids } from "@/lib/dossier/batchClient";
import { formatBatchDensifyStatus } from "@/lib/dossier/batchStreamStatus";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";
import { formatProcessFactsEmptyCopy } from "@/lib/dossier/sectionHonesty";
import { useState } from "react";

/**
 * Multi-CID process network + impurity densify queue + campaign hooks.
 * Harvest failure is not "Network is center-only".
 * Leftover identity / annotation HTTP is not a reaction-network miss.
 */
export function ReactionNetworkPanel({
  dossier,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onRegenerate?: () => void;
}) {
  const atlas =
    dossier.processKnowledge?.conditionAtlas || buildConditionAtlas(dossier);
  const net =
    dossier.processKnowledge?.reactionNetwork ||
    buildReactionNetwork(dossier, atlas);
  const neighborGraph = buildNeighborDensifyGraph(dossier, net);
  // Harvest failure is not "Network is center-only" / a clean neighbor-queue miss.
  // Leftover identity / annotation HTTP is not a reaction-network miss.
  const networkEmpty = formatProcessFactsEmptyCopy({
    traces: dossier.traces,
    fetchErrors: dossier.fetchErrors,
  });
  const isCenterOnly = net.nodes.length <= 1;
  const networkSummary =
    isCenterOnly && networkEmpty.kind === "error"
      ? networkEmpty.message
      : net.summary;
  const neighborSummary =
    neighborGraph.queue.length === 0 && networkEmpty.kind === "error"
      ? null
      : neighborGraph.summary;
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  function saveCampaign() {
    const name = `${net.centerName} network`;
    const camp = createCampaign(name, net.campaignCids, {
      description: net.summary,
      labels: Object.fromEntries(
        net.nodes
          .filter((n) => n.pubchemCid)
          .map((n) => [String(n.pubchemCid), n.label])
      ),
    });
    setMsg(`Campaign saved: ${camp.name} (${camp.cids.length} CIDs)`);
  }

  function saveImpurityCampaign() {
    const cids =
      neighborGraph.impurityCids.length > 0
        ? [dossier.cid, ...neighborGraph.impurityCids, ...neighborGraph.intermediateCids]
        : neighborGraph.campaignCids;
    const unique = [...new Set(cids)].slice(0, 40);
    if (unique.length < 2) {
      setMsg("Need related impurity/intermediate PubChem CIDs first.");
      return;
    }
    const labels: Record<string, string> = {
      [String(dossier.cid)]: neighborGraph.centerName,
    };
    for (const t of neighborGraph.queue) {
      labels[String(t.cid)] = `${t.label} (${t.role})`;
    }
    const camp = createCampaign(
      `${neighborGraph.centerName} impurity/related`,
      unique,
      {
        description: neighborGraph.summary,
        labels,
      }
    );
    setMsg(
      `Impurity/related campaign: ${camp.name} · ${camp.cids.length} CIDs (${neighborGraph.impurityCids.length} impurity)`
    );
  }

  function addToLatest() {
    const all = listCampaigns();
    if (!all.length) {
      saveCampaign();
      return;
    }
    const c = addCidToCampaign(
      all[0]!.id,
      dossier.cid,
      dossier.identity?.name
    );
    setMsg(c ? `Added CID ${dossier.cid} to “${c.name}”` : "Could not update campaign");
  }

  async function densifyNeighborQueue() {
    const cids = neighborGraph.queue.map((t) => t.cid).slice(0, 8);
    if (!cids.length) {
      setMsg("No related CIDs with PubChem IDs to densify.");
      return;
    }
    setBusy(true);
    setLog([]);
    setMsg(`Densifying impurity/related queue: ${cids.join(", ")}`);
    try {
      const res = await streamBatchDensifyCids(cids, {
        includeDossiers: true,
        cacheLocal: true,
        concurrency: 2,
        retries: 2,
        onProgress: (m) => setMsg(m),
        onEvent: (ev) => {
          if (ev.type === "cid_complete" && ev.cid != null) {
            const role =
              neighborGraph.queue.find((t) => t.cid === ev.cid)?.role || "?";
            setLog((prev) =>
              [
                ...prev,
                `CID ${ev.cid} (${role}): ${
                  ev.ok ? "ok" : ev.error || "fail"
                } · obs ${ev.summary?.observationCount ?? "—"} · ideal ${
                  ev.summary?.idealScore ?? "—"
                }`,
              ].slice(-20)
            );
          }
        },
      });
      setMsg(
        `${formatBatchDensifyStatus({
          ok: res.ok,
          fail: res.fail,
          error: res.error,
          prefix: "Neighbor densify",
        })} · impurities first`
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Neighbor densify failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="reaction-network"
      className="scroll-mt-24 rounded-xl border border-sky-500/20 bg-slate-900/50 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
        Frontier · multi-CID network
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-50">
          Process reaction network
        </h2>
        <FreePublicProvenance
          dossier={dossier}
          title="Process reaction network"
          field="Reaction network"
          aiField="relatedEntities"
          aiMode="field-or-parsed"
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{net.disclaimer}</p>
      <p className="mt-2 text-xs text-slate-300">{networkSummary}</p>
      {neighborSummary ? (
        <p className="mt-1 text-[11px] text-amber-100/80">{neighborSummary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveCampaign}
          className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
        >
          Save as science campaign
        </button>
        <button
          type="button"
          onClick={saveImpurityCampaign}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100"
        >
          Impurity/related campaign
        </button>
        <button
          type="button"
          disabled={busy || neighborGraph.queue.length === 0}
          onClick={() => void densifyNeighborQueue()}
          className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-40"
        >
          {busy
            ? "Densifying neighbors…"
            : `Densify impurities/related (${neighborGraph.queue.length})`}
        </button>
        <button
          type="button"
          onClick={addToLatest}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300"
        >
          Add center to latest campaign
        </button>
        <Link
          href={routes.workspace()}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-teal-300 hover:border-teal-500/40"
        >
          Workspace / campaigns →
        </Link>
      </div>
      {msg ? <p className="mt-2 text-[11px] text-teal-300/90">{msg}</p> : null}
      {log.length > 0 ? (
        <ul className="mt-2 max-h-24 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      ) : null}

      {neighborGraph.queue.length > 0 ? (
        <div className="mt-3">
          <h3 className="text-[10px] font-semibold uppercase text-amber-200/80">
            Densify queue (impurity first)
          </h3>
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
            {neighborGraph.queue.slice(0, 12).map((t) => (
              <li key={t.cid}>
                <Link
                  href={routes.pubchem(t.cid)}
                  className="text-sky-300 hover:underline"
                >
                  CID {t.cid}
                </Link>{" "}
                {t.label.slice(0, 28)} · <span className="text-amber-200/70">{t.role}</span>{" "}
                · p={t.priority}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">
            Nodes
          </h3>
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-[11px]">
            {net.nodes.map((n) => (
              <li
                key={n.id}
                className="flex flex-wrap items-baseline justify-between gap-1 rounded border border-slate-800 bg-slate-950/40 px-2 py-1"
              >
                <span>
                  <span className="text-[9px] uppercase text-slate-600">
                    {n.role}
                  </span>{" "}
                  {n.pubchemCid ? (
                    <Link
                      href={routes.pubchem(n.pubchemCid)}
                      className="font-medium text-teal-300 hover:underline"
                    >
                      {n.label}
                    </Link>
                  ) : (
                    <span className="text-slate-300">{n.label}</span>
                  )}
                </span>
                {n.pubchemCid ? (
                  <span className="font-mono text-[10px] text-slate-600">
                    CID {n.pubchemCid}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-[10px] font-semibold uppercase text-slate-500">
            Edges
          </h3>
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-[11px] text-slate-400">
            {net.edges.slice(0, 24).map((e) => (
              <li key={e.id} className="rounded border border-slate-800 px-2 py-1">
                <span className="text-slate-500">{e.relation}</span>
                <span className="mt-0.5 block text-[10px] text-slate-600">
                  {e.evidence.slice(0, 2).join(" · ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {net.campaignCids.length > 1 ? (
        <p className="mt-3 text-[10px] text-slate-600">
          Campaign CIDs: {net.campaignCids.join(", ")}
        </p>
      ) : null}

      {net.edges.length >= 2 ? (
        <div className="mt-4">
          <NetworkEdgeComparePanel network={net} dossiers={[dossier]} />
        </div>
      ) : null}
    </div>
  );
}
