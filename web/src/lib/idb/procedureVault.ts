/**
 * Client durable procedure vault — accumulates free-public + user densify
 * windows across rebuilds so thin re-gathers don't lose prior excerpts.
 *
 * Browser-only IndexedDB. Never store confidential SOPs.
 */

const DB_NAME = "chemistry-recipes-procedure-vault";
const DB_VERSION = 1;
const STORE = "excerpts";

export interface VaultExcerpt {
  /** cid:source:id */
  key: string;
  cid: number;
  source: string;
  label: string;
  text: string;
  url?: string;
  chars: number;
  savedAt: number;
}

function canUse(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("vault open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "key" });
        s.createIndex("cid", "cid", { unique: false });
        s.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("vault req failed"));
  });
}

export async function getVaultExcerptsForCid(
  cid: number
): Promise<VaultExcerpt[]> {
  if (!canUse() || !Number.isFinite(cid)) return [];
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const idx = tx.objectStore(STORE).index("cid");
      const rows = await idbReq<VaultExcerpt[]>(idx.getAll(cid));
      return (rows || []).sort((a, b) => b.chars - a.chars).slice(0, 40);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function putVaultExcerpts(
  cid: number,
  items: Array<{
    id: string;
    source: string;
    label: string;
    text: string;
    url?: string;
    chars?: number;
  }>
): Promise<void> {
  if (!canUse() || !items.length) return;
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const now = Date.now();
      for (const it of items) {
        if (!it.text || it.text.length < 60) continue;
        const row: VaultExcerpt = {
          key: `${cid}:${it.source}:${it.id}`,
          cid,
          source: it.source,
          label: it.label.slice(0, 160),
          text: it.text.slice(0, 12_000),
          url: it.url,
          chars: it.chars || it.text.length,
          savedAt: now,
        };
        store.put(row);
      }
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}
