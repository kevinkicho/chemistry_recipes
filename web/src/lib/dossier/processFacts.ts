/**
 * Process fact atoms — the accuracy layer for production / manufacturing guidance.
 *
 * HARD PRODUCT LAW:
 * - Every numeric / condition fact must point at a public source.
 * - Manufacturing view and public process briefs only show sourced atoms
 *   (or explicit open gaps). AI may structure, never invent site limits.
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import { looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";
import { scoreProcessRelevance } from "@/lib/literature/rank";
import type {
  ProcessRoute,
  ProcessStep,
  SourceRef,
  StepConditions,
} from "@/lib/types/process";
import { honestProcessSequenceStub } from "@/lib/dossier/sectionHonesty";

export type ProcessFactKind =
  | "unit-op"
  | "condition"
  | "material"
  | "yield"
  | "purity"
  | "isolation"
  | "hazard-process"
  | "scale-note"
  | "workup"
  | "open-gap";

export type ProcessFactProvenance =
  | "patent"
  | "literature"
  | "pubchem-mfg"
  | "ghs"
  | "annotation"
  | "user-supplement"
  | "editorial-gap";
// note: ORD / KEGG / Rhea excerpts map to "annotation"

/** How the UI should frame the process content */
export type ProcessFraming = "process-recipe" | "evidence-lead-pack";

export interface ProcessFact {
  id: string;
  kind: ProcessFactKind;
  /** Short plant-readable claim */
  claim: string;
  /** Optional structured value (e.g. "80–100", "1.2 eq") */
  value?: string;
  unit?: string;
  /** Verbatim-ish excerpt supporting the claim */
  quote?: string;
  provenance: ProcessFactProvenance;
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  /** Process-relevance of parent document 0–100 */
  sourceScore?: number;
  /** unit-op hint when detected */
  unitOp?: string;
  /** Patent/literature example or embodiment id when detected */
  exampleRef?: string;
}

export interface ProcessAccuracyMetrics {
  sourcedConditionCount: number;
  unitOpCount: number;
  isolationCount: number;
  exampleDenseSources: number;
  patentConditionCount: number;
  userSupplementChars: number;
  /** 0–100 display metric for diagnostics */
  accuracyScore: number;
  framing: ProcessFraming;
}

export interface ProcessFactBundle {
  facts: ProcessFact[];
  /** Counts by kind */
  counts: Record<string, number>;
  /** Distinct primary sources that contributed condition/unit-op facts */
  sourcedConditionCount: number;
  unitOpCount: number;
  openGapCount: number;
  /** True when density supports a manufacturing *recipe* framing */
  productionBriefEligible: boolean;
  /** process-recipe only when eligibility bar is met; else evidence-lead-pack */
  framing: ProcessFraming;
  summary: string;
  openGaps: string[];
  /** Manager-facing scale-up / EHS risks called out from public text */
  managerRisks: string[];
  /** Patent numbers / assignees for planning (not legal advice) */
  ipPointers: string[];
  /** Documents that look like worked examples */
  exampleDenseSources: string[];
  metrics: ProcessAccuracyMetrics;
}

const UNIT_OP_PATTERNS: Array<{ re: RegExp; op: string }> = [
  { re: /\bhydrogenat/i, op: "hydrogenation" },
  { re: /\bcrystalliz/i, op: "crystallization" },
  { re: /\bferment/i, op: "fermentation" },
  { re: /\bdistill/i, op: "distillation" },
  { re: /\bextract(ion|ed|ing)?\b/i, op: "extraction" },
  { re: /\bfiltr|filter/i, op: "filtration" },
  { re: /\bcentrifug/i, op: "centrifugation" },
  { re: /\bdry(ing|ied)?\b|dried under/i, op: "drying" },
  { re: /\bquench/i, op: "quench" },
  { re: /\bwork[- ]?up\b/i, op: "workup" },
  { re: /\bpurif/i, op: "purification" },
  { re: /\balkylat|acylat|amidat|esterif|hydrolys|condens|oxidat|reduct/i, op: "reaction" },
  { re: /\bcharg(e|ing)\b/i, op: "charge" },
  { re: /\bisolat/i, op: "isolation" },
  { re: /\bmilling|microniz/i, op: "milling" },
  { re: /\bchromatograph/i, op: "chromatography" },
];

const TEMP_RE =
  /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*°\s*C\b/gi;
const TIME_RE =
  /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|min|minutes?|s)\b/gi;
const PRESS_RE =
  /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(bar|atm|MPa|psi|kPa)\b/gi;
