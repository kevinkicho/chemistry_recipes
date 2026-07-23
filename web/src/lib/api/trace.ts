/** Real HTTP call tracing for provenance / validation. No mock traces. */

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
  error?: string;
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

/**
 * Fetch and return body + full trace for provenance tables.
 * Only call for free public endpoints — never invent a trace.
 */
export async function fetchWithTrace(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } }
): Promise<{ text: string; data: unknown | null; trace: ApiFetchTrace }> {
  const method = (init?.method ?? "GET").toUpperCase();
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json, text/plain, */*",
        ...(init?.headers ?? {}),
      },
    });
    const contentType = res.headers.get("content-type") ?? undefined;
    const text = await res.text();
    let data: unknown | null = null;
    if (res.ok) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
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
        error: res.ok ? undefined : `HTTP ${res.status}`,
      },
    };
  } catch (e) {
    return {
      text: "",
      data: null,
      trace: {
        endpointUrl: url,
        method,
        fetchedAt,
        responseBody: "",
        ok: false,
        error: e instanceof Error ? e.message : "fetch failed",
      },
    };
  }
}

export async function fetchJsonWithTrace<T>(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } }
): Promise<{ data: T | null; trace: ApiFetchTrace }> {
  const { data, trace } = await fetchWithTrace(url, init);
  return { data: (data as T) ?? null, trace };
}
