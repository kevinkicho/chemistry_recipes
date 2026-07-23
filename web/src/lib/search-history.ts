/** Client-side search / navigation history (localStorage). */

import { routes } from "@/lib/routes";

export const SEARCH_HISTORY_KEY = "cr-search-history-v1";
export const HISTORY_EVENT = "cr-search-history-changed";
export const MAX_HISTORY = 40;

export type HistoryKind = "search" | "molecule" | "cid";

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  /** Display label */
  label: string;
  /** Navigation path (may include query string) */
  href: string;
  /** Original query string when kind === search */
  query?: string;
  ts: number;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

export function readHistory(): HistoryEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        Boolean(e && typeof e === "object" && e.id && e.href && e.label && e.kind)
    );
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    /* quota / private mode */
  }
  notify();
}

/** Stable id so React keys and dedupe stay consistent across revisits. */
export function historyEntryId(kind: HistoryKind, href: string): string {
  return `${kind}:${href}`;
}

export function pushHistory(
  entry: Omit<HistoryEntry, "id" | "ts"> & { id?: string; ts?: number }
) {
  if (!canUseStorage()) return;

  const href = entry.href.trim();
  if (!href || !entry.label.trim()) return;

  const id = entry.id ?? historyEntryId(entry.kind, href);
  const next: HistoryEntry = {
    id,
    kind: entry.kind,
    label: entry.label.trim(),
    href,
    query: entry.query?.trim() || undefined,
    ts: entry.ts ?? Date.now(),
  };

  const prev = readHistory().filter((e) => {
    if (e.id === next.id) return false;
    if (e.kind === next.kind && e.href === next.href) return false;
    if (next.query && e.query && e.query.toLowerCase() === next.query.toLowerCase()) {
      return false;
    }
    return true;
  });

  writeHistory([next, ...prev]);
}

export function removeHistory(id: string) {
  writeHistory(readHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  writeHistory([]);
}

export function pushSearchQuery(query: string) {
  const q = query.trim();
  if (!q) return;
  pushHistory({
    kind: "search",
    label: q,
    href: routes.search(q),
    query: q,
  });
}

/** Subscribe to history mutations (same-tab custom event + cross-tab storage). */
export function subscribeHistory(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = () => listener();
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SEARCH_HISTORY_KEY) listener();
  };

  window.addEventListener(HISTORY_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(HISTORY_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
