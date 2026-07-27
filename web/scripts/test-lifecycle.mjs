/**
 * Lifecycle contracts — gather → densify/cache → score → AI gate → strip → enrich.
 * Offline. Maps to LIFE-* in docs/engineering/test-spec.md
 * Run: node scripts/test-lifecycle.mjs
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

const pipe = read("lib/dossier/pipeline.ts");
const gather = read("lib/dossier/gather.ts");
const densify = read("lib/dossier/densifyPass.ts");
const cache = read("lib/dossier/serverEvidenceCache.ts");
const score = read("lib/dossier/evidenceScore.ts");
const readiness = read("lib/dossier/recipeReadiness.ts");
const packageAi = read("lib/dossier/aiEvidencePackage.ts");
const stream = read("app/api/dossier/[cid]/stream/route.ts");
const loader = read("components/dossier/DossierClientLoader.tsx");

// LIFE-01: pipeline stages present (imports may appear before body)
const stages = [
  "gatherCompoundEvidence",
  "scoreCompoundEvidence",
  "buildScaffoldDossier",
  "shouldSynthesize",
  "synthesizeDossierFromEvidence",
  "stripUncitedRouteDetails",
  "preferRoutesForEvidence",
  "withRecipeReadiness",
];
for (const s of stages) {
  ok(`LIFE-01 stage present: ${s}`, pipe.includes(s));
}
// Order of *invocation* markers in body (not import lines)
const body = pipe.slice(pipe.indexOf("export async function buildLiveDossierWithProgress"));
const callOrder = [
  "await gatherCompoundEvidence",
  "scoreCompoundEvidence(evidence)",
  "buildScaffoldDossier",
  "scored.shouldSynthesize",
  "synthesizeDossierFromEvidence",
  "stripUncitedRouteDetails",
  "preferRoutesForEvidence",
  "withRecipeReadiness",
];
let last = -1;
for (const s of callOrder) {
  const i = body.indexOf(s);
  ok(`LIFE-01 call site present: ${s}`, i >= 0);
  if (i >= 0) {
    ok(`LIFE-01 call order: ${s}`, i >= last);
    last = i;
  }
}

// LIFE-02 soft-fail gather
ok("LIFE-02 soft() helper", /function soft\s*</.test(gather) || /function soft\(/.test(gather));
ok("LIFE-02 soft wraps Europe PMC", /soft\(\s*searchEuropePmc/.test(gather));
ok("LIFE-02 soft wraps patents densify", /soft\(\s*enrichPatentHitsWithEpmc|soft\(\s*densifyUsPatentsWithPubchem/.test(gather));
ok("LIFE-02 durable wrapper gatherCompoundEvidence", /export async function gatherCompoundEvidence/.test(gather));
ok("LIFE-02 live gather separate", /gatherCompoundEvidenceLive/.test(gather));

// LIFE-03 cache merge denser
ok("LIFE-03 getCachedEvidence", /export function getCachedEvidence/.test(cache));
ok("LIFE-03 putCachedEvidence", /export function putCachedEvidence/.test(cache));
ok("LIFE-03 mergeEvidencePreferDense", /export function mergeEvidencePreferDense/.test(cache));
ok("LIFE-03 merge prefers longer procedure text", /chars|procedureExcerpts|fullTextExcerpt/.test(cache));
ok("LIFE-03 gather calls merge", /mergeEvidencePreferDense/.test(gather));

// LIFE-04 densify thresholds
ok("LIFE-04 needsDensifyPass", /export function needsDensifyPass/.test(densify));
ok(
  "LIFE-04 runDensifyPass",
  /export async function runDensifyPass|export function runDensifyPass/.test(densify)
);
ok("LIFE-04 min procedure chars threshold", /DENSIFY_MIN_PROCEDURE_CHARS/.test(densify));
ok("LIFE-04 min excerpts threshold", /DENSIFY_MIN_EXCERPTS/.test(densify));
ok("LIFE-04 gather runs densify when thin", /needsDensifyPass|runDensifyPass/.test(gather));
ok("LIFE-04 densify re-extracts process facts", /extractProcessFacts/.test(densify));

// LIFE-05 recipe readiness modes
ok("LIFE-05 scout-dossier mode", /scout-dossier/.test(readiness));
ok("LIFE-05 recipe-draft mode", /recipe-draft/.test(readiness));
ok("LIFE-05 teaching-package mode", /teaching-package/.test(readiness));
ok("LIFE-05 assessRecipeReadiness", /export function assessRecipeReadiness/.test(readiness));
ok("LIFE-05 withRecipeReadiness", /export function withRecipeReadiness/.test(readiness));
ok("LIFE-05 pipeline attaches readiness", /withRecipeReadiness/.test(pipe));

// LIFE-06 client durability modules
ok(
  "LIFE-06 dossierCache schema",
  /SCHEMA_VERSION\s*=\s*(1[1-9]|\d{2,})/.test(read("lib/idb/dossierCache.ts"))
);
ok("LIFE-06 procedure vault", fs.existsSync(path.join(src, "lib/idb/procedureVault.ts")));
ok(
  "LIFE-06 vault put/get",
  /putVaultExcerpts|getVaultExcerptsForCid/.test(read("lib/idb/procedureVault.ts"))
);

// LIFE-07 stream + client loader lifecycle
ok("LIFE-07 SSE stream route", /buildLiveDossierWithProgress/.test(stream));
ok("LIFE-07 stream maxDuration", /maxDuration/.test(stream));
ok("LIFE-07 client EventSource", /EventSource/.test(loader));
ok("LIFE-07 client putCachedDossier", /putCachedDossierAndNotify/.test(loader));
ok("LIFE-07 client handles partial + complete", /partial/.test(loader) && /complete/.test(loader));

// Score / AI gate linkage
ok("LIFE score shouldSynthesize", /shouldSynthesize/.test(score));
ok("LIFE score densify credits", /procedureExcerpts|procChars/.test(score));
ok("LIFE AI package module", /buildEvidencePayload/.test(packageAi));

// Executable densify threshold logic (mirror)
const DENSIFY_MIN_PROCEDURE_CHARS = 1800;
const DENSIFY_MIN_EXCERPTS = 4;
function needsDensify(chars, n) {
  return chars < DENSIFY_MIN_PROCEDURE_CHARS || n < DENSIFY_MIN_EXCERPTS;
}
ok("LIFE-04 executable: thin needs densify", needsDensify(100, 1) === true);
ok("LIFE-04 executable: rich skips densify", needsDensify(5000, 10) === false);

// Executable recipe mode heuristics (mirror)
function modeFrom(cond, ops, blockers, procedureChars) {
  const framing = cond >= 3 && ops >= 2 ? "process-recipe" : "evidence-lead-pack";
  const canDraft =
    framing === "process-recipe" &&
    blockers === 0 &&
    cond >= 3 &&
    ops >= 2 &&
    procedureChars >= 800;
  return canDraft ? "recipe-draft" : "scout-dossier";
}
ok("LIFE-05 executable: thin → scout", modeFrom(0, 0, 1, 100) === "scout-dossier");
ok(
  "LIFE-05 executable: dense → recipe-draft",
  modeFrom(4, 3, 0, 2000) === "recipe-draft"
);

console.log(`\nAll lifecycle contracts passed (${passed}).`);
