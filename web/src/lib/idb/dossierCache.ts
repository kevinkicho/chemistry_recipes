/**
 * IndexedDB persistence for live dossiers (client-only).
 * Avoids re-running free APIs + Ollama on every revisit.
 * Users force a refetch via History ↻ or in-page Refresh.
 */

import type { LiveDossier } from "@/lib/dossier/types";

const DB_NAME = "chemistry-recipes-v1";
const DB_VERSION = 1;
const STORE = "dossiers";

export interface CachedDossierRecord {
  cid: number;
  dossier: LiveDossier;
  /** Wall-clock ms when written */
  savedAt: number;
  /** Display name snapshot */
  name?: string;
  /** Schema version for future migrations */
  schemaVersion: number;
}

/** Bump when live dossier quality pipeline changes so stale junk scaffolds are discarded */
const SCHEMA_VERSION = 4;

function canUseIdb(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "cid" });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

/** Load a cached dossier by PubChem CID, or null if missing. */
export async function getCachedDossier(
  cid: number
): Promise<CachedDossierRecord | null> {
  if (!canUseIdb() || !Number.isFinite(cid) || cid <= 0) return null;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const row = await idbReq<CachedDossierRecord | undefined>(store.get(cid));
      if (!row?.dossier || row.schemaVersion !== SCHEMA_VERSION) return null;
      return row;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Persist a completed live dossier for offline-style revisits. */
export async function putCachedDossier(dossier: LiveDossier): Promise<void> {
  if (!canUseIdb()) return;
  const cid = dossier.cid;
  if (!Number.isFinite(cid) || cid <= 0) return;

  const record: CachedDossierRecord = {
    cid,
    dossier,
    savedAt: Date.now(),
    name: dossier.identity?.name,
    schemaVersion: SCHEMA_VERSION,
  };

  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await idbReq(tx.objectStore(STORE).put(record));
      // Wait for transaction to complete
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("tx failed"));
        tx.onabort = () => reject(tx.error ?? new Error("tx aborted"));
      });
    } finally {
      db.close();
    }
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Drop one CID from the cache (before forced refresh). */
export async function deleteCachedDossier(cid: number): Promise<void> {
  if (!canUseIdb() || !Number.isFinite(cid) || cid <= 0) return;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await idbReq(tx.objectStore(STORE).delete(cid));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("tx failed"));
        tx.onabort = () => reject(tx.error ?? new Error("tx aborted"));
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

/** List cached CIDs (for optional UI). */
export async function listCachedDossiers(): Promise<
  Array<{ cid: number; name?: string; savedAt: number }>
> {
  if (!canUseIdb()) return [];
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const all = await idbReq<CachedDossierRecord[]>(tx.objectStore(STORE).getAll());
      return (all || [])
        .map((r) => ({ cid: r.cid, name: r.name, savedAt: r.savedAt }))
        .sort((a, b) => b.savedAt - a.savedAt);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export function formatCacheAge(savedAt: number): string {
  const ms = Date.now() - savedAt;
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  return `${Math.floor(ms / 86_400_000)} d ago`;
}

/** Custom event so history UI can show cache badges if needed later. */
export const DOSSIER_CACHE_EVENT = "cr-dossier-cache-changed";

export function notifyDossierCacheChanged(cid?: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DOSSIER_CACHE_EVENT, { detail: { cid } })
  );
}

export async function putCachedDossierAndNotify(dossier: LiveDossier): Promise<void> {
  await putCachedDossier(dossier);
  notifyDossierCacheChanged(dossier.cid);
}

export async function deleteCachedDossierAndNotify(cid: number): Promise<void> {
  await deleteCachedDossier(cid);
  notifyDossierCacheChanged(cid);
}
