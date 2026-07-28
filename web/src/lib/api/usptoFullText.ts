/**
 * Free patent full-text densification beyond PatentsView abstracts.
 *
 * Legal free paths:
 * - USPTO PatentsView (already wired; abstracts)
 * - Europe PMC SRC:PAT (already wired)
 * - USPTO Patent Public Search is not a stable free bulk full-text REST for us
 * - Best-effort: USPTO ODP / PED bulk is heavy; we use Europe PMC + PatentsView
 *   and optional USPTO assignment/publication HTML is fragile.
 *
 * Additional densify: PubChem patent abstract endpoint when available,
 * and Google Patents is intentionally NOT scraped.
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";
import { politeDelay } from "@/lib/api/rateLimit";
import type { PatentHit } from "@/lib/api/patentsView";
import { extractProcessWindowsFromFullText } from "@/lib/api/europePmc";
import {
  rankByProcedureWindow,
  scoreProcedureWindow,
} from "@/lib/literature/procedureWindowScore";

/**
 * For US patents missing procedure windows, try PubChem patent record abstract
 * and Europe PMC already handled in patentFullText.ts.
 *
 * Prefers process-rich titles/abstracts (temp/equiv/workup) before clinical-only.
 *
 * PubChem: /rest/pug/patent/patentid/{id}/xrefs/… limited;
 * Prefer PubChem view of patent via PUG when patent ID is known.
 */
export async function densifyUsPatentsWithPubchem(
  hits: PatentHit[],
  opts: { max?: number } = {}
): Promise<{ hits: PatentHit[]; traces: ApiFetchTrace[] }> {
  const max = opts.max ?? 4;
  const traces: ApiFetchTrace[] = [];
  // Rank candidates so densify budget hits process patents first
  const ranked = rankByProcedureWindow(hits, (h) =>
    [h.procedureExcerpt, h.abstract, h.title].filter(Boolean).join("\n")
  );
  const out = ranked.map((h) => ({ ...h }));
  let n = 0;

  for (let i = 0; i < out.length && n < max; i++) {
    const h = out[i]!;
    if (h.procedureExcerpt && h.procedureExcerpt.length > 400) continue;
    // Skip pure clinical noise when we still have densify budget and better candidates later
    if (
      scoreProcedureWindow(`${h.title}\n${h.abstract || ""}`) < 0 &&
      n + 1 < max
    ) {
      continue;
    }
    const num = (h.patentNumber || "").replace(/\s+/g, "");
    if (!/^US/i.test(num) && !/^US/i.test(h.id)) continue;

    // PubChem patent JSON (when indexed)
    const patentId = num || h.patentNumber;
    if (!patentId) continue;
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/patent/patentid/${encodeURIComponent(patentId)}/JSON`;
    const { data, trace } = await fetchJsonWithTrace<{
      Patents?: {
        Patent?: Array<{
          PatentId?: string;
          Title?: string;
          Abstract?: string;
          PublicationDate?: string;
        }>;
      };
    }>(url, {
      next: { revalidate: 86400 },
      timeoutMs: 10_000,
    });
    traces.push(trace);
    n += 1;

    const pat = data?.Patents?.Patent?.[0];
    if (pat?.Abstract && pat.Abstract.length > 80) {
      h.abstract = pat.Abstract.slice(0, 4000);
      h.procedureExcerpt = extractProcessWindowsFromFullText(
        pat.Abstract,
        2800
      );
      if (pat.Title && h.title.includes("linked patent")) {
        h.title = pat.Title;
      }
      if (pat.PublicationDate) h.date = pat.PublicationDate;
    }
    await politeDelay(80);
  }

  return { hits: out, traces };
}
