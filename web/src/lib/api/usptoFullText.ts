/**
 * Free patent full-text densification beyond PatentsView abstracts.
 *
 * Legal free paths:
 * - USPTO PatentsView (abstracts; optional key)
 * - Europe PMC SRC:PAT
 * - PubChem PUG View patent records (pug_view/data/patent/{US-xxx}/JSON)
 *
 * PUG REST /patent/patentid/ was retired ("Invalid input domain") — use PUG View.
 * Google Patents is intentionally NOT scraped.
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
 * Normalize patent numbers to PubChem PUG View accession form, e.g. US-10029448-B2.
 */
export function normalizePubChemPatentAccession(raw: string): string | null {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!s) return null;
  // Already US-1234567-A1
  if (/^US-\d+[A-Z0-9-]*$/i.test(s)) return s;
  // US10029448B2 or US10029448
  const m = s.match(/^US0*(\d{4,})([A-Z]\d*)?$/i);
  if (m) {
    const kind = m[2] || "A";
    return `US-${m[1]}-${kind}`;
  }
  // 10029448.pn style
  const n = s.match(/^(\d{6,})([A-Z]\d*)?$/);
  if (n) return `US-${n[1]}-${n[2] || "A"}`;
  return null;
}

function walkPatentText(section: unknown, out: string[] = []): string[] {
  if (!section) return out;
  const secs = Array.isArray(section) ? section : [section];
  for (const sec of secs) {
    if (!sec || typeof sec !== "object") continue;
    const s = sec as {
      TOCHeading?: string;
      Description?: string;
      Information?: Array<{
        Value?: { StringWithMarkup?: Array<{ String?: string }> };
      }>;
      Section?: unknown;
    };
    if (s.Description) out.push(s.Description);
    for (const info of s.Information || []) {
      for (const m of info.Value?.StringWithMarkup || []) {
        if (m.String) out.push(m.String);
      }
    }
    if (s.Section) walkPatentText(s.Section, out);
  }
  return out;
}

/**
 * For US patents missing procedure windows, densify via PubChem PUG View patent JSON.
 */
export async function densifyUsPatentsWithPubchem(
  hits: PatentHit[],
  opts: { max?: number } = {}
): Promise<{ hits: PatentHit[]; traces: ApiFetchTrace[] }> {
  const max = opts.max ?? 4;
  const traces: ApiFetchTrace[] = [];
  const ranked = rankByProcedureWindow(hits, (h) =>
    [h.procedureExcerpt, h.abstract, h.title].filter(Boolean).join("\n")
  );
  const out = ranked.map((h) => ({ ...h }));
  let n = 0;

  for (let i = 0; i < out.length && n < max; i++) {
    const h = out[i]!;
    if (h.procedureExcerpt && h.procedureExcerpt.length > 400) continue;
    if (
      scoreProcedureWindow(`${h.title}\n${h.abstract || ""}`) < 0 &&
      n + 1 < max
    ) {
      continue;
    }
    const num = (h.patentNumber || h.id || "").replace(/\s+/g, "");
    if (!/^US/i.test(num) && !/^\d{6,}/.test(num)) continue;

    const accession =
      normalizePubChemPatentAccession(num) ||
      normalizePubChemPatentAccession(h.patentNumber || "") ||
      normalizePubChemPatentAccession(h.id);
    if (!accession) continue;

    // PUG View patent record (free public; works when PUG /patent/ domain fails)
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/patent/${encodeURIComponent(accession)}/JSON`;
    const { data, trace } = await fetchJsonWithTrace<{
      Record?: {
        RecordTitle?: string;
        RecordAccession?: string;
        Section?: unknown;
      };
    }>(url, {
      next: { revalidate: 86400 },
      timeoutMs: 14_000,
      headers: { Accept: "application/json" },
    });
    traces.push(trace);
    n += 1;

    const texts = walkPatentText(data?.Record?.Section);
    const abstractish =
      texts.find((t) => t.length > 80 && t.length < 8000) ||
      texts.sort((a, b) => b.length - a.length)[0];
    if (abstractish && abstractish.length >= 80) {
      if (!h.abstract || h.abstract.length < abstractish.length) {
        h.abstract = abstractish.slice(0, 4000);
      }
      h.procedureExcerpt = extractProcessWindowsFromFullText(abstractish, 2800);
      if (data?.Record?.RecordTitle && h.title.includes("linked patent")) {
        h.title = data.Record.RecordTitle;
      }
    }
    await politeDelay(80);
  }

  return { hits: out, traces };
}
