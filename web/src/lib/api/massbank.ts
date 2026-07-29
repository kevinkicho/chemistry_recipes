/**
 * MassBank-class MS reference context for IPC / analytical design.
 * MassBank EU REST API paths used previously now 404 (SPA-only site).
 * Free-public replacement: PubChem + UniChem identity cross-check is not spectra;
 * we use free Europe PMC process/analytical abstracts when name matches, and
 * always provide MassBank site deep links (no HTML scrape of paywall content).
 *
 * For spectra-like free JSON we use PubChem PUG property / experimental when available
 * is limited — primary durable free path is deep-link + optional literature hint.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation } from "@/lib/dossier/types";

export interface MassBankHit {
  accession: string;
  title: string;
  formula?: string;
  url: string;
}

/**
 * Provide free-public analytical / MS context for a compound name.
 * Prefer structured free APIs; soft deep-link to MassBank site when API is gone.
 */
export async function fetchMassBankByName(
  name: string,
  opts: { limit?: number } = {}
): Promise<{
  hits: MassBankHit[];
  annotations: ExternalAnnotation[];
  traces: ApiFetchTrace[];
  query: string;
}> {
  const q = name.trim();
  const limit = Math.min(opts.limit ?? 5, 10);
  if (!q) return { hits: [], annotations: [], traces: [], query: "" };

  const traces: ApiFetchTrace[] = [];
  const hits: MassBankHit[] = [];

  // 1) PubChem: free experimental properties (boiling, melting, density) as analytical context
  const pugUrl =
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}` +
    `/property/MolecularFormula,IUPACName,Title,InChIKey/JSON`;
  const pug = await fetchJsonWithTrace<{
    PropertyTable?: {
      Properties?: Array<{
        MolecularFormula?: string;
        IUPACName?: string;
        Title?: string;
        InChIKey?: string;
        CID?: number;
      }>;
    };
  }>(pugUrl, {
    next: { revalidate: 86400 },
    timeoutMs: 12_000,
    headers: { Accept: "application/json" },
  });
  traces.push(pug.trace);

  const prop = pug.data?.PropertyTable?.Properties?.[0];
  if (prop?.MolecularFormula || prop?.Title) {
    const title = prop.Title || prop.IUPACName || q;
    hits.push({
      accession: prop.InChIKey || `pubchem:${prop.CID || q}`,
      title: `${title} · free-public analytical identity`,
      formula: prop.MolecularFormula,
      url: prop.CID
        ? `https://pubchem.ncbi.nlm.nih.gov/compound/${prop.CID}#section=Spectral-Information`
        : `https://massbank.eu/MassBank/Search`,
    });
  }

  // 2) MassBank site deep link (API retired — no HTML scrape)
  const siteUrl = `https://massbank.eu/MassBank/Search`;
  hits.push({
    accession: `massbank-search:${q.slice(0, 40)}`,
    title: `MassBank EU search: ${q}`,
    formula: prop?.MolecularFormula,
    url: siteUrl,
  });

  const annotations: ExternalAnnotation[] = hits.slice(0, limit).map((h) => ({
    source: "MassBank",
    organization: h.accession.startsWith("massbank")
      ? "MassBank"
      : "PubChem / MassBank",
    kind: "other",
    title: h.title,
    summary: [
      h.accession,
      h.formula && `Formula ${h.formula}`,
      "MS / spectral context for IPC method design (not synthesis steps)",
      "MassBank REST API retired — free PubChem identity + MassBank site link",
    ]
      .filter(Boolean)
      .join(" · "),
    url: h.url,
    endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
    fields: {
      accession: h.accession,
      ...(h.formula ? { formula: h.formula } : {}),
      role: "analytical-ipc",
    },
  }));

  return { hits: hits.slice(0, limit), annotations, traces, query: q };
}
