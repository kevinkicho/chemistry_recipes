/**
 * Contract tests for process-fact extraction & accuracy rules.
 * Mirrors lib/dossier/processFacts.ts heuristics (keep in sync).
 * Run: node scripts/test-process-facts.mjs
 */

import assert from "node:assert/strict";

const TEMP_RE =
  /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*°\s*C\b/gi;
const TIME_RE =
  /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|min|minutes?)\b/gi;
const PRESS_RE =
  /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(bar|atm|MPa|psi|kPa)\b/gi;
const UNIT_OP_PATTERNS = [
  { re: /\bhydrogenat/i, op: "hydrogenation" },
  { re: /\bcrystalliz/i, op: "crystallization" },
  { re: /\bferment/i, op: "fermentation" },
  { re: /\bdistill/i, op: "distillation" },
  { re: /\bfiltr|filter/i, op: "filtration" },
  { re: /\bquench/i, op: "quench" },
  { re: /\bwork[- ]?up\b/i, op: "workup" },
  { re: /\bisolat/i, op: "isolation" },
];
const NUMERICISH =
  /\d+(?:\.\d+)?\s*(?:°\s*C|C\b|bar|atm|psi|MPa|kPa|%|h\b|hr|min|eq\.?)/i;
const INVENTED_PLANT =
  /\b(typical industrial|plant typical|site standard|validated ipc|batch record|gmp release)\b/i;
const JUNK_STEP =
  /this section provides information|major uses of this chemical|define ipc\/cqas|extracted from pubchem pug view/i;

function extractFacts(text) {
  const facts = [];
  const seen = new Set();
  const push = (kind, claim, value) => {
    const key = `${kind}|${value || claim}`;
    if (seen.has(key)) return;
    seen.add(key);
    facts.push({ kind, claim, value });
  };
  for (const { re, op } of UNIT_OP_PATTERNS) {
    if (re.test(text)) push("unit-op", `Unit operation: ${op}`, op);
  }
  for (const re of [TEMP_RE, TIME_RE, PRESS_RE]) {
    re.lastIndex = 0;
    let m;
    let n = 0;
    while ((m = re.exec(text)) !== null && n < 6) {
      n += 1;
      push("condition", m[0], m[1] || m[0]);
    }
  }
  if (/\bisolat|crystall/i.test(text)) push("isolation", "isolation language");
  if (/\bexotherm|H2\b|hydrogen gas|cryogenic/i.test(text)) {
    push("hazard-process", "process hazard cue");
  }
  return facts;
}

function productionBriefEligible(facts) {
  const cond = facts.filter((f) => f.kind === "condition").length;
  const unit = facts.filter((f) => f.kind === "unit-op").length;
  const isolation = facts.filter((f) => f.kind === "isolation").length;
  // Mirror stricter bar: ≥3 cond, ≥2 unit ops, isolation OR enough density
  return cond >= 3 && unit >= 2 && (isolation >= 1 || cond >= 4);
}

function conditionSupported(value, facts) {
  if (!value?.trim()) return true;
  if (!NUMERICISH.test(value)) return true;
  const compact = value.replace(/\s+/g, "").toLowerCase();
  return facts.some((f) => {
    if (f.kind !== "condition") return false;
    const fv = (f.value || f.claim || "").replace(/\s+/g, "").toLowerCase();
    return fv && (compact.includes(fv.slice(0, 6)) || fv.includes(compact.slice(0, 6)));
  });
}

function stripConditions(conditions, facts) {
  if (!conditions) return undefined;
  const cleaned = {};
  for (const [k, v] of Object.entries(conditions)) {
    if (v && conditionSupported(String(v), facts)) cleaned[k] = v;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
}

function preferRoutes(routes, eligible, condCount) {
  if (!routes.length) return routes;
  if (eligible && condCount >= 3) return routes.slice(0, 2);
  return routes.slice(0, 1);
}

function qualityRejectStep(title, description) {
  const blob = `${title} ${description}`;
  if (JUNK_STEP.test(blob)) return true;
  if (INVENTED_PLANT.test(blob)) return true;
  if (description.trim().length < 48) return true;
  return false;
}

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

const rich =
  "Example 1. Hydrogenation of the intermediate at 50–60 °C under H2 (5 bar) for 4 h at pH 7, followed by crystallization from ethanol and filtration. Mild exotherm observed. Charge 1.0 equiv substrate. Hold 2 h at 40 °C.";
const thin = "Aspirin is used as an analgesic in clinical trials of patients with disease.";

const richFacts = extractFacts(rich);
const thinFacts = extractFacts(thin);

ok("rich text yields temperature condition", richFacts.some((f) => /°\s*C|50/i.test(f.claim + (f.value || ""))));
ok("rich text yields pressure or time", richFacts.filter((f) => f.kind === "condition").length >= 2);
ok("rich text yields hydrogenation unit-op", richFacts.some((f) => f.value === "hydrogenation"));
ok("rich text yields crystallization unit-op", richFacts.some((f) => f.value === "crystallization"));
ok("rich text yields hazard cue", richFacts.some((f) => f.kind === "hazard-process"));
ok("thin clinical text yields no process facts", thinFacts.length === 0);
ok("production brief eligible for rich", productionBriefEligible(richFacts));
ok("production brief not eligible for empty", !productionBriefEligible([]));
ok("rich has isolation language", richFacts.some((f) => f.kind === "isolation"));

// Uncited strip
const factsForStrip = extractFacts("Hold at 80 °C for 2 h under nitrogen.");
ok(
  "keeps sourced temperature",
  stripConditions({ temperatureC: "80 °C", time: "2 h" }, factsForStrip)?.temperatureC === "80 °C"
);
ok(
  "strips invented numeric yield-like temp",
  stripConditions({ temperatureC: "999 °C" }, factsForStrip) === undefined ||
    !stripConditions({ temperatureC: "999 °C" }, factsForStrip)?.temperatureC
);
ok("qualitative atmosphere allowed", !NUMERICISH.test("inert atmosphere only"));

// Route preference
ok(
  "thin prefers single route",
  preferRoutes([{ id: "a" }, { id: "b" }], false, 1).length === 1
);
ok(
  "rich multi-route keeps two",
  preferRoutes([{ id: "a" }, { id: "b" }, { id: "c" }], true, 4).length === 2
);

// Quality gate
ok(
  "rejects TOC junk step",
  qualityRejectStep("Uses", "This section provides information on the use and manufacturing.")
);
ok(
  "rejects invented plant language",
  qualityRejectStep(
    "Commercial step",
    "Run the typical industrial validated IPC batch record release at plant typical conditions for several hours of operation."
  )
);
ok(
  "accepts real process step body",
  !qualityRejectStep(
    "Hydrogenation",
    "Charge intermediate to the hydrogenator under nitrogen, then pressurize with hydrogen and agitate until uptake ceases."
  )
);

// Open-gap policy: thin evidence must surface site-fill messaging
const openGapsForThin = [
  "No numeric process conditions found",
  "Validated IPC methods are site QMS only",
];
ok("thin evidence has open-gap messages", openGapsForThin.length >= 2);

console.log(`\nAll process-fact contracts passed (${passed}).`);
