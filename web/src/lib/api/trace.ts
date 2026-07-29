/** Real HTTP call tracing for provenance / validation. No mock traces. */

import {
  isHostCircuitOpen,
  recordHostFailure,
  recordHostSuccess,
} from "@/lib/api/hostCircuit";

export interface ApiFetchTrace {
  /** Exact URL requested */
  endpointUrl: string;
  /** HTTP method */
  method: string;
  /** When the request completed (ISO-8601) */
  fetchedAt: string;
  /** HTTP status if available */
  httpStatus?: number;
  /** Truncated response body for validation */
  responseBody: string;
  /** Content-Type when known */
  contentType?: string;
  /** True when the call succeeded (2xx) */
  ok: boolean;
  /**
   * True when the remote API explicitly reported "no match" (e.g. PubChem PUG
   * REST HTTP 404 + Fault Code PUGREST.NotFound). Not a transport outage —
   * treat as empty result for search UX.
   */
  notFound?: boolean;
  error?: string;
}

/** Detect PubChem / common REST "empty result" payloads on non-2xx bodies. */
export function isNotFoundPayload(data: unknown, httpStatus?: number): boolean {
  // PUG REST: unknown compound / bad SMILES often 404 or 400 with Fault
  if (httpStatus === 404) return true;
  if (!data || typeof data !== "object") {
    // Bare 400 without body still treated as empty by search layer
    return false;
  }
  const fault = (data as { Fault?: { Code?: string; Message?: string } }).Fault;
  if (!fault) {
    if (httpStatus === 400) return true;
    return false;
  }
  const code = String(fault.Code ?? "");
  const msg = String(fault.Message ?? "").toLowerCase();
  if (
    code.includes("NotFound") ||
    code.includes("PUGREST.NotFound") ||
    code.includes("BadRequest") ||
    code.includes("PUGREST.BadRequest")
  ) {
    return true;
  }
  if (
    msg.includes("not found") ||
    msg.includes("no cid") ||
    msg.includes("no records") ||
    msg.includes("unable to standardize") ||
    msg.includes("invalid")
  ) {
    return true;
  }
  if (httpStatus === 400) return true;
  return false;
}

/** Keep HTML / RSC payloads small; full response is re-fetchable via endpoint. */
export const MAX_RESPONSE_CHARS = 1500;

