/**
 * Segment free-public procedure windows into plant unit-op phases
 * before AI dual-view assembly. Never invents content — only classifies
 * substrings already present in densified text.
 */

export type ProcedureUnitOp =
  | "charge"
  | "react"
  | "quench"
  | "workup"
  | "isolate"
  | "dry"
  | "other";

export type ProcedureSegment = {
  unitOp: ProcedureUnitOp;
  /** Classified snippet (bounded) */
  text: string;
  /** Short quote for grounding */
  quote: string;
  sourceId?: string;
  label?: string;
  order: number;
};

const UNIT_OP_RULES: Array<{ unitOp: ProcedureUnitOp; re: RegExp; priority: number }> = [
  {
    unitOp: "charge",
    re: /\b(charg(?:e|ed|ing)|add(?:ed|ing)?|dissolv(?:e|ed|ing)|suspend(?:ed|ing)?|load(?:ed|ing)?|place[sd]?)\b/i,
    priority: 10,
  },
  {
    unitOp: "react",
    re: /\b(stirr(?:ed|ing)?|heat(?:ed|ing)?|reflux(?:ed|ing)?|react(?:ed|ion|ing)?|hydrogenat|hydrolys|coupl(?:e|ed|ing)|hold(?:s|ing)? at|maintain(?:ed|ing)?|agitated|aged)\b/i,
    priority: 9,
  },
  {
    unitOp: "quench",
    re: /\b(quench(?:ed|ing)?|cool(?:ed|ing)? to|pour(?:ed|ing)? into|neutraliz|acidif|basif)\b/i,
    priority: 11,
  },
  {
    unitOp: "workup",
    re: /\b(work[- ]?up|extract(?:ed|ion|ing)?|wash(?:ed|ing)?|phase.?separat|organic layer|aqueous layer|brine)\b/i,
    priority: 10,
  },
  {
    unitOp: "isolate",
    re: /\b(isolat(?:e|ed|ion|ing)|filtr(?:ate|ation|ered)|crystalliz|precipitat|centrifug|collect(?:ed|ing)? the solid|concentrat(?:e|ed|ion))\b/i,
    priority: 10,
  },
  {
    unitOp: "dry",
    re: /\b(dry(?:ied|ing)?|lyophil|vacuum.?dry|tray.?dry|desiccat|oven)\b/i,
    priority: 8,
  },
];

const SPLIT_RE = /(?<=[.!?;])\s+|\n+/;

function classifyChunk(chunk: string): ProcedureUnitOp {
  let best: { unitOp: ProcedureUnitOp; priority: number } | null = null;
  for (const rule of UNIT_OP_RULES) {
    if (rule.re.test(chunk)) {
      if (!best || rule.priority > best.priority) {
        best = { unitOp: rule.unitOp, priority: rule.priority };
      }
    }
  }
  return best?.unitOp ?? "other";
}

/**
 * Split one procedure window into ordered unit-op segments.
 */
export function segmentProcedureText(
  text: string,
  meta?: { sourceId?: string; label?: string; maxSegments?: number }
): ProcedureSegment[] {
  const raw = (text || "").replace(/\s+/g, " ").trim();
  if (raw.length < 40) return [];

  const maxSeg = meta?.maxSegments ?? 16;
  const parts = raw
    .split(SPLIT_RE)
    .map((p) => p.trim())
    .filter((p) => p.length >= 24);

  // If no sentence split, chunk by length
  const chunks =
    parts.length >= 2
      ? parts
      : raw.match(/.{40,280}(?:\s|$)/g)?.map((s) => s.trim()) || [raw.slice(0, 400)];

  const out: ProcedureSegment[] = [];
  let order = 0;
  for (const chunk of chunks) {
    if (out.length >= maxSeg) break;
    const unitOp = classifyChunk(chunk);
    // Drop pure clinical noise classified as other when short
    if (unitOp === "other" && chunk.length < 50) continue;
    if (
      unitOp === "other" &&
      /\b(patient|placebo|endpoint|pharmacokinet|clinical trial)\b/i.test(chunk)
    ) {
      continue;
    }
    out.push({
      unitOp,
      text: chunk.slice(0, 480),
      quote: chunk.slice(0, 200),
      sourceId: meta?.sourceId,
      label: meta?.label,
      order: order++,
    });
  }
  return out;
}

export type ProcedureExcerptLike = {
  id: string;
  text: string;
  label?: string;
  chars?: number;
};

/**
 * Segment many densified excerpts; prefer process-rich windows first.
 */
export function segmentProcedureExcerpts(
  excerpts: ProcedureExcerptLike[],
  opts?: { maxTotal?: number; maxPerExcerpt?: number }
): ProcedureSegment[] {
  const maxTotal = opts?.maxTotal ?? 40;
  const maxPer = opts?.maxPerExcerpt ?? 8;
  const ranked = [...excerpts].sort(
    (a, b) => (b.chars || b.text.length) - (a.chars || a.text.length)
  );
  const out: ProcedureSegment[] = [];
  for (const ex of ranked) {
    if (out.length >= maxTotal) break;
    const segs = segmentProcedureText(ex.text, {
      sourceId: ex.id,
      label: ex.label,
      maxSegments: maxPer,
    });
    for (const s of segs) {
      if (out.length >= maxTotal) break;
      out.push({ ...s, order: out.length });
    }
  }
  return out;
}

/** Compact rollup for AI prompt (ordered plant phases). */
export function formatSegmentsForPrompt(
  segments: ProcedureSegment[],
  maxChars = 6_000
): string {
  if (!segments.length) return "";
  const byOp: Partial<Record<ProcedureUnitOp, ProcedureSegment[]>> = {};
  for (const s of segments) {
    (byOp[s.unitOp] ||= []).push(s);
  }
  const order: ProcedureUnitOp[] = [
    "charge",
    "react",
    "quench",
    "workup",
    "isolate",
    "dry",
    "other",
  ];
  const lines: string[] = [
    "PROCEDURE SEGMENTS (classified from free-public densify only — assemble dual-view steps from these phases; do not invent unit ops not listed):",
  ];
  let used = lines[0].length;
  for (const op of order) {
    const list = byOp[op];
    if (!list?.length) continue;
    const head = `\n[${op}] (${list.length})`;
    if (used + head.length > maxChars) break;
    lines.push(head);
    used += head.length;
    for (const s of list.slice(0, 4)) {
      const line = `  - ${s.quote}${s.label ? ` {${s.label}}` : ""}`;
      if (used + line.length > maxChars) break;
      lines.push(line);
      used += line.length;
    }
  }
  return lines.join("\n");
}

export function segmentCoverage(
  segments: ProcedureSegment[]
): Record<ProcedureUnitOp, number> {
  const cov: Record<ProcedureUnitOp, number> = {
    charge: 0,
    react: 0,
    quench: 0,
    workup: 0,
    isolate: 0,
    dry: 0,
    other: 0,
  };
  for (const s of segments) cov[s.unitOp] += 1;
  return cov;
}
