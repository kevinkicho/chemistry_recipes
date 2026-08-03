/**
 * Free-public API etiquette — pacing, 429 cooldowns, polite identity.
 * Used by fetchWithTrace + harvest agent so densify does not thrash rate limits.
 *
 * Policy (agent-owned decisions; rails always on):
 * - Min spacing per host (no burst storms)
 * - On HTTP 429: honor Retry-After, cool host, skip further calls until open
 * - Polite User-Agent / From on outbound requests
 * - Never invent plant data; etiquette is transport only
 */

export type RateLimitHostState = {
  host: string;
  /** Earliest time another request may start */
  nextAllowedAt: number;
  /** If set, host is rate-limited until this time */
  rateLimitedUntil?: number;
  lastStatus?: number;
  lastReason?: string;
  consecutive429: number;
};

const hostState = new Map<string, RateLimitHostState>();

/** Default min gap between calls to the same host (ms). */
const DEFAULT_MIN_INTERVAL_MS = 110;

/**
 * Host-specific polite spacing (ms). Stricter for known free-tier limiters.
 * Keys match hostname includes / endsWith.
 */
const HOST_MIN_INTERVAL_MS: Array<{ match: RegExp; ms: number }> = [
  { match: /semanticscholar\.org$/i, ms: 1500 },
  { match: /eutils\.ncbi\.nlm\.nih\.gov$/i, ms: 400 },
  { match: /pubmed\.ncbi\.nlm\.nih\.gov$/i, ms: 400 },
  { match: /api\.crossref\.org$/i, ms: 200 },
  { match: /api\.openalex\.org$/i, ms: 180 },
  { match: /api\.fda\.gov$/i, ms: 250 },
  { match: /pubchem\.ncbi\.nlm\.nih\.gov$/i, ms: 120 },
  { match: /ebi\.ac\.uk$/i, ms: 100 },
  { match: /rxnav\.nlm\.nih\.gov$/i, ms: 200 },
  { match: /dailymed\.nlm\.nih\.gov$/i, ms: 250 },
  { match: /clinicaltrials\.gov$/i, ms: 150 },
  { match: /export\.arxiv\.org$/i, ms: 300 },
  { match: /rest\.kegg\.jp$/i, ms: 200 },
  { match: /pathwaycommons\.org$/i, ms: 400 },
];

/** Default cooldown when 429 has no Retry-After (ms). */
const DEFAULT_429_COOLDOWN_MS = 35_000;
/** Cap agent wait tool so gather never stalls forever. */
export const MAX_ETIQUETTE_WAIT_MS = 18_000;
/** Cap Retry-After honor (ms). */
const MAX_RETRY_AFTER_MS = 120_000;

export const POLITE_USER_AGENT =
  "ChemistryRecipes/1.5 (+https://chemrecipe--chemistryrecipes.us-central1.hosted.app; educational free-public densify; polite; contact: ops@localhost)";

export function hostKeyFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url.slice(0, 64).toLowerCase();
  }
}

function minIntervalForHost(host: string): number {
  for (const row of HOST_MIN_INTERVAL_MS) {
    if (row.match.test(host)) return row.ms;
  }
  return DEFAULT_MIN_INTERVAL_MS;
}

function ensureState(host: string): RateLimitHostState {
  let st = hostState.get(host);
  if (!st) {
    st = {
      host,
      nextAllowedAt: 0,
      consecutive429: 0,
    };
    hostState.set(host, st);
  }
  return st;
}

/** True when host is under explicit rate-limit cooldown (429). */
export function isHostRateLimited(urlOrHost: string): boolean {
  const host = urlOrHost.includes("://")
    ? hostKeyFromUrl(urlOrHost)
    : urlOrHost.toLowerCase();
  const st = hostState.get(host);
  if (!st?.rateLimitedUntil) return false;
  if (Date.now() >= st.rateLimitedUntil) {
    st.rateLimitedUntil = undefined;
    st.consecutive429 = 0;
    return false;
  }
  return true;
}

