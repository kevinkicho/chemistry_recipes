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

async function loadCompareWarm() {
  const srcFile = path.join(src, "lib/dossier/compareWarmStatus.ts");
  const source = fs.readFileSync(srcFile, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcFile,
  });
  const out = path.join(tmpdir(), `compareWarm-${process.pid}.mjs`);
  fs.writeFileSync(out, outputText, "utf8");
  return import(pathToFileURL(out).href);
}

async function loadSearchHonesty() {
  const srcFile = path.join(src, "lib/search/searchHonesty.ts");
  const source = fs.readFileSync(srcFile, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcFile,
  });
  const out = path.join(tmpdir(), `searchHonesty-${process.pid}.mjs`);
  fs.writeFileSync(out, outputText, "utf8");
  return import(pathToFileURL(out).href);
}

async function loadNeighborDensify() {
  const srcFile = path.join(src, "lib/frontier/neighborDensifyStatus.ts");
  const source = fs.readFileSync(srcFile, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcFile,
  });
  const out = path.join(tmpdir(), `neighborDensify-${process.pid}.mjs`);
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
const comparePage = read("app/compare/page.tsx");
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
  "SEARCH-09 multi-source skips name fan-out for structure-only queries",
  /classifyChemicalQuery/.test(multi) &&
    /isStructureOnlyQuery/.test(multi) &&
    /name APIs were not queried/.test(multi)
);
ok(
  "SEARCH-09 numbered-name Enter still uses highlight",
  qk.resolveSearchSubmit("2-prop", { value: "2-propanol" }).value ===
    "2-propanol"
);


ok(
  "SEARCH-10 normalize InChIKey= prefix (not SMILES)",
  qk.normalizeChemicalQuery("InChIKey=" + aspirinKey) === aspirinKey &&
    qk.classifyChemicalQuery("InChIKey=" + aspirinKey) === "inchikey" &&
    !qk.looksLikeSmiles(qk.normalizeChemicalQuery("InChIKey=" + aspirinKey))
);
ok(
  "SEARCH-10 normalize InChIKey: display form",
  qk.classifyChemicalQuery("InChIKey: " + aspirinKey) === "inchikey" &&
    qk.normalizeChemicalQuery("InChI Key: " + aspirinKey) === aspirinKey
);
ok(
  "SEARCH-10 normalize CID prefix and PubChem URL",
  qk.normalizeChemicalQuery("CID 2244") === "2244" &&
    qk.classifyChemicalQuery("CID: 2244") === "cid" &&
    qk.normalizeChemicalQuery(
      "https://pubchem.ncbi.nlm.nih.gov/compound/2244"
    ) === "2244"
);
ok(
  "SEARCH-10 normalize CAS RN / UNII prefixes and quotes",
  qk.normalizeChemicalQuery("CAS RN: 50-78-2") === "50-78-2" &&
    qk.classifyChemicalQuery("CAS 50-78-2") === "cas" &&
    qk.normalizeChemicalQuery("UNII: R16CO5Y76E") === "R16CO5Y76E" &&
    qk.classifyChemicalQuery('"50-78-2"') === "cas" &&
    qk.classifyChemicalQuery('"' + aspirinSmiles + '"') === "smiles"
);
ok(
  "SEARCH-10 prefixed InChIKey Enter submits key as written",
  qk.resolveSearchSubmit("InChIKey=" + aspirinKey, { value: "aspirin" })
    .value === aspirinKey
);
ok(
  "SEARCH-10 CID prefix Enter may keep compound href",
  qk.resolveSearchSubmit("CID 2244", {
    value: "2244",
    href: "/compounds/pubchem/2244",
  }).href === "/compounds/pubchem/2244"
);
ok(
  "SEARCH-10 name queries still names after normalize",
  qk.classifyChemicalQuery("aspirin") === "name" &&
    qk.classifyChemicalQuery("2-propanol") === "name" &&
    qk.isNameQuery("aspirin") &&
    !qk.isNameQuery("InChIKey=" + aspirinKey) &&
    !qk.isNameQuery("CID 2244")
);
ok(
  "SEARCH-10 structure-only kinds skip name fan-out",
  qk.isStructureOnlyQuery("smiles") &&
    qk.isStructureOnlyQuery("inchi") &&
    qk.isStructureOnlyQuery("inchikey") &&
    qk.isStructureOnlyQuery("cid") &&
    !qk.isStructureOnlyQuery("cas") &&
    !qk.isStructureOnlyQuery("unii") &&
    !qk.isStructureOnlyQuery("name")
);
ok(
  "SEARCH-10 resolvers normalize before PubChem lookup",
  /normalizeChemicalQuery/.test(serverPubchem) &&
    /normalizeChemicalQuery/.test(browser) &&
    /normalizeChemicalQuery/.test(multi) &&
    /normalizeChemicalQuery/.test(form)
);
ok(
  "SEARCH-10 SearchForm CID hint uses normalized CID",
  /normalizeChemicalQuery/.test(form) &&
    /PubChem CID · open compound/.test(form) &&
    /qNorm/.test(form)
);


ok(
  "SEARCH-11 normalize Canonical/Isomeric SMILES labels",
  qk.normalizeChemicalQuery("SMILES: " + aspirinSmiles) === aspirinSmiles &&
    qk.classifyChemicalQuery("Canonical SMILES: " + aspirinSmiles) === "smiles" &&
    qk.classifyChemicalQuery("Isomeric SMILES=C/C=C/C") === "smiles" &&
    qk.normalizeChemicalQuery("SMILES=" + aspirinSmiles) === aspirinSmiles
);
ok(
  "SEARCH-11 SMILES label Enter submits SMILES as written",
  qk.resolveSearchSubmit("SMILES: " + aspirinSmiles, { value: "aspirin" })
    .value === aspirinSmiles
);
ok(
  "SEARCH-11 InChI label prefix strips to InChI body",
  qk.normalizeChemicalQuery("InChI: " + aspirinInchi) === aspirinInchi &&
    qk.classifyChemicalQuery("InChI: " + aspirinInchi) === "inchi" &&
    qk.classifyChemicalQuery(aspirinInchi) === "inchi"
);
ok(
  "SEARCH-11 word smiles is still a name",
  qk.classifyChemicalQuery("smiles") === "name" &&
    qk.normalizeChemicalQuery("smiles") === "smiles"
);
ok(
  "SEARCH-11 parsePubchemCidQuery prefixes and URLs",
  qk.parsePubchemCidQuery("CID 2244") === 2244 &&
    qk.parsePubchemCidQuery("CID: 2244") === 2244 &&
    qk.parsePubchemCidQuery(
      "https://pubchem.ncbi.nlm.nih.gov/compound/2244"
    ) === 2244 &&
    qk.parsePubchemCidQuery("2244") === 2244 &&
    qk.parsePubchemCidQuery("aspirin") === null &&
    qk.parsePubchemCidQuery("50-78-2") === null
);
ok(
  "SEARCH-11 compare warms prefixed CID / PubChem URL",
  /parsePubchemCidQuery/.test(comparePage) &&
    /normalizeChemicalQuery/.test(comparePage)
);
ok(
  "SEARCH-11 SearchResults normalizes before CID fallback",
  /normalizeChemicalQuery/.test(results) &&
    /parsePubchemCidQuery/.test(results)
);


