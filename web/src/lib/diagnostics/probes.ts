/**
 * Free-API health probes for diagnostics + CLI.
 * Catalog: publicApiProbes.ts (full gather/densify inventory).
 * Never logs secrets. Timeouts stay bounded.
 */

import {
  PUBLIC_API_PROBE_DEFS,
  type PublicProbeDef,
  probeCatalogStats,
} from "@/lib/diagnostics/publicApiProbes";

export type ProbeStatus = "ok" | "degraded" | "fail" | "skip";

export interface ApiProbeResult {
  id: string;
  name: string;
  organization: string;
  endpointUrl: string;
  status: ProbeStatus;
  httpStatus?: number;
  latencyMs?: number;
  detail?: string;
  category: string;
  gatherFamilies?: string[];
  notes?: string;
}

const PROBE_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 8000);
const PROBE_CONCURRENCY = Number(process.env.PROBE_CONCURRENCY || 8);

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function bodyOk(def: PublicProbeDef, body: string): boolean {
  if (!def.bodyMustMatch) return true;
  try {
    return new RegExp(def.bodyMustMatch, "i").test(body);
  } catch {
    return body.toLowerCase().includes(def.bodyMustMatch.toLowerCase());
  }
}

async function runOne(def: PublicProbeDef): Promise<ApiProbeResult> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  const base: Pick<
    ApiProbeResult,
    "id" | "name" | "organization" | "endpointUrl" | "category" | "gatherFamilies" | "notes"
  > = {
    id: def.id,
    name: def.name,
    organization: def.organization,
    endpointUrl: def.url,
    category: def.category,
    gatherFamilies: def.gatherFamilies,
    notes: def.notes,
  };

  try {
    const res = await fetch(def.url, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        Accept: "application/json, text/plain, text/xml, */*",
        "User-Agent":
          "ChemistryRecipes/1.0 (educational free-public health probe; mailto:devnull@example.com)",
      },
      cache: "no-store",
    });
    const body = await res.text().catch(() => "");
    const latencyMs = Date.now() - t0;
    const status = res.status;
    const accept = def.acceptStatus || [200, 201, 202, 203, 204];
    const statusOk = accept.includes(status) || (status >= 200 && status < 300);
    const contentOk = bodyOk(def, body);

    // Optional-key services
    if (def.optionalKey && (status === 401 || status === 403)) {
      return {
        ...base,
        status: "skip",
        httpStatus: status,
        latencyMs,
        detail: `HTTP ${status} · optional API key not configured (expected)`,
      };
    }

    // Rate limited but service is up
    if (status === 429) {
      return {
        ...base,
        status: "degraded",
        httpStatus: status,
        latencyMs,
        detail: "HTTP 429 rate limited — service up",
      };
    }

    if (!statusOk || !contentOk) {
      return {
        ...base,
        status: "fail",
        httpStatus: status,
        latencyMs,
        detail: !statusOk
          ? `HTTP ${status}${body ? ` · ${body.slice(0, 100)}` : ""}`
          : `HTTP ${status} · body mismatch (expected /${def.bodyMustMatch}/)`,
      };
    }

    return {
      ...base,
      status: latencyMs > 3500 ? "degraded" : "ok",
      httpStatus: status,
      latencyMs,
      detail: `HTTP ${status} · ${body.length} B`,
    };
  } catch (e) {
    return {
      ...base,
      status: "fail",
      latencyMs: Date.now() - t0,
      detail: e instanceof Error ? e.message : "request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Concurrent free-API probes covering the full gather/densify catalog.
 */
export async function runPublicApiProbes(opts?: {
  ids?: string[];
  concurrency?: number;
}): Promise<ApiProbeResult[]> {
  let defs = PUBLIC_API_PROBE_DEFS;
  if (opts?.ids?.length) {
    const want = new Set(opts.ids);
    defs = defs.filter((d) => want.has(d.id));
  }
  const concurrency = opts?.concurrency ?? PROBE_CONCURRENCY;
  return mapPool(defs, concurrency, (d) => runOne(d));
}

export function summarizeProbes(probes: ApiProbeResult[]): {
  ok: number;
  degraded: number;
  fail: number;
  skip: number;
  avgLatencyMs: number | null;
  total: number;
  catalog: ReturnType<typeof probeCatalogStats>;
} {
  let ok = 0;
  let degraded = 0;
  let fail = 0;
  let skip = 0;
  let latSum = 0;
  let latN = 0;
  for (const p of probes) {
    if (p.status === "ok") ok += 1;
    else if (p.status === "degraded") degraded += 1;
    else if (p.status === "fail") fail += 1;
    else skip += 1;
    if (typeof p.latencyMs === "number") {
      latSum += p.latencyMs;
      latN += 1;
    }
  }
  return {
    ok,
    degraded,
    fail,
    skip,
    avgLatencyMs: latN ? Math.round(latSum / latN) : null,
    total: probes.length,
    catalog: probeCatalogStats(),
  };
}

export { PUBLIC_API_PROBE_DEFS, probeCatalogStats } from "@/lib/diagnostics/publicApiProbes";
