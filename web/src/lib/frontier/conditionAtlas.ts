/**
 * Condition-space atlas — extract grounded T/t/P/pH/equiv/yield/atmosphere
 * mentions from free-public densified text and process facts.
 * Produces distributions + conflict flags. Never invents values.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessFact } from "@/lib/dossier/processFacts";
import type {
  ConditionAtlas,
  ConditionDistribution,
  ConditionKind,
  ConditionObservation,
  EvidenceSourceKind,
} from "@/lib/frontier/types";
import {
  intervalsConflict,
  normalizeEquiv,
  normalizePercent,
  normalizePh,
  normalizePressure,
  normalizeTemperature,
  normalizeTime,
  parseNumericSpan,
} from "@/lib/frontier/unitNormalize";
import { rankDossierTextWindows } from "@/lib/frontier/literatureDepth";

const DISCLAIMER =
  "Condition atlas from free-public text only. Distributions are not plant setpoints, " +
  "validated ranges, or GMP limits. Empty cells mean insufficient public evidence.";

type TextWindow = {
  text: string;
  sourceKind: EvidenceSourceKind;
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  documentTitle?: string;
};

function uid(prefix: string, i: number): string {
  return `${prefix}:${i}`;
}

function parseRange(raw: string): { low?: number; high?: number } {
  const span = parseNumericSpan(raw);
  if (!span) return {};
  return { low: span.low, high: span.high };
}

function attachBaseUnits(o: ConditionObservation): ConditionObservation {
  const low = o.valueLow;
  const high = o.valueHigh ?? o.valueLow;
  if (low == null || high == null) return o;
  let norm = null;
  if (o.kind === "temperature") {
    norm = normalizeTemperature(low, high, o.unit || "°C");
  } else if (o.kind === "time") {
    norm = normalizeTime(low, high, o.unit || "h");
  } else if (o.kind === "pressure") {
    norm = normalizePressure(low, high, o.unit || "bar");
  } else if (o.kind === "ph") {
    norm = normalizePh(low, high);
  } else if (o.kind === "yield") {
    norm = normalizePercent(low, high, "yield");
  } else if (o.kind === "equiv") {
    norm = normalizeEquiv(low, high);
  }
  if (!norm?.ok) return o;
  return {
    ...o,
    baseLow: norm.low,
    baseHigh: norm.high,
    baseUnit: norm.baseUnit,
  };
}

function contextSlice(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + len + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function pushObs(
  out: ConditionObservation[],
  o: Omit<ConditionObservation, "id">,
  i: number
): void {
  const row = attachBaseUnits({ ...o, id: uid("obs", i + out.length) });
  out.push(row);
}

function extractFromWindow(
  w: TextWindow,
  out: ConditionObservation[]
): void {
  const t = w.text;
  if (!t || t.length < 12) return;

  // Broader spans: "80 °C", "100 deg C", "80 degrees C" (avoid bare "C" false positives)
  const tempRe =
    /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:°\s*C|deg(?:rees?)?\s*C)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = tempRe.exec(t))) {
    const raw = m[0];
    const { low, high } = parseRange(m[1] || raw);
    pushObs(out, {
      kind: "temperature",
      raw,
      valueLow: low,
      valueHigh: high,
      unit: "°C",
      quote: contextSlice(t, m.index, raw.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  const timeRe =
    /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|min|minutes?)\b/gi;
  while ((m = timeRe.exec(t))) {
    const raw = m[0];
    const { low, high } = parseRange(m[1] || raw);
    const unit = /min/i.test(m[2] || "") ? "min" : "h";
    pushObs(out, {
      kind: "time",
      raw,
      valueLow: low,
      valueHigh: high,
      unit,
      quote: contextSlice(t, m.index, raw.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  const pressRe =
    /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(bar|atm|MPa|psi|kPa)\b/gi;
  while ((m = pressRe.exec(t))) {
    const raw = m[0];
    const { low, high } = parseRange(m[1] || raw);
    pushObs(out, {
      kind: "pressure",
      raw,
      valueLow: low,
      valueHigh: high,
      unit: m[2],
      quote: contextSlice(t, m.index, raw.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  const phRe =
    /\bpH\s*[=~]?\s*(\d+(?:\.\d+)?(?:\s*(?:–|-|to)\s*\d+(?:\.\d+)?)?)/gi;
  while ((m = phRe.exec(t))) {
    const raw = m[0];
    const { low, high } = parseRange(m[1] || raw);
    pushObs(out, {
      kind: "ph",
      raw,
      valueLow: low,
      valueHigh: high,
      unit: "pH",
      quote: contextSlice(t, m.index, raw.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  const eqRe = /(\d+(?:\.\d+)?)\s*(?:equiv\.?|eq\.?)\b/gi;
  while ((m = eqRe.exec(t))) {
    const raw = m[0];
    const { low, high } = parseRange(m[1] || raw);
    pushObs(out, {
      kind: "equiv",
      raw,
      valueLow: low,
      valueHigh: high,
      unit: "eq",
      quote: contextSlice(t, m.index, raw.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  const yieldRe =
    /\b(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*%\s*(?:yield|isolated|overall)?/gi;
  while ((m = yieldRe.exec(t))) {
    const raw = m[0];
    const { low, high } = parseRange(m[1] || raw);
    pushObs(out, {
      kind: "yield",
      raw,
      valueLow: low,
      valueHigh: high,
      unit: "%",
      quote: contextSlice(t, m.index, raw.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  // Concentration: 0.5 M, 100 mM, 10 wt%, 5 v/v %
  const concRe =
    /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(mM|M|mol\s*\/?\s*L|wt\s*%|w\/w\s*%|v\/v\s*%|g\s*\/?\s*L)\b/gi;
  while ((m = concRe.exec(t))) {
    const raw = m[0];
    const { low, high } = parseRange(m[1] || raw);
    const unit = (m[2] || "").replace(/\s+/g, "");
    pushObs(
      out,
      {
        kind: "concentration",
        raw,
        valueLow: low,
        valueHigh: high,
        unit,
        quote: contextSlice(t, m.index, raw.length),
        sourceKind: w.sourceKind,
        sourceId: w.sourceId,
        sourceLabel: w.sourceLabel,
        sourceUrl: w.sourceUrl,
        documentTitle: w.documentTitle,
      },
      out.length
    );
  }

  // Molar ratios: 1:1, 2:1 molar ratio, substrate:reagent 3:1
  const ratioRe =
    /\b(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)(?:\s*(?:molar\s+)?ratio)?\b/gi;
  let ratioCount = 0;
  while ((m = ratioRe.exec(t)) && ratioCount < 8) {
    const raw = m[0];
    // Skip clock-like false positives (hours:minutes without chemistry context nearby)
    const ctx = contextSlice(t, m.index, raw.length).toLowerCase();
    if (
      !/ratio|molar|equiv|substrate|reagent|feed|stoich|mol\b/.test(ctx) &&
      Number(m[1]) > 24
    ) {
      continue;
    }
    ratioCount += 1;
    const a = Number(m[1]);
    const b = Number(m[2]);
    pushObs(
      out,
      {
        kind: "molar-ratio",
        raw,
        valueLow: Number.isFinite(a) && b ? a / b : a,
        valueHigh: Number.isFinite(a) && b ? a / b : a,
        unit: "ratio",
        quote: contextSlice(t, m.index, raw.length),
        sourceKind: w.sourceKind,
        sourceId: w.sourceId,
        sourceLabel: w.sourceLabel,
        sourceUrl: w.sourceUrl,
        documentTitle: w.documentTitle,
      },
      out.length
    );
  }

  const atmRe =
    /\b(under\s+)?(N2|N₂|nitrogen|argon|Ar\b|H2|H₂|hydrogen|air|CO2|CO₂|O2|O₂|inert atmosphere|vacuum|N2\/H2|forming gas)\b/gi;
  while ((m = atmRe.exec(t))) {
    const raw = m[0];
    pushObs(out, {
      kind: "atmosphere",
      raw,
      quote: contextSlice(t, m.index, raw.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  // Solvents (lightweight lexicon — observation, not plant choice)
  const solventRe =
    /\b(water|ethanol|methanol|isopropanol|IPA|acetone|acetonitrile|MeCN|DCM|dichloromethane|chloroform|toluene|hexane|heptane|EtOAc|ethyl acetate|THF|DMF|DMSO|dioxane|acetic acid|MTBE|2-MeTHF|NMP|DMAc|pyridine|xylene|benzene|diethyl ether|Et2O)\b/gi;
  const seenSol = new Set<string>();
  while ((m = solventRe.exec(t))) {
    const name = m[1]!;
    const key = name.toLowerCase();
    if (seenSol.has(key)) continue;
    seenSol.add(key);
    pushObs(out, {
      kind: "solvent",
      raw: name,
      quote: contextSlice(t, m.index, name.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }

  const catRe =
    /\b(Pd\/C|palladium|platinum|Raney\s*Ni|H2SO4|H3PO4|HCl|NaOH|KOH|triethylamine|TEA|DIPEA|pyridine|DCC|EDC|enzyme|lipase)\b/gi;
  const seenCat = new Set<string>();
  while ((m = catRe.exec(t))) {
    const name = m[1]!;
    const key = name.toLowerCase();
    if (seenCat.has(key)) continue;
    seenCat.add(key);
    pushObs(out, {
      kind: "catalyst",
      raw: name,
      quote: contextSlice(t, m.index, name.length),
      sourceKind: w.sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.sourceLabel,
      sourceUrl: w.sourceUrl,
      documentTitle: w.documentTitle,
    }, out.length);
  }
}

function windowsFromDossier(d: LiveDossier): TextWindow[] {
  const windows: TextWindow[] = [];

  // Prefer procedure-rich OA / patent / mfg windows (literature densify depth)
  for (const w of rankDossierTextWindows(d)) {
    const sourceKind =
      w.kind === "mfg"
        ? "pubchem-mfg"
        : w.kind === "literature"
          ? "literature"
          : w.kind === "patent"
            ? "patent"
            : "other";
    windows.push({
      text: w.text,
      sourceKind,
      sourceId: w.sourceId,
      sourceLabel: w.label,
      sourceUrl: w.url,
      documentTitle: w.label,
    });
  }

  for (const a of d.annotations || []) {
    const blob = [a.title, a.summary].filter(Boolean).join("\n");
    if (blob.length < 20) continue;
    windows.push({
      text: blob,
      sourceKind: "annotation",
      sourceId: a.source + ":" + a.title,
      sourceLabel: a.source + " · " + a.title,
      sourceUrl: a.url,
      documentTitle: a.title,
    });
  }

  // Process facts as short windows
  for (const f of d.processFacts?.facts || []) {
    if (f.kind === "open-gap") continue;
    const blob = [f.claim, f.quote, f.value, f.unit].filter(Boolean).join(" ");
    if (blob.length < 8) continue;
    windows.push({
      text: blob,
      sourceKind: "process-fact",
      sourceId: f.id,
      sourceLabel: f.sourceLabel || f.sourceId,
      sourceUrl: f.sourceUrl,
      documentTitle: f.sourceLabel,
    });
  }

  return windows;
}

function fromProcessFactConditions(facts: ProcessFact[]): ConditionObservation[] {
  const out: ConditionObservation[] = [];
  for (const f of facts) {
    if (f.kind !== "condition" && f.kind !== "yield") continue;
    const raw = [f.value, f.unit].filter(Boolean).join(" ") || f.claim;
    let kind: ConditionKind = "other";
    if (/°\s*C|temp/i.test(raw + f.claim)) kind = "temperature";
    else if (/\b(h|hr|min)\b/i.test(raw)) kind = "time";
    else if (/bar|psi|atm|MPa/i.test(raw)) kind = "pressure";
    else if (/pH/i.test(raw + f.claim)) kind = "ph";
    else if (/equiv|eq\b/i.test(raw)) kind = "equiv";
    else if (/%|yield/i.test(raw + f.claim)) kind = "yield";
    else if (/N2|argon|hydrogen|inert/i.test(raw + f.claim)) kind = "atmosphere";

    const { low, high } = parseRange(raw);
    out.push({
      id: `fact:${f.id}`,
      kind,
      raw: raw.slice(0, 80),
      valueLow: low,
      valueHigh: high,
      unit: f.unit,
      quote: (f.quote || f.claim).slice(0, 280),
      sourceKind: "process-fact",
      sourceId: f.id,
      sourceLabel: f.sourceLabel || f.sourceId,
      sourceUrl: f.sourceUrl,
    });
  }
  return out;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (!s.length) return NaN;
  if (s.length % 2) return s[mid]!;
  return (s[mid - 1]! + s[mid]!) / 2;
}

function rangesConflict(
  obs: ConditionObservation[]
): { conflict: boolean; note?: string } {
  // Prefer base units when present (normalized °C / h / bar)
  const intervals = obs
    .filter(
      (o) =>
        (o.baseLow != null && o.baseHigh != null) ||
        (o.valueLow != null && o.valueHigh != null)
    )
    .map((o) => ({
      low: o.baseLow ?? o.valueLow!,
      high: o.baseHigh ?? o.valueHigh!,
    }));
  if (intervals.length < 2) return { conflict: false };
  const { conflict, maxLow, minHigh } = intervalsConflict(intervals);
  if (conflict) {
    return {
      conflict: true,
      note: `Reported ranges do not overlap in base units (max low ${Number(maxLow.toFixed(3))} > min high ${Number(minHigh.toFixed(3))})`,
    };
  }
  return { conflict: false };
}

function buildDistribution(
  kind: ConditionKind,
  obs: ConditionObservation[]
): ConditionDistribution | null {
  if (!obs.length) return null;
  const variants = [...new Set(obs.map((o) => o.raw))].slice(0, 24);
  const nums: number[] = [];
  let unit: string | undefined;
  for (const o of obs) {
    // Prefer base-unit values for summary statistics
    if (o.baseLow != null) nums.push(o.baseLow);
    if (o.baseHigh != null && o.baseHigh !== o.baseLow) nums.push(o.baseHigh);
    else if (o.baseLow == null) {
      if (o.valueLow != null) nums.push(o.valueLow);
      if (o.valueHigh != null && o.valueHigh !== o.valueLow) nums.push(o.valueHigh);
    }
    if (o.baseUnit) unit = o.baseUnit;
    else if (o.unit) unit = o.unit;
  }
  const { conflict, note } = rangesConflict(obs);
  const numeric =
    nums.length > 0
      ? {
          min: Math.min(...nums),
          max: Math.max(...nums),
          median: median(nums),
          unit,
        }
      : undefined;

  let summary = `${obs.length} public mention(s) of ${kind}`;
  if (numeric) {
    summary += ` · range ${numeric.min}–${numeric.max}${numeric.unit ? " " + numeric.unit : ""} · median ~${Number(numeric.median.toFixed(2))}`;
  }
  if (conflict) summary += " · CONFLICT among sources";

  return {
    kind,
    n: obs.length,
    variants,
    numeric,
    conflict,
    conflictNote: note,
    observations: obs.slice(0, 40),
    summary,
  };
}

function countNamed(
  obs: ConditionObservation[],
  kind: "solvent" | "catalyst"
): Array<{ name: string; n: number; quotes: string[] }> {
  const map = new Map<string, { n: number; quotes: string[] }>();
  for (const o of obs.filter((x) => x.kind === kind)) {
    const key = o.raw.toLowerCase();
    const cur = map.get(key) || { n: 0, quotes: [] };
    cur.n += 1;
    if (cur.quotes.length < 3) cur.quotes.push(o.quote.slice(0, 160));
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, n: v.n, quotes: v.quotes }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 20);
}

/**
 * Build condition atlas from a live dossier's free-public text.
 */