const PH_RE = /\bpH\s*[=~]?\s*(\d+(?:\.\d+)?(?:\s*(?:–|-|to)\s*\d+(?:\.\d+)?)?)/gi;
const YIELD_RE =
  /\b(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*%\s*(?:yield|isolated|overall)?/gi;
const EQ_RE = /(\d+(?:\.\d+)?)\s*(?:equiv\.?|eq\.?)\b/gi;
const ATM_RE = /\b(under\s+)?(N2|nitrogen|argon|H2|hydrogen|air|inert)\b/gi;

const HAZARD_PROC_RE =
  /\b(exotherm|runaway|peroxide|pyrophoric|H2\b|hydrogen gas|cryogenic|dust explos|toxic gas|scrubber|ATEX|flammable solvent)\b/i;

const SCALE_RE =
  /\b(scale[- ]?up|pilot plant|kilo lab|commercial scale|heat transfer|mass transfer|mixing limited|cycle time)\b/i;

/** Worked example / embodiment cues (patent full-text or rich abstract) */
const EXAMPLE_RE =
  /\b(example\s+\d+|examples?\s+\d+\s*[-–]\s*\d+|embodiment\s+\d+|general procedure|experimental (procedure|section)|worked example)\b/gi;

const ASSIGNEE_RE =
  /\b(assigned to|assignee[:\s]+|owned by)\s+([A-Z][A-Za-z0-9&.,\-\s]{2,60})/;

function trunc(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function sentenceWindow(text: string, matchIndex: number, matchLen: number): string {
  const start = Math.max(0, text.lastIndexOf(".", matchIndex - 1) + 1);
  let end = text.indexOf(".", matchIndex + matchLen);
  if (end < 0) end = Math.min(text.length, matchIndex + matchLen + 120);
  else end = Math.min(text.length, end + 1);
  return trunc(text.slice(start, end), 220);
}

function pushFact(
  out: ProcessFact[],
  seen: Set<string>,
  f: Omit<ProcessFact, "id"> & { id?: string }
): void {
  const key = `${f.kind}|${f.value || ""}|${f.claim}|${f.sourceId}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    ...f,
    id: f.id || `pf-${out.length + 1}-${f.kind}`,
  });
}

function detectExampleRefs(text: string): string[] {
  const out: string[] = [];
  EXAMPLE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXAMPLE_RE.exec(text)) !== null && out.length < 6) {
    const ref = m[0].replace(/\s+/g, " ").trim();
    if (!out.includes(ref)) out.push(ref);
  }
  return out;
}

function conditionDensityScore(text: string): number {
  if (!text) return 0;
  let n = 0;
  for (const re of [TEMP_RE, TIME_RE, PRESS_RE, PH_RE, YIELD_RE, EQ_RE]) {
    re.lastIndex = 0;
    const hits = text.match(re);
    n += hits?.length ?? 0;
  }
  const examples = detectExampleRefs(text).length;
  return Math.min(100, n * 12 + examples * 15);
}

function extractFromText(
  text: string,
  meta: {
    provenance: ProcessFactProvenance;
    sourceId: string;
    sourceLabel: string;
    sourceUrl?: string;
    sourceScore?: number;
  },
  out: ProcessFact[],
  seen: Set<string>
): void {
  if (!text || text.length < 20) return;
  const hay = text;
  const exampleRefs = detectExampleRefs(hay);
  const exampleRef = exampleRefs[0];
  const densityBoost = conditionDensityScore(hay);
  const metaWithEx = {
    ...meta,
    sourceScore: Math.min(100, (meta.sourceScore || 0) + Math.floor(densityBoost / 5)),
    exampleRef,
  };

  for (const { re, op } of UNIT_OP_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(hay)) {
      pushFact(out, seen, {
        kind: "unit-op",
        claim: `Unit operation mentioned: ${op}`,
        value: op,
        unitOp: op,
        quote: trunc(hay, 180),
        ...metaWithEx,
      });
    }
  }

  const scan = (
    re: RegExp,
    kind: ProcessFactKind,
    label: string,
    unit?: string
  ) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let n = 0;
    // Allow more hits from example-dense patent text
    const maxHits = exampleRefs.length ? 10 : 6;
    while ((m = re.exec(hay)) !== null && n < maxHits) {
      n += 1;
      const raw = m[0];
      const value = (m[1] || raw).trim();
      pushFact(out, seen, {
        kind,
        claim: `${label}: ${raw.trim()}${exampleRef ? ` (${exampleRef})` : ""}`,
        value,
        unit: unit || m[2],
        quote: sentenceWindow(hay, m.index, m[0].length),
        ...metaWithEx,
      });
    }
  };

  scan(TEMP_RE, "condition", "Temperature", "°C");
  scan(TIME_RE, "condition", "Time");
  scan(PRESS_RE, "condition", "Pressure");
  scan(PH_RE, "condition", "pH");
  scan(YIELD_RE, "yield", "Reported yield/purity figure", "%");
  scan(EQ_RE, "material", "Stoichiometry", "eq");

  ATM_RE.lastIndex = 0;
  let am: RegExpExecArray | null;
  let an = 0;
  while ((am = ATM_RE.exec(hay)) !== null && an < 4) {
    an += 1;
    pushFact(out, seen, {
      kind: "condition",
      claim: `Atmosphere / gas: ${am[0]}`,
      value: am[0],
      quote: sentenceWindow(hay, am.index, am[0].length),
      ...metaWithEx,
    });
  }

  if (/\bisolat|crystall|filter.?dry|recrystall/i.test(hay)) {
    pushFact(out, seen, {
      kind: "isolation",
      claim: "Isolation / crystallization language present in source",
      quote: trunc(hay, 200),
      unitOp: "isolation",
      ...metaWithEx,
    });
  }

  if (/\bwork[- ]?up|quench|extract with|washed with/i.test(hay)) {
    pushFact(out, seen, {
      kind: "workup",
      claim: "Workup / quench language present in source",
      quote: trunc(hay, 200),
      unitOp: "workup",
      ...metaWithEx,
    });
  }

  if (HAZARD_PROC_RE.test(hay)) {
    const m = hay.match(HAZARD_PROC_RE);
    pushFact(out, seen, {
      kind: "hazard-process",
      claim: `Process hazard cue: ${m?.[0] || "process hazard"}`,
      value: m?.[0],
      quote: trunc(hay, 200),
      ...metaWithEx,
    });
  }

  if (SCALE_RE.test(hay)) {
    const m = hay.match(SCALE_RE);
    pushFact(out, seen, {
      kind: "scale-note",
      claim: `Scale-up / plant language: ${m?.[0] || "scale"}`,
      value: m?.[0],
      quote: trunc(hay, 200),
      ...metaWithEx,
    });
  }
}

/**
 * Extract facts from optional user-pasted public patent/paper text (local enrich).
 */
export function extractFactsFromUserText(
  text: string,
  opts?: { label?: string; cid?: number }
): ProcessFact[] {
  const facts: ProcessFact[] = [];
  const seen = new Set<string>();
  const label = opts?.label?.trim() || "User-pasted public text";
  // Chunk long pastes so example windows stay local
  const chunks: string[] = [];
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  if (raw.length <= 8000) chunks.push(raw);
  else {
    const parts = raw.split(/\n(?=Example\s+\d+|EXAMPLE\s+\d+|Embodiment\s+\d+)/i);
    for (const p of parts) {
      if (p.trim().length > 40) chunks.push(p.slice(0, 12000));
    }
    if (!chunks.length) chunks.push(raw.slice(0, 12000));
  }
  let i = 0;
  for (const chunk of chunks.slice(0, 12)) {
    i += 1;
    extractFromText(
      chunk,
      {
        provenance: "user-supplement",
        sourceId: `user-supplement:${opts?.cid || "x"}:${i}`,
        sourceLabel: `${label}${chunks.length > 1 ? ` (part ${i})` : ""}`,
        sourceScore: 55 + Math.min(30, conditionDensityScore(chunk) / 3),
      },
      facts,
      seen
    );
  }
  return facts;
}

/**
 * Extract structured process facts from free-public evidence (+ optional user paste).
 */
export function extractProcessFacts(
  evidence: CompoundEvidence,
  userTexts?: Array<{ text: string; label?: string }>
): ProcessFactBundle {
  const facts: ProcessFact[] = [];
  const seen = new Set<string>();
  const exampleDenseSources: string[] = [];
  const ipPointers: string[] = [];

  const lit = evidence.literature || [];
  const patents = evidence.patents || [];
  const mfg = evidence.view?.manufacturingTexts || [];
  const ghs = evidence.view?.hazards;

  for (const paper of lit) {
    const score = scoreProcessRelevance(
      paper.title,
      [paper.abstract, paper.fullTextExcerpt].filter(Boolean).join(" ")
    );
    if (
      score < 12 &&
      !looksLikeProcessLiterature(paper.title, paper.abstract) &&
      !paper.fullTextExcerpt
    ) {
      continue;
    }
    const body = [
      paper.title,
      paper.abstract,
      paper.fullTextExcerpt,
    ]
      .filter(Boolean)
      .join(". ");
    if (detectExampleRefs(body).length || conditionDensityScore(body) >= 24) {
      exampleDenseSources.push(trunc(paper.title, 60));
    }
    extractFromText(
      body,
      {
        provenance: "literature",
        sourceId: paper.id,
        sourceLabel: trunc(paper.title, 80),
        sourceUrl: paper.url,
        sourceScore: score + (paper.fullTextExcerpt ? 12 : 0),
      },
      facts,
      seen
    );
  }

  for (const p of patents) {
    const score =
      scoreProcessRelevance(p.title, p.abstract || p.procedureExcerpt) + 10;
    const body = [
      p.title,
      p.abstract,
      p.procedureExcerpt,
      p.patentNumber,
    ]
      .filter(Boolean)
      .join(". ");
    if (detectExampleRefs(body).length || conditionDensityScore(body) >= 20) {
      exampleDenseSources.push(
        trunc(p.patentNumber || p.title || "Patent", 60)
      );
    }
    const assignee = body.match(ASSIGNEE_RE);
    if (p.patentNumber) {
      ipPointers.push(
        [p.patentNumber, p.title ? trunc(p.title, 50) : null, assignee?.[2]?.trim()]
          .filter(Boolean)
          .join(" · ")
      );
    }
    extractFromText(
      body,
      {
        provenance: "patent",
        sourceId: p.id || p.patentNumber || "patent",
        sourceLabel: trunc(
          [p.patentNumber, p.title].filter(Boolean).join(" — ") || "Patent",
          90
        ),
        sourceUrl: p.url,
        sourceScore: score + (p.procedureExcerpt ? 10 : 0),
      },
      facts,
      seen
    );
  }

  // Dedicated procedure excerpts (OA full text, ORD, KEGG, Rhea, densified mfg)
  for (const pe of evidence.procedureExcerpts || []) {
    if (!pe.text || pe.text.length < 40) continue;
    const prov: ProcessFactProvenance =
      pe.source === "patent"
        ? "patent"
        : pe.source === "europepmc-oa"
          ? "literature"
          : pe.source === "pubchem-mfg"
            ? "pubchem-mfg"
            : pe.source === "user-supplement"
              ? "user-supplement"
              : "annotation";
    if (detectExampleRefs(pe.text).length || conditionDensityScore(pe.text) >= 20) {
      exampleDenseSources.push(trunc(pe.label, 60));
    }
    extractFromText(
      pe.text,
      {
        provenance: prov,
        sourceId: pe.id,
        sourceLabel: trunc(pe.label, 90),
        sourceUrl: pe.url,
        sourceScore: 40 + Math.min(30, conditionDensityScore(pe.text) / 3),
      },
      facts,
      seen
    );
  }

  // User-pasted public full text (local enrich — never claimed as validated SOP)
  let userSupplementChars = 0;
  for (const u of userTexts || []) {
    userSupplementChars += u.text?.length || 0;
    const extra = extractFactsFromUserText(u.text, {
      label: u.label,
      cid: evidence.cid,
    });
    for (const f of extra) {
      pushFact(facts, seen, f);
    }
    if (detectExampleRefs(u.text || "").length) {
      exampleDenseSources.push(u.label || "User patent/paper paste");
    }
  }

  for (const t of mfg.slice(0, 12)) {
    extractFromText(
      t,
      {
        provenance: "pubchem-mfg",
        sourceId: `pubchem-mfg:${evidence.cid}`,
        sourceLabel: "PubChem manufacturing / use text",
        sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${evidence.cid}`,
        sourceScore: 20,
      },
      facts,
      seen
    );
  }

  // GHS as process-adjacent EHS facts (not synthesis steps)
  for (const h of (ghs?.hazardStatements || []).slice(0, 8)) {
    pushFact(facts, seen, {
      kind: "hazard-process",
      claim: h,
      quote: h,
      provenance: "ghs",
      sourceId: `pubchem-view-ghs:${evidence.cid}`,
      sourceLabel: "PubChem GHS",
      sourceUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${evidence.cid}#section=Safety-and-Hazards`,
      sourceScore: 40,
    });
  }

  const conditionFacts = facts.filter((f) => f.kind === "condition");
  const unitOps = facts.filter((f) => f.kind === "unit-op");
  const isolation = facts.filter((f) => f.kind === "isolation");
  const materials = facts.filter((f) => f.kind === "material");
  const patentConditionCount = conditionFacts.filter(
    (f) => f.provenance === "patent" || f.provenance === "user-supplement"
  ).length;
  const isolationCount = isolation.length;
  const exampleDense = [...new Set(exampleDenseSources)].slice(0, 8);
  const sourcedConditionCount = conditionFacts.length;
  const unitOpCount = unitOps.length;

  // Stricter bar: recipe framing needs conditions + unit ops + isolation/example/patent density
  const productionBriefEligible =
    sourcedConditionCount >= 3 &&
    unitOpCount >= 2 &&
    (isolationCount >= 1 ||
      exampleDense.length >= 1 ||
      patentConditionCount >= 2);

  const framing: ProcessFraming = productionBriefEligible
    ? "process-recipe"
    : "evidence-lead-pack";

  const openGaps: string[] = [];
  if (framing === "evidence-lead-pack") {
    openGaps.push(
      "Framed as evidence-lead pack (not process recipe): need more conditions, unit ops, and isolation/example density before treating as a manufacturing sequence."
    );
  }
  if (conditionFacts.length === 0) {
    openGaps.push(
      "No numeric process conditions (°C, time, pressure, pH) found in public abstracts/titles — site process must supply validated ranges."
    );
  }
  if (unitOps.length === 0) {
    openGaps.push(
      "No clear unit-operation language extracted from public patents/literature — do not invent a plant sequence."
    );
  }
  if (isolation.length === 0) {
    openGaps.push(
      "Isolation / crystallization details not found in free-public excerpts."
    );
  }
  if (materials.length === 0) {
    openGaps.push(
      "Stoichiometry / material charges not extracted from public text — BOM remains incomplete."
    );
  }
  openGaps.push(
    "Validated IPC methods, hold times, cleaning, and site CPPs are never taken from free APIs — site QMS only."
  );

  for (const g of openGaps) {
    pushFact(facts, seen, {
      kind: "open-gap",
      claim: g,
      provenance: "editorial-gap",
      sourceId: "gap",
      sourceLabel: "Explicit gap (not a process fact)",
    });
  }

  const managerRisks = [
    ...facts
      .filter((f) => f.kind === "hazard-process" && f.provenance !== "ghs")
      .map((f) => f.claim),
    ...facts.filter((f) => f.kind === "scale-note").map((f) => f.claim),
  ].slice(0, 12);

  const counts: Record<string, number> = {};
  for (const f of facts) {
    counts[f.kind] = (counts[f.kind] || 0) + 1;
  }

  const openGapCount = facts.filter((f) => f.kind === "open-gap").length;

  const procedureChars = (evidence.procedureExcerpts || []).reduce(
    (n, p) => n + (p.chars || p.text.length),
    0
  );

  const accuracyScore = Math.min(
    100,
    Math.round(
      sourcedConditionCount * 8 +
        unitOpCount * 6 +
        isolationCount * 8 +
        exampleDense.length * 10 +
        patentConditionCount * 4 +
        Math.min(15, userSupplementChars / 400) +
        Math.min(12, procedureChars / 500)
    )
  );

  const summary =
    framing === "process-recipe"
      ? `Process-recipe framing: ${facts.filter((f) => f.kind !== "open-gap").length} sourced atoms (${sourcedConditionCount} conditions, ${unitOpCount} unit ops${exampleDense.length ? `, ${exampleDense.length} example-dense source(s)` : ""}).`
      : `Evidence-lead pack (not a process recipe): ${sourcedConditionCount} conditions, ${unitOpCount} unit ops — thin public density; do not invent plant detail.`;

  const metrics: ProcessAccuracyMetrics = {
    sourcedConditionCount,
    unitOpCount,
    isolationCount,
    exampleDenseSources: exampleDense.length,
    patentConditionCount,
    userSupplementChars,
    accuracyScore,
    framing,
  };

  return {
    facts,
    counts,
    sourcedConditionCount,
    unitOpCount,
    openGapCount,
    productionBriefEligible,
    framing,
    summary,
    openGaps,
    managerRisks,
    ipPointers: [...new Set(ipPointers)].slice(0, 10),
    exampleDenseSources: exampleDense,
    metrics,
  };
}

