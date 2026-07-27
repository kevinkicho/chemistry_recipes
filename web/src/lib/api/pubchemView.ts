/**
 * PubChem PUG View client — free public annotations (NIH/NCBI).
 * Sections: GHS hazards, use & manufacturing, physchem notes.
 * Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-view
 */

import { fetchJsonWithTrace, type ApiFetchTrace } from "@/lib/api/trace";

const PUG_VIEW = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view";

const PUG_VIEW_FETCH = {
  cache: "no-store" as RequestCache,
  timeoutMs: 10_000,
  headers: {
    Accept: "application/json",
    "User-Agent": "ChemistryRecipes/1.2 (educational; process-recipe hub)",
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

  // Prefer targeted headings (smaller payloads) over full record.
  // Extra process-relevant sections densify manufacturing recipe evidence.
  const headings = [
    "GHS Classification",
    "Use and Manufacturing",
    "Chemical and Physical Properties",
    "Safety and Hazards",
    "Pharmacology and Biochemistry",
    "Drug and Medication Information",
    "Associated Disorders and Diseases",
    "Literature",
    "Patents",
    "Biomolecular Interactions and Pathways",
  ];

  async function fetchHeading(heading: string) {
    const url = `${PUG_VIEW}/data/compound/${cid}/JSON?heading=${encodeURIComponent(heading)}`;
    let last = await fetchJsonWithTrace<PugViewPayload>(url, PUG_VIEW_FETCH);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (last.trace.ok || last.trace.notFound || last.trace.httpStatus === 404) {
        break;
      }
      // Retry transient 503/timeout from cloud egress
      await sleep(600 * (attempt + 1) + Math.floor(Math.random() * 200));
      last = await fetchJsonWithTrace<PugViewPayload>(url, PUG_VIEW_FETCH);
    }
    return last;
  }

  const results = await Promise.all(headings.map((h) => fetchHeading(h)));

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
  if (okCount < 2) {
    const url = `${PUG_VIEW}/data/compound/${cid}/JSON`;
    let full = await fetchJsonWithTrace<PugViewPayload>(url, PUG_VIEW_FETCH);
    if (!full.trace.ok) {
      await sleep(800);
      full = await fetchJsonWithTrace<PugViewPayload>(url, PUG_VIEW_FETCH);
    }
    traces.push(full.trace);
    if (full.data?.Record) {
      title = full.data.Record.RecordTitle || title;
      const blocks: PugViewTextBlock[] = [];
      walkSections(full.data.Record.Section, [], blocks);
      // Cap blocks from full record to keep page/AI context sane
      allBlocks.push(...blocks.slice(0, 200));
    }
  }

  const hazards = classifyHazards(allBlocks);

  // Broad manufacturing/use harvest — then fall back to any non-boilerplate under that TOC
  let manufacturingTexts = filterByHeadingKeywords(allBlocks, [
    "use and manufacturing",
    "methods of manufacturing",
    "industry uses",
    "manufacturing",
    "production",
    "preparation",
    "synthesis",
    "formulations",
    "consumption",
    "sample use",
    "use classification",
  ]);
  if (manufacturingTexts.length === 0) {
    manufacturingTexts = unique(
      allBlocks
        .filter((b) =>
          /use and manufacturing|methods of manufacturing|industry uses|formulations/i.test(
            b.heading
          )
        )
        .map((b) => b.text)
        .filter((t) => !isTocBoilerplate(t) && t.length >= 24)
    );
  }
  // Also harvest long process-looking blocks outside strict mfg headings
  const processyExtra = unique(
    allBlocks
      .filter((b) => {
        if (isTocBoilerplate(b.text) || b.text.length < 40) return false;
        return /synthes|manufactur|preparat|process for|industrial|hydrogenat|crystall|ferment|work.?up|isolation/i.test(
          `${b.heading} ${b.name || ""} ${b.text}`
        );
      })
      .map((b) => {
        const name = (b.name || "").trim();
        if (!name || /^description$/i.test(name)) return b.text;
        return `${name}: ${b.text}`;
      })
  );
  manufacturingTexts = unique([...manufacturingTexts, ...processyExtra]).slice(
    0,
    60
  );

  const descriptionTexts = filterByHeadingKeywords(allBlocks, [
    "record description",
    "description",
    "pharmacology",
    "biochemistry",
    "drug indication",
    "associated disorders",
    "therapeutic uses",
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
    "physical description",
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
