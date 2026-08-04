/**
 * Vault densify fingerprint for agent packs / exports.
 * Sync summary from dossier procedure windows (no IndexedDB required).
 * Free-public densify only — not GMP.
 */

import type { LiveDossier, ProcedureExcerpt } from "@/lib/dossier/types";

export const VAULT_FINGERPRINT_SCHEMA =
  "chemistry-recipes.vault-fingerprint.v1" as const;

export type VaultFingerprint = {
  schema: typeof VAULT_FINGERPRINT_SCHEMA;
  cid: number;
  windowCount: number;
  totalChars: number;
  sources: string[];
  /** Short stable id for agent context / cache bust */
  fingerprint: string;
  /** Top window labels for densify-next context */
  topLabels: string[];
  note: string;
};

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint densify procedure windows already on a live dossier.
 * Does not read IndexedDB — safe for server + agent export paths.
 */
export function vaultFingerprintFromExcerpts(
  cid: number,
  excerpts: ProcedureExcerpt[] | undefined | null
): VaultFingerprint {
  const list = (excerpts || []).filter((e) => (e.text || "").length >= 40);
  const sources = [
    ...new Set(list.map((e) => e.source || "other").filter(Boolean)),
  ].slice(0, 16);
  const totalChars = list.reduce(
    (n, e) => n + (e.chars || e.text.length),
    0
  );
  const topLabels = list
    .slice()
    .sort(
      (a, b) =>
        (b.chars || b.text.length) - (a.chars || a.text.length)
    )
    .slice(0, 6)
    .map((e) => (e.label || e.id || e.source).slice(0, 80));
  const material = list
    .map(
      (e) =>
        `${e.id}|${e.source}|${e.chars || e.text.length}|${(e.text || "").slice(0, 120)}`
    )
    .join("\n");
  const fingerprint = `${cid}-${list.length}-${totalChars}-${fnv1a(material)}`;

  return {
    schema: VAULT_FINGERPRINT_SCHEMA,
    cid,
    windowCount: list.length,
    totalChars,
    sources,
    fingerprint,
    topLabels,
    note:
      "Densify procedure-window fingerprint from free-public harvest on this dossier. " +
      "Local IndexedDB vault may hold more windows after paste/sync. Not GMP.",
  };
}

export function vaultFingerprintFromDossier(
  dossier: LiveDossier
): VaultFingerprint {
  return vaultFingerprintFromExcerpts(
    dossier.cid,
    dossier.procedureExcerpts
  );
}
