/**
 * Rank patent / literature windows by process-useful language
 * (temp, equiv, workup, isolation) before feeding densify/AI.
 */

const PROCESS_MARKERS: Array<{ re: RegExp; w: number }> = [
  { re: /\b\d+(?:\.\d+)?\s*°\s*C\b/i, w: 6 },
  { re: /\bequiv(?:alent)?s?\b|\beq\.\b/i, w: 5 },
  { re: /\bwork[- ]?up\b|\bquench\b|\bextract(?:ion|ed)?\b/i, w: 5 },
  { re: /\bcrystalliz|\bfiltr|\bdistill|\bisolat/i, w: 5 },
  { re: /\bexample\s+\d+\b/i, w: 4 },
  { re: /\bhydrogenat|\bhydrolysis|\bcoupling\b/i, w: 4 },
  { re: /\bmL\b|\bmmol\b|\bmol\b|\bM\b/i, w: 3 },
  { re: /\bstirred\b|\bheated\b|\breflux\b|\bnitrogen\b|\bargon\b/i, w: 3 },
  { re: /\byield\b|\b%+\s*yield/i, w: 2 },
  // Down-rank pure clinical / pharmacology language
  { re: /\bclinical trial\b|\bpharmacokinet|\bdose[- ]escalat/i, w: -6 },
  { re: /\bpatient\b|\bendpoint\b|\bplacebo\b/i, w: -4 },
];

export function scoreProcedureWindow(text: string | undefined | null): number {
  if (!text?.trim()) return 0;
  const t = text.slice(0, 8000);
  let s = Math.min(8, Math.floor(t.length / 400));
  for (const { re, w } of PROCESS_MARKERS) {
    if (re.test(t)) s += w;
  }
  return s;
}

export function rankByProcedureWindow<T>(
  items: T[],
  getText: (item: T) => string | undefined
): T[] {
  return items
    .map((item, i) => ({ item, i, sc: scoreProcedureWindow(getText(item)) }))
    .sort((a, b) => b.sc - a.sc || a.i - b.i)
    .map((x) => x.item);
}

/** Prefer procedureExcerpt / fullTextExcerpt when scoring densify candidates */
export function pickBestProcedureText(opts: {
  procedureExcerpt?: string;
  fullTextExcerpt?: string;
  abstract?: string;
  title?: string;
}): { text: string; score: number; source: string } {
  const candidates: Array<{ text: string; source: string }> = [
    { text: opts.procedureExcerpt || "", source: "procedureExcerpt" },
    { text: opts.fullTextExcerpt || "", source: "fullTextExcerpt" },
    { text: opts.abstract || "", source: "abstract" },
    { text: opts.title || "", source: "title" },
  ].filter((c) => c.text.trim().length >= 20);

  let best = { text: "", score: -1, source: "none" };
  for (const c of candidates) {
    const sc = scoreProcedureWindow(c.text);
    if (sc > best.score) best = { text: c.text, score: sc, source: c.source };
  }
  return best;
}