/** Source refs from process facts (for step/route attachment). */
export function sourceRefsFromFacts(facts: ProcessFact[]): SourceRef[] {
  const map = new Map<string, SourceRef>();
  for (const f of facts) {
    if (f.kind === "open-gap" || f.provenance === "editorial-gap") continue;
    if (map.has(f.sourceId)) continue;
    const type: SourceRef["type"] =
      f.provenance === "patent"
        ? "patent"
        : f.provenance === "literature"
          ? "literature"
          : "api";
    map.set(f.sourceId, {
      type,
      id: f.sourceId,
      label: f.sourceLabel,
      url: f.sourceUrl,
      note: `process-fact:${f.kind}`,
    });
  }
  return [...map.values()];
}

/**
 * Build literature/patent leads enriched with extracted condition atoms
 * (still not a validated SOP — but factory-readable when sources support it).
 */
export function routesFromProcessFacts(
  evidence: CompoundEvidence,
  bundle: ProcessFactBundle
): ProcessRoute[] {
  const name = evidence.identity?.name || `CID ${evidence.cid}`;
  const processLit = evidence.literature.filter((h) =>
    looksLikeProcessLiterature(h.title, h.abstract)
  );
  const processPatents = evidence.patents.filter((p) =>
    looksLikeProcessLiterature(p.title, p.abstract)
  );

  const steps: ProcessStep[] = [];
  let order = 1;

  const attachFacts = (
    sourceId: string,
    title: string,
    description: string,
    type: "literature" | "patent",
    url?: string
  ) => {
    const related = bundle.facts.filter(
      (f) => f.sourceId === sourceId && f.kind !== "open-gap"
    );
    const conditions: StepConditions = {};
    for (const f of related.filter((x) => x.kind === "condition")) {
      const q = (f.quote || f.claim).toLowerCase();
      if (/°\s*c|temp/i.test(f.claim) && !conditions.temperatureC) {
        conditions.temperatureC = f.value || f.claim;
      } else if (/\b(bar|atm|psi|mpa|kpa)\b/i.test(q) && !conditions.pressure) {
        conditions.pressure = f.value || f.claim;
      } else if (/\b(h|hr|min)\b/i.test(q) && !conditions.time) {
        conditions.time = f.value || f.claim;
      } else if (/ph/i.test(f.claim) && !conditions.ph) {
        conditions.ph = f.value || f.claim;
      } else if (/n2|nitrogen|argon|hydrogen|inert|air/i.test(q) && !conditions.atmosphere) {
        conditions.atmosphere = f.value || f.claim;
      } else if (!conditions.other) {
        conditions.other = f.claim;
      }
    }
    const hasCond = Object.keys(conditions).length > 0;
    const unitOps = related
      .filter((f) => f.kind === "unit-op")
      .map((f) => f.value || f.claim)
      .filter(Boolean) as string[];
    const workup = related.find((f) => f.kind === "workup")?.quote;
    const isolation = related.find((f) => f.kind === "isolation")?.quote;
    const scaleNotes = related
      .filter((f) => f.kind === "scale-note" || f.kind === "hazard-process")
      .map((f) => f.claim)
      .slice(0, 3)
      .join("; ");

    // Dual-view body: plant description from unit ops; chemistry notes from abstract
    const abstractBody =
      description ||
      (related[0]?.quote
        ? related[0].quote
        : "Open primary source for experimental detail.");
    const plantDesc = [
      unitOps.length ? `Plant unit-op cues: ${unitOps.join(", ")}.` : null,
      hasCond
        ? `Public conditions: ${[
            conditions.temperatureC && `T ${conditions.temperatureC}`,
            conditions.time && `t ${conditions.time}`,
            conditions.pressure && `P ${conditions.pressure}`,
            conditions.atmosphere && conditions.atmosphere,
          ]
            .filter(Boolean)
            .join("; ")}.`
        : null,
      workup || isolation
        ? `Workup/isolation language present in source excerpt.`
        : null,
      "Verify full experimental procedure in the primary source before any plant use.",
    ]
      .filter(Boolean)
      .join(" ");

    const apparatus = unitOps.flatMap((op) => {
      const items: Array<{ equipmentClass: string; notes: string }> = [];
      if (/hydrogenat/i.test(op))
        items.push({ equipmentClass: "hydrogenator", notes: "Unit-op cue" });
      if (/crystall/i.test(op))
        items.push({ equipmentClass: "crystallizer", notes: "Unit-op cue" });
      if (/filtr|filter/i.test(op))
        items.push({ equipmentClass: "filter-dryer", notes: "Unit-op cue" });
      if (/distill/i.test(op))
        items.push({
          equipmentClass: "distillation-column",
          notes: "Unit-op cue",
        });
      if (/ferment/i.test(op))
        items.push({ equipmentClass: "ss316-reactor", notes: "Unit-op cue" });
      if (/react|charge|acylation|alkylat|acetylation/i.test(op))
        items.push({
          equipmentClass: "glass-lined-reactor",
          notes: "Unit-op cue",
        });
      return items;
    });

    steps.push({
      id: `${type}-${order}`,
      order: order++,
      title: unitOps[0]
        ? `${String(unitOps[0]).replace(/^./, (c) => c.toUpperCase())} (public lead)`
        : title.slice(0, 120),
      description: plantDesc || abstractBody,
      mechanismClass:
        unitOps[0] ||
        (type === "patent" ? "Patent process lead" : "Literature process lead"),
      mechanismNotes: abstractBody.slice(0, 600),
      conditions: hasCond ? conditions : undefined,
      factIds: related.map((f) => f.id).slice(0, 20),
      apparatus: apparatus.length ? apparatus : undefined,
      environment: conditions.atmosphere
        ? { atmosphere: conditions.atmosphere }
        : undefined,
      workup: workup || isolation,
      scaleNotes: scaleNotes || undefined,
      sourceRefs: [
        {
          type,
          id: sourceId,
          label: title.slice(0, 80),
          url,
        },
        ...sourceRefsFromFacts(related),
      ],
      controls: related.some((f) => f.kind === "yield")
        ? {
            notes: related
              .filter((f) => f.kind === "yield")
              .map((f) => f.claim)
              .join("; "),
          }
        : undefined,
    });
  };

  // Atom-first steps: group unit-ops into plant sequence when density allows
  if (bundle.productionBriefEligible) {
    const unitOps = bundle.facts.filter((f) => f.kind === "unit-op");
    const seenOps = new Set<string>();
    for (const u of unitOps.slice(0, 8)) {
      const op = (u.value || u.unitOp || u.claim).toLowerCase();
      if (seenOps.has(op)) continue;
      seenOps.add(op);
      attachFacts(
        u.sourceId,
        u.claim,
        u.quote || u.claim,
        u.provenance === "patent" ? "patent" : "literature",
        u.sourceUrl
      );
    }
  }

  for (const paper of processLit.slice(0, 5)) {
    if (steps.some((s) => s.sourceRefs?.some((r) => r.id === paper.id))) continue;
    attachFacts(
      paper.id,
      paper.title,
      [paper.abstract, paper.fullTextExcerpt].filter(Boolean).join("\n").trim(),
      "literature",
      paper.url
    );
  }
  for (const p of processPatents.slice(0, 4)) {
    if (
      steps.some((s) =>
        s.sourceRefs?.some((r) => r.id === p.id || r.id === p.patentNumber)
      )
    ) {
      continue;
    }
    attachFacts(
      p.id || p.patentNumber || `pat-${order}`,
      p.title || p.patentNumber || "Patent",
      [p.abstract, p.procedureExcerpt].filter(Boolean).join("\n").trim(),
      "patent",
      p.url
    );
  }

  if (!steps.length) {
    // Harvest failure is not "did not yield atoms". Leftover identity HTTP is not a sequence miss.
    const stub = honestProcessSequenceStub({
      traces: evidence.traces,
      fetchErrors: evidence.fetchErrors,
      name,
      kind: "facts",
    });
    steps.push({
      id: "await-facts-1",
      order: 1,
      title: stub.title,
      description: stub.description,
      mechanismClass: "Evidence gap",
      sourceRefs: [
        {
          type: "editorial",
          id: `process-facts-gap:${evidence.cid}`,
          label: "Process fact extraction — gap",
        },
      ],
    });
  }

  const route: ProcessRoute = {
    id: "public-process-facts",
    name:
      bundle.framing === "process-recipe"
        ? `${name} — public process recipe (sourced)`
        : `${name} — evidence-lead pack (not a recipe)`,
    type: processPatents.length ? "industrial" : "literature",
    preference: 1,
    scaleClass: "lab",
    summary: bundle.summary,
    advantages: [
      "Conditions shown only when extracted from public text",
      "Open gaps listed explicitly — not filled with plant fiction",
    ],
    disadvantages: [
      "Abstracts/titles are incomplete vs full patents/papers",
      "Not a validated SOP, batch record, or GMP procedure",
    ],
    materials: [],
    steps,
    sourceRefs: sourceRefsFromFacts(
      bundle.facts.filter((f) => f.kind !== "open-gap")
    ),
  };

  return [route];
}

