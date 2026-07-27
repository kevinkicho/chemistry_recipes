/**
 * Durable multi-API gather helpers: never let one flaky free endpoint
 * abort the whole harvest wave.
 */

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
  const settled = await Promise.allSettled(
    keys.map((k) => tasks[k]!())
  );
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

/** Soft timeout wrapper — returns fallback if task exceeds ms. */
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
