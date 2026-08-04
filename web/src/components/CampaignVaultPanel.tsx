"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCampaigns,
  subscribeCampaigns,
  type ScienceCampaign,
} from "@/lib/workspace/campaigns";
import {
  buildCampaignVaultBag,
  downloadCampaignVaultBag,
  importCampaignVaultBag,
  type CampaignVaultBag,
  type VaultCidSummary,
} from "@/lib/idb/campaignVault";
import { getCachedDossier } from "@/lib/idb/dossierCache";
import { ingestExcerptsToVault } from "@/lib/idb/bulkVault";

/**
 * Workspace: export / import multi-CID procedure vault bags for campaigns.
 */
export function CampaignVaultPanel() {
  const [campaigns, setCampaigns] = useState<ScienceCampaign[]>([]);
  const [selected, setSelected] = useState("");
  const [summaries, setSummaries] = useState<VaultCidSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    const rows = listCampaigns();
    setCampaigns(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }, [selected]);

  useEffect(() => {
    reload();
    return subscribeCampaigns(reload);
  }, [reload]);

  const camp = campaigns.find((c) => c.id === selected) || null;

  const refreshSummaries = useCallback(async () => {
    if (!camp?.cids.length) {
      setSummaries([]);
      return;
    }
    const bag = await buildCampaignVaultBag(camp.cids, {
      campaign: camp,
      includeWindows: false,
    });
    setSummaries(bag.summaries);
  }, [camp]);

  useEffect(() => {
    void refreshSummaries();
  }, [refreshSummaries]);

  async function syncFromCache() {
    if (!camp) return;
    setBusy(true);
    setStatus(null);
    try {
      let stored = 0;
      for (const cid of camp.cids.slice(0, 24)) {
        const cached = await getCachedDossier(cid);
        const ex = cached?.dossier?.procedureExcerpts;
        if (ex?.length) {
          const r = await ingestExcerptsToVault(cid, ex, {
            label: camp.labels?.[String(cid)],
          });
          stored += r.stored;
        }
      }
      await refreshSummaries();
      setStatus(
        stored
          ? `Synced ${stored} window(s) from local densify cache into vault.`
          : "No procedure excerpts in local cache — densify campaign CIDs first."
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function exportBag() {
    if (!camp) return;
    setBusy(true);
    setStatus(null);
    try {
      const bag = await buildCampaignVaultBag(camp.cids, {
        campaign: camp,
        includeWindows: true,
      });
      downloadCampaignVaultBag(bag);
      setStatus(
        `Exported ${bag.summaries.length} CID(s) · ${
          bag.windows?.length || 0
        } window(s). Not GMP.`
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  function onImportFile(file: File) {
    setBusy(true);
    setStatus(null);
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const bag = JSON.parse(String(reader.result)) as CampaignVaultBag;
          if (!bag?.schema?.includes("campaign-vault-bag")) {
            setStatus("Not a campaign-vault-bag.v1 JSON file.");
            return;
          }
          const res = await importCampaignVaultBag(bag);
          await refreshSummaries();
          setStatus(
            `Imported ${res.stored} window(s) across ${res.cids} CID(s).`
          );
        } catch (e) {
          setStatus(e instanceof Error ? e.message : "Import failed");
        } finally {
          setBusy(false);
        }
      })();
    };
    reader.onerror = () => {
      setStatus("Could not read file");
      setBusy(false);
    };
    reader.readAsText(file);
  }

  return (
    <div
      id="campaign-vault"
      className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/90">
        Campaign vault bag
      </p>
      <h2 className="mt-1 text-sm font-semibold text-slate-50">
        Multi-CID densify memory
      </h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Export procedure windows for a science campaign (impurities + API). Re-import
        on another browser. Free-public densify only — not GMP.
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

      {summaries.length > 0 ? (
        <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto font-mono text-[10px] text-slate-500">
          {summaries.map((s) => (
            <li key={s.cid}>
              CID {s.cid}
              {s.label ? ` · ${s.label}` : ""} · {s.windowCount} win ·{" "}
              {s.totalChars.toLocaleString()} ch
              {s.versionAt
                ? ` · v ${new Date(s.versionAt).toISOString().slice(0, 10)}`
                : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-slate-600">
          {camp
            ? "No vault windows yet — sync from densify cache or densify CIDs."
            : "Select a campaign."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy || !camp}
          onClick={() => void syncFromCache()}
          className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          Sync cache → vault
        </button>
        <button
          type="button"
          disabled={busy || !camp}
          onClick={() => void exportBag()}
          className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-100 disabled:opacity-40"
        >
          Export bag JSON
        </button>
        <label className="cursor-pointer rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-500/40">
          Import bag JSON
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {status ? (
        <p className="mt-2 text-[11px] text-sky-100/90" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
