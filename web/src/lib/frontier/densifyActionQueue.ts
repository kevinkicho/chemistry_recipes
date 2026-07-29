/**
 * Map densify-next actions → executable free-public densify work.
 * Goal: auto-queue harvest that improves AI ingest, not paper previews.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { DensifyNextAction } from "@/lib/frontier/aiGuidancePackage";
import { prioritizedNeighborCids } from "@/lib/frontier/neighborDensifyGraph";
import { streamBatchDensifyCids } from "@/lib/dossier/batchClient";
import { recordDensifyRun } from "@/lib/dossier/densifyTelemetry";

export type DensifyQueueMode =
  | "force-primary"
  | "neighbors"
  | "campaign-cids"
  | "manual-paste"
  | "noop";

export interface DensifyQueuePlan {
  modes: DensifyQueueMode[];
  /** CIDs to stream densify (may include primary when force) */
  cids: number[];
  forcePrimary: boolean;
  actionsUsed: DensifyNextAction[];
  manualHints: string[];
  summary: string;
}

/**
 * Build a densify queue plan from guidance densifyNext actions.
 */
export function planDensifyActions(
  dossier: LiveDossier,
  actions: DensifyNextAction[],
  opts?: { maxNeighbors?: number; onlyHigh?: boolean }
): DensifyQueuePlan {
  const list = opts?.onlyHigh
    ? actions.filter((a) => a.priority === "high")
    : actions;
  const modes = new Set<DensifyQueueMode>();
  const cids = new Set<number>();
  const manualHints: string[] = [];
  let forcePrimary = false;

  for (const a of list) {
    switch (a.kind) {
      case "oa-literature":
      case "patent-procedure":
      case "force-regather":
      case "multi-source-search":
        forcePrimary = true;
        modes.add("force-primary");
        cids.add(dossier.cid);
        break;
      case "neighbor-impurity": {
        modes.add("neighbors");
        const n = prioritizedNeighborCids(
          dossier,
          opts?.maxNeighbors ?? 4
        );
        for (const c of n) cids.add(c);
        break;
      }
      case "campaign-densify":
        modes.add("campaign-cids");
        break;
      case "local-paste":
        modes.add("manual-paste");
        manualHints.push(a.how);
        break;
      default:
        break;
    }
  }

  // If only manual, still ok
  if (!modes.size) modes.add("noop");

  const cidList = [...cids].filter((c) => c > 0).slice(0, 12);
  const summaryParts: string[] = [];
  if (forcePrimary) summaryParts.push(`force re-gather CID ${dossier.cid}`);
  if (modes.has("neighbors")) {
    const neigh = cidList.filter((c) => c !== dossier.cid);
    summaryParts.push(
      neigh.length
        ? `densify neighbors ${neigh.join(", ")}`
        : "neighbors requested but none resolved"
    );
  }
  if (modes.has("manual-paste")) summaryParts.push("manual paste still needed");
  if (modes.has("noop") && summaryParts.length === 0) {
    summaryParts.push("no executable densify actions");
  }

  return {
    modes: [...modes],
    cids: cidList,
    forcePrimary,
    actionsUsed: list,
    manualHints,
    summary: summaryParts.join(" · ") || "idle",
  };
}

export interface RunDensifyQueueResult {
  ok: boolean;
  plan: DensifyQueuePlan;
  densifiedCids: number[];
  failedCids: number[];
  /** True when caller should hard-refresh primary page (?refresh=1) */
  needsPageRefresh: boolean;
  detail: string;
}

/**
 * Execute densify plan via batch stream (neighbors + optional primary force).
 * When forcePrimary is true, prefer page refresh so SSE rebuild skips server cache
 * if the caller wires needsPageRefresh → ?refresh=1 with force on stream.
 */