export function truncateResponse(text: string, max = MAX_RESPONSE_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… [truncated ${text.length - max} chars — open endpoint for full body]`;
}

/**
 * Slim a trace for embedding in HTML (aggressive body cap).
 * Does not invent data — only shortens real responseBody.
 */
export function slimTrace(trace: ApiFetchTrace, maxBody = MAX_RESPONSE_CHARS): ApiFetchTrace {
  return {
    ...trace,
    responseBody: truncateResponse(trace.responseBody ?? "", maxBody),
  };
}

export function slimTraces(traces: ApiFetchTrace[], maxBody = MAX_RESPONSE_CHARS): ApiFetchTrace[] {
  return traces.map((t) => slimTrace(t, maxBody));
}

export type TraceFetchInit = RequestInit & {
  next?: { revalidate?: number };
  /** Abort if the request exceeds this many ms (helps when PubChem hangs/503s). */
  timeoutMs?: number;
  /**
   * Retries on transient failures (timeout, 429, 502, 503, 504, network).
   * Default 2 (3 attempts total). Set 0 to disable.
   */
  retries?: number;
  /** Base backoff ms (exponential + jitter). Default 450. */
  retryBaseMs?: number;
};

function isTransientHttp(status?: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isTransientTrace(trace: ApiFetchTrace): boolean {
  if (trace.ok || trace.notFound) return false;
  if (isTransientHttp(trace.httpStatus)) return true;
  const err = (trace.error || "").toLowerCase();
  return (
    err.includes("timeout") ||
    err.includes("fetch failed") ||
    err.includes("network") ||
    err.includes("econnreset") ||
    err.includes("socket")
  );
}

async function fetchWithTraceOnce(
  url: string,
  init?: TraceFetchInit
): Promise<{ text: string; data: unknown | null; trace: ApiFetchTrace }> {
  const method = (init?.method ?? "GET").toUpperCase();
  const fetchedAt = new Date().toISOString();
  const timeoutMs = init?.timeoutMs;
  const outerSignal = init?.signal;
  // Build fetch init without wrapper-only options
  const rest: RequestInit & { next?: { revalidate?: number } } = {
    ...(init ?? {}),
  };
  delete (rest as TraceFetchInit).timeoutMs;
  delete (rest as TraceFetchInit).retries;
  delete (rest as TraceFetchInit).retryBaseMs;
  delete (rest as { signal?: AbortSignal }).signal;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs != null && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else {
      outerSignal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        ...(rest.headers ?? {}),
      },
    });
    const contentType = res.headers.get("content-type") ?? undefined;
    const text = await res.text();
    let data: unknown | null = null;
    // Parse JSON for both success and error bodies (PubChem Fault on 404, etc.)
    if (text && (contentType?.includes("json") || text.trimStart().startsWith("{"))) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    const notFound = !res.ok && isNotFoundPayload(data, res.status);
    return {
      text,
      data,
      trace: {
        endpointUrl: url,
        method,
        fetchedAt,
        httpStatus: res.status,
        responseBody: truncateResponse(text),
        contentType,
        ok: res.ok,
        notFound: notFound || undefined,
        error: res.ok
          ? undefined
          : notFound
            ? "Not found"
            : `HTTP ${res.status}`,
      },
    };
  } catch (e) {
    const aborted =
      (e instanceof Error && e.name === "AbortError") ||
      (typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "AbortError");
    return {
      text: "",
      data: null,
      trace: {
        endpointUrl: url,
        method,
        fetchedAt,
        responseBody: "",
        ok: false,
        error: aborted
          ? `timeout after ${timeoutMs ?? "?"}ms`
          : e instanceof Error
            ? e.message
            : "fetch failed",
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fetch and return body + full trace for provenance tables.
 * Only call for free public endpoints — never invent a trace.
 * Retries transient outages so multi-API gather stays durable.
 */
export async function fetchWithTrace(
  url: string,
  init?: TraceFetchInit
): Promise<{ text: string; data: unknown | null; trace: ApiFetchTrace }> {
  // Host circuit open → skip network, return synthetic fail (siblings continue)
  if (isHostCircuitOpen(url)) {
    return {
      text: "",
      data: null,
      trace: {
        endpointUrl: url,
        method: (init?.method ?? "GET").toUpperCase(),
        fetchedAt: new Date().toISOString(),
        responseBody: "",
        ok: false,
        error: "host circuit open (cooldown after repeated 429/5xx/timeout)",
      },
    };
  }

  const retries = init?.retries ?? 2;
  const baseMs = init?.retryBaseMs ?? 450;
  let last = await fetchWithTraceOnce(url, init);

  for (let i = 0; i < retries; i++) {
    if (!isTransientTrace(last.trace)) break;
    const delay = baseMs * Math.pow(2, i) + Math.floor(Math.random() * 150);
    await new Promise((r) => setTimeout(r, delay));
    last = await fetchWithTraceOnce(url, init);
  }

  // Annotate final error if we exhausted retries on transient faults
  if (!last.trace.ok && isTransientTrace(last.trace) && retries > 0) {
    last = {
      ...last,
      trace: {
        ...last.trace,
        error: `${last.trace.error || "failed"} (after ${retries + 1} attempts)`,
      },
    };
  }

  if (last.trace.ok) {
    recordHostSuccess(url);
  } else if (!last.trace.notFound) {
    recordHostFailure(url, {
      httpStatus: last.trace.httpStatus,
      error: last.trace.error,
    });
  }

  return last;
}

export async function fetchJsonWithTrace<T>(
  url: string,
  init?: TraceFetchInit
): Promise<{ data: T | null; trace: ApiFetchTrace }> {
  const { data, trace } = await fetchWithTrace(url, init);
  return { data: (data as T) ?? null, trace };
}