const NUMERICISH =
  /\d+(?:\.\d+)?\s*(?:°\s*C|C\b|bar|atm|psi|MPa|kPa|%|h\b|hr|min|eq\.?)/i;

/**
 * True if a free-text condition string is supportable by extracted facts
 * or by an explicit sourceRef on the step (patent/literature).
 */
export function conditionSupportedByFacts(
  value: string | undefined,
  facts: ProcessFact[],
  stepSourceIds: Set<string>
): boolean {
  if (!value?.trim()) return true;
  if (!NUMERICISH.test(value)) {
    // Qualitative (e.g. "inert") — allow if any fact or process source present
    return (
      facts.some(
        (f) =>
          f.kind === "condition" &&
          (value.toLowerCase().includes((f.value || "").toLowerCase()) ||
            (f.value || "").toLowerCase().includes(value.toLowerCase().slice(0, 12)))
      ) || stepSourceIds.size > 0
    );
  }
  // Numeric: require overlap with a sourced fact value or quote
  const compact = value.replace(/\s+/g, "").toLowerCase();
  return facts.some((f) => {
    if (f.kind !== "condition" && f.kind !== "yield") return false;
    const fv = (f.value || f.claim || "").replace(/\s+/g, "").toLowerCase();
    const fq = (f.quote || "").replace(/\s+/g, "").toLowerCase();
    return (
      (fv && (compact.includes(fv.slice(0, 8)) || fv.includes(compact.slice(0, 8)))) ||
      (fq && fq.includes(compact.slice(0, 6)))
    );
  });
}

