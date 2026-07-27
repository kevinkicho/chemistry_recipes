/**
 * Free-public patent procedure densification.
 *
 * PatentsView abstracts + PubChem xrefs rarely include Example procedures.
 * We densify via:
 * 1. Europe PMC patent records (SRC:PAT) with longer abstracts
 * 2. USPTO Open Data / PatentsView when key present (already in patentsView.ts)
 * 3. Optional Google Patents HTML scrape is intentionally NOT used (fragile / ToS).
 *
 * Users can paste public example text via Local full-text enrich for max density.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import { politeDelay } from "@/lib/api/rateLimit";
import type { PatentHit } from "@/lib/api/patentsView";
import { extractProcessWindowsFromFullText } from "@/lib/api/europePmc";

const EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest";

interface EpmcResult {
  id?: string;
  source?: string;
  title?: string;
  abstractText?: string;
  patentNumber?: string;
  doi?: string;
}

/**
 * Search Europe PMC patent corpus for process / preparation patents.
 * Returns denser abstracts than many PatentsView stubs.
 */
export async function searchEuropePmcPatents(
  compoundName: string,
  opts: { limit?: number } = {}
): Promise<{ hits: PatentHit[]; traces: ApiFetchTrace[]; query: string }> {
  const limit = Math.min(opts.limit ?? 8, 15);
  const name = compoundName.trim();
  if (!name) return { hits: [], traces: [], query: "" };

  const n = name.replace(/"/g, " ");
  const query =
    `SRC:PAT AND ("${n}") AND (synthesis OR preparation OR manufacturing OR process OR "method of" OR industrial OR crystalliz* OR hydrogenat*)`;
  const url =
    `${EPMC}/search?query=${encodeURIComponent(query)}` +
    `&resultType=core&pageSize=${limit}&format=json`;

  const { data, trace } = await fetchJsonWithTrace<{
    resultList?: { result?: EpmcResult[] };
  }>(url, { next: { revalidate: 3600 }, timeoutMs: 12_000 });

  const results = data?.resultList?.result ?? [];
  const hits: PatentHit[] = results.map((r, i) => {
    const patentNumber =
      r.patentNumber ||
      (r.id && r.source === "PAT" ? r.id : undefined) ||
      r.id ||
      `pat-${i}`;
    const abstract = r.abstractText?.slice(0, 4000);
    return {
      id: `epmc-pat:${r.source || "PAT"}:${r.id || patentNumber}`,
      patentNumber: String(patentNumber),
      title: r.title || `Patent ${patentNumber}`,
      abstract,
      // Prefer procedure windows when abstract is long
      procedureExcerpt: abstract
        ? extractProcessWindowsFromFullText(abstract, 2800)
        : undefined,
      url: r.doi
        ? `https://doi.org/${r.doi}`
        : `https://europepmc.org/article/${r.source || "PAT"}/${r.id || patentNumber}`,
    };
  });

  return { hits, traces: [trace], query };
}

/**
 * Enrich PubChem / PatentsView hits that have US/EP/WO numbers with Europe PMC abstracts.
 */
export async function enrichPatentHitsWithEpmc(
  hits: PatentHit[],
  opts: { max?: number } = {}
): Promise<{ hits: PatentHit[]; traces: ApiFetchTrace[] }> {
  const max = opts.max ?? 5;
  const traces: ApiFetchTrace[] = [];
  const out = hits.map((h) => ({ ...h }));
  let n = 0;

  for (let i = 0; i < out.length && n < max; i++) {
    const h = out[i]!;
    if (h.procedureExcerpt && h.procedureExcerpt.length > 200) continue;
    if (h.abstract && h.abstract.length > 800 && /example|°\s*C|equiv/i.test(h.abstract)) {
      h.procedureExcerpt = extractProcessWindowsFromFullText(h.abstract, 2800);
      continue;
    }
    const num = (h.patentNumber || "").replace(/[^A-Za-z0-9]/g, "");
    if (!num || num.length < 5) continue;
    // Europe PMC often indexes as US1234567 or similar
    const q = `SRC:PAT AND (EXT_ID:"${h.patentNumber}" OR "${h.patentNumber}" OR "${num}")`;
    const url =
      `${EPMC}/search?query=${encodeURIComponent(q)}` +
      `&resultType=core&pageSize=3&format=json`;
    const { data, trace } = await fetchJsonWithTrace<{
      resultList?: { result?: EpmcResult[] };
    }>(url, { next: { revalidate: 86400 }, timeoutMs: 10_000 });
    traces.push(trace);
    n += 1;
    const best = data?.resultList?.result?.find((r) => r.abstractText);
    if (best?.abstractText) {
      h.abstract = best.abstractText.slice(0, 4000);
      h.procedureExcerpt = extractProcessWindowsFromFullText(
        best.abstractText,
        2800
      );
      if (best.title && h.title.includes("linked patent")) {
        h.title = best.title;
      }
    }
    await politeDelay(70);
  }

  return { hits: out, traces };
}
