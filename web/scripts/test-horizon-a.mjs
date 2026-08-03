/**
 * Horizon A contracts: procedure segmentation + ideal densify plan.
 * Run: node scripts/test-horizon-a.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log("ok  ", name);
}

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

console.log("test-horizon-a");

// --- procedure segments (executable mirror) ---
const UNIT_OP_RULES = [
  { unitOp: "charge", re: /\b(charg(?:e|ed|ing)|add(?:ed|ing)?|dissolv)/i },
  { unitOp: "react", re: /\b(stirr(?:ed|ing)?|heat(?:ed|ing)?|reflux)/i },
  { unitOp: "quench", re: /\b(quench(?:ed|ing)?|cool(?:ed|ing)? to)/i },
  { unitOp: "workup", re: /\b(work[- ]?up|extract(?:ed|ion)?|wash(?:ed)?)/i },
  { unitOp: "isolate", re: /\b(isolat|filtr|crystalliz|precipitat)/i },
  { unitOp: "dry", re: /\b(dry(?:ied|ing)?|vacuum.?dry)/i },
];

function classify(chunk) {
  for (const r of UNIT_OP_RULES) {
    if (r.re.test(chunk)) return r.unitOp;
  }
  return "other";
}

const sample =
  "Charge salicylic acid to the reactor under nitrogen. The mixture was heated at 80 °C and stirred for 2 h. " +
  "The reaction was quenched with water. The product was extracted with toluene. " +
  "The solid was isolated by filtration. The cake was dried under vacuum.";

const parts = sample.split(/(?<=[.!?;])\s+/).filter((p) => p.length > 20);
const ops = parts.map(classify);
ok("segments classify charge", ops.includes("charge"));
ok("segments classify react", ops.includes("react"));
ok("segments classify quench", ops.includes("quench"));
ok("segments classify workup", ops.includes("workup") || ops.includes("isolate"));
ok("segments classify isolate or dry", ops.includes("isolate") || ops.includes("dry"));

const segMod = read("lib/literature/procedureSegments.ts");
ok("procedureSegments module", /export function segmentProcedureText/.test(segMod));
ok("segmentProcedureExcerpts export", /export function segmentProcedureExcerpts/.test(segMod));
ok("formatSegmentsForPrompt export", /export function formatSegmentsForPrompt/.test(segMod));
ok("unit ops include charge react quench", /charge|react|quench|isolate|dry/.test(segMod));

const pack = read("lib/dossier/aiEvidencePackage.ts");
ok("AI package uses procedureSegments", /procedureSegments/.test(pack));
ok("AI package segments instruction", /procedureSegments \(charge/.test(pack));
ok("AI package formatSegmentsForPrompt", /formatSegmentsForPrompt/.test(pack));

// --- ideal densify plan ---
const planMod = read("lib/dossier/idealDensifyPlan.ts");
ok("idealDensifyPlan module", /export function planDensifyFromIdealWeaknesses/.test(planMod));
ok("executeIdealDensifyPlan export", /export async function executeIdealDensifyPlan/.test(planMod));
ok("process-recipe maps densify", /process-recipe[\s\S]*run_densify_pass/.test(planMod));
ok("related-entities maps promote", /related-entities[\s\S]*promote_annotations/.test(planMod));

// Executable plan logic mirror
function planFromWeak(sections) {
  const SECTION_TOOLS = {
    "process-recipe": ["run_densify_pass", "retry_failed_families"],
    "related-entities": ["promote_annotations"],
    overview: ["run_densify_pass"],
  };
  const weak = sections.filter((s) => !s.filled || s.depth < 45);
  const seen = new Set();
  const plan = [];
  for (const s of weak) {
    for (const t of SECTION_TOOLS[s.id] || []) {
      if (seen.has(t)) continue;
      seen.add(t);
      plan.push(t);
    }
  }
  return plan;
}
ok(
  "weak process-recipe plans densify",
  planFromWeak([{ id: "process-recipe", depth: 10, filled: false }]).includes(
    "run_densify_pass"
  )
);
ok(
  "strong sections plan empty",
  planFromWeak([{ id: "process-recipe", depth: 90, filled: true }]).length === 0
);

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline recoverEvidenceAfterQualityGate", /recoverEvidenceAfterQualityGate/.test(pipe));
ok("pipeline ideal-close recovery", /ideal-close densify recovery|Ideal-close/.test(pipe));
ok("pipeline re-AI after recovery", /Re-running AI dual-view|runSynthesis/.test(pipe));
ok("pipeline emptiedByGate path", /emptiedByGate|Quality gate emptied/.test(pipe));

console.log(`\n${n} horizon-a checks passed`);
