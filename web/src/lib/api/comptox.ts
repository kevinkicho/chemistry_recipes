/**
 * EPA CompTox Dashboard API — free public substance search (limited).
 * Docs: https://www.epa.gov/comptox-tools
 * Note: endpoint shapes change; we degrade gracefully.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

export interface CompToxHit {
  dtxsid?: string;
  preferredName?: string;
  casrn?: string;
  url: string;
  summary?: string;
}

/**
 * Search CompTox by chemical name (best-effort free endpoint).
 */
export async function fetchCompToxByName(
  name: string
): Promise<{ hit: CompToxHit | null; traces: ApiFetchTrace[]; query: string }> {
  const q = name.trim();
  if (!q) return { hit: null, traces: [], query: "" };

  // Public search used by dashboard (may rate-limit)
  const url =
    `https://comptox.epa.gov/dashboard-api/ccdapp1/search/chemical/equal/${encodeURIComponent(
      q
    )}`;

  const { data, trace } = await fetchJsonWithTrace<
    Array<{
      dtxsid?: string;
      preferredName?: string;
      casrn?: string;
      rank?: number;
    }>
  >(url, { next: { revalidate: 7200 } });

  const first = Array.isArray(data) ? data[0] : null;
  if (!first?.dtxsid && !first?.preferredName) {
    return { hit: null, traces: [trace], query: q };
  }

  const dtxsid = first.dtxsid;
  return {
    hit: {
      dtxsid,
      preferredName: first.preferredName,
      casrn: first.casrn,
      url: dtxsid
        ? `https://comptox.epa.gov/dashboard/chemical/details/${dtxsid}`
        : "https://comptox.epa.gov/dashboard/",
      summary: [dtxsid, first.casrn && `CAS ${first.casrn}`]
        .filter(Boolean)
        .join(" · "),
    },
    traces: [trace],
    query: q,
  };
}
