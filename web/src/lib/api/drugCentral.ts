/**
 * DrugCentral identity via free-public UniChem + PubChem (DrugCentral REST API is gone).
 * Resolves: name → PubChem InChIKey → UniChem → DrugCentral drugcard id.
 * Card pages remain free-public HTML deep links (no HTML scrape for plant numbers).
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface DrugCentralHit {
  id: string;
  name: string;
  cas?: string;
  unii?: string;
  url: string;
  summary?: string;
}

/**
 * Search DrugCentral by drug/compound name (free-public mapping only).
 */
export async function fetchDrugCentralByName(
  name: string
): Promise<{
  hit: DrugCentralHit | null;
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  if (!q) return { hit: null, annotations: [], traces: [], query: "" };

  const traces: ApiFetchTrace[] = [];

  // 1) Resolve name → InChIKey via PubChem (free)
  const pugUrl =
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}` +
    `/property/InChIKey,Title,IUPACName/JSON`;
  const pug = await fetchJsonWithTrace<{
    PropertyTable?: {
      Properties?: Array<{ InChIKey?: string; Title?: string; IUPACName?: string }>;
    };
  }>(pugUrl, {
    next: { revalidate: 86400 },
    timeoutMs: 12_000,
    headers: { Accept: "application/json" },
  });
  traces.push(pug.trace);

  let inchiKey = pug.data?.PropertyTable?.Properties?.[0]?.InChIKey?.trim();
  const title =
    pug.data?.PropertyTable?.Properties?.[0]?.Title ||
    pug.data?.PropertyTable?.Properties?.[0]?.IUPACName ||
    q;

  // 2) Fallback: PubChem text search → CID → InChIKey
  if (!inchiKey) {
    const esUrl =
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/cids/JSON`;
    const cids = await fetchJsonWithTrace<{
      IdentifierList?: { CID?: number[] };
    }>(esUrl, {
      next: { revalidate: 86400 },
      timeoutMs: 10_000,
      headers: { Accept: "application/json" },
    });
    traces.push(cids.trace);
    const cid = cids.data?.IdentifierList?.CID?.[0];
    if (cid) {
      const ikUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/InChIKey,Title/JSON`;
      const ik = await fetchJsonWithTrace<{
        PropertyTable?: { Properties?: Array<{ InChIKey?: string; Title?: string }> };
      }>(ikUrl, {
        next: { revalidate: 86400 },
        timeoutMs: 10_000,
        headers: { Accept: "application/json" },
      });
      traces.push(ik.trace);
      inchiKey = ik.data?.PropertyTable?.Properties?.[0]?.InChIKey?.trim();
    }
  }

  // 3) UniChem InChIKey map → DrugCentral source (src_id 34)
  if (inchiKey) {
    const uniUrl = `https://www.ebi.ac.uk/unichem/rest/verbose_inchikey/${encodeURIComponent(inchiKey)}`;
    const uni = await fetchJsonWithTrace<
      Array<{
        name?: string;
        src_id?: number;
        src_compound_id?: string[];
        src_url?: string;
        base_id_url?: string;
      }>
    >(uniUrl, {
      next: { revalidate: 86400 },
      timeoutMs: 12_000,
      headers: { Accept: "application/json" },
    });
    traces.push(uni.trace);

    const rows = Array.isArray(uni.data) ? uni.data : [];
    const dc = rows.find(
      (r) =>
        Number(r.src_id) === 34 ||
        /drugcentral/i.test(r.name || "")
    );
    const dcId = dc?.src_compound_id?.[0];
    if (dcId) {
      const url =
        dc.src_url ||
        `https://drugcentral.org/drugcard/${encodeURIComponent(dcId)}`;
      const hit: DrugCentralHit = {
        id: String(dcId),
        name: title,
        url,
        summary: `DrugCentral id ${dcId} via UniChem (free-public map; DrugCentral REST API retired)`,
      };
      return {
        hit,
        annotations: [
          {
            source: "DrugCentral",
            organization: "UNM / DrugCentral",
            kind: "identity",
            title: hit.name,
            summary:
              hit.summary +
              " — drug card identity / target context (not a manufacturing route).",
            url: hit.url,
            endpointUrl: "https://www.ebi.ac.uk/unichem/rest",
            fields: {
              id: hit.id,
              inchiKey,
              via: "unichem-inchikey",
            },
          },
        ],
        traces,
        query: q,
      };
    }
  }

  // 4) Soft deep-link only (no invented card ids)
  return {
    hit: null,
    annotations: [
      {
        source: "DrugCentral",
        organization: "UNM / DrugCentral",
        kind: "identity",
        title: `DrugCentral search: ${q}`,
        summary:
          "No UniChem DrugCentral map for this name — open DrugCentral manually for drug-card context.",
        url: "https://drugcentral.org/",
        endpointUrl: "https://drugcentral.org/",
      },
    ],
    traces,
    query: q,
  };
}
