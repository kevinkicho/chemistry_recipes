/**
 * PubChem PUG View client — free public annotations (NIH/NCBI).
 * Sections: GHS hazards, use & manufacturing, physchem notes.
 * Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-view
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const PUG_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view";

/** Headings we request (PubChem Compound TOC). */
export const PUG_VIEW_HEADINGS = [
  "GHS Classification",
  "Use and Manufacturing",
  "Chemical and Physical Properties",
  "Names and Identifiers",
  "Pharmacology and Biochemistry",
  "Safety and Hazards",
] as const;

export type PugViewHeading = (typeof PUG_VIEW_HEADINGS)[number];

export interface PugViewTextBlock {
  heading: string;
  name?: string;
  text: string;
  reference?: string;
}

export interface PugViewHazardInfo {
  signalWord?: string;
  pictograms: string[];
  hazardStatements: string[];
  precautionaryStatements: string[];
  rawBlocks: PugViewTextBlock[];
}

export interface PugViewResult {
  cid: number;
  title?: string;
  blocks: PugViewTextBlock[];
  hazards: PugViewHazardInfo;
  manufacturingTexts: string[];
  descriptionTexts: string[];
  propertyTexts: string[];
  traces: ApiFetchTrace[];
}

interface PugSection {
  TOCHeading?: string;
  Description?: string;
  Information?: Array<{
    Name?: string;
    Value?: {
      StringWithMarkup?: Array<{ String?: string }>;
      Number?: number[];
      Unit?: string;
      ExternalDataURL?: string[];
    };
    ReferenceNumber?: number;
  }>;
  Section?: PugSection[];
}

interface PugViewPayload {
  Record?: {
    RecordTitle?: string;
    RecordType?: string;
    RecordNumber?: number;
    Section?: PugSection[];
  };
}

function extractStrings(info: NonNullable<PugSection["Information"]>[number]): string[] {
  const out: string[] = [];
  const swm = info.Value?.StringWithMarkup;
  if (swm) {
    for (const s of swm) {
      if (s.String?.trim()) out.push(s.String.trim());
    }
  }
  if (info.Value?.Number?.length) {
    const unit = info.Value.Unit ? ` ${info.Value.Unit}` : "";
    out.push(`${info.Value.Number.join(", ")}${unit}`);
  }
  return out;
}

/** PubChem often puts generic TOC blurbs in Description — skip those. */
function isTocBoilerplate(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return true;
  return /this section provides information|major uses of this chemical, including both consumer|various chemical and physical properties that are experimentally|information on safety and hazards for this compound/i.test(
    t
  );
}

function walkSections(
  sections: PugSection[] | undefined,
  path: string[],
  blocks: PugViewTextBlock[]
): void {
  if (!sections) return;
  for (const sec of sections) {
    const heading = sec.TOCHeading || path[path.length - 1] || "Section";
    const nextPath = [...path, heading];

    // Do NOT push TOC Description blurbs — they polluted process steps.
    // Only Information values carry substance-specific text.

    for (const info of sec.Information ?? []) {
      const texts = extractStrings(info);
      for (const text of texts) {
        if (isTocBoilerplate(text)) continue;
        blocks.push({
          heading: nextPath.join(" › "),
          name: info.Name,
          text,
        });
      }
    }

    walkSections(sec.Section, nextPath, blocks);
  }
}

function classifyHazards(blocks: PugViewTextBlock[]): PugViewHazardInfo {
  const pictograms: string[] = [];
  const hazardStatements: string[] = [];
  const precautionaryStatements: string[] = [];
  let signalWord: string | undefined;
  const rawBlocks: PugViewTextBlock[] = [];

  for (const b of blocks) {
    const h = b.heading.toLowerCase();
    const n = (b.name || "").toLowerCase();
    const isHazardSection =
      h.includes("ghs") ||
      h.includes("safety and hazards") ||
      h.includes("hazard") ||
      n.includes("ghs") ||
      n.includes("hazard") ||
      n.includes("pictogram") ||
      n.includes("precaution") ||
      n.includes("signal");

    if (!isHazardSection) continue;
    rawBlocks.push(b);

    if (n.includes("signal") || /^danger$|^warning$/i.test(b.text)) {
      signalWord = b.text;
    } else if (n.includes("pictogram") || /GHS\d+/i.test(b.text)) {
      pictograms.push(b.text);
    } else if (
      n.includes("precaution") ||
      /^P\d{3}/i.test(b.text) ||
      b.text.startsWith("P")
    ) {
      precautionaryStatements.push(b.text);
    } else if (
      n.includes("hazard") ||
      /^H\d{3}/i.test(b.text) ||
      b.text.includes("H2") ||
      b.text.includes("H3")
    ) {
      hazardStatements.push(b.text);
    } else {
      hazardStatements.push(b.text);
    }
  }

  return {
    signalWord,
    pictograms: unique(pictograms).slice(0, 20),
    hazardStatements: unique(hazardStatements).slice(0, 40),
    precautionaryStatements: unique(precautionaryStatements).slice(0, 40),
    rawBlocks: rawBlocks.slice(0, 50),
  };
}