/** ms until host may be called (0 if ready). */
export function hostCooldownRemainingMs(urlOrHost: string): number {
  const host = urlOrHost.includes("://")
    ? hostKeyFromUrl(urlOrHost)
    : urlOrHost.toLowerCase();
  const st = hostState.get(host);
  if (!st) return 0;
  const now = Date.now();
  const until = Math.max(st.nextAllowedAt, st.rateLimitedUntil || 0);
  return Math.max(0, until - now);
}

/**
 * Wait until host slot is free (min spacing + rate-limit cooldown).
 * Caps wait so a single call never blocks the process forever.
 */
export async function waitForHostSlot(
  url: string,
  opts?: { maxWaitMs?: number }
): Promise<{ waitedMs: number; rateLimited: boolean; host: string }> {
  const host = hostKeyFromUrl(url);
  const st = ensureState(host);
  const now = Date.now();
  const until = Math.max(st.nextAllowedAt, st.rateLimitedUntil || 0);
  const rawWait = Math.max(0, until - now);
  const maxWait = opts?.maxWaitMs ?? MAX_ETIQUETTE_WAIT_MS;
  const wait = Math.min(rawWait, maxWait);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  return {
    waitedMs: wait,
    rateLimited: Boolean(st.rateLimitedUntil && Date.now() < (st.rateLimitedUntil || 0)),
    host,
  };
}

/** Mark successful request — schedule next min-interval slot. */
export function recordHostCallComplete(url: string, opts?: { httpStatus?: number }): void {
  const host = hostKeyFromUrl(url);
  const st = ensureState(host);
  const gap = minIntervalForHost(host);
  st.nextAllowedAt = Date.now() + gap;
  st.lastStatus = opts?.httpStatus;
  if (opts?.httpStatus != null && opts.httpStatus < 400) {
    st.consecutive429 = 0;
    // Successful traffic clears soft rate-limit sooner
    if (st.rateLimitedUntil && opts.httpStatus >= 200 && opts.httpStatus < 300) {
      st.rateLimitedUntil = undefined;
    }
  }
}

/**
 * Record 429 (or explicit rate-limit). Honors Retry-After seconds/date when present.
 * Escalates cooldown on consecutive 429s.
 */
export function recordHostRateLimited(
  url: string,
  opts?: { retryAfterHeader?: string | null; httpStatus?: number }
): number {
  const host = hostKeyFromUrl(url);
  const st = ensureState(host);
  st.consecutive429 += 1;
  st.lastStatus = opts?.httpStatus ?? 429;
  st.lastReason = "HTTP 429 rate limited";

  let coolMs = parseRetryAfterMs(opts?.retryAfterHeader) ?? DEFAULT_429_COOLDOWN_MS;
  // Escalate: 2nd 429 → 1.5x, 3rd+ → 2x
  if (st.consecutive429 >= 3) coolMs = Math.min(MAX_RETRY_AFTER_MS, coolMs * 2);
  else if (st.consecutive429 === 2) coolMs = Math.min(MAX_RETRY_AFTER_MS, Math.floor(coolMs * 1.5));

  const until = Date.now() + coolMs;
  st.rateLimitedUntil = until;
  st.nextAllowedAt = Math.max(st.nextAllowedAt, until);
  return coolMs;
}

export function parseRetryAfterMs(header?: string | null): number | null {
  if (!header) return null;
  const t = header.trim();
  if (!t) return null;
  // Seconds form
  if (/^\d+(\.\d+)?$/.test(t)) {
    const sec = Number(t);
    if (!Number.isFinite(sec) || sec < 0) return null;
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(1000, Math.floor(sec * 1000)));
  }
  // HTTP-date form
  const when = Date.parse(t);
  if (!Number.isFinite(when)) return null;
  const ms = when - Date.now();
  if (ms <= 0) return 1000;
  return Math.min(MAX_RETRY_AFTER_MS, ms);
}