export function buildConditionAtlas(dossier: LiveDossier): ConditionAtlas {
  const observations: ConditionObservation[] = [];
  for (const w of windowsFromDossier(dossier)) {
    extractFromWindow(w, observations);
  }
  // Prefer process-fact rows as additional grounded rows (de-dupe by quote+kind)
  const fromFacts = fromProcessFactConditions(dossier.processFacts?.facts || []);
  const seen = new Set(
    observations.map((o) => `${o.kind}|${o.raw}|${o.sourceId}`)
  );
  for (const f of fromFacts) {
    const k = `${f.kind}|${f.raw}|${f.sourceId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    observations.push(f);
  }

  // Cap total + ensure base units
  const capped = observations.map(attachBaseUnits).slice(0, 200);
  const byKind = new Map<ConditionKind, ConditionObservation[]>();
  for (const o of capped) {
    const list = byKind.get(o.kind) || [];
    list.push(o);
    byKind.set(o.kind, list);
  }

  const order: ConditionKind[] = [
    "temperature",
    "time",
    "pressure",
    "ph",
    "equiv",
    "yield",
    "atmosphere",
    "solvent",
    "catalyst",
    "other",
  ];
  const distributions: ConditionDistribution[] = [];
  for (const kind of order) {
    const dist = buildDistribution(kind, byKind.get(kind) || []);
    if (dist) distributions.push(dist);
  }

  const solvents = countNamed(capped, "solvent");
  const catalysts = countNamed(capped, "catalyst");
  const n = capped.length;
  const conflicts = distributions.filter((d) => d.conflict).length;

  const summary =
    n === 0
      ? "No numeric process conditions extracted from free-public windows yet — densify OA/patent text or paste public procedures."
      : `Condition atlas: ${n} grounded mention(s) across ${distributions.length} kind(s)` +
        (conflicts ? ` · ${conflicts} kind(s) with non-overlapping ranges` : "") +
        (solvents[0] ? ` · top solvent cue “${solvents[0].name}” (n=${solvents[0].n})` : "");

  return {
    cid: dossier.cid,
    moleculeName: dossier.identity?.name,
    generatedAt: new Date().toISOString(),
    observationCount: n,
    distributions,
    solvents,
    catalysts,
    summary,
    disclaimer: DISCLAIMER,
  };
}

/** Export helper for tests: extract observations from raw text */
export function extractConditionsFromText(
  text: string,
  meta?: Partial<TextWindow>
): ConditionObservation[] {
  const out: ConditionObservation[] = [];
  extractFromWindow(
    {
      text,
      sourceKind: meta?.sourceKind || "other",
      sourceId: meta?.sourceId || "test",
      sourceLabel: meta?.sourceLabel || "test",
      sourceUrl: meta?.sourceUrl,
      documentTitle: meta?.documentTitle,
    },
    out
  );
  return out;
}
