/**
 * Multi-source search + problem-first contracts (offline).
 * Maps to SEARCH-* in docs/engineering/test-spec.md
 *
 * Run: node scripts/test-search-contracts.mjs
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

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

async function loadQueryKind() {
  const srcFile = path.join(src, "lib/search/queryKind.ts");
  const source = fs.readFileSync(srcFile, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcFile,
  });
  const out = path.join(tmpdir(), `queryKind-${process.pid}.mjs`);
  fs.writeFileSync(out, outputText, "utf8");
  return import(pathToFileURL(out).href);
}

console.log("test-search-contracts");

// Modules
ok("SEARCH multiSourceSearch module", exists("lib/search/multiSourceSearch.ts"));
ok("SEARCH multiSourceSuggest module", exists("lib/search/multiSourceSuggest.ts"));
ok("SEARCH problemFirst module", exists("lib/search/problemFirst.ts"));
ok("SEARCH problemMultiSource module", exists("lib/search/problemMultiSource.ts"));
ok("SEARCH problemCampaign module", exists("lib/search/problemCampaign.ts"));
ok("SEARCH queryKind module", exists("lib/search/queryKind.ts"));

const multi = read("lib/search/multiSourceSearch.ts");
const suggest = read("lib/search/multiSourceSuggest.ts");
const problemFirst = read("lib/search/problemFirst.ts");
const problemMulti = read("lib/search/problemMultiSource.ts");
const problemCamp = read("lib/search/problemCampaign.ts");
const multiApi = read("app/api/search/multi/route.ts");
const suggestApi = read("app/api/search/suggest/route.ts");
const problemApi = read("app/api/search/problem/route.ts");
const searchPage = read("app/search/page.tsx");
const results = read("components/SearchResults.tsx");
const form = read("components/SearchForm.tsx");
const problemUi = read("components/ProblemFirstSearch.tsx");
const serverPubchem = read("lib/api/pubchem.ts");
const browser = read("lib/api/pubchemBrowser.ts");
const queryKindSrc = read("lib/search/queryKind.ts");

// SEARCH-01 multi-source identity fan-out
ok("SEARCH-01 multiSourceSearch export", /export async function multiSourceSearch/.test(multi));
ok("SEARCH-01 includes pubchem chembl", /pubchem|chembl/i.test(multi));
ok("SEARCH-01 multi API route", /multiSourceSearch/.test(multiApi));

// SEARCH-02 suggest fan-out
ok("SEARCH-02 multiSourceSuggest export", /export (async )?function|multiSourceSuggest/.test(suggest));
ok("SEARCH-02 suggest API", /suggest|multiSource/.test(suggestApi));
ok("SEARCH-02 SearchForm uses suggest API", /\/api\/search\/suggest/.test(form));
ok(
  "SEARCH-02 suggest skips structured identifiers",
  /isNameQuery/.test(suggest)
);

// SEARCH-03 problem-first live multi-source
ok("SEARCH-03 searchProblemFirst", /export function searchProblemFirst/.test(problemFirst));
ok("SEARCH-03 PROBLEM_SEARCH_HINTS", /PROBLEM_SEARCH_HINTS/.test(problemFirst));
ok("SEARCH-03 problem multi-source", /export async function|problemMultiSource|unified/.test(problemMulti));
ok("SEARCH-03 problem API route", /problem|limit/.test(problemApi));
ok("SEARCH-03 no hub-live leftover kind", !/hub-live/.test(problemFirst) && !/hub-live/.test(problemMulti));
ok("SEARCH-03 live molecule kind", /kind:\s*"live"/.test(problemMulti));
ok(
  "SEARCH-03 status summary has no local catalog count",
  !/`\$\{localHits\.length\} local`/.test(problemMulti)
);

// SEARCH-04 UI wiring
ok("SEARCH-04 SearchResults multi path", /\/api\/search\/multi/.test(results));
ok("SEARCH-04 SearchResults browser PubChem", /searchPubChemInBrowser/.test(results));
ok(
  "SEARCH-04 SearchResults no local mock index",
  !/resolveLocalSearchHits|searchLocalIndex/.test(results)
);
ok(
  "SEARCH-04 hub/local index modules deleted",
  !fs.existsSync(path.join(src, "lib/data/hubIndex.ts")) &&
    !fs.existsSync(path.join(src, "lib/data/searchLocalIndex.ts"))
);
ok("SEARCH-04 search page mounts SearchResults", /SearchResults/.test(searchPage));
ok("SEARCH-04 problem UI fetches /api/search/problem", /\/api\/search\/problem/.test(problemUi));

// SEARCH-05 campaign densify from problem
ok("SEARCH-05 createCampaignFromProblemHits", /export function createCampaignFromProblemHits/.test(problemCamp));
ok("SEARCH-05 createCampaignAndDensifyFromProblemHits", /export async function createCampaignAndDensifyFromProblemHits/.test(problemCamp));
ok("SEARCH-05 densify uses streamBatchDensifyCids", /streamBatchDensifyCids/.test(problemCamp));

// SEARCH-06 no invent / openable honesty
ok("SEARCH-06 MultiSourceHit openable field", /openable/.test(multi));
ok("SEARCH-06 results separate openable vs identity-only", /openable|identityOnly/.test(results));
ok(
  "SEARCH-06 consolidate case/identity clones into openable CIDs",
  /consolidateIdentityHits|Fold case|identity-only clones/i.test(multi)
);
ok(
  "SEARCH-06 keep browser PubChem hits when server fan-out empty",
  /server multi-source returned no additional matches/.test(results) &&
    /browserHits\.length > 0/.test(results)
);
ok(
  "SEARCH-06 merge browser CID cards when server is identity-only",
  /mergeOpenableBrowserHits/.test(results) &&
    /kept PubChem browser CID cards that server fan-out missed/.test(results)
);
ok(
  "SEARCH-06 keep browser hits when server enrich fails",
  /server enrich failed/.test(results)
);

ok(
  "SEARCH-07 browser PubChem resolves advertised SMILES via query param",
  /looksLikeSmiles/.test(browser) &&
    /compound\/smiles\/cids\/JSON\?smiles=/.test(browser)
);
ok(
  "SEARCH-07 browser PubChem resolves advertised UNII",
  /looksLikeUnii/.test(browser) &&
    /toUpperCase\(\)/.test(browser)
);
ok(
  "SEARCH-07 structured ids skip name autocomplete",
  /isNameQuery/.test(browser)
);
ok(
  "SEARCH-07 shared queryKind used by browser and server",
  /from "@\/lib\/search\/queryKind"/.test(browser) &&
    /from "@\/lib\/search\/queryKind"/.test(serverPubchem)
);

ok(
  "SEARCH-08 server PubChem resolves InChI via query param",
  /looksLikeInchi/.test(serverPubchem) &&
    /compound\/inchi\/cids\/JSON\?inchi=/.test(serverPubchem)
);
ok(
  "SEARCH-08 browser PubChem resolves InChI via query param",
  /looksLikeInchi/.test(browser) &&
    /compound\/inchi\/cids\/JSON\?inchi=/.test(browser)
);
ok(
  "SEARCH-08 SearchForm submits structured query as written",
  /resolveSearchSubmit/.test(form) &&
    /search as written/.test(form)
);
ok(
  "SEARCH-08 advertised identifiers include InChI only with a resolver",
  /InChI/.test(searchPage) &&
    /looksLikeInchi/.test(serverPubchem) &&
    /looksLikeInchi/.test(browser)
);

const qk = await loadQueryKind();
const aspirinInchi =
  "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)";
const aspirinSmiles = "CC(=O)Oc1ccccc1C(=O)O";
const aspirinKey = "BSYNRYMUTXBXSQ-UHFFFAOYSA-N";

ok("SEARCH-08 classify name", qk.classifyChemicalQuery("aspirin") === "name");
ok("SEARCH-08 classify CID", qk.classifyChemicalQuery("2244") === "cid");
ok("SEARCH-08 classify CAS", qk.classifyChemicalQuery("50-78-2") === "cas");
ok("SEARCH-08 classify InChIKey", qk.classifyChemicalQuery(aspirinKey) === "inchikey");
ok("SEARCH-08 classify UNII", qk.classifyChemicalQuery("R16CO5Y76E") === "unii");
ok("SEARCH-08 classify SMILES", qk.classifyChemicalQuery(aspirinSmiles) === "smiles");
ok(
  "SEARCH-08 InChI is not SMILES",
  qk.classifyChemicalQuery(aspirinInchi) === "inchi" &&
    qk.looksLikeInchi(aspirinInchi) &&
    !qk.looksLikeSmiles(aspirinInchi)
);
ok(
  "SEARCH-08 InChI=1 (non-standard) still InChI",
  qk.classifyChemicalQuery("InChI=1/CH4/h1H4") === "inchi"
);

const hijack = qk.resolveSearchSubmit(aspirinSmiles, { value: "aspirin" });
ok(
  "SEARCH-08 structured Enter ignores name highlight",
  hijack.value === aspirinSmiles && hijack.href === undefined
);
const inchiSubmit = qk.resolveSearchSubmit(aspirinInchi, {
  value: "something else",
});
ok(
  "SEARCH-08 InChI Enter keeps typed InChI",
  inchiSubmit.value === aspirinInchi
);
const nameSubmit = qk.resolveSearchSubmit("asp", { value: "aspirin" });
ok(
  "SEARCH-08 name Enter still uses highlight",
  nameSubmit.value === "aspirin"
);
const cidSubmit = qk.resolveSearchSubmit("2244", {
  value: "2244",
  href: "/compounds/pubchem/2244",
});
ok(
  "SEARCH-08 CID Enter may keep compound href",
  cidSubmit.href === "/compounds/pubchem/2244"
);
ok(
  "SEARCH-08 queryKind exports structured helpers",
  typeof qk.structuredQueryLabel === "function" &&
    qk.structuredQueryLabel("inchi") === "InChI" &&
    /resolveSearchSubmit/.test(queryKindSrc)
);

ok(
  "SEARCH-09 numbered names are not SMILES",
  qk.classifyChemicalQuery("2-propanol") === "name" &&
    qk.classifyChemicalQuery("1,3-butadiene") === "name" &&
    qk.classifyChemicalQuery("4-aminophenol") === "name" &&
    qk.looksLikeNumberedChemicalName("2-propanol") &&
    !qk.looksLikeSmiles("2-propanol")
);
ok(
  "SEARCH-09 stereo SMILES still SMILES",
  qk.classifyChemicalQuery("C/C=C/C") === "smiles" &&
    qk.classifyChemicalQuery("C#C") === "smiles" &&
    qk.classifyChemicalQuery("c1ccccc1") === "smiles" &&
    qk.classifyChemicalQuery("C1CCCCC1") === "smiles"
);
ok(
  "SEARCH-09 formula is not SMILES",
  qk.looksLikeMolecularFormula("C9H8O4") &&
    qk.classifyChemicalQuery("C9H8O4") === "name" &&
    !qk.looksLikeSmiles("C9H8O4")
);
ok(
  "SEARCH-09 server SMILES uses query param not path",
  /compound\/smiles\/cids\/JSON\?smiles=/.test(serverPubchem) &&
    !/compound\/smiles\/\$\{encodeURIComponent/.test(serverPubchem)
);
ok(
  "SEARCH-09 SMILES not-found falls back to name",
  /looksLikeSmiles/.test(serverPubchem) &&
    /compound\/name\/\$\{encodeURIComponent/.test(serverPubchem) &&
    /notFound/.test(serverPubchem)
);
ok(
  "SEARCH-09 browser SMILES 400\/404 falls back to name",
  /looksLikeSmiles\(t\) && \(r\.status === 404 \|\| r\.status === 400\)/.test(
    browser
  )
);
ok(
  "SEARCH-09 multi-source skips name fan-out for SMILES\/InChI",
  /classifyChemicalQuery/.test(multi) &&
    /kind === "smiles" \|\| kind === "inchi"/.test(multi) &&
    /name APIs were not queried/.test(multi)
);
ok(
  "SEARCH-09 numbered-name Enter still uses highlight",
  qk.resolveSearchSubmit("2-prop", { value: "2-propanol" }).value ===
    "2-propanol"
);

console.log(`\n${passed} search-contract checks passed`);
