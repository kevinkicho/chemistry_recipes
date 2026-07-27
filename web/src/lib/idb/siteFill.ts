/**
 * Site-fill blanks — local-only fields workers fill under their QMS.
 * Never invent plant numbers; empty by design until the user types.
 */

const KEY = "cr-site-fill-v1";

export interface SiteFillRecord {
  cid: number;
  /** Free-text site temperature / time envelopes */
  siteTemp?: string;
  siteTime?: string;
  sitePressure?: string;
  /** Equipment tag (e.g. R-2401) */
  equipmentTag?: string;
  /** Site IPC method name */
  ipcMethod?: string;
  /** Batch / campaign size note */
  batchSize?: string;
  /** Free notes for shift / tech transfer */
  notes?: string;
  updatedAt: string;
}

type Store = Record<string, SiteFillRecord>;

function canUse(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): Store {
  if (!canUse()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Store;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function writeAll(s: Store): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("cr-site-fill-changed"));
}

export function getSiteFill(cid: number): SiteFillRecord | null {
  if (!Number.isFinite(cid)) return null;
  return readAll()[String(cid)] || null;
}

export function saveSiteFill(
  cid: number,
  patch: Partial<Omit<SiteFillRecord, "cid" | "updatedAt">>
): SiteFillRecord {
  const all = readAll();
  const prev = all[String(cid)] || { cid, updatedAt: new Date().toISOString() };
  const next: SiteFillRecord = {
    ...prev,
    ...patch,
    cid,
    updatedAt: new Date().toISOString(),
  };
  all[String(cid)] = next;
  writeAll(all);
  return next;
}

export function clearSiteFill(cid: number): void {
  const all = readAll();
  delete all[String(cid)];
  writeAll(all);
}

export function subscribeSiteFill(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = () => listener();
  window.addEventListener("cr-site-fill-changed", on);
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === KEY) on();
  });
  return () => window.removeEventListener("cr-site-fill-changed", on);
}
