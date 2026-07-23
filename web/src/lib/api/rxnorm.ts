/**
 * RxNorm REST (NLM) — free drug name normalization.
 * Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const RXNAV = "https://rxnav.nlm.nih.gov/REST";

export interface RxNormHit {
  rxcui: string;
  name: string;
  tty?: string;
  synonym?: string;
  url: string;
}

export async function fetchRxNormByName(
  name: string
): Promise<{ hit: RxNormHit | null; traces: ApiFetchTrace[]; query: string }> {
  const q = name.trim();
  if (!q) return { hit: null, traces: [], query: "" };

  const url =
    `${RXNAV}/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=5`;

  const { data, trace } = await fetchJsonWithTrace<{
    approximateGroup?: {
      candidate?: Array<{
        rxcui?: string;
        name?: string;
        rank?: string;
      }>;
    };
  }>(url, { next: { revalidate: 3600 } });

  const c = data?.approximateGroup?.candidate?.[0];
  if (!c?.rxcui) return { hit: null, traces: [trace], query: q };

  // Optional: get properties for display name
  const propUrl = `${RXNAV}/rxcui/${c.rxcui}/properties.json`;
  const prop = await fetchJsonWithTrace<{
    properties?: { name?: string; tty?: string; synonym?: string };
  }>(propUrl, { next: { revalidate: 3600 } });

  const p = prop.data?.properties;
  return {
    hit: {
      rxcui: c.rxcui,
      name: p?.name || c.name || q,
      tty: p?.tty,
      synonym: p?.synonym,
      url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${c.rxcui}`,
    },
    traces: [trace, prop.trace],
    query: q,
  };
}
