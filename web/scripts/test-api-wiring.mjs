/**
 * Product API list wiring contracts — modules exist + gather references.
 * Maps to API-* in docs/engineering/test-spec.md
 * Run: node scripts/test-api-wiring.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");
const api = path.join(src, "lib", "api");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

function exists(rel) {
  return fs.existsSync(path.join(src, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

const gather = read("lib/dossier/gather.ts");
const registry = read("lib/sources/registry.ts");
const sourcesUi = read("components/SourcesRegistry.tsx");

/** Expected free-public clients for recipe densify / identity */
const CLIENTS = [
  // Core
  ["pubchem.ts", /getPubChemCompound|pubchem/],
  ["pubchemView.ts", /fetchPubChemView/],
  ["pubchemPatents.ts", /fetchPubchemPatentIds/],
  ["pubchemClassifications.ts", /fetchPubchemClassifications/],
  // Literature
  ["europePmc.ts", /searchEuropePmc|enrichLiteratureWithOaFullText/],
  ["pubmed.ts", /searchPubMedProcess/],
  ["openAlex.ts", /searchOpenAlexProcess/],
  ["crossref.ts", /searchCrossrefProcess/],
  ["semanticScholar.ts", /searchSemanticScholarProcess/],
  ["arxiv.ts", /searchArxivProcess/],
  // Patents / procedure
  ["patentsView.ts", /searchPatentsView/],
  ["patentFullText.ts", /searchEuropePmcPatents|enrichPatentHitsWithEpmc/],
  ["usptoFullText.ts", /densifyUsPatentsWithPubchem/],
  ["orgsyn.ts", /fetchOrgSynByName/],
  ["ord.ts", /fetchOrdContext/],
  // Identity graph
  ["unichem.ts", /fetchUnichemByPubchemCid/],
  ["chebi.ts", /fetchChebiByName/],
  ["gsrs.ts", /fetchGsrsByName/],
  ["mychem.ts", /fetchMyChemByName/],
  ["chembl.ts", /fetchChemblByName/],
  ["rxnorm.ts", /fetchRxNormByName/],
  ["drugCentral.ts", /fetchDrugCentralByName/],
  // Pathways / reactions
  ["kegg.ts", /fetchKeggByName/],
  ["rhea.ts", /fetchRheaByName/],
  ["reactome.ts", /fetchReactomeByName/],
  ["wikipathways.ts", /fetchWikiPathwaysByName/],
  ["pathwayCommons.ts", /fetchPathwayCommonsByName/],
  // Regulatory / hazards / analytical
  ["openFda.ts", /fetchOpenFdaByName/],
  ["dailyMed.ts", /fetchDailyMedByName/],
  ["clinicalTrials.ts", /fetchClinicalTrialsByName/],
  ["comptox.ts", /fetchCompToxByName/],
  ["massbank.ts", /fetchMassBankByName/],
];

for (const [file, gatherRe] of CLIENTS) {
  ok(`API-module exists: ${file}`, fs.existsSync(path.join(api, file)));
  ok(`API-gather wires: ${file}`, gatherRe.test(gather));
}

// Registry IDs expected
const REGISTRY_IDS = [
  "pubchem-pug",
  "pubchem-pug-view",
  "europepmc",
  "pubmed",
  "patentsview",
  "kegg",
  "rhea",
  "reactome",
  "wikipathways",
  "pathway-commons",
  "ord",
  "unichem",
  "chebi",
  "gsrs",
  "massbank",
  "drugcentral",
  "clinicaltrials",
  "orgsyn",
  "arxiv",
  "comptox",
  "openfda",
  "dailymed",
];

for (const id of REGISTRY_IDS) {
  ok(`API-registry lists ${id}`, new RegExp(`id:\\s*"${id}"`).test(registry));
}

// Sources UI wired set
for (const id of [
  "reactome",
  "wikipathways",
  "pathway-commons",
  "massbank",
  "drugcentral",
  "clinicaltrials",
  "orgsyn",
  "pubmed",
  "unichem",
]) {
  ok(`API-SourcesRegistry wired ${id}`, new RegExp(`"${id}"`).test(sourcesUi));
}

ok("API-recipe focus filter", /RECIPE_FOCUS_IDS/.test(sourcesUi));
ok("API-procedureExcerpts in gather", /procedureExcerpts/.test(gather));
ok("API-soft parallel wave", /Promise\.all\(\[/.test(gather) && /soft\(/.test(gather));

// Count api client files
const apiFiles = fs
  .readdirSync(api)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
ok("API-client surface ≥ 30 modules", apiFiles.length >= 30);

console.log(`\nAll API wiring contracts passed (${passed}).`);
console.log(`  api/*.ts modules: ${apiFiles.length}`);
