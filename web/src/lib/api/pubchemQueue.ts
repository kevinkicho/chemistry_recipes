/**
 * Browser + shared polite queue for PubChem PUG requests.
 * PubChem returns HTTP 503 under parallel storms; serialize + backoff.
 */

export type QueuedFetchResult = {
  ok: boolean;
  status: number;
  data: unknown | null;
  text?: string;
};

const DEFAULT_GAP_MS = 450;
const MAX_RETRIES = 3;

let chain: Promise<unknown> = Promise.resolve();
let lastStart = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Run a PubChem fetch behind a process-wide serial queue with 503/429 retries.
 */
export function pubchemQueuedFetch(
  url: string,
  opts?: {
    signal?: AbortSignal;
    gapMs?: number;
    retries?: number;
    accept?: string;
    asJson?: boolean;
  }
): Promise<QueuedFetchResult> {
  const gapMs = opts?.gapMs ?? DEFAULT_GAP_MS;
  const retries = opts?.retries ?? MAX_RETRIES;
  const asJson = opts?.asJson !== false;

  const run = async (): Promise<QueuedFetchResult> => {
    const wait = Math.max(0, gapMs - (Date.now() - lastStart));
    if (wait > 0) await sleep(wait);
    lastStart = Date.now();

    let last: QueuedFetchResult = { ok: false, status: 0, data: null };

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (opts?.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const res = await fetch(url, {
          signal: opts?.signal,
          headers: {
            Accept: opts?.accept || "application/json, image/png, */*",
            "User-Agent":
              "ChemistryRecipes/1.2 (educational; polite PubChem client)",
          },
          cache: "no-store",
        });
        if (asJson) {
          let data: unknown | null = null;
          if (res.ok) {
            try {
              data = await res.json();
            } catch {
              data = null;
            }
          }
          last = { ok: res.ok, status: res.status, data };
        } else {
          const text = res.ok ? await res.text() : undefined;
          last = { ok: res.ok, status: res.status, data: null, text };
        }

        if (last.ok) return last;
        if (last.status === 404 || last.status === 400) return last;
        if (!isRetryableStatus(last.status) || attempt === retries) return last;

        const backoff =
          gapMs * Math.pow(1.9, attempt) + Math.floor(Math.random() * 200);
        await sleep(backoff);
        lastStart = Date.now();
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") throw e;
        last = { ok: false, status: 0, data: null };
        if (attempt === retries) return last;
        await sleep(gapMs * Math.pow(1.6, attempt) + 100);
        lastStart = Date.now();
      }
    }
    return last;
  };

  const next = chain.then(run, run);
  // Keep chain alive even if one request fails
  chain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}
