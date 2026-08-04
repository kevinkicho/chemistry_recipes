/**
 * Campaign-level procedure vault bag — multi-CID densify memory export/import.
 * Local-first; free-public windows only. Not a paid chemistry DB.
 */

import {
  getVaultExcerptsForCid,
  putVaultExcerpts,
} from "@/lib/idb/procedureVault";
import {
  ingestExcerptsToVault,
  loadVaultWindowsForCid,
} from "@/lib/idb/bulkVault";
import type { ProcedureExcerpt } from "@/lib/dossier/types";
import type { ScienceCampaign } from "@/lib/workspace/campaigns";

export const CAMPAIGN_VAULT_SCHEMA =
  "chemistry-recipes.campaign-vault-bag.v1" as const;

export type VaultCidSummary = {
  cid: number;
  label?: string;
  windowCount: number;
  totalChars: number;
  /** Epoch ms of newest window */
  versionAt: number | null;
  sources: string[];
};

export type CampaignVaultBag = {
  schema: typeof CAMPAIGN_VAULT_SCHEMA;
  exportedAt: string;
  campaignId?: string;
  campaignName?: string;
  disclaimer: string;
  summaries: VaultCidSummary[];
  /** Optional full windows (capped) for offline re-import */
  windows?: Array<{
    cid: number;
    id: string;
    source: string;
    label: string;
    text: string;
    url?: string;
    chars: number;
  }>;
};

const DISCLAIMER =
  "Local densify memory bag from free-public procedure windows only. " +
  "Not GMP. Not a plant batch record. Import only text you have rights to use.";

/**
 * Summarize vault density for one CID (version = newest savedAt).
 */
export async function summarizeVaultForCid(
  cid: number,
  label?: string
): Promise<VaultCidSummary> {
  const rows = await getVaultExcerptsForCid(cid);
  const sources = [...new Set(rows.map((r) => r.source))];
  const totalChars = rows.reduce((n, r) => n + (r.chars || 0), 0);
  const versionAt = rows.length
    ? Math.max(...rows.map((r) => r.savedAt || 0))
    : null;
  return {
    cid,
    label,
    windowCount: rows.length,
    totalChars,
    versionAt,
    sources,
  };
}

/**
 * Build a multi-CID vault bag for a campaign (or arbitrary CID list).
 */
export async function buildCampaignVaultBag(
  cids: number[],
  opts?: {
    campaign?: Pick<ScienceCampaign, "id" | "name" | "labels">;
    includeWindows?: boolean;
    maxWindowsPerCid?: number;
  }
): Promise<CampaignVaultBag> {
  const unique = [...new Set(cids.filter((c) => c > 0))].slice(0, 24);
  const summaries: VaultCidSummary[] = [];
  const windows: NonNullable<CampaignVaultBag["windows"]> = [];
  const maxW = opts?.maxWindowsPerCid ?? 12;

  for (const cid of unique) {
    const label = opts?.campaign?.labels?.[String(cid)];
    const sum = await summarizeVaultForCid(cid, label);
    summaries.push(sum);
    if (opts?.includeWindows !== false) {
      const rows = await loadVaultWindowsForCid(cid);
      for (const r of rows.slice(0, maxW)) {
        windows.push({
          cid,
          id: r.id,
          source: r.source || "other",
          label: r.label,
          text: r.text,
          url: r.url,
          chars: r.chars || r.text.length,
        });
      }
    }
  }

  return {
    schema: CAMPAIGN_VAULT_SCHEMA,
    exportedAt: new Date().toISOString(),
    campaignId: opts?.campaign?.id,
    campaignName: opts?.campaign?.name,
    disclaimer: DISCLAIMER,
    summaries,
    windows: opts?.includeWindows === false ? undefined : windows,
  };
}

/**
 * Import bag windows into local procedure vault (merge by key).
 */
export async function importCampaignVaultBag(
  bag: CampaignVaultBag
): Promise<{ cids: number; stored: number }> {
  if (!bag?.windows?.length) return { cids: 0, stored: 0 };
  const byCid = new Map<number, ProcedureExcerpt[]>();
  for (const w of bag.windows) {
    if (!w.cid || !w.text || w.text.length < 60) continue;
    const list = byCid.get(w.cid) || [];
    list.push({
      id: w.id,
      source: (w.source as ProcedureExcerpt["source"]) || "other",
      label: w.label,
      text: w.text,
      url: w.url,
      chars: w.chars || w.text.length,
    });
    byCid.set(w.cid, list);
  }
  let stored = 0;
  for (const [cid, excerpts] of byCid) {
    const res = await ingestExcerptsToVault(cid, excerpts);
    stored += res.stored;
  }
  return { cids: byCid.size, stored };
}

/**
 * Download bag as JSON in the browser.
 */
export function downloadCampaignVaultBag(
  bag: CampaignVaultBag,
  filename?: string
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([JSON.stringify(bag, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ||
    `campaign-vault-${bag.campaignId || "bag"}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Sync procedure excerpts for each campaign CID into vault. */
export async function syncCampaignDossiersToVault(
  items: Array<{ cid: number; excerpts?: ProcedureExcerpt[]; label?: string }>
): Promise<{ cids: number; stored: number }> {
  let stored = 0;
  let cids = 0;
  for (const it of items) {
    if (!it.excerpts?.length) continue;
    const res = await ingestExcerptsToVault(it.cid, it.excerpts, {
      label: it.label,
    });
    if (res.stored) {
      cids += 1;
      stored += res.stored;
    }
  }
  return { cids, stored };
}

// re-export put for tests that want raw write
export { putVaultExcerpts };
