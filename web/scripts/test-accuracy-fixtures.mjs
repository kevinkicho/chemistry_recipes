/**
 * Hermetic process-accuracy fixtures (no network).
 * Mirrors processFacts extraction + quality-gate intent from synthesize.ts.
 * Run: node scripts/test-accuracy-fixtures.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/process-accuracy-fixture.json"), "utf8")
);
const srcRoot = join(__dirname, "..", "src");

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log("ok  ", name);
}

function read(rel) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

// --- Executable mirrors (keep aligned with processFacts / synthesize) ---
const TEMP_RE =
  /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*°\s*C\b/gi;
const UNIT_OP_PATTERNS = [
  { re: /\bhydrogenat/i, op: "hydrogenation" },
  { re: /\bcrystalliz/i, op: "crystallization" },
  { re: /\bcharg/i, op: "charge" },
  { re: /\bquench/i, op: "quench" },
  { re: /\bwork[- ]?up\b/i, op: "workup" },
  { re: /\bisolat/i, op: "isolation" },
  { re: /\bfiltr|filter/i, op: "filtration" },
];
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
  TEMP_RE.lastIndex = 0;
  let m;
  let nTemp = 0;
  while ((m = TEMP_RE.exec(text)) !== null && nTemp < 6) {
    nTemp += 1;
    push("condition", m[0], m[1] || m[0]);
  }
  if (/\bisolat|crystall/i.test(text)) push("isolation", "isolation language");
  return facts;
}

function stripUncitedConditions(conditions, facts) {
  if (!conditions) return undefined;
  const next = { ...conditions };
  const NUMERICISH =
    /\d+(?:\.\d+)?\s*(?:°\s*C|C\b|bar|atm|psi|MPa|kPa|%|h\b|hr|min|eq\.?)/i;
  for (const key of Object.keys(next)) {
    const val = next[key];
    if (typeof val !== "string" || !NUMERICISH.test(val)) continue;
    const compact = val.replace(/\s+/g, "").toLowerCase();
    const okFact = facts.some((f) => {
      if (f.kind !== "condition") return false;
      const fv = (f.value || f.claim || "").replace(/\s+/g, "").toLowerCase();
      return fv && (compact.includes(fv.slice(0, 6)) || fv.includes(compact.slice(0, 6)));
    });
    if (!okFact) delete next[key];
  }
  return Object.keys(next).length ? next : undefined;
}

/** Mirror qualityGateSynthesis: drop IPC/CQA + junk steps */
function qualityGate(synth, facts) {
  const routes = (synth.routes || []).map((r) => {
    const steps = (r.steps || [])
      .filter((s) => !JUNK_STEP.test(`${s.title} ${s.description}`))
      .map((s) => ({
        ...s,
        conditions: stripUncitedConditions(s.conditions, facts),
      }));
    return {
      ...r,
      steps,
      ipcMethods: undefined,
      cqaTargets: undefined,
    };
  });
  return { ...synth, routes };
}

console.log("test-accuracy-fixtures");

ok("fixture schema", fixture.schema?.includes("process-accuracy-fixture"));
ok("fixture has rich + thin text", fixture.richProcedureText && fixture.thinClinicalText);

const rich = extractFacts(fixture.richProcedureText);
ok("rich extracts temperature condition", rich.some((f) => f.kind === "condition" && /80/.test(f.claim || f.value || "")));
ok(
  "rich extracts unit-op",
  rich.some((f) => f.kind === "unit-op")
);
ok("rich extracts isolation", rich.some((f) => f.kind === "isolation" || /isolat|crystall/i.test(f.claim || "")));

const thin = extractFacts(fixture.thinClinicalText);
ok(
  "thin has no temperature conditions",
  !thin.some((f) => f.kind === "condition")
);

ok(
  "invented plant language flagged",
  INVENTED_PLANT.test(fixture.inventedPlantLanguage)
);

const gated = qualityGate(fixture.aiSynthesisJunk, rich);
ok(
  "quality gate drops ipcMethods",
  gated.routes.every((r) => r.ipcMethods === undefined)
);
ok(
  "quality gate drops cqaTargets",
  gated.routes.every((r) => r.cqaTargets === undefined)
);
ok(
  "quality gate drops junk steps",
  !gated.routes.some((r) =>
    (r.steps || []).some((s) => JUNK_STEP.test(`${s.title} ${s.description}`))
  )
);
// 999 °C is not in rich facts → strip
const remainingTemp = gated.routes[0]?.steps?.[0]?.conditions?.temperature;
ok(
  "quality gate strips uncited 999 °C",
  !remainingTemp || !/999/.test(remainingTemp)
);

// Source modules still enforce law
const pf = read("lib/dossier/processFacts.ts");
ok("processFacts stripUncitedRouteDetails", /export function stripUncitedRouteDetails/.test(pf));
ok("processFacts invented plant", /gmp|plant typical|invented|INVENTED/i.test(pf));

const syn = read("lib/dossier/synthesize.ts");
ok("synthesize qualityGateSynthesis", /export function qualityGateSynthesis/.test(syn));
ok("synthesize never invent numeric", /NEVER invent numeric/i.test(syn));
ok("quality gate clears ipcMethods", /ipcMethods:\s*undefined/.test(syn));

console.log(`\n${n} accuracy-fixture checks passed`);
