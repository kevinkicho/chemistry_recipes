/**
 * Honest batch densify summaries. A dropped SSE must not look like
 * "done · 0 fail" when CIDs never received cid_complete.
 */

export type BatchOutcomeRow = {
  cid: number;
  ok: boolean;
  error?: string;
  durationMs: number;
};

/**
 * Any need-build CID missing from results is an unfinished fail, not success.
 */
export function accountForUnfinishedBatchCids<T extends BatchOutcomeRow>(
  needBuild: number[],
  results: T[],
  unfinishedError: string
): T[] {
  const seen = new Set(results.map((r) => r.cid));
  const extra = needBuild
    .filter((cid) => Number.isFinite(cid) && cid > 0 && !seen.has(cid))
    .map(
      (cid) =>
        ({
          cid,
          ok: false,
          durationMs: 0,
          error: unfinishedError,
        }) as T
    );
  return extra.length ? [...results, ...extra] : results;
}

export function formatBatchDensifyStatus(opts: {
  ok: number;
  fail: number;
  error?: string;
  prefix: string;
  cacheHits?: number;
  durationMs?: number;
  serverDetail?: string;
}): string {
  const { ok, fail, prefix } = opts;
  const error = (opts.error || "").trim();
  const bits: string[] = [`${ok} ok`];
  if (opts.cacheHits) bits.push(`${opts.cacheHits} cache`);
  bits.push(`${fail} fail`);
  if (opts.durationMs != null && opts.durationMs > 0) {
    bits.push(`${Math.round(opts.durationMs / 1000)}s`);
  }
  if (error) bits.push(error);
  const server = (opts.serverDetail || "").trim();
  if (server) bits.push(`server: ${server}`);
  const body = bits.join(" · ");
  if (fail === 0 && !error) return `${prefix} done · ${body}`;
  if (ok === 0) return `${prefix} failed · ${body}`;
  return `${prefix} partial · ${body}`;
}
