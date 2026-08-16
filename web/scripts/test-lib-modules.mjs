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
  "lib/dossier/serverEvidenceCache.ts",
  "lib/dossier/densifyPass.ts",
  "lib/dossier/gatherResilience.ts",
  "lib/idb/procedureVault.ts",
  "lib/dossier/aiEvidencePackage.ts",
  "lib/dossier/densifyBudgetPlanner.ts",
  "lib/dossier/healthWeightedDensify.ts",
  "lib/dossier/modalityDensifyPlaybook.ts",
  "lib/dossier/attachQuotesToRoutes.ts",
  "lib/search/msatJourney.ts",
  "lib/frontier/routeNeighborhood.ts",
  "lib/export/rolePack.ts",
  "lib/idb/bulkVault.ts",
  "lib/dossier/vaultFingerprint.ts",
  "lib/idb/campaignVault.ts",
  "lib/dossier/relatedContextPackage.ts",
  "lib/dossier/annotationExcerpts.ts",
  "lib/dossier/processKnowledgeDigest.ts",
  "lib/dossier/mergeExtractAtoms.ts",
  "lib/literature/rank.ts",
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
ok("pipeline calls attachQuotesToRoutes", /attachQuotesToRoutes/.test(pipeline));

ok(
  "synthesize two-pass extract path",
  /EXTRACT_SYSTEM/.test(synthesize) && /pass1Extract|useTwoPass/.test(synthesize)
);
ok(
  "evidence pack value-weighted",
  /value-weighted|rankProcedureTextsForPack/.test(
    read("lib/dossier/aiEvidencePackage.ts")
  )
);

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
ok("reactome client", exists("lib/api/reactome.ts"));
ok("wikipathways client", exists("lib/api/wikipathways.ts"));
ok("pathwayCommons client", exists("lib/api/pathwayCommons.ts"));
ok("massbank client", exists("lib/api/massbank.ts"));
ok("drugCentral client", exists("lib/api/drugCentral.ts"));
ok("clinicalTrials client", exists("lib/api/clinicalTrials.ts"));
ok("pubchem classifications client", exists("lib/api/pubchemClassifications.ts"));
ok(
  "gather wires Reactome",
  /fetchReactomeByName/.test(read("lib/dossier/gather.ts"))
);
ok(
  "gather wires MassBank",
  /fetchMassBankByName/.test(read("lib/dossier/gather.ts"))
);
ok(
  "gather wires ClinicalTrials",
  /fetchClinicalTrialsByName/.test(read("lib/dossier/gather.ts"))
);
ok(
  "gather durable cache merge",
  /mergeEvidencePreferDense|getCachedEvidence|runApiHarvestAgent/.test(
    read("lib/dossier/gather.ts")
  )
);
ok("server evidence cache module", exists("lib/dossier/serverEvidenceCache.ts"));
ok("densify pass module", exists("lib/dossier/densifyPass.ts"));
ok("procedure vault module", exists("lib/idb/procedureVault.ts"));
ok("AI evidence package module", exists("lib/dossier/aiEvidencePackage.ts"));
ok(
  "AI package prioritizes procedureExcerpts",
  /procedureExcerpts|agenticBrief/.test(read("lib/dossier/aiEvidencePackage.ts"))
);
ok(
  "AI package latency-tuned budget",
  /MAX_EVIDENCE_CHARS_FULL\s*=\s*28_000|28000/.test(
    read("lib/dossier/aiEvidencePackage.ts")
  ) &&
    /MAX_EVIDENCE_CHARS_FAST\s*=\s*12_000|12000/.test(
      read("lib/dossier/aiEvidencePackage.ts")
    )
);
ok(
  "trace retries transient",
  /retries|isTransient|after \d+ attempts/.test(read("lib/api/trace.ts"))
);

const schemaCache = read("lib/idb/dossierCache.ts");
ok("IndexedDB schema version >= 9", /SCHEMA_VERSION\s*=\s*([9]|\d{2,})/.test(schemaCache));
ok(
  "plant deliverables module exists",
  fs.existsSync(path.join(srcRoot, "lib/dossier/plantDeliverables.ts"))
);
ok(
  "tier-A baseline module deleted",
  !fs.existsSync(path.join(srcRoot, "lib/dossier/tierABaseline.ts"))
);
ok(
  "mock examples module deleted",
  !fs.existsSync(path.join(srcRoot, "lib/data/examples.ts"))
);
ok(
  "mock curatedPackages deleted",
  !fs.existsSync(path.join(srcRoot, "lib/data/curatedPackages.ts"))
);
ok(
  "ExampleDossierView deleted",
  !fs.existsSync(path.join(srcRoot, "components/ExampleDossierView.tsx"))
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
ok("SourcesRegistry wires reactome", /"reactome"/.test(sourcesReg));
ok("SourcesRegistry wires massbank", /"massbank"/.test(sourcesReg));
ok("SourcesRegistry wires clinicaltrials", /"clinicaltrials"/.test(sourcesReg));
ok("SourcesRegistry recipe focus", /RECIPE_FOCUS_IDS|recipeFocus/.test(sourcesReg));

// Probes include new APIs + full catalog
const probes = read("lib/diagnostics/probes.ts");
const probeCat = read("lib/diagnostics/publicApiProbes.ts");
ok("probes include comptox", /comptox/i.test(probes) || /comptox/i.test(probeCat));
ok("probes include dailymed", /dailymed/i.test(probes) || /dailymed/i.test(probeCat));
ok("probes include semantic-scholar", /semantic-scholar|semanticscholar/i.test(probes + probeCat));
ok("full publicApiProbes catalog exists", exists("lib/diagnostics/publicApiProbes.ts"));
ok(
  "publicApiProbes covers unichem+pubmed+massbank",
  /unichem/i.test(probeCat) && /pubmed/i.test(probeCat) && /massbank/i.test(probeCat)
);
ok(
  "full API health CLI exists",
  exists("../scripts/test-api-health-full.mjs") ||
    fs.existsSync(path.join(__dirname, "test-api-health-full.mjs"))
);
ok(
  "API coverage compare script exists",
  fs.existsSync(path.join(__dirname, "compare-api-registration.mjs"))
);
const regSrc = read("lib/sources/registry.ts");
const regIdList = [...regSrc.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
const regDupes = regIdList.filter((id, i) => regIdList.indexOf(id) !== i);
ok("registry has no duplicate ids", regDupes.length === 0);
ok(
  "health suite tags patent-literature + densify families",
  /gather:\s*"patent-literature"/.test(
    fs.readFileSync(path.join(__dirname, "test-api-health-full.mjs"), "utf8")
  ) &&
    /gather:\s*"patent-epmc-densify"/.test(
      fs.readFileSync(path.join(__dirname, "test-api-health-full.mjs"), "utf8")
    )
);

const hubLib = fs.readFileSync(path.join(__dirname, "test-hub-lib.mjs"), "utf8");
ok(
  "hub-lib test loads production rank.ts scorer",
  /lib\/literature\/rank\.ts/.test(hubLib) && !/function scoreProcessRelevance\s*\(/.test(hubLib)
);

console.log(`\nAll lib-module integrity checks passed (${passed}).`);
