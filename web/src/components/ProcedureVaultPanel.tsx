"use client";

import { useCallback, useEffect, useState } from "react";
import type { LiveDossier } from "@/lib/dossier/types";
import {
  bulkVaultManifest,
  ingestExcerptsToVault,
  loadVaultWindowsForCid,
} from "@/lib/idb/bulkVault";
import {
  buildCampaignVaultBag,
  downloadCampaignVaultBag,
  summarizeVaultForCid,
} from "@/lib/idb/campaignVault";
import { FreePublicProvenance } from "@/components/FreePublicProvenance";

/**
 * Procedure vault hero — local densify memory (OA/patent/paste windows).
 * Competitive moat under free-public law: durable offline procedure text.
 */
export function ProcedureVaultPanel({
  dossier,
  onScrollPaste,
  onRegenerate,
}: {
  dossier: LiveDossier;
  onScrollPaste?: () => void;
  onRegenerate?: () => void;
}) {
  const [windows, setWindows] = useState<
    Array<{ id: string; label: string; chars: number; source: string }>
  >([]);
  const [versionAt, setVersionAt] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const manifest = bulkVaultManifest();

  const reload = useCallback(async () => {
    const rows = await loadVaultWindowsForCid(dossier.cid);
    setWindows(
      rows.map((r) => ({
        id: r.id,
        label: r.label,
        chars: r.chars || r.text.length,
        source: r.source,
      }))
    );
    const sum = await summarizeVaultForCid(
      dossier.cid,
      dossier.identity?.name
    );
    setVersionAt(sum.versionAt);
  }, [dossier.cid, dossier.identity?.name]);

  useEffect(() => {
    void reload();
  }, [reload, dossier.procedureExcerpts?.length]);

  async function syncFromDossier() {
    setBusy(true);
    setStatus(null);
    try {
      const excerpts = dossier.procedureExcerpts || [];
      const res = await ingestExcerptsToVault(dossier.cid, excerpts, {
        label: dossier.identity?.name,
      });
      // Also promote densified lit/patent bodies already on dossier via enrich path
      await reload();
      setStatus(
        res.stored
          ? `Vault sync · ${res.stored} procedure window(s) stored locally. Not GMP.`
          : excerpts.length
            ? "No new windows ≥60 chars to store."
            : "No procedure excerpts on dossier yet — force densify or paste public text."
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Vault sync failed");
    } finally {
      setBusy(false);
    }
  }

  const totalChars = windows.reduce((n, w) => n + w.chars, 0);

  async function exportVaultBag() {
    setBusy(true);
    setStatus(null);
    try {
      // Ensure latest densify windows are in vault before export
      if (dossier.procedureExcerpts?.length) {
        await ingestExcerptsToVault(dossier.cid, dossier.procedureExcerpts, {
          label: dossier.identity?.name,
        });
      }
      const bag = await buildCampaignVaultBag([dossier.cid], {
        campaign: {
          id: `cid-${dossier.cid}`,
          name: dossier.identity?.name || `CID ${dossier.cid}`,
          labels: {
            [String(dossier.cid)]: dossier.identity?.name || `CID ${dossier.cid}`,
          },
        },
        includeWindows: true,
      });
      downloadCampaignVaultBag(
        bag,
        `vault-${dossier.cid}-${Date.now()}.json`
      );
      setStatus(
        `Exported vault bag · ${bag.summaries[0]?.windowCount ?? 0} window(s). Not GMP.`
      );
      await reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="procedure-vault"
      className="print:hidden scroll-mt-24 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/90">
          Procedure vault · local densify memory
        </p>
        <FreePublicProvenance
          dossier={dossier}
          title="Procedure vault"
          field="Procedure vault"
          onRegenerate={onRegenerate}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Durable free-public procedure windows in IndexedDB survive thin re-gathers.
        Online densify stays multi-API only — vault is offline enrichment, not a paid DB.
        {manifest.note ? "" : ""}
      </p>
      <p className="mt-2 font-mono text-[11px] text-slate-300">
        {windows.length} window(s) · ~{totalChars.toLocaleString()} chars · CID{" "}
        {dossier.cid}
        {versionAt
          ? ` · v ${new Date(versionAt).toISOString().slice(0, 16)}Z`
          : ""}
      </p>
      {windows.length > 0 ? (
        <ul className="mt-2 max-h-28 space-y-0.5 overflow-y-auto text-[10px] text-slate-500">
          {windows.slice(0, 12).map((w) => (
            <li key={w.id} className="truncate">
              <span className="text-slate-400">{w.source}</span>
              {" · "}
              {w.label.slice(0, 72)}
              {" · "}
              {w.chars.toLocaleString()} ch
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-slate-600">
          Empty vault — densify OA/patents or paste public experimental text.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void syncFromDossier()}
          className="rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {busy ? "Syncing…" : "Sync densify → vault"}
        </button>
        {onScrollPaste ? (
          <button
            type="button"
            onClick={onScrollPaste}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-500/40"
          >
            Paste wizard
          </button>
        ) : null}
        {onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-100"
          >
            Force densify
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void exportVaultBag()}
          className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-sky-500/40 disabled:opacity-40"
        >
          Export vault bag JSON
        </button>
      </div>
      {status ? (
        <p className="mt-2 text-[11px] text-sky-100/90" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
