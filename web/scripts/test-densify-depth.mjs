/**
 * Densify-depth contracts — process-ranked harvest, OA-sparse patents,
 * procedureExcerpts on live dossier, AI guidance ingest (offline).
 * Maps to DENS-* in docs/engineering/test-spec.md
 *
 * Run: node scripts/test-densify-depth.mjs
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

function exists(rel) {
  return fs.existsSync(path.join(src, rel));
}

console.log("test-densify-depth");

const densify = read("lib/dossier/densifyPass.ts");
const gather = read("lib/dossier/gather.ts");
const scaffold = read("lib/dossier/scaffold.ts");
const types = read("lib/dossier/types.ts");
const pipeline = read("lib/dossier/pipeline.ts");
const guide = read("lib/frontier/aiGuidancePackage.ts");
const litDepth = read("lib/frontier/literatureDepth.ts");
const knowledge = read("lib/frontier/buildKnowledge.ts");
const stream = read("app/api/dossier/[cid]/stream/route.ts");
const evidencePkg = read("lib/dossier/aiEvidencePackage.ts");
const enrich = read("lib/dossier/enrichClientFacts.ts");

// DENS-01 thresholds + needsDensifyPass
ok("DENS-01 needsDensifyPass export", /export function needsDensifyPass/.test(densify));
ok("DENS-01 min procedure chars", /DENSIFY_MIN_PROCEDURE_CHARS/.test(densify));
ok("DENS-01 min excerpts", /DENSIFY_MIN_EXCERPTS/.test(densify));
ok("DENS-01 runDensifyPass export", /export async function runDensifyPass/.test(densify));

// DENS-02 process-rank / budget planner before OA budget
ok("DENS-02 processScore ranking", /processScore/.test(densify));
ok(
  "DENS-02 literature densify budget planner",
  /planLiteratureDensifyTargets|literature\s*=\s*\[\.\.\.literature\]\.sort/.test(
    densify
  )
);
ok(
  "DENS-02 OA maxArticles ≥ 8",
  /maxArticles:\s*(8|10|1[0-2])|maxOa:\s*(8|10|1[0-2])|deepDensifyLiterature/.test(
    densify
  )
);
ok(
  "DENS-02 extra PMC densify",
  /extraPmc|fetchEuropePmcFullTextXml|deepDensifyLiterature/.test(densify)
);

// DENS-03 OA-sparse patent boost
ok("DENS-03 oaSparse detection", /oaSparse|oaWindows/.test(densify));
ok("DENS-03 higher patent max when OA sparse", /epmcPatMax|usPatMax|oaSparse\s*\?\s*12/.test(densify));
ok(
  "DENS-03 patents process-ranked / planner",
  /planPatentDensifyTargets|patents\s*=\s*\[\.\.\.patents\]\.sort/.test(densify)
);

// DENS-04 procedure excerpts retained
ok("DENS-04 LiveDossier procedureExcerpts field", /procedureExcerpts\?:/.test(types));
ok("DENS-04 scaffold attaches excerpts", /procedureExcerpts:/.test(scaffold));
ok("DENS-04 densify caps excerpts", /procedureExcerpts\.slice\(0,\s*\d+\)/.test(densify));
ok("DENS-04 gather first-pass excerpts", /procedureExcerpts/.test(gather));

// DENS-05 AI package densify-first
ok("DENS-05 buildAiGuidancePackage", /export function buildAiGuidancePackage/.test(guide));
ok("DENS-05 formatAiGuidanceContext", /export function formatAiGuidanceContext/.test(guide));
ok("DENS-05 ingestScore", /ingestScore/.test(guide));
ok("DENS-05 densifyNext actions", /densifyNext/.test(guide));
ok("DENS-05 NEVER invent plant", /NEVER invent|never invent/.test(guide));
ok("DENS-05 procedure windows from excerpts", /procedureExcerpts/.test(guide));

// DENS-06 literature depth ranks windows
ok("DENS-06 buildLiteratureDepthReport", /export function buildLiteratureDepthReport/.test(litDepth));
ok("DENS-06 rankDossierTextWindows", /export function rankDossierTextWindows/.test(litDepth));
ok("DENS-06 uses procedureExcerpts", /procedureExcerpts/.test(litDepth));

// DENS-07 process-knowledge metrics
ok("DENS-07 buildProcessKnowledgePackage", /export function buildProcessKnowledgePackage/.test(knowledge));
ok("DENS-07 procedureChars metric", /procedureChars/.test(knowledge));
ok("DENS-07 withProcessKnowledge in pipeline", /withProcessKnowledge/.test(pipeline));

// DENS-08 force densify stream
ok("DENS-08 stream force param", /force/.test(stream));
ok("DENS-08 force passed to pipeline", /force\s*[,}]/.test(stream) || /force\s*:/.test(stream));

// DENS-09 AI evidence package prioritizes densify
ok("DENS-09 MAX_EVIDENCE_CHARS_FULL", /MAX_EVIDENCE_CHARS_FULL\s*=\s*3[0-9_]+/.test(evidencePkg));
ok("DENS-09 procedureExcerpts in package", /procedureExcerpts/.test(evidencePkg));
ok("DENS-09 processFacts atoms first", /processFacts|atoms/.test(evidencePkg));
ok("DENS-09 value-weighted packing", /value-weighted|rankProcedureTextsForPack|packing:\s*"value-weighted"/.test(evidencePkg));
ok("DENS-09 processKnowledgeDigest in pack", /processKnowledgeDigest/.test(evidencePkg));
ok("DENS-09 relatedProcessContext in pack", /relatedProcessContext|buildRelatedProcessContext/.test(evidencePkg));

// DENS-10 client enrich reuses harvest
ok("DENS-10 enrich uses dossier.procedureExcerpts", /dossier\.procedureExcerpts/.test(enrich));

// DENS-11 densify budget planner + quote-bind + two-pass AI
const planner = read("lib/dossier/densifyBudgetPlanner.ts");
const quoteBind = read("lib/dossier/attachQuotesToRoutes.ts");
const relatedCtx = read("lib/dossier/relatedContextPackage.ts");
const annEx = read("lib/dossier/annotationExcerpts.ts");
const synth = read("lib/dossier/synthesize.ts");
const deep = read("lib/dossier/deepDensify.ts");
const score = read("lib/dossier/evidenceScore.ts");

ok("DENS-11 planLiteratureDensifyTargets", /export function planLiteratureDensifyTargets/.test(planner));
ok("DENS-11 planPatentDensifyTargets", /export function planPatentDensifyTargets/.test(planner));
ok("DENS-11 listThinHighValueTargets", /export function listThinHighValueTargets/.test(planner));
ok("DENS-11 deepDensify uses planner", /planLiteratureDensifyTargets/.test(deep));
ok("DENS-11 densifyPass uses planner", /planLiteratureDensifyTargets/.test(densify));
ok("DENS-11 attachQuotesToRoutes export", /export function attachQuotesToRoutes/.test(quoteBind));
ok("DENS-11 pipeline quote-bind", /attachQuotesToRoutes/.test(pipeline));
ok("DENS-11 related context package", /export function buildRelatedProcessContext/.test(relatedCtx));
ok("DENS-11 annotations→excerpts", /export function annotationsToProcedureExcerpts/.test(annEx));
ok("DENS-11 gather promotes annotations", /annotationsToProcedureExcerpts/.test(gather));
ok("DENS-11 two-pass extract system", /EXTRACT_SYSTEM|pass1Extract|two-pass/.test(synth));
ok("DENS-11 densifyNext thin hits", /listThinHighValueTargets|act:thin-hits|thin high-value/.test(guide));
ok("DENS-11 procedure-density gate", /hasProcedureDensity|PROC_DENSITY/.test(score));

// Module presence for densify ecosystem
const densifyMods = [
  "lib/dossier/densifyPass.ts",
  "lib/dossier/densifySchedule.ts",
  "lib/dossier/densifyTelemetry.ts",
  "lib/dossier/densifyBudgetPlanner.ts",
  "lib/dossier/attachQuotesToRoutes.ts",
  "lib/dossier/relatedContextPackage.ts",
  "lib/dossier/annotationExcerpts.ts",
  "lib/frontier/aiGuidancePackage.ts",
  "lib/frontier/campaignAiGuidance.ts",
  "lib/frontier/densifyActionQueue.ts",
  "lib/frontier/literatureDepth.ts",
  "lib/literature/procedureWindowScore.ts",
];
for (const m of densifyMods) {
  ok(`DENS-mod ${m}`, exists(m));
}

console.log(`\n${passed} densify-depth checks passed`);