ok(
  "SEARCH-12 Wikipedia CAS Number / CAS No. / CAS-RN labels",
  qk.normalizeChemicalQuery("CAS Number: 50-78-2") === "50-78-2" &&
    qk.classifyChemicalQuery("CAS Number: 50-78-2") === "cas" &&
    qk.classifyChemicalQuery("CAS No. 50-78-2") === "cas" &&
    qk.classifyChemicalQuery("CAS-RN: 50-78-2") === "cas" &&
    qk.normalizeChemicalQuery("CAS No: 50-78-2") === "50-78-2" &&
    qk.classifyChemicalQuery("CAS RN: 50-78-2") === "cas"
);
ok(
  "SEARCH-12 PubChem name-slug URL is a name, not SMILES",
  qk.normalizeChemicalQuery(
    "https://pubchem.ncbi.nlm.nih.gov/compound/Aspirin"
  ) === "Aspirin" &&
    qk.classifyChemicalQuery(
      "https://pubchem.ncbi.nlm.nih.gov/compound/Aspirin"
    ) === "name" &&
    qk.parsePubchemCidQuery(
      "https://pubchem.ncbi.nlm.nih.gov/compound/Aspirin"
    ) === null &&
    !qk.looksLikeSmiles(
      qk.normalizeChemicalQuery(
        "https://pubchem.ncbi.nlm.nih.gov/compound/Aspirin"
      )
    )
);
ok(
  "SEARCH-12 PubChem CID URL and www/encoded name slug",
  qk.parsePubchemCidQuery(
    "https://www.pubchem.ncbi.nlm.nih.gov/compound/2244#section=Names"
  ) === 2244 &&
    qk.normalizeChemicalQuery(
      "https://pubchem.ncbi.nlm.nih.gov/compound/2-Propanol"
    ) === "2-Propanol" &&
    qk.classifyChemicalQuery(
      "https://pubchem.ncbi.nlm.nih.gov/compound/2-Propanol"
    ) === "name" &&
    qk.normalizeChemicalQuery(
      "https://pubchem.ncbi.nlm.nih.gov/compound/acetylsalicylic%20acid"
    ) === "acetylsalicylic acid"
);
ok(
  "SEARCH-12 CAS Number Enter submits CAS as written",
  qk.resolveSearchSubmit("CAS Number: 50-78-2", { value: "aspirin" })
    .value === "50-78-2"
);
ok(
  "SEARCH-12 name-slug URL Enter submits the compound name",
  qk.resolveSearchSubmit(
    "https://pubchem.ncbi.nlm.nih.gov/compound/Aspirin",
    null
  ).value === "Aspirin"
);
ok(
  "SEARCH-12 SearchForm name autocomplete uses normalized query",
  /fetchPubChemAutocomplete\(qNorm/.test(form) &&
    /encodeURIComponent\(qNorm\)/.test(form)
);

ok(
  "SEARCH-13 compare uses formatCompareWarmStatus",
  /formatCompareWarmStatus/.test(comparePage) &&
    /ok: Boolean\(o\.dossier\)/.test(comparePage)
);
ok(
  "SEARCH-13 compare does not claim warm complete unconditionally",
  !/Warm complete — dual export ready when both sides loaded/.test(comparePage)
);
ok(
  "SEARCH-13 compare export alert matches one-or-both behavior",
  /Warm or open a live CID dossier first/.test(comparePage) &&
    !/Warm or open both live dossiers first/.test(comparePage)
);

const cw = await loadCompareWarm();
ok(
  "SEARCH-13 both sides ok",
  cw.formatCompareWarmStatus([
    { side: "A", cid: 2244, ok: true },
    { side: "B", cid: 3672, ok: true },
  ]) === "Warm complete — both sides loaded, dual export ready."
);
ok(
  "SEARCH-13 stream fail is not complete",
  /Warm failed/.test(
    cw.formatCompareWarmStatus([
      { side: "A", cid: 2244, ok: false, lastStatus: "Stream failed HTTP 503" },
    ])
  ) &&
    /503/.test(
      cw.formatCompareWarmStatus([
        { side: "A", cid: 2244, ok: false, lastStatus: "Stream failed HTTP 503" },
      ])
    ) &&
    !/dual export ready/.test(
      cw.formatCompareWarmStatus([
        { side: "A", cid: 2244, ok: false, lastStatus: "Stream failed HTTP 503" },
      ])
    )
);
ok(
  "SEARCH-13 partial warm reports fail",
  /Warm partial/.test(
    cw.formatCompareWarmStatus([
      { side: "A", cid: 2244, ok: true },
      { side: "B", cid: 3672, ok: false, lastStatus: "Stream failed CID 3672" },
    ])
  )
);


ok(
  "SEARCH-14 CID= and Compound CID are CIDs not SMILES",
  qk.normalizeChemicalQuery("CID=2244") === "2244" &&
    qk.classifyChemicalQuery("CID=2244") === "cid" &&
    qk.parsePubchemCidQuery("CID=2244") === 2244 &&
    qk.classifyChemicalQuery("Compound CID: 2244") === "cid" &&
    qk.parsePubchemCidQuery("PubChem Compound CID: 2244") === 2244 &&
    qk.parsePubchemCidQuery("pubchem cid=2244") === 2244 &&
    !qk.looksLikeSmiles(qk.normalizeChemicalQuery("CID=2244"))
);
ok(
  "SEARCH-14 CAS= / CAS ID / CAS Number[n] are CAS not SMILES",
  qk.normalizeChemicalQuery("CAS=50-78-2") === "50-78-2" &&
    qk.classifyChemicalQuery("CAS=50-78-2") === "cas" &&
    qk.classifyChemicalQuery("CAS ID: 50-78-2") === "cas" &&
    qk.classifyChemicalQuery("CAS numbers: 50-78-2") === "cas" &&
    qk.normalizeChemicalQuery("CAS Number[1]: 50-78-2") === "50-78-2" &&
    qk.classifyChemicalQuery("CAS Number[1]: 50-78-2") === "cas" &&
    qk.classifyChemicalQuery("CAS registry no. 50-78-2") === "cas" &&
    qk.normalizeChemicalQuery("50-78-2[1]") === "50-78-2" &&
    !qk.looksLikeSmiles(qk.normalizeChemicalQuery("CAS=50-78-2"))
);
ok(
  "SEARCH-14 UNII= and InChIKey space prefix",
  qk.normalizeChemicalQuery("UNII=R16CO5Y76E") === "R16CO5Y76E" &&
    qk.classifyChemicalQuery("UNII=R16CO5Y76E") === "unii" &&
    !qk.looksLikeSmiles(qk.normalizeChemicalQuery("UNII=R16CO5Y76E")) &&
    qk.normalizeChemicalQuery("InChIKey " + aspirinKey) === aspirinKey &&
    qk.classifyChemicalQuery("InChIKey " + aspirinKey) === "inchikey"
);
ok(
  "SEARCH-14 PubChem #query= is a name, not SMILES",
  qk.normalizeChemicalQuery(
    "https://pubchem.ncbi.nlm.nih.gov/#query=aspirin"
  ) === "aspirin" &&
    qk.classifyChemicalQuery(
      "https://pubchem.ncbi.nlm.nih.gov/#query=aspirin"
    ) === "name" &&
    qk.normalizeChemicalQuery(
      "https://pubchem.ncbi.nlm.nih.gov/#query=CID%3D2244"
    ) === "2244" &&
    qk.parsePubchemCidQuery(
      "https://pubchem.ncbi.nlm.nih.gov/#query=2244"
    ) === 2244 &&
    !qk.looksLikeSmiles(
      qk.normalizeChemicalQuery(
        "https://pubchem.ncbi.nlm.nih.gov/#query=aspirin"
      )
    )
);
ok(
  "SEARCH-14 Wikipedia /wiki/ title is a name, not SMILES",
  qk.normalizeChemicalQuery("https://en.wikipedia.org/wiki/Aspirin") ===
    "Aspirin" &&
    qk.classifyChemicalQuery("https://en.wikipedia.org/wiki/Aspirin") ===
      "name" &&
    qk.normalizeChemicalQuery(
      "https://en.wikipedia.org/wiki/Salicylic_acid"
    ) === "Salicylic acid" &&
    qk.classifyChemicalQuery(
      "https://en.m.wikipedia.org/wiki/2-Propanol"
    ) === "name" &&
    !qk.looksLikeSmiles(
      qk.normalizeChemicalQuery("https://en.wikipedia.org/wiki/Aspirin")
    )
);
ok(
  "SEARCH-14 equals CID Enter submits CID as written",
  qk.resolveSearchSubmit("CID=2244", { value: "aspirin" }).value === "2244" &&
    qk.resolveSearchSubmit("Compound CID: 2244", { value: "aspirin" })
      .value === "2244" &&
    qk.resolveSearchSubmit("CAS Number[1]: 50-78-2", { value: "aspirin" })
      .value === "50-78-2"
);
ok(
  "SEARCH-14 word smiles and plain names still names",
  qk.classifyChemicalQuery("smiles") === "name" &&
    qk.classifyChemicalQuery("aspirin") === "name" &&
    qk.normalizeChemicalQuery("smiles") === "smiles"
);

ok(
  "SEARCH-15 Standard InChI / StdInChI labels compact to InChI (not name/SMILES)",
  qk.normalizeChemicalQuery("Standard InChI: " + aspirinInchi) === aspirinInchi &&
    qk.classifyChemicalQuery("Standard InChI: " + aspirinInchi) === "inchi" &&
    qk.classifyChemicalQuery("StdInChI: " + aspirinInchi) === "inchi" &&
    qk.classifyChemicalQuery("Std. InChI " + aspirinInchi) === "inchi" &&
    !qk.looksLikeSmiles(qk.normalizeChemicalQuery("Standard InChI: " + aspirinInchi))
);
ok(
  "SEARCH-15 Standard InChIKey / StdInChIKey labels",
  qk.normalizeChemicalQuery("Standard InChIKey: " + aspirinKey) === aspirinKey &&
    qk.classifyChemicalQuery("Standard InChIKey: " + aspirinKey) === "inchikey" &&
    qk.classifyChemicalQuery("StdInChIKey: " + aspirinKey) === "inchikey" &&
    qk.normalizeChemicalQuery("Std. InChIKey " + aspirinKey) === aspirinKey &&
    qk.normalizeChemicalQuery("InChIKey: " + aspirinKey + "[1]") === aspirinKey
);
ok(
  "SEARCH-15 InChI wrapping spaces and labeled body spaces compact",
  qk.normalizeChemicalQuery(aspirinInchi.replace("C9H8O4", "C9H8O4 ")) ===
    aspirinInchi &&
    qk.classifyChemicalQuery("InChI: " + aspirinInchi.replace("/", "/ ")) ===
      "inchi" &&
    qk.normalizeChemicalQuery("InChI = 1S/CH4/h1H4") === "InChI=1S/CH4/h1H4" &&
    qk.classifyChemicalQuery("InChI = 1S/CH4/h1H4") === "inchi"
);
ok(
  "SEARCH-15 DOI and doi.org are names, not SMILES",
  qk.normalizeChemicalQuery("https://doi.org/10.1038/nature12373") ===
    "10.1038/nature12373" &&
    qk.normalizeChemicalQuery("DOI: 10.1021/ja00001a001") ===
      "10.1021/ja00001a001" &&
    qk.classifyChemicalQuery("10.1038/nature12373") === "name" &&
    qk.classifyChemicalQuery("https://dx.doi.org/10.1038/nchem.123") ===
      "name" &&
    qk.looksLikeDoi("10.1038/nature12373") &&
    !qk.looksLikeSmiles("10.1038/nature12373") &&
    !qk.looksLikeSmiles(
      qk.normalizeChemicalQuery("https://doi.org/10.1038/nature12373")
    ) &&
    !qk.isStructureOnlyQuery(qk.classifyChemicalQuery("10.1038/nature12373"))
);
ok(
  "SEARCH-15 ChEBI labels and EBI URLs normalize to CHEBI:n (not SMILES)",
  qk.normalizeChemicalQuery("ChEBI:15365") === "CHEBI:15365" &&
    qk.normalizeChemicalQuery("ChEBI ID: 15365") === "CHEBI:15365" &&
    qk.normalizeChemicalQuery("CHEBI:CHEBI:15365") === "CHEBI:15365" &&
    qk.normalizeChemicalQuery(
      "https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:15365"
    ) === "CHEBI:15365" &&
    qk.classifyChemicalQuery("ChEBI ID: 15365") === "name" &&
    qk.looksLikeChebi("CHEBI:15365") &&
    !qk.looksLikeSmiles(qk.normalizeChemicalQuery("CHEBI:15365"))
);
ok(
  "SEARCH-15 EC Number / EINECS labels are names, not CAS or SMILES",
  qk.normalizeChemicalQuery("EC Number: 200-064-1") === "200-064-1" &&
    qk.classifyChemicalQuery("EC Number: 200-064-1") === "name" &&
    qk.classifyChemicalQuery("EINECS: 200-064-1") === "name" &&
    qk.normalizeChemicalQuery("European Community (EC) Number: 200-064-1") ===
      "200-064-1" &&
    qk.normalizeChemicalQuery("EC:1.1.1.1") === "1.1.1.1" &&
    qk.classifyChemicalQuery("EC 1.1.1.1") === "name" &&
    !qk.looksLikeCas(qk.normalizeChemicalQuery("EC Number: 200-064-1")) &&
    !qk.looksLikeSmiles(qk.normalizeChemicalQuery("EC Number: 200-064-1"))
);
ok(
  "SEARCH-15 Standard InChI / DOI / ChEBI Enter submits normalized value",
  qk.resolveSearchSubmit("Standard InChI: " + aspirinInchi, { value: "aspirin" })
    .value === aspirinInchi &&
    qk.resolveSearchSubmit("DOI: 10.1038/nature12373", null).value ===
      "10.1038/nature12373" &&
    qk.resolveSearchSubmit("ChEBI ID: 15365", { value: "aspirin" }).value ===
      "CHEBI:15365" &&
    qk.resolveSearchSubmit("EC Number: 200-064-1", { value: "aspirin" })
      .value === "200-064-1"
);
ok(
  "SEARCH-15 prior identifiers still classify after new prefixes",
  qk.classifyChemicalQuery("CID=2244") === "cid" &&
    qk.classifyChemicalQuery("CAS=50-78-2") === "cas" &&
    qk.classifyChemicalQuery("smiles") === "name" &&
    qk.classifyChemicalQuery("aspirin") === "name" &&
    qk.classifyChemicalQuery(aspirinSmiles) === "smiles" &&
    qk.classifyChemicalQuery("2-propanol") === "name"
);

const scienceAgent = read("lib/frontier/scienceAgent.ts");
const sciencePanel = read("components/frontier/ScienceAgentPanel.tsx");
const batchPanel = read("components/frontier/BatchDensifyPanel.tsx");
ok(
  "SEARCH-16 science agent tracks neighbor densify failures",
  /neighborFailedCids/.test(scienceAgent) &&
    /neighborFailedCids\.push/.test(scienceAgent)
);
ok(
  "SEARCH-16 science panel uses formatNeighborDensifyStatus",
  /formatNeighborDensifyStatus/.test(sciencePanel) &&
    /fail: result\.neighborFailedCids/.test(sciencePanel)
);
ok(
  "SEARCH-16 science panel does not claim none-needed on fail",
  !/Neighbors densified: \$\{neighborCids\.join/.test(sciencePanel)
);
ok(
  "SEARCH-16 batch densify log has no success checkmark on fail",
  !/`✓ CID \$\{ev\.cid\}/.test(batchPanel)
);

const nd = await loadNeighborDensify();
ok(
  "SEARCH-16 neighbor fail is not none-needed",
  nd.formatNeighborDensifyStatus({
    requested: true,
    okCids: [],
    failCids: [3672],
  }) ===
    "Neighbor densify failed — CID 3672. Stream did not return a dossier." &&
    !/none needed/.test(
      nd.formatNeighborDensifyStatus({
        requested: true,
        okCids: [],
        failCids: [3672],
      })
    )
);
ok(
  "SEARCH-16 neighbor partial reports fail",
  /partial/.test(
    nd.formatNeighborDensifyStatus({
      requested: true,
      okCids: [2244],
      failCids: [3672],
    })
  ) &&
    /3672/.test(
      nd.formatNeighborDensifyStatus({
        requested: true,
        okCids: [2244],
        failCids: [3672],
      })
    )
);
ok(
  "SEARCH-16 neighbor off and none-available stay distinct from fail",
  nd.formatNeighborDensifyStatus({
    requested: false,
    okCids: [],
    failCids: [],
  }) === "Neighbor densify: off" &&
    nd.formatNeighborDensifyStatus({
      requested: true,
      okCids: [],
      failCids: [],
    }) === "Neighbor densify: none needed or none available" &&
    nd.formatNeighborDensifyStatus({
      requested: true,
      okCids: [2244],
      failCids: [],
    }) === "Neighbors densified: 2244"
);


ok(
  "SEARCH-17 DrugBank id/URL/prefix are names, not SMILES",
  qk.normalizeChemicalQuery("DB00945") === "DB00945" &&
    qk.classifyChemicalQuery("DB00945") === "name" &&
    qk.looksLikeDrugbank("DB00945") &&
    qk.looksLikeAccessionId("DB00945") &&
    !qk.looksLikeSmiles("DB00945") &&
    qk.normalizeChemicalQuery("DrugBank ID: DB00945") === "DB00945" &&
    qk.classifyChemicalQuery("DrugBank: DB00945") === "name" &&
    qk.normalizeChemicalQuery(
      "https://go.drugbank.com/drugs/DB00945"
    ) === "DB00945" &&
    qk.classifyChemicalQuery(
      "https://go.drugbank.com/drugs/DB00945"
    ) === "name" &&
    !qk.looksLikeSmiles(
      qk.normalizeChemicalQuery("https://go.drugbank.com/drugs/DB00945")
    ) &&
    !qk.isStructureOnlyQuery(qk.classifyChemicalQuery("DB00945"))
);
ok(
  "SEARCH-17 KEGG C00031 / URL / cpd: are names, not SMILES",
  qk.normalizeChemicalQuery("C00031") === "C00031" &&
    qk.classifyChemicalQuery("C00031") === "name" &&
    qk.looksLikeKegg("C00031") &&
    !qk.looksLikeSmiles("C00031") &&
    qk.normalizeChemicalQuery("KEGG Compound: C00031") === "C00031" &&
    qk.normalizeChemicalQuery("cpd:C00031") === "C00031" &&
    qk.normalizeChemicalQuery("https://www.kegg.jp/entry/C00031") ===
      "C00031" &&
    qk.classifyChemicalQuery("https://www.genome.jp/entry/C00031") ===
      "name" &&
    qk.classifyChemicalQuery("C1CCCCC1") === "smiles"
);
ok(
  "SEARCH-17 HMDB / MeSH / ATC are names, not SMILES",
  qk.normalizeChemicalQuery("HMDB0000122") === "HMDB0000122" &&
    qk.classifyChemicalQuery("HMDB0000122") === "name" &&
    qk.looksLikeHmdb("HMDB0000122") &&
    !qk.looksLikeSmiles("HMDB0000122") &&
    qk.normalizeChemicalQuery("HMDB ID: 0000122") === "HMDB0000122" &&
    qk.normalizeChemicalQuery(
      "https://hmdb.ca/metabolites/HMDB0000122"
    ) === "HMDB0000122" &&
    qk.normalizeChemicalQuery("MeSH: D001241") === "D001241" &&
    qk.classifyChemicalQuery("D001241") === "name" &&
    qk.looksLikeMesh("D001241") &&
    !qk.looksLikeKegg("D001241") &&
    !qk.looksLikeSmiles("D001241") &&
    qk.normalizeChemicalQuery(
      "https://meshb.nlm.nih.gov/record/ui?ui=D001241"
    ) === "D001241" &&
    qk.normalizeChemicalQuery("ATC code: N02BA01") === "N02BA01" &&
    qk.classifyChemicalQuery("N02BA01") === "name" &&
    qk.looksLikeAtc("N02BA01") &&
    !qk.looksLikeSmiles("N02BA01")
);
ok(
  "SEARCH-17 UN number is UN#### name, not CID or SMILES",
  qk.normalizeChemicalQuery("UN1993") === "UN1993" &&
    qk.classifyChemicalQuery("UN1993") === "name" &&
    qk.looksLikeUnNumber("UN1993") &&
    !qk.looksLikeSmiles("UN1993") &&
    qk.parsePubchemCidQuery("UN1993") === null &&
    qk.normalizeChemicalQuery("UN Number: 1993") === "UN1993" &&
    qk.classifyChemicalQuery("UN Number: 1993") === "name" &&
    qk.normalizeChemicalQuery("UN No. 1993") === "UN1993" &&
    qk.parsePubchemCidQuery("UN Number: 1993") === null &&
    qk.classifyChemicalQuery("1993") === "cid" &&
    qk.parsePubchemCidQuery("1993") === 1993 &&
    qk.classifyChemicalQuery("UNII=R16CO5Y76E") === "unii"
);
ok(
  "SEARCH-17 accession Enter submits id as written (not highlight/SMILES)",
  qk.resolveSearchSubmit("DB00945", { value: "aspirin" }).value ===
    "DB00945" &&
    qk.resolveSearchSubmit("DrugBank ID: DB00945", { value: "aspirin" })
      .value === "DB00945" &&
    qk.resolveSearchSubmit("C00031", { value: "glucose" }).value ===
      "C00031" &&
    qk.resolveSearchSubmit("https://go.drugbank.com/drugs/DB00945", null)
      .value === "DB00945" &&
    qk.resolveSearchSubmit("UN Number: 1993", { value: "1993" }).value ===
      "UN1993" &&
    qk.resolveSearchSubmit("ATC: N02BA01", { value: "aspirin" }).value ===
      "N02BA01"
);
ok(
  "SEARCH-17 prior identifiers still classify after accession ids",
  qk.classifyChemicalQuery("CID=2244") === "cid" &&
    qk.classifyChemicalQuery("CAS=50-78-2") === "cas" &&
    qk.classifyChemicalQuery("smiles") === "name" &&
    qk.classifyChemicalQuery("aspirin") === "name" &&
    qk.classifyChemicalQuery(aspirinSmiles) === "smiles" &&
    qk.classifyChemicalQuery("2-propanol") === "name" &&
    qk.classifyChemicalQuery("C/C=C/C") === "smiles" &&
    qk.classifyChemicalQuery("C9H8O4") === "name" &&
    qk.classifyChemicalQuery(aspirinInchi) === "inchi"
);


ok(
  "SEARCH-18 searchHonesty helper exists",
  exists("lib/search/searchHonesty.ts")
);
ok(
  "SEARCH-18 SearchResults reads PubChem failure/ok",
  /failure\?:/.test(results) &&
    /pubchemFailure/.test(results) &&
    /formatSearchNoHitsMessage/.test(results)
);
ok(
  "SEARCH-18 SearchResults keeps sourceStatus when fan-out is empty",
  /multiStatus = data\.sourceStatus/.test(results) &&
    /if \(multiStatus\.length\) setSourceStatus/.test(results)
);
ok(
  "SEARCH-18 multi-source note uses formatFanoutNote",
  /formatFanoutNote/.test(multi)
);

const honesty = await loadSearchHonesty();
ok(
  "SEARCH-18 PubChem failure is error not empty",
  honesty.formatSearchNoHitsMessage({
    pubchemFailure: "HTTP 503",
    pubchemOk: false,
  }).kind === "error" &&
    /Not an empty result/.test(
      honesty.formatSearchNoHitsMessage({
        pubchemFailure: "HTTP 503",
        pubchemOk: false,
      }).message
    )
);
ok(
  "SEARCH-18 genuine empty stays empty",
  honesty.formatSearchNoHitsMessage({
    pubchemOk: true,
    sourceStatus: [
      { source: "pubchem", ok: false, detail: "no hit" },
      { source: "chembl", ok: false, detail: "no hit" },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-18 all-source reject is fan-out failure",
  honesty.isFanoutUpstreamFailure([
    { source: "pubchem", ok: false, detail: "HTTP 503" },
    { source: "chembl", ok: false, detail: "TypeError: fetch failed" },
  ]) &&
    honesty.formatSearchNoHitsMessage({
      sourceStatus: [
        { source: "pubchem", ok: false, detail: "HTTP 503" },
        { source: "chembl", ok: false, detail: "TypeError: fetch failed" },
      ],
    }).kind === "error"
);
ok(
  "SEARCH-18 mixed empty+ok is not fan-out failure",
  !honesty.isFanoutUpstreamFailure([
    { source: "pubchem", ok: true, hitCount: 1 },
    { source: "chembl", ok: false, detail: "no hit" },
  ])
);
ok(
  "SEARCH-18 fan-out note splits empty vs failed",
  honesty.formatFanoutNote({
    okSources: ["pubchem"],
    sourceStatus: [
      { source: "pubchem", ok: true, hitCount: 1 },
      { source: "chembl", ok: false, detail: "no hit" },
    ],
  }).includes("returned empty") &&
    honesty
      .formatFanoutNote({
        okSources: ["pubchem"],
        sourceStatus: [
          { source: "pubchem", ok: true, hitCount: 1 },
          { source: "chembl", ok: false, detail: "HTTP 503" },
        ],
      })
      .includes("failed or timed out") &&
    honesty.formatFanoutNote({
      okSources: [],
      sourceStatus: [
        { source: "pubchem", ok: false, detail: "HTTP 503" },
        { source: "chembl", ok: false, detail: "timeout" },
      ],
    }) === "Free-public fan-out failed — not an empty result"
);


async function loadSectionHonesty() {
  const srcFile = path.join(src, "lib/dossier/sectionHonesty.ts");
  const source = fs.readFileSync(srcFile, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcFile,
  });
  const out = path.join(tmpdir(), `sectionHonesty-${process.pid}.mjs`);
  fs.writeFileSync(out, outputText, "utf8");
  return import(pathToFileURL(out).href);
}

ok(
  "SEARCH-19 sectionHonesty helper exists",
  exists("lib/dossier/sectionHonesty.ts")
);
const liveDossier = read("components/dossier/LiveMoleculeDossier.tsx");
ok(
  "SEARCH-19 live dossier uses formatSectionEmptyCopy",
  /formatSectionEmptyCopy/.test(liveDossier) &&
    /litEmpty/.test(liveDossier) &&
    /patentEmpty/.test(liveDossier) &&
    /annotationEmpty/.test(liveDossier)
);
ok(
  "SEARCH-19 literature/patents tables accept emptyMessage",
  /emptyMessage/.test(read("components/LiteratureTable.tsx")) &&
    /emptyMessage/.test(read("components/PatentsTable.tsx"))
);

const sectionH = await loadSectionHonesty();
ok(
  "SEARCH-19 literature all-fail is error not empty",
  sectionH.formatSectionEmptyCopy({
    family: "literature",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
      {
        endpointUrl: "https://api.openalex.org/works",
        ok: false,
        error: "timeout",
      },
    ],
  }).kind === "error" &&
    /Not an empty result/.test(
      sectionH.formatSectionEmptyCopy({
        family: "literature",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-19 literature genuine empty stays empty",
  sectionH.formatSectionEmptyCopy({
    family: "literature",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: true,
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-19 literature notFound is empty not error",
  sectionH.formatSectionEmptyCopy({
    family: "literature",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        notFound: true,
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-19 europepmc-pat fail is not literature error",
  sectionH.formatSectionEmptyCopy({
    family: "literature",
    fetchErrors: ["soft-fail · europepmc-pat: HTTP 503"],
  }).kind === "empty"
);
ok(
  "SEARCH-19 patent soft-fail is error",
  sectionH.formatSectionEmptyCopy({
    family: "patents",
    fetchErrors: ["soft-fail · patentsview: timeout"],
  }).kind === "error" &&
    /Patent sources failed/.test(
      sectionH.formatSectionEmptyCopy({
        family: "patents",
        fetchErrors: ["soft-fail · patentsview: timeout"],
      }).message
    )
);
ok(
  "SEARCH-19 mixed ok+fail is not a clean miss",
  sectionH.formatSectionEmptyCopy({
    family: "literature",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: true,
      },
      { endpointUrl: "https://api.openalex.org/works", ok: false, error: "HTTP 503" },
    ],
  }).kind === "error" &&
    /some free-public sources failed/.test(
      sectionH.formatSectionEmptyCopy({
        family: "literature",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: true,
          },
          { endpointUrl: "https://api.openalex.org/works", ok: false, error: "HTTP 503" },
        ],
      }).message
    )
);
ok(
  "SEARCH-19 annotation chembl fail is error; pubchem leftover is not",
  sectionH.formatSectionEmptyCopy({
    family: "annotations",
    traces: [
      { endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search", ok: false, error: "HTTP 502" },
    ],
  }).kind === "error" &&
    sectionH.formatSectionEmptyCopy({
      family: "annotations",
      traces: [
        { endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON", ok: false, error: "HTTP 503" },
      ],
    }).kind === "empty"
);

ok(
  "SEARCH-20 GHS heading timeout is error not empty",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: false,
        error: "timeout",
      },
    ],
  }).kind === "error" &&
    /Not an empty result/.test(
      sectionH.formatSectionEmptyCopy({
        family: "hazards",
        traces: [
          {
            endpointUrl:
              "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
            ok: false,
            error: "timeout",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-20 GHS heading 404 is empty not error",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: false,
        notFound: true,
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-20 leftover literature heading is not a GHS failure",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Literature",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-20 pubchem-view soft-fail is GHS/mfg/properties error",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    fetchErrors: ["soft-fail · pubchem-view: HTTP 503"],
  }).kind === "error" &&
    sectionH.formatSectionEmptyCopy({
      family: "manufacturing",
      fetchErrors: ["soft-fail · pubchem-view: HTTP 503"],
    }).kind === "error" &&
    sectionH.formatSectionEmptyCopy({
      family: "properties",
      fetchErrors: ["soft-fail · pubchem-view: HTTP 503"],
    }).kind === "error"
);
ok(
  "SEARCH-20 manufacturing heading timeout is error; identity leftover is not",
  sectionH.formatSectionEmptyCopy({
    family: "manufacturing",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Use+and+Manufacturing",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    sectionH.formatSectionEmptyCopy({
      family: "manufacturing",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularWeight/JSON",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).kind === "empty"
);
ok(
  "SEARCH-20 properties /property/ fail is error; GHS leftover is not",
  sectionH.formatSectionEmptyCopy({
    family: "properties",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularWeight,MolecularFormula/JSON",
        ok: false,
        error: "timeout",
      },
    ],
  }).kind === "error" &&
    sectionH.formatSectionEmptyCopy({
      family: "properties",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).kind === "empty"
);
ok(
  "SEARCH-20 classification fail is annotation error; identity leftover is not",
  sectionH.formatSectionEmptyCopy({
    family: "annotations",
    fetchErrors: ["soft-fail · pubchem-class: HTTP 503"],
  }).kind === "error" &&
    sectionH.formatSectionEmptyCopy({
      family: "annotations",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/classification/JSON",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).kind === "error"
);
ok(
  "SEARCH-20 genuine GHS/mfg/properties empty stays empty",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: true,
      },
    ],
  }).kind === "empty" &&
    sectionH.formatSectionEmptyCopy({
      family: "manufacturing",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Use+and+Manufacturing",
          ok: true,
        },
      ],
    }).kind === "empty" &&
    sectionH.formatSectionEmptyCopy({
      family: "properties",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularWeight/JSON",
          ok: true,
        },
      ],
    }).kind === "empty"
);


ok(
  "SEARCH-21 live dossier overview empty copy uses formatSectionEmptyCopy",
  /overviewEmpty/.test(liveDossier) &&
    /family: "overview"/.test(liveDossier) &&
    /\{overviewEmpty\.message\}/.test(liveDossier) &&
    !/Overview appears when PubChem description or Ollama synthesis is available/.test(
      liveDossier
    )
);
ok(
  "SEARCH-21 pharmacology heading timeout is overview error not empty",
  sectionH.formatSectionEmptyCopy({
    family: "overview",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Pharmacology+and+Biochemistry",
        ok: false,
        error: "timeout",
      },
    ],
  }).kind === "error" &&
    /Not an empty result/.test(
      sectionH.formatSectionEmptyCopy({
        family: "overview",
        traces: [
          {
            endpointUrl:
              "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Pharmacology+and+Biochemistry",
            ok: false,
            error: "timeout",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-21 overview heading 404 is empty not error",
  sectionH.formatSectionEmptyCopy({
    family: "overview",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Pharmacology+and+Biochemistry",
        ok: false,
        notFound: true,
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-21 leftover GHS heading is not an overview failure",
  sectionH.formatSectionEmptyCopy({
    family: "overview",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-21 leftover literature heading is not an overview failure",
  sectionH.formatSectionEmptyCopy({
    family: "overview",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Literature",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-21 leftover identity /property/ is not an overview failure",
  sectionH.formatSectionEmptyCopy({
    family: "overview",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularWeight/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-21 pubchem-view soft-fail is overview error",
  sectionH.formatSectionEmptyCopy({
    family: "overview",
    fetchErrors: ["soft-fail · pubchem-view: HTTP 503"],
  }).kind === "error"
);
ok(
  "SEARCH-21 genuine overview empty stays empty",
  sectionH.formatSectionEmptyCopy({
    family: "overview",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Pharmacology+and+Biochemistry",
        ok: true,
      },
    ],
  }).kind === "empty"
);


ok(
  "SEARCH-22 problem multi uses formatProblemSearchSummary",
  /formatProblemSearchSummary/.test(problemMulti) &&
    /failureDetailFromTraces/.test(problemMulti) &&
    /isFanoutUpstreamFailure/.test(problemMulti)
);
ok(
  "SEARCH-22 problem UI uses formatSearchNoHitsMessage",
  /formatSearchNoHitsMessage/.test(problemUi) &&
    /noHits\.kind === "error"/.test(problemUi)
);

ok(
  "SEARCH-22 literature HTTP fail is not a clean miss",
  honesty.failureDetailFromTraces([
    { ok: false, error: "HTTP 503" },
  ]) === "HTTP 503" &&
    honesty.failureDetailFromTraces([
      { ok: false, notFound: true, error: "Not found" },
    ]) === undefined &&
    honesty.failureDetailFromTraces([
      { ok: true },
    ]) === undefined
);
ok(
  "SEARCH-22 all-source problem fail is not empty counts",
  honesty.formatProblemSearchSummary({
    moleculeCount: 0,
    literatureCount: 0,
    sourceStatus: [
      { source: "multi-molecule", ok: false, detail: "HTTP 503" },
      { source: "europepmc", ok: false, detail: "timeout after 8000ms" },
    ],
  }) === "Free-public problem search failed — not an empty result"
);
ok(
  "SEARCH-22 genuine problem empty stays count copy",
  honesty.formatProblemSearchSummary({
    moleculeCount: 0,
    literatureCount: 0,
    sourceStatus: [
      { source: "multi-molecule", ok: false, detail: "no hit" },
      { source: "europepmc", ok: false, detail: "no hit" },
    ],
  }) === "0 multi-source molecules · 0 process papers"
);
ok(
  "SEARCH-22 mixed problem empty+fail is not a clean miss",
  honesty.formatProblemSearchSummary({
    moleculeCount: 0,
    literatureCount: 0,
    sourceStatus: [
      { source: "multi-molecule", ok: false, detail: "no hit" },
      { source: "europepmc", ok: false, detail: "HTTP 503" },
    ],
  }) === "No free-public problem hits; some sources failed"
);
ok(
  "SEARCH-22 problem hits keep counts when a sibling failed",
  honesty.formatProblemSearchSummary({
    moleculeCount: 2,
    literatureCount: 0,
    sourceStatus: [
      { source: "multi-molecule", ok: true, hitCount: 2 },
      { source: "europepmc", ok: false, detail: "HTTP 503" },
    ],
  }).includes("2 multi-source molecules") &&
    honesty
      .formatProblemSearchSummary({
        moleculeCount: 2,
        literatureCount: 0,
        sourceStatus: [
          { source: "multi-molecule", ok: true, hitCount: 2 },
          { source: "europepmc", ok: false, detail: "HTTP 503" },
        ],
      })
      .includes("some free sources failed")
);

ok(
  "SEARCH-23 clinicaltrials fail is annotation error; identity leftover is not",
  sectionH.formatSectionEmptyCopy({
    family: "annotations",
    fetchErrors: ["soft-fail · clinicaltrials: timeout"],
  }).kind === "error" &&
    sectionH.formatSectionEmptyCopy({
      family: "annotations",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).kind === "empty"
);
ok(
  "SEARCH-23 rhea / reactome harvest HTTP is annotation family",
  sectionH.isAnnotationSectionTrace(
    "https://www.rhea-db.org/rhea?query=aspirin"
  ) &&
    sectionH.isAnnotationSectionTrace(
      "https://reactome.org/ContentService/search/query?query=aspirin"
    ) &&
    !sectionH.isAnnotationSectionTrace(
      "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/Title/JSON"
    ) &&
    !sectionH.isAnnotationSectionTrace(
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=aspirin"
    )
);
ok(
  "SEARCH-23 annotation sourceRefs keep ChEMBL/Rhea, drop PubChem identity",
  sectionH.isAnnotationSourceRef({ type: "api", id: "chembl:CHEMBL25" }) &&
    sectionH.isAnnotationSourceRef({ type: "api", id: "rhea:2244" }) &&
    sectionH.isAnnotationSourceRef({ type: "api", id: "clinicaltrials:2244" }) &&
    !sectionH.isAnnotationSourceRef({ type: "api", id: "pubchem:2244" }) &&
    !sectionH.isAnnotationSourceRef({ type: "literature", id: "europepmc:123" })
);
ok(
  "SEARCH-23 live multi-source chip uses annotationTraces not all harvest HTTP",
  /traces=\{annotationTraces\}/.test(liveDossier) &&
    /sourceRefs=\{annotationSourceRefs\}/.test(liveDossier) &&
    !/title="Multi-source free APIs"[\s\S]{0,200}traces=\{traces\}/.test(
      liveDossier
    )
);

const identityUrl =
  "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/Title/JSON";
const litUrl = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=aspirin";
const ghsUrl =
  "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification";
const mfgUrl =
  "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Use+and+Manufacturing";
const chemblUrl = "https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=aspirin";
ok(
  "PROV-15 literature/mfg/GHS harvest is process-fact HTTP; identity leftover is not",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "PROV-15 tracesForProcessFactProvenance keeps family only",
  sectionH.tracesForProcessFactProvenance(
    [
      { endpointUrl: litUrl },
      { endpointUrl: identityUrl },
      { endpointUrl: ghsUrl },
    ],
    "literature"
  ).length === 1 &&
    sectionH.tracesForProcessFactProvenance(
      [
        { endpointUrl: litUrl },
        { endpointUrl: identityUrl },
        { endpointUrl: ghsUrl },
      ],
      "ghs"
    )[0].endpointUrl === ghsUrl &&
    sectionH.tracesForProcessFactProvenance(
      [{ endpointUrl: identityUrl }],
      "user-supplement"
    ).length === 0
);
ok(
  "PROV-15 process-fact sourceRefs keep lit/mfg/ghs, drop identity/chembl",
  sectionH.isProcessFactSourceRef({ type: "literature", id: "europepmc:123" }) &&
    sectionH.isProcessFactSourceRef({ type: "api", id: "pubchem-mfg:2244" }) &&
    sectionH.isProcessFactSourceRef({ type: "api", id: "pubchem-view-ghs:2244" }) &&
    !sectionH.isProcessFactSourceRef({ type: "api", id: "pubchem:2244" }) &&
    !sectionH.isProcessFactSourceRef({ type: "api", id: "chembl:CHEMBL25" })
);

const asideSrc = read("components/dossier/LiveDossierAside.tsx");
const unitOpPanel = read("components/UnitOpFillPanel.tsx");
ok(
  "PROV-16 environment/apparatus chips use plantTraces not leftover harvest HTTP",
  /traces=\{plantTraces\}/.test(asideSrc) &&
    /sourceRefs=\{plantSourceRefs\}/.test(asideSrc) &&
    /isProcessFactTrace/.test(asideSrc) &&
    /field="Plant environment baseline"[\s\S]{0,200}traces=\{plantTraces\}/.test(asideSrc) &&
    /field="Apparatus catalog"[\s\S]{0,200}traces=\{plantTraces\}/.test(asideSrc) &&
    !/field="Plant environment baseline"[\s\S]{0,200}traces=\{apiTraces\}/.test(asideSrc) &&
    !/field="Apparatus catalog"[\s\S]{0,200}traces=\{apiTraces\}/.test(asideSrc) &&
    !/field="Plant environment baseline"[\s\S]{0,200}pubchemCid=/.test(asideSrc) &&
    !/field="Apparatus catalog"[\s\S]{0,200}pubchemCid=/.test(asideSrc)
);
ok(
  "PROV-16 leftover PubChem identity is not plant environment/apparatus HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "PROV-17 process recipe / route / control-points chips use processFactTraces not leftover harvest HTTP",
  /traces=\{processFactTraces\}/.test(liveDossier) &&
    /sourceRefs=\{processFactSourceRefs\}/.test(liveDossier) &&
    /isProcessFactTrace/.test(liveDossier) &&
    /field="Process recipe"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    /field="Route compare"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    /<RoutePanel[\s\S]{0,400}traces=\{processFactTraces\}/.test(liveDossier) &&
    /<CriticalParametersBoard[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    !/field="Process recipe"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Route compare"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Process recipe"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="Route compare"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/<RoutePanel[\s\S]{0,400}pubchemCid=/.test(liveDossier) &&
    !/<CriticalParametersBoard[\s\S]{0,200}pubchemCid=/.test(liveDossier)
);
ok(
  "PROV-17 leftover PubChem identity is not process-recipe HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "PROV-18 related / unit-ops chips use processFactTraces not leftover harvest HTTP",
  /traces=\{processFactTraces\}/.test(liveDossier) &&
    /sourceRefs=\{processFactSourceRefs\}/.test(liveDossier) &&
    /isProcessFactTrace/.test(liveDossier) &&
    /field="Related materials"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    /field="Modality unit ops"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    !/field="Related materials"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Modality unit ops"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Related materials"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="Modality unit ops"[\s\S]{0,200}pubchemCid=/.test(liveDossier)
);
ok(
  "PROV-18 evidence-gaps chip uses plantTraces not leftover harvest HTTP",
  /field="Evidence gaps"[\s\S]{0,200}traces=\{plantTraces\}/.test(asideSrc) &&
    /sourceRefs=\{plantSourceRefs\}/.test(asideSrc) &&
    !/field="Evidence gaps"[\s\S]{0,200}traces=\{allTraces\}/.test(asideSrc) &&
    !/field="Evidence gaps"[\s\S]{0,200}pubchemCid=/.test(asideSrc)
);
ok(
  "PROV-18 leftover PubChem identity is not related/unit-op/gap HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "PROV-18 unit-op panel filters process-fact traces and does not live-fetch identity",
  /isProcessFactTrace/.test(unitOpPanel) &&
    /isProcessFactSourceRef/.test(unitOpPanel) &&
    /liveFetch=\{false\}/.test(unitOpPanel)
);

const processFraming = read("components/ProcessFramingBanner.tsx");
ok(
  "PROV-19 process-framing chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(processFraming) &&
    /isProcessFactSourceRef/.test(processFraming) &&
    /liveFetch=\{false\}/.test(processFraming) &&
    /field="Process framing"/.test(processFraming) &&
    /traces=\{traces\}/.test(processFraming) &&
    /sourceRefs=\{sourceRefs\}/.test(processFraming)
);
ok(
  "PROV-19 leftover PubChem identity is not process-framing HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
const conditionAtlas = read("components/frontier/ConditionAtlasPanel.tsx");
ok(
  "PROV-20 condition-atlas chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(conditionAtlas) &&
    /isProcessFactSourceRef/.test(conditionAtlas) &&
    /liveFetch=\{false\}/.test(conditionAtlas) &&
    /field="Condition atlas"/.test(conditionAtlas) &&
    /traces=\{traces\}/.test(conditionAtlas) &&
    /sourceRefs=\{sourceRefs\}/.test(conditionAtlas)
);
ok(
  "PROV-20 leftover PubChem identity is not condition-atlas HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
const operatorJobAid = read("components/OperatorJobAid.tsx");
ok(
  "PROV-21 operator-job-aid chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(operatorJobAid) &&
    /isProcessFactSourceRef/.test(operatorJobAid) &&
    /field="Operator job aid"/.test(operatorJobAid) &&
    /traces=\{traces\}/.test(operatorJobAid) &&
    /sourceRefs=\{sourceRefs\}/.test(operatorJobAid) &&
    !/field="Operator job aid"[\s\S]{0,200}pubchemCid=/.test(operatorJobAid)
);
ok(
  "PROV-21 leftover PubChem identity is not job-aid HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "SEARCH-24 process-facts panel uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("components/ProcessFactsPanel.tsx")) &&
    /factEmpty\.message/.test(read("components/ProcessFactsPanel.tsx")) &&
    !/No condition \/ unit-op atoms extracted from titles and abstracts yet\./.test(
      read("components/ProcessFactsPanel.tsx")
    )
);
ok(
  "SEARCH-24 literature harvest fail is process-facts error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-24 genuine process-facts empty stays extracted-yet copy",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: true,
      },
    ],
  }).kind === "empty" &&
    /extracted from titles and abstracts yet/.test(
      sectionH.formatProcessFactsEmptyCopy({ traces: [] }).message
    )
);
ok(
  "SEARCH-24 leftover PubChem identity is not a process-facts miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-24 leftover GHS heading fail is not a process-facts miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: false,
        error: "timeout",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-24 leftover ChEMBL annotation fail is not a process-facts miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-24 mixed lit fail + patent ok is not a clean miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
      {
        endpointUrl: "https://api.patentsview.org/patents/query",
        ok: true,
      },
    ],
  }).kind === "error" &&
    /Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
          {
            endpointUrl: "https://api.patentsview.org/patents/query",
            ok: true,
          },
        ],
      }).message
    )
);
const jobAidSrc = read("components/OperatorJobAid.tsx");
ok(
  "SEARCH-25 job-aid empty copy uses section honesty helpers",
  /formatSectionEmptyCopy/.test(jobAidSrc) &&
    /formatProcessFactsEmptyCopy/.test(jobAidSrc) &&
    /hazardEmpty\.message/.test(jobAidSrc) &&
    /sequenceEmpty\.kind === "error"/.test(jobAidSrc) &&
    !/No GHS hazard statements on file/.test(jobAidSrc)
);
ok(
  "SEARCH-25 GHS harvest fail is job-aid error not empty",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: false,
        error: "timeout",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatSectionEmptyCopy({
        family: "hazards",
        traces: [
          {
            endpointUrl:
              "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
            ok: false,
            error: "timeout",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-25 genuine GHS empty stays no-GHS-text copy",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: true,
      },
    ],
  }).kind === "empty" &&
    /No GHS text/.test(
      sectionH.formatSectionEmptyCopy({ family: "hazards", traces: [] }).message
    )
);
ok(
  "SEARCH-25 leftover PubChem identity is not a job-aid GHS miss",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-25 leftover ChEMBL annotation fail is not a job-aid GHS miss",
  sectionH.formatSectionEmptyCopy({
    family: "hazards",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-25 literature harvest fail is job-aid sequence error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-25 leftover identity is not a job-aid sequence miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
const mondayPack = read("components/MondayMorningPack.tsx");
ok(
  "PROV-22 monday-pack chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(mondayPack) &&
    /isProcessFactSourceRef/.test(mondayPack) &&
    /field="Monday pack"/.test(mondayPack) &&
    /traces=\{traces\}/.test(mondayPack) &&
    /sourceRefs=\{sourceRefs\}/.test(mondayPack) &&
    !/field="Monday pack"[\s\S]{0,200}pubchemCid=/.test(mondayPack)
);
ok(
  "PROV-22 leftover PubChem identity is not Monday-pack HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "SEARCH-26 monday-pack empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(mondayPack) &&
    /sequenceEmpty\.kind === "error"/.test(mondayPack) &&
    /sequenceEmpty\.message/.test(mondayPack)
);
ok(
  "SEARCH-26 literature harvest fail is monday-pack sequence error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-26 leftover identity is not a monday-pack sequence miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-26 leftover ChEMBL annotation fail is not a monday-pack sequence miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-26 genuine empty stays not-enough-density copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /Not enough public procedure density/.test(mondayPack)
);
ok(
  "SEARCH-27 condition-atlas empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(conditionAtlas) &&
    /atlasEmpty\.kind === "error"/.test(conditionAtlas) &&
    /atlasEmpty\.message/.test(conditionAtlas)
);
ok(
  "SEARCH-27 literature harvest fail is condition-atlas error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-27 leftover identity is not a condition-atlas miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-27 leftover ChEMBL annotation fail is not a condition-atlas miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-27 genuine empty stays no-conditions-extracted copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /No conditions extracted/.test(conditionAtlas)
);

const routePanel = read("components/RoutePanel.tsx");
ok(
  "SEARCH-28 route-panel empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(routePanel) &&
    /recipeEmpty\.kind === "error"/.test(routePanel) &&
    /recipeEmpty\.message/.test(routePanel) &&
    /fetchErrors=\{dossier\.fetchErrors\}/.test(liveDossier)
);
ok(
  "SEARCH-28 literature harvest fail is process-recipe error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-28 leftover identity is not a process-recipe miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-28 leftover ChEMBL annotation fail is not a process-recipe miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-28 genuine empty stays no-process-recipe copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /No process recipe yet/.test(routePanel)
);

const routeCompare = read("components/RouteCompare.tsx");
ok(
  "SEARCH-29 route-compare empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(routeCompare) &&
    /compareEmpty\.kind === "error"/.test(routeCompare) &&
    /compareEmpty\.message/.test(routeCompare) &&
    /<RouteCompare[\s\S]{0,250}traces=\{processFactTraces\}/.test(liveDossier) &&
    /<RouteCompare[\s\S]{0,250}fetchErrors=\{dossier\.fetchErrors\}/.test(liveDossier)
);
ok(
  "SEARCH-29 literature harvest fail is route-compare error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-29 leftover identity is not a route-compare miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-29 leftover ChEMBL annotation fail is not a route-compare miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-29 genuine empty stays no-process-routes copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /No process routes yet/.test(routeCompare)
);

const routeHypotheses = read("components/frontier/RouteHypothesesPanel.tsx");
ok(
  "PROV-23 route-hypotheses chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(routeHypotheses) &&
    /isProcessFactSourceRef/.test(routeHypotheses) &&
    /liveFetch=\{false\}/.test(routeHypotheses) &&
    /field="Route hypotheses"/.test(routeHypotheses) &&
    /traces=\{traces\}/.test(routeHypotheses) &&
    /sourceRefs=\{sourceRefs\}/.test(routeHypotheses)
);
ok(
  "PROV-23 leftover PubChem identity is not route-hypotheses HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "SEARCH-30 route-hypotheses empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(routeHypotheses) &&
    /hypoEmpty\.kind === "error"/.test(routeHypotheses) &&
    /hypoEmpty\.message/.test(routeHypotheses)
);
ok(
  "SEARCH-30 literature harvest fail is route-hypotheses error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-30 leftover identity is not a route-hypotheses miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-30 leftover ChEMBL annotation fail is not a route-hypotheses miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-30 genuine empty stays no-public-process-hypothesis copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /hyp-none/.test(routeHypotheses) &&
    /No public process hypothesis yet/.test(read("lib/frontier/routeHypotheses.ts"))
);

const problemUnitOp = read("components/ProblemUnitOpSearch.tsx");
ok(
  "PROV-24 unit-op-search chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(problemUnitOp) &&
    /isProcessFactSourceRef/.test(problemUnitOp) &&
    /liveFetch=\{false\}/.test(problemUnitOp) &&
    /field="Unit-op search"/.test(problemUnitOp) &&
    /traces=\{traces\}/.test(problemUnitOp) &&
    /sourceRefs=\{sourceRefs\}/.test(problemUnitOp)
);
ok(
  "PROV-24 leftover PubChem identity is not unit-op-search HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "SEARCH-31 unit-op-search empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(problemUnitOp) &&
    /factEmpty\.kind === "error"/.test(problemUnitOp) &&
    /factEmpty\.message/.test(problemUnitOp) &&
    !/No process facts yet\./.test(problemUnitOp)
);
ok(
  "SEARCH-31 literature harvest fail is unit-op-search error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-31 leftover identity is not a unit-op-search miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-31 leftover ChEMBL annotation fail is not a unit-op-search miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-31 genuine empty stays extracted-yet copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /extracted from titles and abstracts yet/.test(
      sectionH.formatProcessFactsEmptyCopy({ traces: [] }).message
    )
);
ok(
  "SEARCH-31 query filter uses harvest empty-vs-error not clean miss",
  /litEmpty\.kind === "error"/.test(problemUnitOp) &&
    /patentEmpty\.kind === "error"/.test(problemUnitOp) &&
    /formatSectionEmptyCopy/.test(problemUnitOp)
);

const managerBrief = read("components/ManagerBriefPanel.tsx");
ok(
  "SEARCH-32 manager-brief empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(managerBrief) &&
    /formatSectionEmptyCopy/.test(managerBrief) &&
    /pathEmpty\.kind === "error"/.test(managerBrief) &&
    /patentEmpty\.kind === "error"/.test(managerBrief) &&
    /hazardEmpty\.kind === "error"/.test(managerBrief) &&
    /pathEmpty\.message/.test(managerBrief)
);
ok(
  "SEARCH-32 literature harvest fail is manager-brief path error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-32 leftover identity is not a manager-brief path miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-32 leftover ChEMBL annotation fail is not a manager-brief path miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-32 genuine empty stays await-literature copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /Await process literature\/patents/.test(managerBrief)
);
ok(
  "SEARCH-32 patent harvest fail is manager-brief IP error not empty",
  sectionH.formatSectionEmptyCopy({
    family: "patents",
    traces: [
      {
        endpointUrl: "https://search.patentsview.org/api/v1/patent/",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /patentEmpty\.message/.test(managerBrief)
);
ok(
  "SEARCH-32 leftover identity is not a manager-brief patent miss",
  sectionH.formatSectionEmptyCopy({
    family: "patents",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-32 manager-brief chips still pass all traces (composite)",
  /field="Manager brief"/.test(managerBrief) &&
    /traces=\{slimTraces\(dossier\.traces/.test(managerBrief) &&
    /sourceRefs=\{dossier\.sourceRefs\}/.test(managerBrief)
);

async function loadTocNavigate() {
  const srcFile = path.join(src, "lib/tocNavigate.ts");
  const source = fs.readFileSync(srcFile, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcFile,
  });
  const out = path.join(tmpdir(), `tocNavigate-${process.pid}.mjs`);
  fs.writeFileSync(out, outputText, "utf8");
  return import(pathToFileURL(out).href);
}

const tocNav = await loadTocNavigate();
const toc = read("components/TableOfContents.tsx");
const collapsible = read("components/CollapsibleSection.tsx");
const aside = read("components/dossier/LiveDossierAside.tsx");

ok(
  "SEARCH-33 TOC chrome uses harvestFailed not unconditional no-content-yet",
  /harvestFailed/.test(toc) &&
    /Sources failed — not empty/.test(toc) &&
    /item\.harvestFailed/.test(toc) &&
    /data-toc-error/.test(toc)
);
ok(
  "SEARCH-33 CollapsibleSection harvest failure is not empty badge",
  /harvestFailed/.test(collapsible) &&
    /data-toc-error/.test(collapsible) &&
    /failed/.test(collapsible)
);
ok(
  "SEARCH-33 live dossier TOC flags literature/patents/annotations/mfg harvest failure",
  /harvestFailed=\{litEmpty\.kind === "error"\}/.test(liveDossier) &&
    /harvestFailed=\{patentEmpty\.kind === "error"\}/.test(liveDossier) &&
    /harvestFailed=\{annotationEmpty\.kind === "error"\}/.test(liveDossier) &&
    /harvestFailed=\{mfgEmpty\.kind === "error"\}/.test(liveDossier) &&
    /tocSectionFlags/.test(liveDossier) &&
    /formatProcessFactsEmptyCopy/.test(liveDossier)
);
ok(
  "SEARCH-33 aside TOC flags manufacturing/hazards/properties harvest failure",
  /tocSectionFlags/.test(aside) &&
    /mfgToc/.test(aside) &&
    /hazardToc/.test(aside) &&
    /propertyToc/.test(aside) &&
    /data-toc-error=\{mfgToc\.error\}/.test(aside)
);

const litFail = {
  endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
  ok: false,
  error: "HTTP 503",
};
const identityFail = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
  ok: false,
  error: "HTTP 503",
};
const chemblFail = {
  endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
  ok: false,
  error: "HTTP 502",
};

ok(
  "SEARCH-33 literature harvest fail is TOC content not empty",
  sectionH.tocHasSectionContent({
    hasHits: false,
    emptyCopy: sectionH.formatSectionEmptyCopy({
      family: "literature",
      traces: [litFail],
    }),
  }) === true &&
    sectionH.tocSectionFlags({
      hasHits: false,
      emptyCopy: sectionH.formatSectionEmptyCopy({
        family: "literature",
        traces: [litFail],
      }),
    }).error === "1"
);
ok(
  "SEARCH-33 leftover identity is not a TOC literature miss",
  sectionH.tocHasSectionContent({
    hasHits: false,
    emptyCopy: sectionH.formatSectionEmptyCopy({
      family: "literature",
      traces: [identityFail],
    }),
  }) === false &&
    sectionH.tocSectionFlags({
      hasHits: false,
      emptyCopy: sectionH.formatSectionEmptyCopy({
        family: "literature",
        traces: [identityFail],
      }),
    }).empty === "1"
);
ok(
  "SEARCH-33 leftover ChEMBL annotation fail is not a TOC literature miss",
  sectionH.tocSectionFlags({
    hasHits: false,
    emptyCopy: sectionH.formatSectionEmptyCopy({
      family: "literature",
      traces: [chemblFail],
    }),
  }).empty === "1"
);
ok(
  "SEARCH-33 genuine empty stays TOC empty",
  sectionH.tocSectionFlags({
    hasHits: false,
    emptyCopy: sectionH.formatSectionEmptyCopy({ family: "literature", traces: [] }),
  }).empty === "1" &&
    sectionH.tocHasSectionContent({
      hasHits: false,
      emptyCopy: sectionH.formatSectionEmptyCopy({ family: "literature", traces: [] }),
    }) === false
);
ok(
  "SEARCH-33 process-recipe harvest fail is TOC content not empty",
  sectionH.tocSectionFlags({
    hasHits: false,
    emptyCopy: sectionH.formatProcessFactsEmptyCopy({ traces: [litFail] }),
  }).error === "1"
);
ok(
  "SEARCH-33 leftover identity is not a process-recipe TOC miss",
  sectionH.tocSectionFlags({
    hasHits: false,
    emptyCopy: sectionH.formatProcessFactsEmptyCopy({ traces: [identityFail] }),
  }).empty === "1"
);
ok(
  "SEARCH-33 interpretTocFlags data-toc-error is harvest failure not empty",
  tocNav.interpretTocFlags({
    present: true,
    tocEmpty: "1",
    tocError: "1",
    text: "Literature",
  }).harvestFailed === true &&
    tocNav.interpretTocFlags({
      present: true,
      tocEmpty: "1",
      tocError: "1",
      text: "Literature",
    }).hasContent === true
);
ok(
  "SEARCH-33 interpretTocFlags error copy wins over data-toc-empty",
  tocNav.interpretTocFlags({
    present: true,
    tocEmpty: "1",
    text: "Sources failed — not empty",
  }).harvestFailed === true
);
ok(
  "SEARCH-33 interpretTocFlags genuine empty stays no-content-yet",
  tocNav.interpretTocFlags({
    present: true,
    tocEmpty: "1",
    text: "No hits",
  }).hasContent === false &&
    tocNav.interpretTocFlags({
      present: true,
      tocEmpty: "1",
      text: "No hits",
    }).harvestFailed === false
);


const critique = read("components/EvidenceCritiquePanel.tsx");
ok(
  "SEARCH-34 critique empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(critique) &&
    /windowsEmpty\.kind === "error"/.test(critique) &&
    /windowsEmpty\.message/.test(critique)
);
ok(
  "SEARCH-34 literature harvest fail is critique error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-34 leftover identity is not a critique miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-34 leftover ChEMBL annotation fail is not a critique miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-34 genuine empty stays no-procedure-windows copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /No procedure windows densified/.test(critique)
);
ok(
  "SEARCH-34 critique chips still pass all traces (composite)",
  /field="Critique"/.test(critique) &&
    /traces=\{allTraces\}/.test(critique) &&
    /sourceRefs=\{dossier\.sourceRefs\}/.test(critique)
);


const scienceQa = read("lib/frontier/evidenceQa.ts");
const evidenceSciencePanel = read("components/frontier/EvidenceSciencePanel.tsx");
ok(
  "SEARCH-35 science-QA empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(scienceQa) &&
    /honestScienceQaAnswer/.test(scienceQa) &&
    /harvest\.kind === "error"/.test(scienceQa)
);
ok(
  "SEARCH-35 literature harvest fail is science-QA error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-35 leftover identity is not a science-QA miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-35 leftover ChEMBL annotation fail is not a science-QA miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-35 genuine empty stays no-route-hypotheses copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /No route hypotheses assembled/.test(scienceQa)
);
ok(
  "SEARCH-35 science chips still pass all traces (composite)",
  /field="Evidence science Q&A"/.test(evidenceSciencePanel) &&
    /dossier=\{dossier\}/.test(evidenceSciencePanel) &&
    /composite Q&A/.test(evidenceSciencePanel)
);


const litDepthSrc = read("lib/frontier/literatureDepth.ts");
ok(
  "SEARCH-36 literature-depth empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(litDepthSrc) &&
    /honestLiteratureDepthSummary/.test(litDepthSrc) &&
    /harvest\.kind === "error"/.test(litDepthSrc)
);
ok(
  "SEARCH-36 literature harvest fail is literature-depth error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-36 leftover identity is not a literature-depth miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-36 leftover ChEMBL annotation fail is not a literature-depth miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-36 genuine empty stays no-procedure-scored-windows copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /No procedure-scored free-public windows yet/.test(litDepthSrc)
);
ok(
  "SEARCH-36 science panel shows literature-depth harvest empty copy",
  /litDepth\.totalWindows === 0/.test(evidenceSciencePanel) &&
    /litDepth\.summary/.test(evidenceSciencePanel) &&
    /literature-depth miss/.test(evidenceSciencePanel)
);
ok(
  "SEARCH-36 science chips still pass all traces (composite)",
  /field="Evidence science Q&A"/.test(evidenceSciencePanel) &&
    /dossier=\{dossier\}/.test(evidenceSciencePanel)
);


const reactionNetSrc = read("lib/frontier/reactionNetwork.ts");
const reactionNetPanel = read("components/frontier/ReactionNetworkPanel.tsx");
const neighborGraphSrc = read("lib/frontier/neighborDensifyGraph.ts");
ok(
  "SEARCH-37 reaction-network empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(reactionNetSrc) &&
    /honestReactionNetworkSummary/.test(reactionNetSrc) &&
    /harvest\.kind === "error"/.test(reactionNetSrc)
);
ok(
  "SEARCH-37 literature harvest fail is reaction-network error not empty",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "error" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.formatProcessFactsEmptyCopy({
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).message
    )
);
ok(
  "SEARCH-37 leftover identity is not a reaction-network miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-37 leftover ChEMBL annotation fail is not a reaction-network miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).kind === "empty"
);
ok(
  "SEARCH-37 genuine empty stays center-only copy",
  sectionH.formatProcessFactsEmptyCopy({ traces: [] }).kind === "empty" &&
    /Network is center-only/.test(reactionNetSrc)
);
ok(
  "SEARCH-37 panel overlays harvest empty copy on cached center-only network",
  /networkEmpty\.kind === "error"/.test(reactionNetPanel) &&
    /networkSummary/.test(reactionNetPanel) &&
    /isCenterOnly/.test(reactionNetPanel) &&
    /reaction-network miss/.test(reactionNetPanel)
);
ok(
  "SEARCH-37 neighbor queue harvest fail is not clean CID miss",
  /formatProcessFactsEmptyCopy/.test(neighborGraphSrc) &&
    /harvest\.kind === "error"/.test(neighborGraphSrc) &&
    /No related PubChem CIDs for densify queue/.test(neighborGraphSrc)
);
ok(
  "SEARCH-37 network chips still pass all traces (composite)",
  /field="Reaction network"/.test(reactionNetPanel) &&
    /dossier=\{dossier\}/.test(reactionNetPanel)
);


const scaffoldSrc = read("lib/dossier/scaffold.ts");
const processFactsSrc = read("lib/dossier/processFacts.ts");
const mondayPack38 = read("components/MondayMorningPack.tsx");
const jobAid38 = read("components/OperatorJobAid.tsx");
const routePanel38 = read("components/RoutePanel.tsx");
const routeCompare38 = read("components/RouteCompare.tsx");
const manager38 = read("components/ManagerBriefPanel.tsx");
ok(
  "SEARCH-38 process-sequence stub uses honestProcessSequenceStub",
  /honestProcessSequenceStub/.test(scaffoldSrc) &&
    /honestProcessSequenceStub/.test(processFactsSrc) &&
    /export function honestProcessSequenceStub/.test(
      read("lib/dossier/sectionHonesty.ts")
    )
);
ok(
  "SEARCH-38 literature harvest fail is process-sequence error not empty",
  /Sources failed|some sources failed/.test(
    sectionH.honestProcessSequenceStub({
      name: "Aspirin",
      kind: "scaffold",
      traces: [
        {
          endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).title
  ) &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.honestProcessSequenceStub({
        name: "Aspirin",
        kind: "scaffold",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).description
    ) &&
    !/retrieved yet|did not yield/.test(
      sectionH.honestProcessSequenceStub({
        name: "Aspirin",
        kind: "scaffold",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).description
    )
);
ok(
  "SEARCH-38 leftover identity is not a process-sequence miss",
  sectionH.honestProcessSequenceStub({
    name: "Aspirin",
    kind: "scaffold",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).title === "Process route synthesis pending"
);
ok(
  "SEARCH-38 leftover ChEMBL annotation fail is not a process-sequence miss",
  sectionH.honestProcessSequenceStub({
    name: "Aspirin",
    kind: "facts",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).title === "No extractable public process sequence yet"
);
ok(
  "SEARCH-38 genuine empty stays retrieved-yet / not-extractable copy",
  sectionH.honestProcessSequenceStub({
    name: "Aspirin",
    kind: "scaffold",
    traces: [],
  }).title === "Process route synthesis pending" &&
    /retrieved yet/.test(
      sectionH.honestProcessSequenceStub({
        name: "Aspirin",
        kind: "scaffold",
        traces: [],
      }).description
    ) &&
    sectionH.honestProcessSequenceStub({
      name: "Aspirin",
      kind: "facts",
      traces: [],
    }).title === "No extractable public process sequence yet"
);
ok(
  "SEARCH-38 stub ids are recognized; leftover identity is not a stub miss",
  sectionH.isProcessSequenceStub({ id: "await-ai-1", title: "Process route synthesis pending" }) &&
    sectionH.isProcessSequenceStub({
      id: "await-facts-1",
      title: "No extractable public process sequence yet",
    }) &&
    sectionH.isStubOnlyProcessSequence([
      { id: "await-ai-1", title: "Process route synthesis pending" },
    ]) &&
    !sectionH.isProcessSequenceStub({ id: "lit-1", title: "Hydrogenation (public lead)" })
);
ok(
  "SEARCH-38 panels overlay harvest empty copy on cached stub-only sequence",
  /isStubOnlyProcessSequence/.test(mondayPack38) &&
    /showPreferredSteps/.test(mondayPack38) &&
    /isStubOnlyProcessSequence/.test(jobAid38) &&
    /showSequence/.test(jobAid38) &&
    /isStubOnlyProcessSequence/.test(routePanel38) &&
    /isStubOnlyProcessSequence/.test(routeCompare38) &&
    /isStubOnlyProcessSequence/.test(manager38) &&
    /showPreferredPath/.test(manager38)
);
ok(
  "SEARCH-38 leftover identity HTTP is not a process-sequence miss",
  sectionH.formatProcessFactsEmptyCopy({
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).kind === "empty"
);


const idealPageSrc = read("lib/dossier/idealPage.ts");
const idealPanelSrc = read("components/IdealPageParityPanel.tsx");
ok(
  "SEARCH-39 ideal-page empty copy uses honestIdealEmptyCopy",
  /honestIdealEmptyCopy/.test(idealPageSrc) &&
    /isStubOnlyProcessSequence/.test(idealPageSrc) &&
    /harvest-fail/.test(idealPageSrc) &&
    /harvest-fail/.test(idealPanelSrc) &&
    /export function honestIdealEmptyCopy/.test(
      read("lib/dossier/sectionHonesty.ts")
    )
);
ok(
  "SEARCH-39 literature harvest fail is ideal process-recipe error not empty",
  sectionH.honestIdealEmptyCopy({
    family: "process-facts",
    cleanDetail: "No process steps yet",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).harvestFail &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.honestIdealEmptyCopy({
        family: "process-facts",
        cleanDetail: "No process steps yet",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).detail
    ) &&
    !/No process steps yet/.test(
      sectionH.honestIdealEmptyCopy({
        family: "process-facts",
        cleanDetail: "No process steps yet",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).detail
    )
);
ok(
  "SEARCH-39 GHS harvest fail is ideal hazards error not No GHS text",
  sectionH.honestIdealEmptyCopy({
    family: "hazards",
    cleanDetail: "No GHS text for this CID",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).harvestFail &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.honestIdealEmptyCopy({
        family: "hazards",
        cleanDetail: "No GHS text for this CID",
        traces: [
          {
            endpointUrl:
              "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).detail
    ) &&
    !/No GHS text for this CID/.test(
      sectionH.honestIdealEmptyCopy({
        family: "hazards",
        cleanDetail: "No GHS text for this CID",
        traces: [
          {
            endpointUrl:
              "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).detail
    )
);
ok(
  "SEARCH-39 leftover identity is not an ideal-page GHS miss",
  sectionH.honestIdealEmptyCopy({
    family: "hazards",
    cleanDetail: "No GHS text for this CID",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).harvestFail === false &&
    sectionH.honestIdealEmptyCopy({
      family: "hazards",
      cleanDetail: "No GHS text for this CID",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).detail === "No GHS text for this CID"
);
ok(
  "SEARCH-39 leftover identity is not an ideal-page process-recipe miss",
  sectionH.honestIdealEmptyCopy({
    family: "process-facts",
    cleanDetail: "No process steps yet",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).harvestFail === false &&
    sectionH.honestIdealEmptyCopy({
      family: "process-facts",
      cleanDetail: "No process steps yet",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).detail === "No process steps yet"
);
ok(
  "SEARCH-39 leftover ChEMBL annotation fail is not an ideal-page miss",
  sectionH.honestIdealEmptyCopy({
    family: "process-facts",
    cleanDetail: "No process steps yet",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).detail === "No process steps yet"
);
ok(
  "SEARCH-39 genuine empty stays No process steps / No GHS text copy",
  sectionH.honestIdealEmptyCopy({
    family: "process-facts",
    cleanDetail: "No process steps yet",
    traces: [],
  }).detail === "No process steps yet" &&
    sectionH.honestIdealEmptyCopy({
      family: "hazards",
      cleanDetail: "No GHS text for this CID",
      traces: [],
    }).detail === "No GHS text for this CID" &&
    sectionH.honestIdealEmptyCopy({
      family: "overview",
      cleanDetail: "Missing process overview",
      traces: [],
    }).detail === "Missing process overview"
);
ok(
  "SEARCH-39 stub-only routes do not count as process-recipe fill",
  /isStubOnlyProcessSequence\(route\.steps\)/.test(idealPageSrc) &&
    /isStubOnlyProcessSequence\(r\.steps\)/.test(idealPageSrc)
);
ok(
  "SEARCH-39 ideal chips still pass all traces (composite)",
  /slimTraces\(dossier\.traces/.test(idealPanelSrc)
);

const techTransferSrc = read("lib/export/techTransfer.ts");
ok(
  "SEARCH-40 checklist empty copy uses honestChecklistGap",
  /honestChecklistGap/.test(techTransferSrc) &&
    /isStubOnlyProcessSequence/.test(techTransferSrc) &&
    /isProcessSequenceStub/.test(techTransferSrc) &&
    /export function honestChecklistGap/.test(
      read("lib/dossier/sectionHonesty.ts")
    )
);
ok(
  "SEARCH-40 literature harvest fail is checklist review not Gap",
  sectionH.honestChecklistGap({
    family: "process-facts",
    filled: false,
    cleanStatus: "gap",
    cleanNote: "No process facts",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).harvestFail &&
    sectionH.honestChecklistGap({
      family: "process-facts",
      filled: false,
      cleanStatus: "gap",
      cleanNote: "No process facts",
      traces: [
        {
          endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).status === "review" &&
    /Not an empty result|Not a clean miss/.test(
      sectionH.honestChecklistGap({
        family: "process-facts",
        filled: false,
        cleanStatus: "gap",
        cleanNote: "No process facts",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).note
    ) &&
    !/No process facts/.test(
      sectionH.honestChecklistGap({
        family: "process-facts",
        filled: false,
        cleanStatus: "gap",
        cleanNote: "No process facts",
        traces: [
          {
            endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            ok: false,
            error: "HTTP 503",
          },
        ],
      }).note
    )
);
ok(
  "SEARCH-40 GHS harvest fail is checklist EHS review not Gap",
  sectionH.honestChecklistGap({
    family: "hazards",
    filled: false,
    cleanStatus: "gap",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).harvestFail &&
    sectionH.honestChecklistGap({
      family: "hazards",
      filled: false,
      cleanStatus: "gap",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).status === "review"
);
ok(
  "SEARCH-40 leftover identity is not a checklist process-facts miss",
  sectionH.honestChecklistGap({
    family: "process-facts",
    filled: false,
    cleanStatus: "gap",
    cleanNote: "No process facts",
    traces: [
      {
        endpointUrl:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).harvestFail === false &&
    sectionH.honestChecklistGap({
      family: "process-facts",
      filled: false,
      cleanStatus: "gap",
      cleanNote: "No process facts",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).status === "gap" &&
    sectionH.honestChecklistGap({
      family: "process-facts",
      filled: false,
      cleanStatus: "gap",
      cleanNote: "No process facts",
      traces: [
        {
          endpointUrl:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).note === "No process facts"
);
ok(
  "SEARCH-40 leftover ChEMBL annotation fail is not a checklist miss",
  sectionH.honestChecklistGap({
    family: "process-facts",
    filled: false,
    cleanStatus: "gap",
    cleanNote: "No process facts",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
        ok: false,
        error: "HTTP 502",
      },
    ],
  }).status === "gap" &&
    sectionH.honestChecklistGap({
      family: "process-facts",
      filled: false,
      cleanStatus: "gap",
      cleanNote: "No process facts",
      traces: [
        {
          endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/search",
          ok: false,
          error: "HTTP 502",
        },
      ],
    }).note === "No process facts"
);
ok(
  "SEARCH-40 genuine empty stays Gap / No process facts copy",
  sectionH.honestChecklistGap({
    family: "process-facts",
    filled: false,
    cleanStatus: "gap",
    cleanNote: "No process facts",
    traces: [],
  }).status === "gap" &&
    sectionH.honestChecklistGap({
      family: "process-facts",
      filled: false,
      cleanStatus: "gap",
      cleanNote: "No process facts",
      traces: [],
    }).note === "No process facts" &&
    sectionH.honestChecklistGap({
      family: "hazards",
      filled: false,
      cleanStatus: "gap",
      traces: [],
    }).status === "gap"
);
ok(
  "SEARCH-40 filled checklist items stay ok despite harvest fail",
  sectionH.honestChecklistGap({
    family: "process-facts",
    filled: true,
    cleanStatus: "ok",
    cleanNote: "2 cond · 1 unit ops",
    traces: [
      {
        endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ok: false,
        error: "HTTP 503",
      },
    ],
  }).status === "ok" &&
    sectionH.honestChecklistGap({
      family: "process-facts",
      filled: true,
      cleanStatus: "ok",
      cleanNote: "2 cond · 1 unit ops",
      traces: [
        {
          endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
          ok: false,
          error: "HTTP 503",
        },
      ],
    }).harvestFail === false
);
ok(
  "SEARCH-40 stub-only routes do not count as checklist step fill",
  /isStubOnlyProcessSequence\(steps\)/.test(techTransferSrc) &&
    /isProcessSequenceStub/.test(techTransferSrc)
);
ok(
  "SEARCH-40 checklist chips still pass all traces (composite)",
  /FreePublicProvenance/.test(read("components/ValidationChecklist.tsx")) &&
    /dossier=\{dossier\}/.test(read("components/ValidationChecklist.tsx"))
);


async function loadRecipeReadiness() {
  const honestyFile = path.join(src, "lib/dossier/sectionHonesty.ts");
  const honestyOut = ts.transpileModule(fs.readFileSync(honestyFile, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: honestyFile,
  }).outputText;
  const honestyPath = path.join(tmpdir(), `sectionHonesty-rr-${process.pid}.mjs`);
  fs.writeFileSync(honestyPath, honestyOut, "utf8");

  const srcFile = path.join(src, "lib/dossier/recipeReadiness.ts");
  const { outputText } = ts.transpileModule(fs.readFileSync(srcFile, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcFile,
  });
  const rewritten = outputText.replace(
    /from ["']@\/lib\/dossier\/sectionHonesty["']/,
    `from ${JSON.stringify(pathToFileURL(honestyPath).href)}`
  );
  const out = path.join(tmpdir(), `recipeReadiness-${process.pid}.mjs`);
  fs.writeFileSync(out, rewritten, "utf8");
  return import(pathToFileURL(out).href);
}

const recipeReadinessSrc = read("lib/dossier/recipeReadiness.ts");
const recipePanelSrc = read("components/RecipeReadinessPanel.tsx");
ok(
  "SEARCH-41 recipe-readiness empty copy uses honestIdealEmptyCopy",
  /honestIdealEmptyCopy/.test(recipeReadinessSrc) &&
    /harvestFail/.test(recipeReadinessSrc) &&
    /family: "process-facts"/.test(recipeReadinessSrc)
);
ok(
  "SEARCH-41 withRecipeReadiness and fallbacks pass harvest traces",
  /traces: dossier\.traces/.test(recipeReadinessSrc) &&
    /fetchErrors: dossier\.fetchErrors/.test(recipeReadinessSrc) &&
    /traces: dossier\.traces/.test(recipePanelSrc) &&
    /traces: dossier\.traces/.test(read("components/MondayMorningPack.tsx")) &&
    /traces: dossier\.traces/.test(read("components/SiteGapsExport.tsx"))
);

const recipeH = await loadRecipeReadiness();

function recipeGaps(traces) {
  return recipeH.assessRecipeReadiness({ traces }).gaps;
}

const litFailGaps = recipeGaps([litFail]);
const condFail = litFailGaps.find((g) => g.id === "conditions");
const isoFail = litFailGaps.find((g) => g.id === "isolation");
const srcFail = litFailGaps.find((g) => g.id === "source-breadth");
const qmsFail = litFailGaps.find((g) => g.id === "site-qms");
ok(
  "SEARCH-41 literature harvest fail is recipe-readiness review not Only 0 atoms",
  condFail?.harvestFail &&
    isoFail?.harvestFail &&
    srcFail?.harvestFail &&
    /Not an empty result|Not a clean miss/.test(condFail?.detail || "") &&
    !/Only 0 sourced condition atom/.test(condFail?.detail || "") &&
    !/No isolation language/.test(isoFail?.detail || "") &&
    !/Only 0 literature/.test(srcFail?.detail || "")
);
ok(
  "SEARCH-41 leftover identity is not a recipe-readiness miss",
  recipeGaps([identityFail]).find((g) => g.id === "conditions")?.harvestFail !==
    true &&
    /Only 0 sourced condition atom/.test(
      recipeGaps([identityFail]).find((g) => g.id === "conditions")?.detail || ""
    )
);
ok(
  "SEARCH-41 leftover ChEMBL annotation fail is not a recipe-readiness miss",
  recipeGaps([chemblFail]).find((g) => g.id === "conditions")?.harvestFail !==
    true &&
    /Only 0 sourced condition atom/.test(
      recipeGaps([chemblFail]).find((g) => g.id === "conditions")?.detail || ""
    )
);
const emptyGaps = recipeGaps([]);
ok(
  "SEARCH-41 genuine empty stays Only 0 condition / No isolation copy",
  emptyGaps.find((g) => g.id === "conditions")?.harvestFail !== true &&
    /Only 0 sourced condition atom/.test(
      emptyGaps.find((g) => g.id === "conditions")?.detail || ""
    ) &&
    /No isolation language/.test(
      emptyGaps.find((g) => g.id === "isolation")?.detail || ""
    ) &&
    /Only 0 literature/.test(
      emptyGaps.find((g) => g.id === "source-breadth")?.detail || ""
    )
);
ok(
  "SEARCH-41 site-QMS gap stays site QMS despite harvest fail",
  /site QMS/.test(qmsFail?.detail || "") &&
    qmsFail?.harvestFail !== true &&
    /site QMS/.test(emptyGaps.find((g) => g.id === "site-qms")?.detail || "")
);
ok(
  "SEARCH-41 filled condition strength stays despite leftover identity fail",
  recipeH
    .assessRecipeReadiness({
      traces: [identityFail],
      processFacts: { sourcedConditionCount: 4, unitOpCount: 3, framing: "evidence-lead-pack" },
    })
    .gaps.every((g) => g.id !== "conditions") &&
    recipeH
      .assessRecipeReadiness({
        traces: [identityFail],
        processFacts: { sourcedConditionCount: 4, unitOpCount: 3, framing: "evidence-lead-pack" },
      })
      .strengths.some((s) => /4 sourced condition/.test(s))
);
ok(
  "SEARCH-41 recipe-readiness chips still pass all traces (composite)",
  /slimTraces\(dossier\.traces/.test(recipePanelSrc) &&
    /field="Recipe readiness"/.test(recipePanelSrc)
);
ok(
  "SEARCH-41 panel shows harvest-fail as review not blocker copy",
  /harvestFail \? "review"/.test(recipePanelSrc) ||
    /g\.harvestFail \? "review"/.test(recipePanelSrc)
);



const campaignBriefSrc = read("lib/frontier/campaignBrief.ts");
const campaignAgentSrc = read("lib/frontier/campaignAgent.ts");
ok(
  "SEARCH-42 campaign-brief empty copy uses honestCampaignBriefEmpty",
  /honestCampaignBriefEmpty/.test(campaignBriefSrc) &&
    /harvestFail/.test(campaignBriefSrc) &&
    /harvestEmpty\.harvestFail/.test(campaignBriefSrc)
);
ok(
  "SEARCH-42 campaign-agent empty copy uses honestCampaignAgentEmpty",
  /honestCampaignAgentEmpty/.test(campaignAgentSrc) &&
    /Insufficient free-public evidence in the campaign package/.test(campaignAgentSrc)
);
ok(
  "SEARCH-42 cachedCount 0 stays Empty campaign package",
  sectionH.honestCampaignBriefEmpty({
    cachedCount: 0,
    totalObservations: 0,
    networkEdgeCount: 0,
    thinCidCount: 1,
    dossiers: [{ traces: [litFail] }],
  }).harvestFail !== true &&
    /Empty campaign package/.test(
      sectionH.honestCampaignBriefEmpty({
        cachedCount: 0,
        totalObservations: 0,
        networkEdgeCount: 0,
        thinCidCount: 1,
        dossiers: [{ traces: [litFail] }],
      }).summaryOverlay || ""
    )
);

function campBrief(traces) {
  return sectionH.honestCampaignBriefEmpty({
    cachedCount: 1,
    totalObservations: 0,
    networkEdgeCount: 0,
    thinCidCount: 1,
    dossiers: [{ traces }],
  });
}

const litCamp = campBrief([litFail]);
ok(
  "SEARCH-42 literature harvest fail is campaign-brief error not Few observations",
  litCamp.harvestFail &&
    /Not an empty result|Not a clean miss/.test(litCamp.summaryOverlay || "") &&
    !/Few condition observations/.test(litCamp.openGaps.join(" ")) &&
    !/No reaction-network edges yet/.test(litCamp.openGaps.join(" "))
);
ok(
  "SEARCH-42 leftover identity is not a campaign-brief miss",
  campBrief([identityFail]).harvestFail !== true &&
    /Few condition observations/.test(campBrief([identityFail]).openGaps.join(" ")) &&
    /No reaction-network edges yet/.test(campBrief([identityFail]).openGaps.join(" "))
);
ok(
  "SEARCH-42 leftover ChEMBL annotation fail is not a campaign-brief miss",
  campBrief([chemblFail]).harvestFail !== true &&
    /Few condition observations/.test(campBrief([chemblFail]).openGaps.join(" "))
);
ok(
  "SEARCH-42 genuine empty stays Few observations / No edges copy",
  campBrief([]).harvestFail !== true &&
    /Few condition observations/.test(campBrief([]).openGaps.join(" ")) &&
    /No reaction-network edges yet/.test(campBrief([]).openGaps.join(" "))
);
ok(
  "SEARCH-42 filled observations stay despite leftover identity fail",
  sectionH.honestCampaignBriefEmpty({
    cachedCount: 1,
    totalObservations: 8,
    networkEdgeCount: 3,
    thinCidCount: 0,
    dossiers: [{ traces: [identityFail] }],
  }).harvestFail !== true &&
    sectionH.honestCampaignBriefEmpty({
      cachedCount: 1,
      totalObservations: 8,
      networkEdgeCount: 3,
      thinCidCount: 0,
      dossiers: [{ traces: [identityFail] }],
    }).openGaps.length === 0
);

const CLEAN_AGENT =
  "Insufficient free-public evidence in the campaign package for this question. Densify more CIDs, paste public procedure text, or narrow to temperatures, edges, impurities, or network relations.";
ok(
  "SEARCH-42 literature harvest fail is campaign-agent error not package miss",
  /Not an empty result|Not a clean miss/.test(
    sectionH.honestCampaignAgentEmpty({
      dossiers: [{ traces: [litFail] }],
      cleanEmpty: CLEAN_AGENT,
    })
  ) &&
    !/Insufficient free-public evidence in the campaign package/.test(
      sectionH.honestCampaignAgentEmpty({
        dossiers: [{ traces: [litFail] }],
        cleanEmpty: CLEAN_AGENT,
      })
    )
);
ok(
  "SEARCH-42 leftover identity is not a campaign-agent miss",
  sectionH.honestCampaignAgentEmpty({
    dossiers: [{ traces: [identityFail] }],
    cleanEmpty: CLEAN_AGENT,
  }) === CLEAN_AGENT
);
ok(
  "SEARCH-42 leftover ChEMBL annotation fail is not a campaign-agent miss",
  sectionH.honestCampaignAgentEmpty({
    dossiers: [{ traces: [chemblFail] }],
    cleanEmpty: CLEAN_AGENT,
  }) === CLEAN_AGENT
);
ok(
  "SEARCH-42 genuine empty stays campaign-package insufficient copy",
  sectionH.honestCampaignAgentEmpty({
    dossiers: [{ traces: [] }],
    cleanEmpty: CLEAN_AGENT,
  }) === CLEAN_AGENT
);
ok(
  "SEARCH-42 campaign-brief chips stay composite (no leftover-identity claim)",
  /FreePublicBadge/.test(read("components/frontier/CampaignBriefPanel.tsx"))
);
const diagSrc = read("components/DossierDiagnostics.tsx");
ok(
  "SEARCH-43 diagnostics strip uses honestDiagnosticsAnnotationStat",
  /honestDiagnosticsAnnotationStat/.test(diagSrc) &&
    /annotationStat\.value/.test(diagSrc) &&
    /annotationStat\.harvestFail/.test(diagSrc)
);
ok(
  "SEARCH-43 diagnostics strip uses honestDiagnosticsLitPatentStat",
  /honestDiagnosticsLitPatentStat/.test(diagSrc) &&
    /litPatentStat\.value/.test(diagSrc) &&
    /litPatentStat\.harvestFail/.test(diagSrc)
);

function annStat(traces, count, sources) {
  return sectionH.honestDiagnosticsAnnotationStat({
    annotationCount: count ?? 0,
    annotationSources: sources,
    traces,
  });
}
function litPatStat(traces, lit, pat) {
  return sectionH.honestDiagnosticsLitPatentStat({
    literatureCount: lit ?? 0,
    patentCount: pat ?? 0,
    traces,
  });
}

ok(
  "SEARCH-43 annotation harvest fail is diagnostics error not none yet",
  annStat([chemblFail]).harvestFail &&
    /Sources failed|some sources failed/.test(annStat([chemblFail]).value) &&
    !/none yet/.test(annStat([chemblFail]).value)
);
ok(
  "SEARCH-43 leftover identity is not a diagnostics annotation miss",
  annStat([identityFail]).harvestFail !== true &&
    annStat([identityFail]).value === "none yet"
);
ok(
  "SEARCH-43 leftover literature fail is not a diagnostics annotation miss",
  annStat([litFail]).harvestFail !== true &&
    annStat([litFail]).value === "none yet"
);
ok(
  "SEARCH-43 genuine annotation empty stays none yet",
  annStat([]).harvestFail !== true && annStat([]).value === "none yet"
);
ok(
  "SEARCH-43 filled annotations stay despite leftover identity fail",
  annStat([identityFail], 2, ["chembl", "openfda"]).harvestFail !== true &&
    /2 · chembl, openfda/.test(annStat([identityFail], 2, ["chembl", "openfda"]).value)
);

ok(
  "SEARCH-43 literature harvest fail is diagnostics error not muted 0 · 0",
  litPatStat([litFail]).harvestFail &&
    /Sources failed|some sources failed/.test(litPatStat([litFail]).value) &&
    !/^0 · 0$/.test(litPatStat([litFail]).value)
);
ok(
  "SEARCH-43 leftover identity is not a diagnostics literature miss",
  litPatStat([identityFail]).harvestFail !== true &&
    litPatStat([identityFail]).value === "0 · 0"
);
ok(
  "SEARCH-43 leftover ChEMBL annotation fail is not a diagnostics literature miss",
  litPatStat([chemblFail]).harvestFail !== true &&
    litPatStat([chemblFail]).value === "0 · 0"
);
ok(
  "SEARCH-43 genuine literature empty stays 0 · 0",
  litPatStat([]).harvestFail !== true && litPatStat([]).value === "0 · 0"
);
ok(
  "SEARCH-43 filled literature stays despite leftover identity fail",
  litPatStat([identityFail], 3, 1).harvestFail !== true &&
    litPatStat([identityFail], 3, 1).value === "3 · 1"
);




const shiftPanel = read("components/ShiftPackPanel.tsx");
const shiftPacksSrc = read("lib/workspace/shiftPacks.ts");
ok(
  "SEARCH-44 shift-pack empty copy uses honestShiftPackContent",
  /honestShiftPackContent/.test(shiftPacksSrc) &&
    /shiftPackSaveDetail/.test(shiftPacksSrc) &&
    /harvest failed — not 0\/0/.test(shiftPacksSrc) &&
    /export function honestShiftPackContent/.test(
      read("lib/dossier/sectionHonesty.ts")
    )
);
ok(
  "SEARCH-44 shift-pack chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(shiftPanel) &&
    /isProcessFactSourceRef/.test(shiftPanel) &&
    /field="Shift pack"/.test(shiftPanel) &&
    /traces=\{traces\}/.test(shiftPanel) &&
    /sourceRefs=\{sourceRefs\}/.test(shiftPanel) &&
    !/field="Shift pack"[\s\S]{0,200}pubchemCid=/.test(shiftPanel)
);

const STUB_STEP = {
  id: "await-facts-1",
  title: "No extractable public process sequence yet",
  order: 1,
};
const REAL_STEP = {
  id: "lit-1",
  title: "Hydrogenation (public lead)",
  order: 1,
  description: "Public abstract",
};

function shiftPack(traces, extra) {
  return sectionH.honestShiftPackContent({
    traces,
    steps: extra && extra.steps ? extra.steps : [STUB_STEP],
    gaps: extra && extra.gaps ? extra.gaps : [],
    litCount: extra && extra.litCount != null ? extra.litCount : 0,
    patentCount: extra && extra.patentCount != null ? extra.patentCount : 0,
  });
}

ok(
  "SEARCH-44 literature harvest fail is shift-pack error not N-step / 0/0",
  shiftPack([litFail]).harvestFail &&
    shiftPack([litFail]).steps.length === 0 &&
    /Not an empty result|Not a clean miss/.test(shiftPack([litFail]).saveDetail) &&
    !/^\d+ steps$/.test(shiftPack([litFail]).saveDetail) &&
    !/^0\/0$/.test(shiftPack([litFail]).litPatentLabel)
);
ok(
  "SEARCH-44 leftover identity is not a shift-pack miss",
  shiftPack([identityFail]).harvestFail !== true &&
    shiftPack([identityFail]).steps.length === 0 &&
    shiftPack([identityFail]).litPatentLabel === "0/0" &&
    shiftPack([identityFail]).saveDetail === "0 steps"
);
ok(
  "SEARCH-44 leftover ChEMBL annotation fail is not a shift-pack miss",
  shiftPack([chemblFail]).harvestFail !== true &&
    shiftPack([chemblFail]).litPatentLabel === "0/0"
);
ok(
  "SEARCH-44 genuine empty stays 0 steps / 0/0",
  shiftPack([]).harvestFail !== true &&
    shiftPack([]).steps.length === 0 &&
    shiftPack([]).litPatentLabel === "0/0" &&
    shiftPack([]).saveDetail === "0 steps"
);
ok(
  "SEARCH-44 filled steps stay despite leftover identity fail",
  shiftPack([identityFail], { steps: [REAL_STEP], litCount: 3, patentCount: 1 })
    .harvestFail !== true &&
    shiftPack([identityFail], { steps: [REAL_STEP], litCount: 3, patentCount: 1 })
      .steps.length === 1 &&
    shiftPack([identityFail], { steps: [REAL_STEP], litCount: 3, patentCount: 1 })
      .litPatentLabel === "3/1" &&
    shiftPack([identityFail], { steps: [REAL_STEP], litCount: 3, patentCount: 1 })
      .saveDetail === "1 steps"
);
ok(
  "SEARCH-44 stub-only steps do not count as public sequence",
  shiftPack([]).steps.length === 0 &&
    shiftPack([litFail], { steps: [STUB_STEP] }).steps.length === 0
);
ok(
  "SEARCH-44 local-cache empty stays No saved shift packs",
  /No saved shift packs for this CID yet/.test(shiftPanel)
);


const procedureVault = read("components/ProcedureVaultPanel.tsx");
ok(
  "PROV-25 procedure-vault chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(procedureVault) &&
    /isProcessFactSourceRef/.test(procedureVault) &&
    /liveFetch=\{false\}/.test(procedureVault) &&
    /field="Procedure vault"/.test(procedureVault) &&
    /traces=\{traces\}/.test(procedureVault) &&
    /sourceRefs=\{sourceRefs\}/.test(procedureVault)
);
ok(
  "PROV-25 leftover PubChem identity is not procedure-vault HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);
ok(
  "PROV-25 empty vault stays local-cache gap",
  /Empty vault — densify OA\/patents or paste public experimental text/.test(
    procedureVault
  )
);


const pdfPack = read("components/PdfWorkerPack.tsx");
ok(
  "PROV-26 pdf-pack chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(pdfPack) &&
    /isProcessFactSourceRef/.test(pdfPack) &&
    /field="PDF pack"/.test(pdfPack) &&
    /traces=\{traces\}/.test(pdfPack) &&
    /sourceRefs=\{sourceRefs\}/.test(pdfPack) &&
    !/field="PDF pack"[\s\S]{0,200}pubchemCid=/.test(pdfPack)
);
const playbooks = read("components/WorkerPlaybookPanel.tsx");
ok(
  "PROV-26 playbook chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(playbooks) &&
    /isProcessFactSourceRef/.test(playbooks) &&
    /field="Playbooks"/.test(playbooks) &&
    /traces=\{traces\}/.test(playbooks) &&
    /sourceRefs=\{sourceRefs\}/.test(playbooks) &&
    !/field="Playbooks"[\s\S]{0,200}pubchemCid=/.test(playbooks)
);
ok(
  "PROV-26 leftover PubChem identity is not PDF-pack or playbook HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);

const siteFill = read("components/SiteFillPanel.tsx");
ok(
  "PROV-27 site-fill chips do not live-fetch leftover identity HTTP",
  /field="Site fill"/.test(siteFill) &&
    /showNotAi/.test(siteFill) &&
    /ContentProvenance/.test(siteFill) &&
    !/pubchemCid=/.test(siteFill)
);
const ordBulk = read("components/OrdBulkPanel.tsx");
ok(
  "PROV-27 ord-bulk chips do not live-fetch leftover identity HTTP",
  /field="ORD bulk"/.test(ordBulk) &&
    /showNotAi/.test(ordBulk) &&
    /ContentProvenance/.test(ordBulk) &&
    !/pubchemCid=/.test(ordBulk)
);
const localText = read("components/LocalTextEnrich.tsx");
ok(
  "PROV-27 local-text-enrich chips do not live-fetch leftover identity HTTP",
  /title="Local public-text enrich"/.test(localText) &&
    /ApiProvenance/.test(localText) &&
    /FreePublicBadge/.test(localText) &&
    !/pubchemCid=/.test(localText)
);
ok(
  "PROV-27 leftover PubChem identity is not site-fill / ORD-bulk / paste HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);

const biologicParams = read("components/BiologicParametersPanel.tsx");
ok(
  "PROV-28 educational-parameters chips do not live-fetch leftover identity HTTP",
  /field="Educational parameters"/.test(biologicParams) &&
    /liveFetch=\{false\}/.test(biologicParams) &&
    /traces=\{\[\]\}/.test(biologicParams) &&
    /sourceRefs=\{\[\]\}/.test(biologicParams) &&
    !/pubchemCid=/.test(biologicParams)
);
ok(
  "PROV-28 educational-parameters section title does not claim leftover identity HTTP",
  /field="Educational parameters"/.test(liveDossier) &&
    !/field="Educational parameters"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="Educational parameters"[\s\S]{0,200}traces=\{identityTraces\}/.test(
      liveDossier
    )
);
ok(
  "PROV-28 leftover PubChem identity is not educational-parameters HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);

const processFactsHeader = read("components/ProcessFactsPanel.tsx");
ok(
  "PROV-29 process-facts header chip does not live-fetch leftover identity HTTP",
  /field="Process facts"/.test(processFactsHeader) &&
    /traces=\{factTraces\}/.test(processFactsHeader) &&
    /sourceRefs=\{factSourceRefs\}/.test(processFactsHeader) &&
    !/pubchemCid=/.test(processFactsHeader)
);
ok(
  "PROV-29 leftover PubChem identity is not process-facts HTTP",
  sectionH.isProcessFactTrace(litUrl) &&
    sectionH.isProcessFactTrace(ghsUrl) &&
    sectionH.isProcessFactTrace(mfgUrl) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isProcessFactTrace(chemblUrl)
);

ok(
  "PROV-30 applications header chip does not live-fetch leftover identity HTTP",
  /field="Applications"/.test(liveDossier) &&
    /field="Applications"[\s\S]{0,200}traces=\{applicationTraces\}/.test(liveDossier) &&
    !/field="Applications"[\s\S]{0,200}pubchemCid=/.test(liveDossier)
);
ok(
  "PROV-30 patents header chip does not live-fetch leftover identity HTTP",
  /title="Patents & process IP"/.test(liveDossier) &&
    /traces=\{patentTraces\}/.test(liveDossier) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{patentTraces\}/.test(liveDossier)
);
ok(
  "PROV-30 manufacturing header chip does not live-fetch leftover identity HTTP",
  /title="Use & manufacturing"/.test(liveDossier) &&
    /traces=\{mfgTraces\}/.test(liveDossier) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{mfgTraces\}/.test(liveDossier)
);
ok(
  "PROV-30 EHS header chips do not live-fetch leftover identity HTTP",
  /field="EHS highlights"[\s\S]{0,220}traces=\{ghsTraces\}/.test(liveDossier) &&
    /field="EHS highlights"[\s\S]{0,220}traces=\{ghsTraces\}/.test(asideSrc) &&
    !/field="EHS highlights"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="EHS highlights"[\s\S]{0,200}pubchemCid=/.test(asideSrc) &&
    /title="PubChem PUG View · GHS \/ hazards"/.test(asideSrc) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{ghsTraces\}/.test(asideSrc)
);
ok(
  "PROV-30 leftover PubChem identity is not applications/patents/mfg/EHS HTTP",
  sectionH.isManufacturingSectionTrace(mfgUrl) &&
    sectionH.isHazardsSectionTrace(ghsUrl) &&
    sectionH.isPatentSectionTrace("https://search.patentsview.org/api/v1/patent/") &&
    !sectionH.isManufacturingSectionTrace(identityUrl) &&
    !sectionH.isHazardsSectionTrace(identityUrl) &&
    !sectionH.isPatentSectionTrace(identityUrl) &&
    !sectionH.isManufacturingSectionTrace(chemblUrl)
);

const msatBoard = read("components/CompareMsatBoard.tsx");
const batchDensify = read("components/frontier/BatchDensifyPanel.tsx");
const edgeCompare = read("components/frontier/NetworkEdgeComparePanel.tsx");
ok(
  "PROV-31 MSAT compare chips stay composite but do not live-fetch leftover identity HTTP",
  /field="MSAT compare"/.test(msatBoard) &&
    /liveFetch=\{false\}/.test(msatBoard) &&
    /dossier=\{a\}/.test(msatBoard) &&
    /dossier=\{b\}/.test(msatBoard) &&
    !/field="MSAT compare"[\s\S]{0,200}pubchemCid=/.test(msatBoard)
);
ok(
  "PROV-31 batch-densify chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Batch densify"/.test(batchDensify) &&
    /liveFetch=\{false\}/.test(batchDensify) &&
    /dossier=\{dossier\}/.test(batchDensify) &&
    !/field="Batch densify"[\s\S]{0,200}pubchemCid=/.test(batchDensify)
);
ok(
  "PROV-31 network-edge-compare chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Network edge compare"/.test(edgeCompare) &&
    /liveFetch=\{false\}/.test(edgeCompare) &&
    /dossier=\{dossiers\[0\]\}/.test(edgeCompare) &&
    !/field="Network edge compare"[\s\S]{0,200}pubchemCid=/.test(edgeCompare)
);
ok(
  "PROV-31 leftover PubChem identity is not MSAT / batch-densify / edge-compare live-fetch",
  /liveFetch=\{false\}/.test(msatBoard) &&
    /liveFetch=\{false\}/.test(batchDensify) &&
    /liveFetch=\{false\}/.test(edgeCompare) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isManufacturingSectionTrace(identityUrl)
);
const sourceCoverage = read("components/SourceCoverageMap.tsx");
ok(
  "PROV-32 source-coverage chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Source coverage"/.test(sourceCoverage) &&
    /liveFetch=\{false\}/.test(sourceCoverage) &&
    /dossier=\{dossier\}/.test(sourceCoverage) &&
    !/field="Source coverage"[\s\S]{0,200}pubchemCid=/.test(sourceCoverage)
);
ok(
  "PROV-32 leftover PubChem identity is not source-coverage live-fetch",
  /liveFetch=\{false\}/.test(sourceCoverage) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isManufacturingSectionTrace(identityUrl)
);
const idealPage = read("components/IdealPageParityPanel.tsx");
ok(
  "PROV-33 ideal-page chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Ideal page"/.test(idealPage) &&
    /traces=\{slimTraces\(dossier\.traces/.test(idealPage) &&
    !/field="Ideal page"[\s\S]{0,200}pubchemCid=/.test(idealPage) &&
    !/pubchemCid=\{dossier\.cid\}/.test(idealPage)
);
ok(
  "PROV-33 leftover PubChem identity is not ideal-page live-fetch",
  !/pubchemCid=\{dossier\.cid\}/.test(idealPage) &&
    !sectionH.isProcessFactTrace(identityUrl) &&
    !sectionH.isManufacturingSectionTrace(identityUrl)
);
console.log(`\n${passed} search-contract checks passed`);
