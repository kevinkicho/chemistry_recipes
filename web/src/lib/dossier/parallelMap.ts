/**
 * Bounded-concurrency async map for batch densify.
 */

/**
 * Run `fn` over items with at most `concurrency` in flight.
 * Preserves result order matching input order.
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = items.length;
  if (n === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, n));
  const results: R[] = new Array(n);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) return;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

function isTransientError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|429|502|503|504|fetch failed|aborted|network/i.test(
    msg
  );
}

/**
 * mapPool with per-item retries on transient failures.
 */
export async function mapPoolWithRetry<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  opts?: { retries?: number; baseDelayMs?: number }
): Promise<R[]> {
  const retries = Math.max(0, opts?.retries ?? 2);
  const baseDelayMs = opts?.baseDelayMs ?? 400;

  return mapPool(items, concurrency, async (item, index) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn(item, index);
      } catch (e) {
        lastErr = e;
        if (attempt >= retries || !isTransientError(e)) throw e;
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr;
  });
}

export { isTransientError };
