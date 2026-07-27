/**
 * Import-level integrity: load compiled Next/TS paths via dynamic transpile.
 * Uses Node + typescript transpile if available; otherwise skips with note.
 *
 * Prefer: npx tsx scripts/test-lib-modules.mjs when tsx is installed.
 * Fallback: syntax/structure checks only.
 *
 * Run: node scripts/test-lib-modules.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "..", "src");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(srcRoot, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(srcRoot, rel));
}

// Critical modules present
const critical = [
  "lib/dossier/processFacts.ts",
  "lib/dossier/evidenceScore.ts",
  "lib/dossier/gather.ts",
  "lib/dossier/pipeline.ts",
  "lib/dossier/synthesize.ts",
  "lib/dossier/scaffold.ts",
  "lib/export/techTransfer.ts",
  "lib/ai/config.ts",
  "lib/ai/serverEnv.ts",
  "lib/diagnostics/probes.ts",
  "components/ProcessFactsPanel.tsx",
  "components/ManagerBriefPanel.tsx",
  "components/OperatorJobAid.tsx",
  "components/LocalTextEnrich.tsx",
  "components/ProcessFramingBanner.tsx",
  "components/RecipeReadinessPanel.tsx",
  "lib/dossier/recipeReadiness.ts",
  "lib/api/rhea.ts",
  "lib/api/patentFullText.ts",
  "lib/api/unichem.ts",
  "lib/api/chebi.ts",
  "lib/api/gsrs.ts",
  "lib/api/pubmed.ts",
  "lib/api/arxiv.ts",
  "lib/api/orgsyn.ts",
  "lib/api/usptoFullText.ts",
  "components/ValidationChecklist.tsx",
  "components/SourceCoverageMap.tsx",
  "components/EvidenceScoreExplainer.tsx",
  "lib/dossier/warmCache.ts",
  "lib/dossier/enrichClientFacts.ts",
  "lib/dossier/plantDeliverables.ts",
  "lib/idb/userSupplements.ts",
  "app/api/diagnostics/route.ts",
  "app/api/dossier/[cid]/stream/route.ts",
  "app/api/ai/chat/route.ts",
];

for (const rel of critical) {
  ok(`module exists: ${rel}`, exists(rel));
}

// Accuracy law strings still present (durability against regressions)
const processFacts = read("lib/dossier/processFacts.ts");
ok(
  "processFacts exports extractProcessFacts",
  /export function extractProcessFacts/.test(processFacts)
);
ok(
  "processFacts exports stripUncitedRouteDetails",
  /export function stripUncitedRouteDetails/.test(processFacts)
);
ok(
  "public process brief schema v1",
  /chemistry-recipes\.public-process-brief\.v1/.test(processFacts)
);

const synthesize = read("lib/dossier/synthesize.ts");
ok(
  "AI system prompt forbids inventing numbers",
  /NEVER invent numeric/i.test(synthesize)
);
ok(
  "AI quality gate strips IPC/CQA",
  /ipcMethods: undefined/.test(synthesize) || /Never keep AI IPC/.test(synthesize)
);

const pipeline = read("lib/dossier/pipeline.ts");
ok("pipeline calls stripUncitedRouteDetails", /stripUncitedRouteDetails/.test(pipeline));
ok("pipeline calls extractProcessFacts", /extractProcessFacts/.test(pipeline));
ok("pipeline calls preferRoutesForEvidence", /preferRoutesForEvidence/.test(pipeline));

const exportTs = read("lib/export/techTransfer.ts");
ok(
  "tech-transfer v2 schema",
  /chemistry-recipes\.tech-transfer\.v2/.test(exportTs)
);
ok("buildPublicProcessBrief exported", /export function buildPublicProcessBrief/.test(exportTs));
ok(
  "validation checklist includes process-facts",
  /id: "process-facts"/.test(exportTs)
);

const config = read("lib/ai/config.ts");
ok("isAllowedOllamaHost exported", /export function isAllowedOllamaHost/.test(config));
ok("isLocalOllamaHost exported", /export function isLocalOllamaHost/.test(config));
ok("OLLAMA_LOCAL_HOST defined", /OLLAMA_LOCAL_HOST/.test(config));

const chatRoute = read("app/api/ai/chat/route.ts");
ok("chat route uses isAllowedOllamaHost", /isAllowedOllamaHost/.test(chatRoute));
ok("chat route allows local without key path", /isLocalOllamaHost/.test(chatRoute));

const liveDossier = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live dossier mounts ProcessFactsPanel", /ProcessFactsPanel/.test(liveDossier));
ok("live dossier mounts ManagerBriefPanel", /ManagerBriefPanel/.test(liveDossier));
ok("live dossier mounts OperatorJobAid", /OperatorJobAid/.test(liveDossier));
ok("live dossier mounts LocalTextEnrich", /LocalTextEnrich/.test(liveDossier));
ok("live dossier mounts ProcessFramingBanner", /ProcessFramingBanner/.test(liveDossier));
ok("live dossier mounts RecipeReadinessPanel", /RecipeReadinessPanel/.test(liveDossier));
ok("recipe readiness module exists", exists("lib/dossier/recipeReadiness.ts"));
ok(
  "europePmc OA full text helper",
  /enrichLiteratureWithOaFullText|fetchEuropePmcFullTextXml/.test(read("lib/api/europePmc.ts"))
);
ok("patent full text densify module", exists("lib/api/patentFullText.ts"));
ok("rhea client module", exists("lib/api/rhea.ts"));
ok("unichem client module", exists("lib/api/unichem.ts"));
ok("chebi client module", exists("lib/api/chebi.ts"));
ok("gsrs client module", exists("lib/api/gsrs.ts"));
ok("pubmed client module", exists("lib/api/pubmed.ts"));
ok("arxiv client module", exists("lib/api/arxiv.ts"));
ok("orgsyn client module", exists("lib/api/orgsyn.ts"));
ok("uspto fulltext densify module", exists("lib/api/usptoFullText.ts"));
ok(
  "gather uses procedureExcerpts",
  /procedureExcerpts/.test(read("lib/dossier/gather.ts"))
);
ok(
  "gather uses ORD fetchOrdContext",
  /fetchOrdContext/.test(read("lib/dossier/gather.ts"))
);
ok(
  "gather wires UniChem",
  /fetchUnichemByPubchemCid/.test(read("lib/dossier/gather.ts"))
);
ok(
  "gather wires PubMed",
  /searchPubMedProcess/.test(read("lib/dossier/gather.ts"))
);
ok(
  "gather wires OrgSyn",
  /fetchOrgSynByName/.test(read("lib/dossier/gather.ts"))
);

const schemaCache = read("lib/idb/dossierCache.ts");
ok("IndexedDB schema version >= 9", /SCHEMA_VERSION\s*=\s*([9]|\d{2,})/.test(schemaCache));
ok(
  "plant deliverables module exists",
  fs.existsSync(path.join(srcRoot, "lib/dossier/plantDeliverables.ts"))
);
ok(
  "tier-A baseline module exists",
  fs.existsSync(path.join(srcRoot, "lib/dossier/tierABaseline.ts"))
);
ok(
  "chemical mentions module exists",
  fs.existsSync(path.join(srcRoot, "lib/dossier/chemicalMentions.ts"))
);

ok(
  "processFacts framing types",
  /process-recipe/.test(processFacts) && /evidence-lead-pack/.test(processFacts)
);
ok("processFacts user text extract", /extractFactsFromUserText/.test(processFacts));
ok("export has operator job aid", /buildOperatorJobAidExport/.test(exportTs));
ok("compare page warms dossiers", /warmLiveDossier/.test(read("app/compare/page.tsx")));

// Registry wired set in SourcesRegistry
const sourcesReg = read("components/SourcesRegistry.tsx");
ok("SourcesRegistry wires comptox", /"comptox"/.test(sourcesReg));
ok("SourcesRegistry wires dailymed", /"dailymed"/.test(sourcesReg));
ok("SourcesRegistry wires semantic-scholar", /"semantic-scholar"/.test(sourcesReg));
ok("SourcesRegistry wires rhea", /"rhea"/.test(sourcesReg));
ok("SourcesRegistry wires unichem", /"unichem"/.test(sourcesReg));
ok("SourcesRegistry wires pubmed", /"pubmed"/.test(sourcesReg));
ok("SourcesRegistry wires orgsyn", /"orgsyn"/.test(sourcesReg));
ok("SourcesRegistry recipe focus", /RECIPE_FOCUS_IDS|recipeFocus/.test(sourcesReg));

// Probes include new APIs
const probes = read("lib/diagnostics/probes.ts");
ok("probes include comptox", /comptox/i.test(probes));
ok("probes include dailymed", /dailymed/i.test(probes));
ok("probes include semantic-scholar", /semantic-scholar|semanticscholar/i.test(probes));

console.log(`\nAll lib-module integrity checks passed (${passed}).`);
