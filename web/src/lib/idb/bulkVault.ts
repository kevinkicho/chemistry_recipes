/**
 * Lightweight bulk densify vault hooks.
 * Local-first procedure vault + optional ORD bulk snippets — not paid DBs.
 * Online densify stays free-public; vault enriches offline paste density.
 */

import {
  getVaultExcerptsForCid,
  putVaultExcerpts,
} from "@/lib/idb/procedureVault";
import type { ProcedureExcerpt } from "@/lib/dossier/types";

export const BULK_VAULT_SCHEMA = "chemistry-recipes.bulk-vault.v1" as const;

/**
 * Import densified procedure excerpts into the local vault for a CID.
 * Call after successful densify to build a durable offline window store.
 */
export async function ingestExcerptsToVault(
  cid: number,
  excerpts: ProcedureExcerpt[],
  opts?: { label?: string }
): Promise<{ stored: number }> {
  if (!excerpts?.length || !Number.isFinite(cid)) return { stored: 0 };
  const items = excerpts
    .filter((e) => (e.text || "").length >= 60)
    .slice(0, 48)
    .map((e) => ({
      id: e.id || `excerpt-${Math.random().toString(36).slice(2, 9)}`,
      source: e.source || "other",
      label: (opts?.label || e.label || "procedure").slice(0, 160),
      text: e.text,
      url: e.url,
      chars: e.chars || e.text.length,
    }));
  if (!items.length) return { stored: 0 };
  await putVaultExcerpts(cid, items);
  return { stored: items.length };
}

/**
 * Load vault windows for densify paste / AI package enrichment.
 */
export async function loadVaultWindowsForCid(
  cid: number
): Promise<ProcedureExcerpt[]> {
  const rows = await getVaultExcerptsForCid(cid);
  return rows.map((r) => ({
    id: r.key,
    source: (r.source as ProcedureExcerpt["source"]) || "other",
    label: r.label,
    text: r.text,
    url: r.url,
    chars: r.chars,
  }));
}

export type BulkVaultManifest = {
  schema: typeof BULK_VAULT_SCHEMA;
  note: string;
  paths: {
    procedureVault: string;
    ordBulk: string;
  };
};

/** Documented bulk paths for power users (no network in this helper). */
export function bulkVaultManifest(): BulkVaultManifest {
  return {
    schema: BULK_VAULT_SCHEMA,
    note:
      "Optional offline enrichment: procedure vault (IndexedDB) + ORD bulk datasets. " +
      "Online densify remains free-public multi-API only. Not a paid chemistry database.",
    paths: {
      procedureVault: "lib/idb/procedureVault.ts",
      ordBulk: "lib/api/ordBulk.ts",
    },
  };
}
