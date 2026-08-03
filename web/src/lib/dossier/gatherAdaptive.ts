/**
 * Adaptive free-public gather concurrency from live API etiquette pressure.
 * Caps in-flight soft tasks so densify does not stampede rate-limited hosts.
 */

import { rateLimitedHosts } from "@/lib/api/apiEtiquette";
import { circuitOpenHosts } from "@/lib/api/hostCircuit";
import { mapPool } from "@/lib/dossier/parallelMap";

/** Soft runner signature (matches createSoftRunner return). */
export type SoftFn = <T>(
  label: string,
  p: Promise<T>,
  fallback: T
) => Promise<T>;

export type SoftWaveTask<T = unknown> = {
  label: string;
  /** Factory — only starts when a concurrency slot is free */
  run: () => Promise<T>;
  fallback: T;
};

/**
 * Recommended in-flight soft-task concurrency for multi-API harvest.
 * Tightens when hosts are rate-limited or circuit-open.
 */
export function recommendedGatherConcurrency(): number {
  const rl = rateLimitedHosts().length;
  const circuits = circuitOpenHosts().length;
  const pressure = rl + Math.min(3, Math.floor(circuits / 1));
  if (pressure >= 4) return 3;
  if (pressure >= 2) return 5;
  if (pressure >= 1) return 7;
  // Cap default well below full fan-out (~30) for free-public politeness
  return 10;
}

/** Extra delay between gather waves when etiquette pressure is high. */
export function recommendedInterWaveDelayMs(): number {
  const rl = rateLimitedHosts().length;
  if (rl >= 3) return 400;
  if (rl >= 1) return 220;
  return 100;
}

/**
 * Run soft-fail API tasks with bounded concurrency (order-preserving).
 * Each task factory runs only when a slot is free — avoids starting all
 * fetches at once under rate-limit pressure.
 *
 * Heterogeneous task return types are allowed (gather multi-API wave).
 */
export async function mapSoftWave(
  tasks: SoftWaveTask[],
  soft: SoftFn,
  opts?: { concurrency?: number }
): Promise<unknown[]> {
  if (!tasks.length) return [];
  const conc = Math.max(
    1,
    Math.min(opts?.concurrency ?? recommendedGatherConcurrency(), tasks.length)
  );
  return mapPool(tasks, conc, (t) => soft(t.label, t.run(), t.fallback));
}

/** Snapshot for diagnostics / audit notes */
export function gatherEtiquetteSnapshot(): {
  concurrency: number;
  interWaveDelayMs: number;
  rateLimitedHosts: string[];
  circuitOpenHosts: string[];
} {
  return {
    concurrency: recommendedGatherConcurrency(),
    interWaveDelayMs: recommendedInterWaveDelayMs(),
    rateLimitedHosts: rateLimitedHosts(),
    circuitOpenHosts: circuitOpenHosts(),
  };
}
