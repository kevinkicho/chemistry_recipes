/**
 * Lightweight sequential backoff for free public APIs (no external deps).
 */

export async function withBackoff<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; label?: string } = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.baseMs ?? 400;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(opts.label ? `${opts.label} failed` : "Request failed");
}

/** Soft delay between parallel-ish free API waves. */
export function politeDelay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
