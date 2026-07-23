/**
 * PubChem patent cross-references (free PUG REST).
 * Returns linked patent IDs for a CID — useful process IP pointers even without PatentsView key.
 * Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { PatentHit } from "@/lib/api/patentsView";

function googlePatentUrl(id: string): string {
  // Normalize JP-2007-… / US-1234567-A1 → Google Patents path
  const compact = id.replace(/-/g, "");
  return `https://patents.google.com/patent/${compact}`;
}

function looksProcessPatentId(_id: string, preferUs: boolean): number {
  // Prefer US grants/apps for English process text paste workflows
  if (preferUs && /^US/i.test(_id)) return 2;
  if (/^(US|EP|WO)/i.test(_id)) return 1;
  return 0;
}

/**
 * List patent IDs associated with a PubChem compound.
 */
export async function fetchPubchemPatentIds(
  cid: number,
  opts: { limit?: number } = {}
): Promise<{ ids: string[]; traces: ApiFetchTrace[] }> {
  const limit = Math.min(opts.limit ?? 40, 80);
  if (!Number.isFinite(cid) || cid <= 0) {
    return { ids: [], traces: [] };
  }
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/xrefs/PatentID/JSON`;
  const { data, trace } = await fetchJsonWithTrace<{
    InformationList?: { Information?: Array<{ PatentID?: string[] }> };
  }>(url, { next: { revalidate: 86400 } });

  const raw = data?.InformationList?.Information?.[0]?.PatentID ?? [];
  const ranked = [...raw].sort(
    (a, b) => looksProcessPatentId(b, true) - looksProcessPatentId(a, true)
  );
  return { ids: ranked.slice(0, limit), traces: [trace] };
}

/**
 * Convert PubChem patent IDs into PatentHit stubs for process-fact / IP pointer layers.
 * No full text here — titles filled with ID; user can paste Google Patents example text.
 */
export function patentHitsFromPubchemIds(
  ids: string[],
  compoundName: string
): PatentHit[] {
  return ids.slice(0, 25).map((id) => ({
    id: `pubchem-patent:${id}`,
    patentNumber: id,
    title: `${compoundName} — linked patent ${id}`,
    abstract: `PubChem patent cross-reference ${id}. Open Google Patents for claims/examples; paste public experimental text via Local full-text enrich for process-fact density.`,
    url: googlePatentUrl(id),
    assignees: undefined,
  }));
}