/**
 * Strip uncited numeric conditions / invented IPC from AI routes
 * so manufacturing view only shows fact-aligned detail.
 */
export function stripUncitedRouteDetails(
  routes: ProcessRoute[],
  bundle: ProcessFactBundle
): ProcessRoute[] {
  const facts = bundle.facts.filter((f) => f.kind !== "open-gap");
  return routes.map((r) => ({
    ...r,
    overallYieldTypical: r.overallYieldTypical
      ? conditionSupportedByFacts(
          r.overallYieldTypical,
          facts,
          new Set(r.sourceRefs?.map((s) => s.id) || [])
        )
        ? r.overallYieldTypical
        : undefined
      : undefined,
    steps: r.steps.map((step) => {
      const stepSourceIds = new Set(
        (step.sourceRefs || r.sourceRefs || []).map((s) => s.id)
      );
      const cond = step.conditions;
      let nextCond: StepConditions | undefined;
      if (cond) {
        const cleaned: StepConditions = {};
        for (const [k, v] of Object.entries(cond) as [keyof StepConditions, string | undefined][]) {
          if (!v) continue;
          if (conditionSupportedByFacts(v, facts, stepSourceIds)) {
            cleaned[k] = v;
          }
        }
        if (Object.keys(cleaned).length) nextCond = cleaned;
      }

      // Drop IPC/CQA arrays that look invented (always site-fill unless fact says yield)
      const controls = step.controls
        ? {
            ...step.controls,
            ipcMethods: undefined as string[] | undefined,
            cqaTargets: undefined as string[] | undefined,
            criticalParameters: step.controls.criticalParameters?.filter((line) =>
              !NUMERICISH.test(line)
                ? true
                : conditionSupportedByFacts(line, facts, stepSourceIds)
            ),
            holdPoints: undefined as string[] | undefined,
          }
        : undefined;

      // If criticalParameters emptied and no notes, drop controls
      const hasControls =
        controls &&
        ((controls.criticalParameters && controls.criticalParameters.length > 0) ||
          controls.notes);

      return {
        ...step,
        conditions: nextCond,
        controls: hasControls ? controls : undefined,
      };
    }),
  }));
}