/** Snapshot for harvest agent inspect_state. */
export function listRateLimitStates(): Array<{
  host: string;
  remainingMs: number;
  rateLimited: boolean;
  consecutive429: number;
  lastStatus?: number;
  lastReason?: string;
  minIntervalMs: number;
}> {
  const now = Date.now();
  const out: Array<{
    host: string;
    remainingMs: number;
    rateLimited: boolean;
    consecutive429: number;
    lastStatus?: number;
    lastReason?: string;
    minIntervalMs: number;
  }> = [];
  for (const st of hostState.values()) {
    const remainingMs = Math.max(
      0,
      Math.max(st.nextAllowedAt, st.rateLimitedUntil || 0) - now
    );
    if (remainingMs <= 0 && st.consecutive429 === 0 && !st.rateLimitedUntil) continue;
    out.push({
      host: st.host,
      remainingMs,
      rateLimited: Boolean(st.rateLimitedUntil && st.rateLimitedUntil > now),
      consecutive429: st.consecutive429,
      lastStatus: st.lastStatus,
      lastReason: st.lastReason,
      minIntervalMs: minIntervalForHost(st.host),
    });
  }
  return out.sort((a, b) => b.remainingMs - a.remainingMs);
}

/** Hosts currently under 429 cooldown. */
export function rateLimitedHosts(): string[] {
  return listRateLimitStates()
    .filter((s) => s.rateLimited)
    .map((s) => s.host);
}

/**
 * Polite identity headers. Callers may override; we only fill missing keys.
 */
export function etiquetteHeaders(
  existing?: HeadersInit
): Record<string, string> {
  const out: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "User-Agent": POLITE_USER_AGENT,
    From: "chemistry-recipes-educational@localhost",
  };
  if (!existing) return out;
  const h = new Headers(existing);
  for (const [k, v] of Object.entries(out)) {
    if (!h.has(k)) h.set(k, v);
  }
  const rec: Record<string, string> = {};
  h.forEach((v, k) => {
    rec[k] = v;
  });
  return rec;
}

/** Wait until the soonest rate-limited host cools, capped. For agent tool. */
export async function waitForAnyRateLimit(
  opts?: { maxWaitMs?: number }
): Promise<{ waitedMs: number; hosts: string[] }> {
  const maxWait = opts?.maxWaitMs ?? MAX_ETIQUETTE_WAIT_MS;
  const limited = listRateLimitStates().filter((s) => s.rateLimited);
  if (!limited.length) return { waitedMs: 0, hosts: [] };
  const soonest = Math.min(...limited.map((s) => s.remainingMs));
  const wait = Math.min(maxWait, soonest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return { waitedMs: wait, hosts: limited.map((s) => s.host) };
}

/** Test helper */
export function resetApiEtiquette(): void {
  hostState.clear();
}

/**
 * Map family labels → hostname hints for agent skip lists.
 */
export function familyLikelyHosts(family: string): string[] {
  const f = family.toLowerCase();
  if (/semantic/.test(f)) return ["api.semanticscholar.org"];
  if (/pubmed|eutils/.test(f)) return ["eutils.ncbi.nlm.nih.gov"];
  if (/pubchem/.test(f)) return ["pubchem.ncbi.nlm.nih.gov"];
  if (/europepmc|epmc|patent-epmc|patent-literature/.test(f))
    return ["www.ebi.ac.uk"];
  if (/openalex/.test(f)) return ["api.openalex.org"];
  if (/crossref/.test(f)) return ["api.crossref.org"];
  if (/openfda|fda/.test(f)) return ["api.fda.gov"];
  if (/chembl|chebi|unichem|rhea/.test(f)) return ["www.ebi.ac.uk"];
  if (/arxiv/.test(f)) return ["export.arxiv.org"];
  if (/kegg/.test(f)) return ["rest.kegg.jp"];
  if (/pathway|wikipathways/.test(f)) return ["www.pathwaycommons.org"];
  if (/rxnorm|rxnav/.test(f)) return ["rxnav.nlm.nih.gov"];
  if (/dailymed/.test(f)) return ["dailymed.nlm.nih.gov"];
  if (/clinicaltrials/.test(f)) return ["clinicaltrials.gov"];
  return [];
}

/** True if family maps to a currently rate-limited host. */
export function isFamilyRateLimited(family: string): boolean {
  const hosts = familyLikelyHosts(family);
  if (!hosts.length) return false;
  return hosts.some((h) => isHostRateLimited(h));
}
