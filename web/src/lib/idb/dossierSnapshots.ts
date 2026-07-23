/**
 * Versioned dossier snapshots (client IndexedDB).
 * Keeps last N completed builds per CID for tech-transfer audit.
 */

import type { LiveDossier } from "@/lib/dossier/types";

const DB_NAME = "chemistry-recipes-snapshots-v1";
const DB_VERSION = 1;
const STORE = "snapshots";
const MAX_PER_CID = 8;

export interface DossierSnapshotRecord {
  id: string;
  cid: number;
  savedAt: number;
  name?: string;
  buildMode?: string;
  evidenceScore?: number;
  model?: string;
  dossier: LiveDossier;
}

function canUseIdb(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("cid", "cid", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("tx aborted"));
  });
}

export async function saveDossierSnapshot(dossier: LiveDossier): Promise<string | null> {
  if (!canUseIdb()) return null;
  const cid = dossier.cid;
  if (!Number.isFinite(cid) || cid <= 0) return null;

  const id = `snap_${cid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const record: DossierSnapshotRecord = {
    id,
    cid,
    savedAt: Date.now(),
    name: dossier.identity?.name,
    buildMode: dossier.buildMode,
    evidenceScore: dossier.evidenceScore?.score,
    model: dossier.synthesis?.model,
    dossier: {
      ...dossier,
      snapshotId: id,
      snapshotSavedAt: new Date().toISOString(),
    },
  };

  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await idbReq(tx.objectStore(STORE).put(record));
      await waitTx(tx);

      // Trim oldest beyond MAX_PER_CID
      const txR = db.transaction(STORE, "readonly");
      const rows = await idbReq<DossierSnapshotRecord[]>(
        txR.objectStore(STORE).index("cid").getAll(cid)
      );
      const sorted = (rows || []).sort((a, b) => b.savedAt - a.savedAt);
      if (sorted.length > MAX_PER_CID) {
        const tx2 = db.transaction(STORE, "readwrite");
        for (const d of sorted.slice(MAX_PER_CID)) {
          tx2.objectStore(STORE).delete(d.id);
        }
        await waitTx(tx2);
      }
      return id;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function listDossierSnapshots(
  cid: number
): Promise<DossierSnapshotRecord[]> {
  if (!canUseIdb() || !Number.isFinite(cid)) return [];
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const idx = tx.objectStore(STORE).index("cid");
      const rows = await idbReq<DossierSnapshotRecord[]>(idx.getAll(cid));
      return (rows || []).sort((a, b) => b.savedAt - a.savedAt);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function getDossierSnapshot(
  id: string
): Promise<DossierSnapshotRecord | null> {
  if (!canUseIdb() || !id) return null;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const row = await idbReq<DossierSnapshotRecord | undefined>(
        tx.objectStore(STORE).get(id)
      );
      return row ?? null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function deleteDossierSnapshot(id: string): Promise<void> {
  if (!canUseIdb() || !id) return;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await idbReq(tx.objectStore(STORE).delete(id));
      await waitTx(tx);
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}
