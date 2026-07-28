/**
 * Client-side densify / batch run telemetry (localStorage).
 * Observability for concurrency, duration, ok/fail — not GMP audit.
 */

const KEY = "cr-densify-telemetry-v1";
const MAX = 40;

export interface DensifyRunRecord {
  id: string;
  at: string;
  kind:
    | "batch-json"
    | "batch-stream"
    | "single"
    | "agent-neighbor"
    | "campaign-server";
  cids: number[];
  concurrency?: number;
  ok: number;
  fail: number;
  durationMs: number;
  detail?: string;
}

function canUse(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): DensifyRunRecord[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as DensifyRunRecord[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeAll(rows: DensifyRunRecord[]): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
  window.dispatchEvent(new CustomEvent("cr-densify-telemetry-changed"));
}

export function listDensifyRuns(): DensifyRunRecord[] {
  return readAll();
}

export function recordDensifyRun(
  partial: Omit<DensifyRunRecord, "id" | "at">
): DensifyRunRecord {
  const row: DensifyRunRecord = {
    ...partial,
    id: `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
  };
  writeAll([row, ...readAll()]);
  return row;
}

export function densifyTelemetrySummary(): {
  runs: number;
  totalOk: number;
  totalFail: number;
  avgDurationMs: number;
  lastConcurrency?: number;
} {
  const rows = readAll();
  if (!rows.length) {
    return { runs: 0, totalOk: 0, totalFail: 0, avgDurationMs: 0 };
  }
  const totalOk = rows.reduce((n, r) => n + r.ok, 0);
  const totalFail = rows.reduce((n, r) => n + r.fail, 0);
  const avgDurationMs = Math.round(
    rows.reduce((n, r) => n + r.durationMs, 0) / rows.length
  );
  return {
    runs: rows.length,
    totalOk,
    totalFail,
    avgDurationMs,
    lastConcurrency: rows[0]?.concurrency,
  };
}

export function subscribeDensifyTelemetry(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = () => listener();
  window.addEventListener("cr-densify-telemetry-changed", on);
  return () => window.removeEventListener("cr-densify-telemetry-changed", on);
}
