"use client";

import Link from "next/link";
import type { LiveDossier } from "@/lib/dossier/types";
import { buildReactionNetwork } from "@/lib/frontier/reactionNetwork";
import { buildConditionAtlas } from "@/lib/frontier/conditionAtlas";
import { routes } from "@/lib/routes";
import {
  addCidToCampaign,
  createCampaign,
  listCampaigns,
} from "@/lib/workspace/campaigns";
import { NetworkEdgeComparePanel } from "@/components/frontier/NetworkEdgeComparePanel";
import { useState } from "react";

/**
 * Multi-CID process network + campaign hooks.
 */
export function ReactionNetworkPanel({ dossier }: { dossier: LiveDossier }) {
  const atlas =
    dossier.processKnowledge?.conditionAtlas || buildConditionAtlas(dossier);
  const net =
    dossier.processKnowledge?.reactionNetwork ||
    buildReactionNetwork(dossier, atlas);
  const [msg, setMsg] = useState<string | null>(null);

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

  return (
    <div
      id="reaction-network"
      className="scroll-mt-24 rounded-xl border border-sky-500/20 bg-slate-900/50 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
        Frontier · multi-CID network
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Process reaction network
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">{net.disclaimer}</p>
      <p className="mt-2 text-xs text-slate-300">{net.summary}</p>

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
