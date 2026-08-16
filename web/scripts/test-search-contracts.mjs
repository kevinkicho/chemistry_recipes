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

console.log(`\n${passed} search-contract checks passed`);
