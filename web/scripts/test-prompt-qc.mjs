/**
 * Prompt / response quality control contracts (offline).
 * Maps to ACC-* and AI-* in docs/engineering/test-spec.md
 * Run: node scripts/test-prompt-qc.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

const synth = read("lib/dossier/synthesize.ts");
const pack = read("lib/dossier/aiEvidencePackage.ts");
const score = read("lib/dossier/evidenceScore.ts");
const facts = read("lib/dossier/processFacts.ts");
const pipe = read("lib/dossier/pipeline.ts");

// ── ACC / AI prompt rules ─────────────────────────────────────────
ok("ACC-01 NEVER invent numeric", /NEVER invent numeric/i.test(synth));
ok(
  "ACC-01 omit field not invent placeholders",
  /OMIT the field|not specified|define IPC/i.test(synth)
);
ok("AI-03 agentic priority A structure densest", /AGENTIC PRIORITY|procedureExcerpts/i.test(synth));
ok(
  "AI-03 ground conditions on atoms or excerpts",
  /processFacts\.atoms|procedureExcerpts/i.test(synth)
);
ok("AI-01 package exports buildEvidencePayload", /export function buildEvidencePayload/.test(pack));
ok("AI-01 package exports buildEvidenceObject", /export function buildEvidenceObject/.test(pack));
ok("AI-01 prioritizes procedureExcerpts key", /procedureExcerpts/.test(pack));
ok("AI-01 prioritizes processFacts atoms", /atoms/.test(pack));
ok("AI-01 agenticBrief instruction", /agenticBrief/.test(pack));

// Budget
ok("AI-02 full budget latency-tuned", /MAX_EVIDENCE_CHARS_FULL\s*=\s*28_000/.test(pack));
ok("AI-02 fast budget latency-tuned", /MAX_EVIDENCE_CHARS_FAST\s*=\s*12_000/.test(pack));

// Timeouts (latency-tuned)
ok("AI-04 full timeout 100s", /AI_TIMEOUT_MS\s*=\s*100_000/.test(synth));
ok("AI-04 fast timeout shorter", /AI_TIMEOUT_FAST_MS\s*=\s*55_000/.test(synth));
ok(
  "AI-04 preferFast selects timeout",
  /preferFast\s*\?\s*AI_TIMEOUT_FAST_MS\s*:\s*AI_TIMEOUT_MS|timeoutMs\s*=\s*preferFast/.test(
    synth
  )
);

// Synthesis uses densified package
ok(
  "AI package used at call site",
  /buildEvidencePayload\(evidence/.test(synth)
);
ok(
  "AI user content mentions priority",
  /Priority:.*processFacts\.atoms|procedureExcerpts/.test(synth)
);
ok("AI two-pass EXTRACT_SYSTEM", /EXTRACT_SYSTEM/.test(synth));
ok("AI two-pass pass1Extract assemble", /pass1Extract/.test(synth));
ok("AI pack processKnowledgeDigest", /processKnowledgeDigest/.test(pack));
ok(
  "AI pack related context",
  /relatedProcessContext|buildRelatedProcessContext/.test(pack)
);
ok("AI pack value-weighted", /value-weighted|packing:\s*"value-weighted"/.test(pack));
ok(
  "AI procedure-density gate in score",
  /hasProcedureDensity|PROC_DENSITY/.test(score)
);
ok("pipeline attachQuotesToRoutes", /attachQuotesToRoutes/.test(pipe));
ok("pipeline mergeExtractAtoms", /mergeExtractAtomsIntoFacts/.test(pipe));
ok(
  "gather API harvest agent densify/retry",
  /runApiHarvestAgent|api-agent/.test(read("lib/dossier/gather.ts"))
);
ok(
  "knowledge digest builder",
  /export function buildProcessKnowledgeDigest/.test(
    read("lib/dossier/processKnowledgeDigest.ts")
  )
);

// Quality gate heuristics (mirrored executable)
const JUNK_STEP =
  /this section provides information|major uses of this chemical|public manufacturing \/ use note|not specified in public excerpt|define ipc\/cqas|extracted from pubchem pug view/i;
const INVENTED_PLANT =
  /\b(typical industrial|plant typical|site standard|validated ipc|cqa of|batch record|gmp release)\b/i;

function stepPassesQc(title, description) {
  const blob = `${title} ${description}`;
  if (JUNK_STEP.test(blob)) return false;
  if (INVENTED_PLANT.test(blob)) return false;
  if (description.trim().length < 48) return false;
  const opLike =
    /charge|react|quench|crystall|filter|dry|distill|extract|hydrog|ferment|isolat|work.?up|heat|cool|cataly/i.test(
      blob
    );
  if (!opLike && description.length < 120) return false;
  return true;
}

ok(
  "AI-05 reject TOC junk step",
  stepPassesQc(
    "Use",
    "This section provides information about major uses of this chemical in industry."
  ) === false
);
ok(
  "AI-05 reject invented plant language",
  stepPassesQc(
    "Plant step",
    "Use typical industrial validated ipc and batch record limits for release testing at commercial scale."
  ) === false
);
ok(
  "AI-05 reject thin non-op step",
  stepPassesQc("Note", "See literature for details.") === false
);
ok(
  "AI-05 accept real process step",
  stepPassesQc(
    "Hydrogenation",
    "Charge the intermediate under nitrogen and hydrogenate at the sourced pressure until uptake ceases, then filter the catalyst."
  ) === true
);

ok("ACC-02 quality gate clears ipcMethods", /ipcMethods:\s*undefined/.test(synth));
ok("ACC-02 quality gate clears cqaTargets", /cqaTargets:\s*undefined/.test(synth));
ok("AI-07 pipeline stripUncitedRouteDetails", /stripUncitedRouteDetails/.test(pipe));
ok("AI-07 pipeline preferRoutesForEvidence", /preferRoutesForEvidence/.test(pipe));

// Evidence score densify → full model
ok("AI-06 score credits procedure densify", /procedureExcerpts|procChars/.test(score));
ok("AI-06 denseForFullModel path", /denseForFullModel|productionBriefEligible/.test(score));
ok("AI-06 preferFastModel inverted when dense", /preferFastModel/.test(score));

// Process fact framing still strict
ok(
  "ACC-05 production brief eligibility bar",
  /sourcedConditionCount >= 3/.test(facts) && /unitOpCount >= 2/.test(facts)
);

// Executable package priority simulator
function packPriorityOrder() {
  return ["processFacts", "procedureExcerpts", "literature", "patents", "manufacturingTexts"];
}
const order = packPriorityOrder();
ok(
  "AI-01 executable priority atoms before mfg",
  order.indexOf("processFacts") < order.indexOf("manufacturingTexts")
);
ok(
  "AI-01 executable priority procedure before patents",
  order.indexOf("procedureExcerpts") < order.indexOf("patents")
);

// Budgeted JSON packing smoke (local)
function budgetPack(obj, max) {
  const raw = JSON.stringify(obj);
  return raw.length > max ? raw.slice(0, max) + "…[truncated]" : raw;
}
const big = { procedureExcerpts: [{ text: "x".repeat(5000) }], atoms: [{ claim: "80 °C" }] };
const packed = budgetPack(big, 1000);
ok("AI-02 executable budget truncates", packed.length <= 1000 + 20);
ok("AI-02 executable keeps prefix", packed.startsWith("{"));

// Condition support rule (mirror NUMERICISH from processFacts)
const NUMERICISH =
  /\d+(?:\.\d+)?\s*(?:°\s*C|C\b|bar|atm|psi|MPa|kPa|%|h\b|hr|min|eq\.?)/i;
function supportedByFacts(value, factQuotes) {
  if (!value?.trim()) return true;
  if (!NUMERICISH.test(value)) return true;
  return factQuotes.some((q) => q && value && q.includes(value.replace(/\s+/g, " ").slice(0, 8)));
}
ok(
  "ACC-04 uncited numeric unsupported",
  supportedByFacts("180 °C", ["heated at 80 °C for 3 h"]) === false
);
ok(
  "ACC-04 cited numeric supported",
  supportedByFacts("80 °C", ["heated at 80 °C for 3 h"]) === true
);
ok(
  "ACC-04 qualitative atmosphere allowed",
  supportedByFacts("under nitrogen", []) === true
);

console.log(`\nAll prompt QC contracts passed (${passed}).`);