export async function runDensifyActionQueue(
  dossier: LiveDossier,
  actions: DensifyNextAction[],
  opts?: {
    onlyHigh?: boolean;
    maxNeighbors?: number;
    /** If true, stream primary with force instead of only signaling page refresh */
    streamPrimary?: boolean;
    onProgress?: (msg: string) => void;
  }
): Promise<RunDensifyQueueResult> {
  const plan = planDensifyActions(dossier, actions, {
    onlyHigh: opts?.onlyHigh !== false,
    maxNeighbors: opts?.maxNeighbors,
  });

  if (plan.modes.includes("noop") && plan.cids.length === 0) {
    return {
      ok: true,
      plan,
      densifiedCids: [],
      failedCids: [],
      needsPageRefresh: false,
      detail: plan.summary,
    };
  }

  // Prefer page refresh for primary force (client loader + force stream)
  if (plan.forcePrimary && !opts?.streamPrimary) {
    const neighbors = plan.cids.filter((c) => c !== dossier.cid);
    let densified: number[] = [];
    let failed: number[] = [];
    if (neighbors.length) {
      opts?.onProgress?.(`Densifying ${neighbors.length} neighbor CID(s)…`);
      const t0 = Date.now();
      const res = await streamBatchDensifyCids(neighbors, {
        includeDossiers: true,
        cacheLocal: true,
        force: false,
        onProgress: opts?.onProgress,
      });
      densified = res.results.filter((r) => r.ok).map((r) => r.cid);
      failed = res.results.filter((r) => !r.ok).map((r) => r.cid);
      recordDensifyRun({
        kind: "agent-neighbor",
        cids: neighbors,
        ok: densified.length,
        fail: failed.length,
        durationMs: Date.now() - t0,
        detail: "densify-action-queue-neighbors",
      });
    }
    return {
      ok: failed.length === 0,
      plan,
      densifiedCids: densified,
      failedCids: failed,
      needsPageRefresh: true,
      detail: `${plan.summary}${neighbors.length ? ` · neighbors ok ${densified.length}` : ""} · page refresh for primary force densify`,
    };
  }

  const queue = plan.cids.length
    ? plan.cids
    : plan.forcePrimary
      ? [dossier.cid]
      : [];
  if (!queue.length) {
    return {
      ok: true,
      plan,
      densifiedCids: [],
      failedCids: [],
      needsPageRefresh: false,
      detail: plan.manualHints[0] || plan.summary,
    };
  }

  opts?.onProgress?.(`Streaming densify: ${queue.join(", ")}`);
  const t0 = Date.now();
  const res = await streamBatchDensifyCids(queue, {
    includeDossiers: true,
    cacheLocal: true,
    force: plan.forcePrimary,
    onProgress: opts?.onProgress,
  });
  const densified = res.results.filter((r) => r.ok).map((r) => r.cid);
  const failed = res.results.filter((r) => !r.ok).map((r) => r.cid);
  recordDensifyRun({
    kind: "batch-stream",
    cids: queue,
    ok: densified.length,
    fail: failed.length,
    durationMs: Date.now() - t0,
    detail: "densify-action-queue",
  });

  return {
    ok: failed.length === 0 && densified.length > 0,
    plan,
    densifiedCids: densified,
    failedCids: failed,
    needsPageRefresh: plan.forcePrimary && densified.includes(dossier.cid),
    detail: `Densified ${densified.length}/${queue.length} · ${plan.summary}`,
  };
}

/**
 * Campaign densify queue from queue CIDs (thin + low ingest).
 */
export async function runCampaignDensifyQueue(
  cids: number[],
  opts?: {
    force?: boolean;
    onProgress?: (msg: string) => void;
  }
): Promise<{
  ok: boolean;
  densifiedCids: number[];
  failedCids: number[];
  detail: string;
}> {
  const queue = [...new Set(cids.filter((c) => c > 0))].slice(0, 12);
  if (!queue.length) {
    return {
      ok: true,
      densifiedCids: [],
      failedCids: [],
      detail: "Empty densify queue",
    };
  }
  const t0 = Date.now();
  const res = await streamBatchDensifyCids(queue, {
    includeDossiers: true,
    cacheLocal: true,
    force: opts?.force ?? false,
    onProgress: opts?.onProgress,
  });
  const densified = res.results.filter((r) => r.ok).map((r) => r.cid);
  const failed = res.results.filter((r) => !r.ok).map((r) => r.cid);
  recordDensifyRun({
    kind: "batch-stream",
    cids: queue,
    ok: densified.length,
    fail: failed.length,
    durationMs: Date.now() - t0,
    detail: "campaign-ai-guidance-queue",
  });
  return {
    ok: failed.length === 0,
    densifiedCids: densified,
    failedCids: failed,
    detail: `Campaign densify ${densified.length}/${queue.length} ok`,
  };
}