function unique(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

function filterByHeadingKeywords(
  blocks: PugViewTextBlock[],
  keywords: string[]
): string[] {
  const lower = keywords.map((k) => k.toLowerCase());
  return unique(
    blocks
      .filter((b) => {
        if (isTocBoilerplate(b.text)) return false;
        const hay = `${b.heading} ${b.name || ""}`.toLowerCase();
        return lower.some((k) => hay.includes(k));
      })
      .map((b) => {
        // Prefer bare substance text; keep name only when it adds context
        const name = (b.name || "").trim();
        if (!name || /^description$/i.test(name)) return b.text;
        return `${name}: ${b.text}`;
      })
  );
}

/**
 * Fetch selected PUG View headings for a CID. Parallel requests; real traces only.
 */
export async function fetchPubChemView(cid: number): Promise<PugViewResult> {
  const empty: PugViewResult = {
    cid,
    blocks: [],
    hazards: {
      pictograms: [],
      hazardStatements: [],
      precautionaryStatements: [],
      rawBlocks: [],
    },
    manufacturingTexts: [],
    descriptionTexts: [],
    propertyTexts: [],
    traces: [],
  };

  if (!Number.isFinite(cid) || cid <= 0) return empty;

  const traces: ApiFetchTrace[] = [];
  const allBlocks: PugViewTextBlock[] = [];
  let title: string | undefined;

  // Prefer targeted headings (smaller payloads) over full record
  const headings = [
    "GHS Classification",
    "Use and Manufacturing",
    "Chemical and Physical Properties",
    "Safety and Hazards",
  ];

  const results = await Promise.all(
    headings.map(async (heading) => {
      const url = `${PUG_VIEW}/data/compound/${cid}/JSON?heading=${encodeURIComponent(heading)}`;
      return fetchJsonWithTrace<PugViewPayload>(url, {
        next: { revalidate: 3600 },
      });
    })
  );

  for (const { data, trace } of results) {
    traces.push(trace);
    if (!data?.Record) continue;
    if (!title && data.Record.RecordTitle) title = data.Record.RecordTitle;
    const blocks: PugViewTextBlock[] = [];
    walkSections(data.Record.Section, [], blocks);
    allBlocks.push(...blocks);
  }

  // If targeted headings mostly failed, try full record once (capped use)
  const okCount = traces.filter((t) => t.ok).length;
  if (okCount === 0) {
    const url = `${PUG_VIEW}/data/compound/${cid}/JSON`;
    const { data, trace } = await fetchJsonWithTrace<PugViewPayload>(url, {
      next: { revalidate: 3600 },
    });
    traces.push(trace);
    if (data?.Record) {
      title = data.Record.RecordTitle || title;
      const blocks: PugViewTextBlock[] = [];
      walkSections(data.Record.Section, [], blocks);
      // Cap blocks from full record to keep page/AI context sane
      allBlocks.push(...blocks.slice(0, 200));
    }
  }

  const hazards = classifyHazards(allBlocks);
  const manufacturingTexts = filterByHeadingKeywords(allBlocks, [
    "use and manufacturing",
    "methods of manufacturing",
    "industry uses",
    "manufacturing",
    "production",
    "preparation",
    "synthesis",
  ]).slice(0, 40);

  const descriptionTexts = filterByHeadingKeywords(allBlocks, [
    "record description",
    "description",
    "pharmacology",
    "biochemistry",
    "drug indication",
  ]).slice(0, 20);

  const propertyTexts = filterByHeadingKeywords(allBlocks, [
    "chemical and physical",
    "experimental properties",
    "computed properties",
    "melting",
    "boiling",
    "solubility",
    "density",
    "logp",
  ]).slice(0, 40);

  return {
    cid,
    title,
    blocks: allBlocks.slice(0, 300),
    hazards,
    manufacturingTexts,
    descriptionTexts,
    propertyTexts,
    traces,
  };
}
