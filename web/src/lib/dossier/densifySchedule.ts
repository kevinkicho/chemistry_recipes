/**
 * Client-side densify schedule — remember recently viewed CIDs and suggest
 * background warm/refresh. Local-first; no server jobs.
 */

const KEY = "cr-densify-schedule-v1";
const MAX = 24;

export interface DensifyScheduleEntry {
  cid: number;
  label?: string;
  lastViewedAt: string;
  lastWarmedAt?: string;
  procedureCharsHint?: number;
  evidenceScore?: number;
  /** Soft priority: higher = warm sooner */
  priority: number;
}

type Store = {
  entries: DensifyScheduleEntry[];
  updatedAt: string;
};

function canUse(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function read(): Store {
  if (!canUse()) return { entries: [], updatedAt: new Date().toISOString() };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { entries: [], updatedAt: new Date().toISOString() };
    const p = JSON.parse(raw) as Store;
    return p?.entries ? p : { entries: [], updatedAt: new Date().toISOString() };
  } catch {
    return { entries: [], updatedAt: new Date().toISOString() };
  }
}

function write(s: Store): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("cr-densify-schedule-changed"));
}

export function touchDensifySchedule(
  cid: number,
  opts?: {
    label?: string;
    procedureCharsHint?: number;
    evidenceScore?: number;
    warmed?: boolean;
  }
): void {
  if (!Number.isFinite(cid) || cid <= 0) return;
  const store = read();
  const now = new Date().toISOString();
  const rest = store.entries.filter((e) => e.cid !== cid);
  const prev = store.entries.find((e) => e.cid === cid);
  const thin =
    (opts?.evidenceScore != null && opts.evidenceScore < 45) ||
    (opts?.procedureCharsHint != null && opts.procedureCharsHint < 400);
  const entry: DensifyScheduleEntry = {
    cid,
    label: opts?.label || prev?.label,
    lastViewedAt: now,
    lastWarmedAt: opts?.warmed ? now : prev?.lastWarmedAt,
    procedureCharsHint: opts?.procedureCharsHint ?? prev?.procedureCharsHint,
    evidenceScore: opts?.evidenceScore ?? prev?.evidenceScore,
    priority: thin ? 10 : 5,
  };
  write({ entries: [entry, ...rest].slice(0, MAX), updatedAt: now });
}

export function listDensifySchedule(): DensifyScheduleEntry[] {
  return read().entries.slice().sort((a, b) => b.priority - a.priority);
}

/** CIDs that look thin and haven't been warmed in 12h */
export function cidsDueForDensify(nowMs = Date.now()): DensifyScheduleEntry[] {
  const twelveH = 12 * 60 * 60 * 1000;
  return listDensifySchedule().filter((e) => {
    if (e.priority < 8) return false;
    if (!e.lastWarmedAt) return true;
    const t = Date.parse(e.lastWarmedAt);
    return !Number.isFinite(t) || nowMs - t > twelveH;
  });
}

export function markDensifyWarmed(cid: number): void {
  const store = read();
  const now = new Date().toISOString();
  write({
    updatedAt: now,
    entries: store.entries.map((e) =>
      e.cid === cid ? { ...e, lastWarmedAt: now, priority: Math.max(1, e.priority - 3) } : e
    ),
  });
}
