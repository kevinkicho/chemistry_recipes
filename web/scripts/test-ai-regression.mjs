/**
 * AI / accuracy regression contracts (offline).
 * Guards against inventing plant numbers and weak framing.
 * Run: node scripts/test-ai-regression.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
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
const facts = read("lib/dossier/processFacts.ts");
const pipe = read("lib/dossier/pipeline.ts");
const gather = read("lib/dossier/gather.ts");

// AI must not invent numerics
ok("system prompt never invent numeric", /NEVER invent numeric/i.test(synth));
ok("quality gate drops IPC methods", /ipcMethods:\s*undefined/.test(synth));
ok("quality gate drops CQA targets", /cqaTargets:\s*undefined/.test(synth));
ok("invented plant language rejected", /typical industrial|INVENTED_PLANT/.test(synth));

// Post-AI fact strip
ok("pipeline strips uncited routes", /stripUncitedRouteDetails/.test(pipe));
ok("pipeline prefers fewer routes when thin", /preferRoutesForEvidence/.test(pipe));

// Framing bar
ok("process-recipe framing exists", /process-recipe/.test(facts));
ok("evidence-lead-pack framing exists", /evidence-lead-pack/.test(facts));
ok(
  "stricter eligibility requires conditions and unit ops",
  /sourcedConditionCount >= 3/.test(facts) && /unitOpCount >= 2/.test(facts)
);

// User supplement path
ok("user-supplement provenance", /user-supplement/.test(facts));
ok("extractFactsFromUserText exported", /export function extractFactsFromUserText/.test(facts));

// Remaining free sources wired
ok("gather uses PubChem patent xrefs", /fetchPubchemPatentIds|pubchemPatentIds/.test(gather));
ok("gather uses ORD context", /fetchOrdContext|buildOrdBrowseAnnotation/.test(gather));

// Export operator + public brief
const exp = read("lib/export/techTransfer.ts");
ok("operator job aid schema", /operator-job-aid\.v[12]/.test(exp));
ok("public process brief schema", /public-process-brief\.v1/.test(exp));
ok("related materials in tech transfer", /relatedMaterials/.test(exp));

console.log(`\nAll AI regression contracts passed (${passed}).`);
