/**
 * Durable multi-API gather helpers: never let one flaky free endpoint
 * abort the whole harvest wave. Soft-fail with recorded errors + traces.
 */

import type { ApiFetchTrace } from "@/lib/api/trace";

export type SoftSink = {
  fetchErrors: string[];
  traces: ApiFetchTrace[];
};

/** Run tasks in parallel; map rejections to a fallback (no throw). */
export async function allSettledMap<T>(
  tasks: Array<() => Promise<T>>,
  fallback: (err: unknown, index: number) => T
): Promise<T[]> {
  const settled = await Promise.allSettled(tasks.map((t) => t()));
  return settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return fallback(r.reason, i);
  });
}

/** Named task runner for gather waves — returns value or error tag. */
export async function runNamedTasks<T extends Record<string, () => Promise<unknown>>>(
  tasks: T
): Promise<{
  results: { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
  errors: Partial<Record<keyof T, string>>;
}> {
  const keys = Object.keys(tasks) as Array<keyof T>;
  const settled = await Promise.allSettled(keys.map((k) => tasks[k]!()));
  const results = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> | null };
  const errors: Partial<Record<keyof T, string>> = {};
  keys.forEach((k, i) => {
    const r = settled[i]!;
    if (r.status === "fulfilled") {
      results[k] = r.value as Awaited<ReturnType<T[typeof k]>>;
    } else {
      results[k] = null;
      errors[k] =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
  });
  return { results, errors };
}

/**
 * Soft-fail runner bound to a gather sink.
 * - On success: returns value; notes when all traces failed (non-notFound)
 * - On throw: records soft-fail error + synthetic fail trace; returns fallback
 * - Never rethrows — siblings always continue
 */
export function createSoftRunner(sink: SoftSink) {
  return function soft<T>(
    label: string,
    p: Promise<T>,
    fallback: T
  ): Promise<T> {
    return p.then(
      (value) => {
        const any = value as { traces?: ApiFetchTrace[] };
        const resultTraces = Array.isArray(any?.traces) ? any.traces : [];
        if (
          resultTraces.length > 0 &&
          resultTraces.every((t) => !t.ok && !t.notFound)
        ) {
          const detail = resultTraces
            .map((t) => t.error || (t.httpStatus != null ? `HTTP ${t.httpStatus}` : "fail"))
            .filter(Boolean)
            .slice(0, 3)
            .join("; ");
          if (detail) {
            sink.fetchErrors.push(
              `api-fail · ${label}: ${detail}`.slice(0, 240)
            );
          }
        }
        return value;
      },
      (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        sink.fetchErrors.push(`soft-fail · ${label}: ${msg}`.slice(0, 240));
        sink.traces.push({
          endpointUrl: `soft-fail://${label}`,
          method: "SOFT",
          fetchedAt: new Date().toISOString(),
          ok: false,
          responseBody: "",
          error: msg.slice(0, 280),
        });
        return fallback;
      }
    );
  };
}

/**
 * Soft timeout — returns fallback if task exceeds ms.
 * Does not cancel the underlying task (fetch layer may still complete);
 * used so densify steps never block the whole package forever.
 */
export async function withSoftTimeout<T>(
  task: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Soft timeout with AbortSignal — cancels the in-flight factory when possible.
 * Prefer this when the task honors `signal` (fetchWithTrace).
 */
export async function withSoftTimeoutSignal<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  fallback: T
): Promise<{ value: T; timedOut: boolean }> {
  const ac = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, ms);
  try {
    const value = await factory(ac.signal);
    return { value, timedOut: false };
  } catch (e) {
    const aborted =
      timedOut ||
      (e instanceof Error && e.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "AbortError");
    if (aborted) return { value: fallback, timedOut: true };
    // Non-abort error → still soft-return fallback for durability
    return { value: fallback, timedOut: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** True when a soft-fail or total API-fail was recorded for this label. */
export function sourceNeedsRetry(
  fetchErrors: string[],
  label: string,
  hasPayload: boolean,
  resultTraces?: ApiFetchTrace[]
): boolean {
  if (hasPayload) return false;
  const hit = fetchErrors.some(
    (e) =>
      e.includes(`soft-fail · ${label}`) ||
      e.includes(`api-fail · ${label}`) ||
      e.includes(`soft-fail · ${label}-retry`)
  );
  if (hit) return true;
  if (!resultTraces || resultTraces.length === 0) return true;
  return resultTraces.every((t) => !t.ok);
}

/** Count procedure-bearing characters on evidence-like shapes. */
export function countProcedureChars(opts: {
  procedureExcerpts?: Array<{ chars?: number; text?: string }>;
  literature?: Array<{ fullTextExcerpt?: string; abstract?: string }>;
  patents?: Array<{ procedureExcerpt?: string; abstract?: string }>;
  manufacturingTexts?: string[];
}): number {
  let n = 0;
  for (const p of opts.procedureExcerpts || []) {
    n += p.chars || p.text?.length || 0;
  }
  for (const h of opts.literature || []) {
    n += h.fullTextExcerpt?.length || 0;
  }
  for (const p of opts.patents || []) {
    n += p.procedureExcerpt?.length || 0;
  }
  for (const t of opts.manufacturingTexts || []) n += t.length;
  return n;
}

/** How many free-API soft/api failures were recorded this gather. */
export function countSoftFailures(fetchErrors: string[] | undefined): number {
  return (fetchErrors || []).filter(
    (e) => e.startsWith("soft-fail ·") || e.startsWith("api-fail ·")
  ).length;
}
