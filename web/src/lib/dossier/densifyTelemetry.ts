/**
 * Client-side densify / batch run telemetry (localStorage).
 * Observability for concurrency, duration, ok/fail, AI ingest deltas — not GMP audit.
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
    | "campaign-server"
    | "guidance-queue";
  cids: number[];
  concurrency?: number;
  ok: number;
  fail: number;
  durationMs: number;
  detail?: string;
  /** Single-CID AI ingest readiness before densify (0–100) */
  ingestBefore?: number;
  /** Single-CID AI ingest readiness after densify (0–100) */
  ingestAfter?: number;
  /** ingestAfter − ingestBefore */
  ingestDelta?: number;
  /** Campaign mean ingest before multi-CID densify */
  meanIngestBefore?: number;
  /** Campaign mean ingest after multi-CID densify */
  meanIngestAfter?: number;
  /** meanIngestAfter − meanIngestBefore */
  meanIngestDelta?: number;
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
  // Auto-compute deltas when both sides present
  if (
    row.ingestBefore != null &&
    row.ingestAfter != null &&
    row.ingestDelta == null
  ) {
    row.ingestDelta = row.ingestAfter - row.ingestBefore;
  }
  if (
    row.meanIngestBefore != null &&
    row.meanIngestAfter != null &&
    row.meanIngestDelta == null
  ) {
    row.meanIngestDelta = row.meanIngestAfter - row.meanIngestBefore;
  }
  writeAll([row, ...readAll()]);
  return row;
}

/**
 * Record a guidance densify queue with optional single-CID or campaign mean ingest deltas.
 */
export function recordIngestDeltaRun(opts: {
  kind?: DensifyRunRecord["kind"];
  cids: number[];
  ok: number;
  fail: number;
  durationMs: number;
  detail?: string;
  concurrency?: number;
  ingestBefore?: number;
  ingestAfter?: number;
  meanIngestBefore?: number;
  meanIngestAfter?: number;
}): DensifyRunRecord {
  const ingestDelta =
    opts.ingestBefore != null && opts.ingestAfter != null
      ? opts.ingestAfter - opts.ingestBefore
      : undefined;
  const meanIngestDelta =
    opts.meanIngestBefore != null && opts.meanIngestAfter != null
      ? opts.meanIngestAfter - opts.meanIngestBefore
      : undefined;
  const deltaPart =
    ingestDelta != null
      ? `ingest ${opts.ingestBefore}→${opts.ingestAfter} (Δ${ingestDelta >= 0 ? "+" : ""}${ingestDelta})`
      : meanIngestDelta != null
        ? `mean ingest ${opts.meanIngestBefore}→${opts.meanIngestAfter} (Δ${meanIngestDelta >= 0 ? "+" : ""}${meanIngestDelta})`
        : "";
  return recordDensifyRun({
    kind: opts.kind || "guidance-queue",
    cids: opts.cids,
    ok: opts.ok,
    fail: opts.fail,
    durationMs: opts.durationMs,
    concurrency: opts.concurrency,
    detail: [opts.detail, deltaPart].filter(Boolean).join(" · "),
    ingestBefore: opts.ingestBefore,
    ingestAfter: opts.ingestAfter,
    ingestDelta,
    meanIngestBefore: opts.meanIngestBefore,
    meanIngestAfter: opts.meanIngestAfter,
    meanIngestDelta,
  });
}

export function densifyTelemetrySummary(): {
  runs: number;
  totalOk: number;
  totalFail: number;
  avgDurationMs: number;
  lastConcurrency?: number;
  /** Mean of recorded single-CID ingest deltas (only runs with delta) */
  avgIngestDelta?: number;
  /** Mean of campaign mean-ingest deltas */
  avgMeanIngestDelta?: number;
  runsWithIngestDelta: number;
} {
  const rows = readAll();
  if (!rows.length) {
    return {
      runs: 0,
      totalOk: 0,
      totalFail: 0,
      avgDurationMs: 0,
      runsWithIngestDelta: 0,
    };
  }
  const totalOk = rows.reduce((n, r) => n + r.ok, 0);
  const totalFail = rows.reduce((n, r) => n + r.fail, 0);
  const avgDurationMs = Math.round(
    rows.reduce((n, r) => n + r.durationMs, 0) / rows.length
  );
  const withIngest = rows.filter((r) => r.ingestDelta != null);
  const withMean = rows.filter((r) => r.meanIngestDelta != null);
  return {
    runs: rows.length,
    totalOk,
    totalFail,
    avgDurationMs,
    lastConcurrency: rows[0]?.concurrency,
    avgIngestDelta: withIngest.length
      ? Math.round(
          (withIngest.reduce((n, r) => n + (r.ingestDelta || 0), 0) /
            withIngest.length) *
            10
        ) / 10
      : undefined,
    avgMeanIngestDelta: withMean.length
      ? Math.round(
          (withMean.reduce((n, r) => n + (r.meanIngestDelta || 0), 0) /
            withMean.length) *
            10
        ) / 10
      : undefined,
    runsWithIngestDelta: withIngest.length + withMean.length,
  };
}

export function subscribeDensifyTelemetry(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const on = () => listener();
  window.addEventListener("cr-densify-telemetry-changed", on);
  return () => window.removeEventListener("cr-densify-telemetry-changed", on);
}
