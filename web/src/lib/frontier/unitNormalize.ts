/**
 * Unit normalization for public condition observations.
 * Converts to comparable base units for distributions / conflicts.
 * Never invents values — only rewrites parseable quantities.
 */

export type NormalizedKind =
  | "temperature"
  | "time"
  | "pressure"
  | "ph"
  | "equiv"
  | "yield"
  | "other";

export interface NormalizedQuantity {
  /** Value in base unit (midpoint of range when applicable) */
  value: number;
  /** Low in base unit */
  low: number;
  /** High in base unit */
  high: number;
  /** Base unit label */
  baseUnit: string;
  /** Original raw fragment */
  raw: string;
  kind: NormalizedKind;
  ok: boolean;
  note?: string;
}

/** °C preferred base for process chemistry public text */
export function normalizeTemperature(
  low: number,
  high: number,
  unitHint?: string
): NormalizedQuantity | null {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  let lo = low;
  let hi = high;
  const u = (unitHint || "°C").toLowerCase();
  // Rare K in free text
  if (/\bk\b|kelvin/.test(u) && lo > 150) {
    lo = lo - 273.15;
    hi = hi - 273.15;
  }
  // °F rare
  if (/°\s*f|fahrenheit/.test(u)) {
    lo = ((lo - 32) * 5) / 9;
    hi = ((hi - 32) * 5) / 9;
  }
  if (lo > hi) [lo, hi] = [hi, lo];
  // Sanity: process chemistry windows
  if (lo < -120 || hi > 500) {
    return {
      value: (lo + hi) / 2,
      low: lo,
      high: hi,
      baseUnit: "°C",
      raw: `${low}–${high}`,
      kind: "temperature",
      ok: false,
      note: "Out-of-range for typical process windows — kept raw only",
    };
  }
  return {
    value: (lo + hi) / 2,
    low: lo,
    high: hi,
    baseUnit: "°C",
    raw: `${low}–${high}`,
    kind: "temperature",
    ok: true,
  };
}

/** Base unit: hours */
export function normalizeTime(
  low: number,
  high: number,
  unitHint?: string
): NormalizedQuantity | null {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  const u = (unitHint || "h").toLowerCase();
  let factor = 1;
  if (/^min|minute/.test(u)) factor = 1 / 60;
  else if (/^s\b|sec/.test(u)) factor = 1 / 3600;
  else if (/^d\b|day/.test(u)) factor = 24;
  let lo = low * factor;
  let hi = high * factor;
  if (lo > hi) [lo, hi] = [hi, lo];
  return {
    value: (lo + hi) / 2,
    low: lo,
    high: hi,
    baseUnit: "h",
    raw: `${low}–${high} ${unitHint || "h"}`,
    kind: "time",
    ok: lo >= 0 && hi < 1000,
  };
}

/** Base unit: bar */
export function normalizePressure(
  low: number,
  high: number,
  unitHint?: string
): NormalizedQuantity | null {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  const u = (unitHint || "bar").toLowerCase();
  let factor = 1;
  if (/psi/.test(u)) factor = 0.0689476;
  else if (/kpa/.test(u)) factor = 0.01;
  else if (/mpa/.test(u)) factor = 10;
  else if (/atm/.test(u)) factor = 1.01325;
  else if (/torr|mmhg/.test(u)) factor = 0.00133322;
  let lo = low * factor;
  let hi = high * factor;
  if (lo > hi) [lo, hi] = [hi, lo];
  return {
    value: (lo + hi) / 2,
    low: lo,
    high: hi,
    baseUnit: "bar",
    raw: `${low}–${high} ${unitHint || "bar"}`,
    kind: "pressure",
    ok: lo >= 0 && hi < 500,
  };
}

export function normalizePh(low: number, high: number): NormalizedQuantity | null {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  let lo = low;
  let hi = high;
  if (lo > hi) [lo, hi] = [hi, lo];
  return {
    value: (lo + hi) / 2,
    low: lo,
    high: hi,
    baseUnit: "pH",
    raw: `${low}–${high}`,
    kind: "ph",
    ok: lo >= 0 && hi <= 14,
  };
}

export function normalizePercent(
  low: number,
  high: number,
  kind: "yield" | "other" = "yield"
): NormalizedQuantity | null {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  let lo = low;
  let hi = high;
  if (lo > hi) [lo, hi] = [hi, lo];
  return {
    value: (lo + hi) / 2,
    low: lo,
    high: hi,
    baseUnit: "%",
    raw: `${low}–${high}%`,
    kind: kind === "yield" ? "yield" : "other",
    ok: lo >= 0 && hi <= 100,
  };
}

export function normalizeEquiv(low: number, high: number): NormalizedQuantity | null {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  let lo = low;
  let hi = high;
  if (lo > hi) [lo, hi] = [hi, lo];
  return {
    value: (lo + hi) / 2,
    low: lo,
    high: hi,
    baseUnit: "eq",
    raw: `${low}–${high} eq`,
    kind: "equiv",
    ok: lo >= 0 && hi < 50,
  };
}

/**
 * Intervals conflict if no overlap in base units.
 */
export function intervalsConflict(
  intervals: Array<{ low: number; high: number }>
): { conflict: boolean; maxLow: number; minHigh: number } {
  if (intervals.length < 2) {
    return { conflict: false, maxLow: NaN, minHigh: NaN };
  }
  let maxLow = -Infinity;
  let minHigh = Infinity;
  for (const iv of intervals) {
    maxLow = Math.max(maxLow, iv.low);
    minHigh = Math.min(minHigh, iv.high);
  }
  return {
    conflict: maxLow > minHigh,
    maxLow,
    minHigh,
  };
}

/** Parse first number or range from free text fragment */
export function parseNumericSpan(
  raw: string
): { low: number; high: number } | null {
  const cleaned = raw.replace(/,/g, "");
  const range = cleaned.match(
    /(\d+(?:\.\d+)?)\s*(?:–|-|to|~)\s*(\d+(?:\.\d+)?)/i
  );
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { low: Math.min(a, b), high: Math.max(a, b) };
  }
  const single = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!single) return null;
  const v = Number(single[1]);
  if (!Number.isFinite(v)) return null;
  return { low: v, high: v };
}