/** Prefer one strong route when evidence is thin; keep alternatives when rich. */
export function preferRoutesForEvidence(
  routes: ProcessRoute[],
  bundle: ProcessFactBundle
): ProcessRoute[] {
  if (!routes.length) return routes;
  if (bundle.productionBriefEligible && bundle.sourcedConditionCount >= 3) {
    return routes.slice(0, 2);
  }
  // Thin: single preferred route only
  return routes.slice(0, 1).map((r, i) => ({ ...r, preference: i + 1 }));
}

export function factToSourceRef(f: ProcessFact): SourceRef | null {
  if (f.kind === "open-gap") return null;
  return {
    type:
      f.provenance === "patent"
        ? "patent"
        : f.provenance === "literature"
          ? "literature"
          : "api",
    id: f.sourceId,
    label: f.sourceLabel,
    url: f.sourceUrl,
    note: f.quote ? trunc(f.quote, 120) : f.claim,
  };
}

/** Public process brief model (sourced-only export). */
export interface PublicProcessBrief {
  schema: "chemistry-recipes.public-process-brief.v1";
  exportedAt: string;
  disclaimer: string;
  entity: {
    name: string;
    cas?: string;
    pubchemCid?: number;
    formula?: string;
  };
  processFactSummary: string;
  productionBriefEligible: boolean;
  sourcedFacts: Array<{
    kind: ProcessFactKind;
    claim: string;
    value?: string;
    unit?: string;
    quote?: string;
    sourceLabel: string;
    sourceUrl?: string;
    provenance: ProcessFactProvenance;
  }>;
  openGaps: string[];
  managerRisks: string[];
  preferredRoute?: {
    name: string;
    summary: string;
    steps: Array<{
      order: number;
      title: string;
      description: string;
      conditions?: StepConditions;
      sourceLabels?: string[];
    }>;
  };
}

export const PUBLIC_PROCESS_BRIEF_DISCLAIMER =
  "PUBLIC PROCESS BRIEF — sourced free-public atoms only. NOT a GMP procedure, batch record, " +
  "validated process description, or regulatory decision support. Numeric conditions appear only " +
  "when extracted from public titles/abstracts/manufacturing text. Site QMS owns all CPPs/IPCs.";
