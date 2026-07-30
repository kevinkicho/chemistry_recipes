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
import { isStructuredPatentHit, type PatentHit } from "@/lib/api/patentsView";
import { extractProcessWindowsFromFullText } from "@/lib/api/europePmc";
import {
  rankByProcedureWindow,
  scoreProcedureWindow,
} from "@/lib/literature/procedureWindowScore";

/**
 * Normalize patent numbers to PubChem PUG View accession form, e.g. US-10029448-B2.
 * Reject bare PMIDs (6–9 digits with no US/authority prefix).
 */
export function normalizePubChemPatentAccession(raw: string): string | null {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  if (!s) return null;
  // Never treat PubMed / MED ids as US patents
  if (/^MED[:\s-]?\d+$/i.test(s) || /^PMID[:\s-]?\d+$/i.test(s)) return null;
  // Already US-1234567-A1
  if (/^US-\d+[A-Z0-9-]*$/i.test(s)) return s;
  // US10029448B2 or US10029448
  const m = s.match(/^US0*(\d{4,})([A-Z]\d*)?$/i);
  if (m) {
    const kind = m[2] || "A";
    return `US-${m[1]}-${kind}`;
  }
  // Bare 6–9 digit numbers are often PMIDs mislabeled as patents — refuse
  if (/^\d{6,9}$/.test(s)) return null;
  // Longer digit runs with optional kind suffix (true patent serials)
  const n = s.match(/^(\d{7,})([A-Z]\d*)?$/);
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
  const structured = hits.filter((h) => isStructuredPatentHit(h));
  const ranked = rankByProcedureWindow(structured, (h) =>
    [h.procedureExcerpt, h.abstract, h.title].filter(Boolean).join("\n")
  );
  // Preserve full hit list; only densify structured US patents
  const out = hits.map((h) => ({ ...h }));
  let n = 0;

  for (let i = 0; i < ranked.length && n < max; i++) {
    const rankedHit = ranked[i]!;
    const h = out.find((x) => x.id === rankedHit.id);
    if (!h || !isStructuredPatentHit(h)) continue;
    if (h.procedureExcerpt && h.procedureExcerpt.length > 400) continue;
    if (
      scoreProcedureWindow(`${h.title}\n${h.abstract || ""}`) < 0 &&
      n + 1 < max
    ) {
      continue;
    }
    const num = (h.patentNumber || h.id || "").replace(/\s+/g, "");
    // Require US authority for PubChem PUG View patent densify
    if (!/^US/i.test(num) && !/US[-_]?\d/i.test(h.id || "")) continue;

    const accession =
      normalizePubChemPatentAccession(num) ||
      normalizePubChemPatentAccession(h.patentNumber || "") ||
      normalizePubChemPatentAccession(
        (h.id || "").replace(/^pubchem-patent:/i, "")
      );
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
