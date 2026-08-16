/**
 * MassBank-class MS reference context for IPC / analytical design.
 * MassBank EU REST API paths used previously now 404 (SPA-only site).
 * Do not invent MS records from PubChem identity HTTP or from a site-search
 * deeplink. Until a free-public MassBank JSON API exists again, harvest is empty.
 */

import type { ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface MassBankHit {
  accession: string;
  title: string;
  formula?: string;
  url: string;
}

/** Site-search / PubChem-identity stand-ins are not harvested MS records. */
export function isHarvestedMassBankRecord(hit: MassBankHit): boolean {
  const acc = (hit.accession || "").trim();
  if (!acc) return false;
  const lower = acc.toLowerCase();
  if (lower.startsWith("massbank-search:")) return false;
  if (lower.startsWith("pubchem:")) return false;
  // InChIKey-only accessions came from PubChem identity, not MassBank records
  if (/^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(acc)) return false;
  return true;
}

/** Only MassBank hosts count as spectra HTTP — never leftover PubChem identity. */
export function isMassBankSpectraTrace(endpointUrl: string): boolean {
  return endpointUrl.toLowerCase().includes("massbank");
}

/**
 * Provide free-public MS records when a MassBank JSON API exists.
 * Retired REST + site HTML are not harvested and must not dump PubChem identity.
 */
export async function fetchMassBankByName(
  name: string
): Promise<{
  hits: MassBankHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };
  return { hits: [], annotations: [], traces: [], query: q };
}
