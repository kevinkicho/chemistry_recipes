/**
 * Per-host circuit breaker for free-public APIs.
 * After repeated 429/5xx/timeouts in-process, skip further calls to that host
 * for a cooldown window so the rest of the harvest stays polite and resilient.
 */

type CircuitState = {
  fails: number;
  openUntil: number;
};

const circuits = new Map<string, CircuitState>();

const FAIL_OPEN_THRESHOLD = 3;
const COOLDOWN_MS = 45_000;

function hostKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.slice(0, 48).toLowerCase();
  }
}

export function isHostCircuitOpen(url: string): boolean {
  const key = hostKey(url);
  const st = circuits.get(key);
  if (!st) return false;
  if (Date.now() >= st.openUntil) {
    circuits.delete(key);
    return false;
  }
  return true;
}

export function recordHostSuccess(url: string): void {
  circuits.delete(hostKey(url));
}

export function recordHostFailure(url: string, opts?: { httpStatus?: number; error?: string }): void {
  const key = hostKey(url);
  const transient =
    opts?.httpStatus === 429 ||
    opts?.httpStatus === 502 ||
    opts?.httpStatus === 503 ||
    opts?.httpStatus === 504 ||
    /timeout|network|fetch failed|econnreset|socket/i.test(opts?.error || "");
  if (!transient && opts?.httpStatus != null && opts.httpStatus < 500 && opts.httpStatus !== 429) {
    return;
  }
  const prev = circuits.get(key) || { fails: 0, openUntil: 0 };
  const fails = prev.fails + 1;
  if (fails >= FAIL_OPEN_THRESHOLD) {
    circuits.set(key, { fails, openUntil: Date.now() + COOLDOWN_MS });
  } else {
    circuits.set(key, { fails, openUntil: 0 });
  }
}

/** Test helper — clear all circuits */
export function resetHostCircuits(): void {
  circuits.clear();
}

export function circuitOpenHosts(): string[] {
  const now = Date.now();
  const out: string[] = [];
  for (const [k, st] of circuits) {
    if (st.openUntil > now) out.push(k);
  }
  return out;
}
