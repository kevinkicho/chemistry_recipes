/**
 * Multi-source search + problem-first contracts (offline).
 * Maps to SEARCH-* in docs/engineering/test-spec.md
 *
 * Run: node scripts/test-search-contracts.mjs
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

console.log("test-search-contracts");

// Modules
ok("SEARCH multiSourceSearch module", exists("lib/search/multiSourceSearch.ts"));
ok("SEARCH multiSourceSuggest module", exists("lib/search/multiSourceSuggest.ts"));
ok("SEARCH problemFirst module", exists("lib/search/problemFirst.ts"));
ok("SEARCH problemMultiSource module", exists("lib/search/problemMultiSource.ts"));
ok("SEARCH problemCampaign module", exists("lib/search/problemCampaign.ts"));

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

// SEARCH-01 multi-source identity fan-out
ok("SEARCH-01 multiSourceSearch export", /export async function multiSourceSearch/.test(multi));
ok("SEARCH-01 includes pubchem chembl", /pubchem|chembl/i.test(multi));
ok("SEARCH-01 multi API route", /multiSourceSearch/.test(multiApi));

// SEARCH-02 suggest fan-out
ok("SEARCH-02 multiSourceSuggest export", /export (async )?function|multiSourceSuggest/.test(suggest));
ok("SEARCH-02 suggest API", /suggest|multiSource/.test(suggestApi));
ok("SEARCH-02 SearchForm uses suggest API", /\/api\/search\/suggest/.test(form));

// SEARCH-03 problem-first local + live
ok("SEARCH-03 searchProblemFirst", /export function searchProblemFirst/.test(problemFirst));
ok("SEARCH-03 PROBLEM_SEARCH_HINTS", /PROBLEM_SEARCH_HINTS/.test(problemFirst));
ok("SEARCH-03 problem multi-source", /export async function|problemMultiSource|unified/.test(problemMulti));
ok("SEARCH-03 problem API route", /problem|limit/.test(problemApi));

// SEARCH-04 UI wiring
ok("SEARCH-04 SearchResults multi path", /\/api\/search\/multi/.test(results));
ok("SEARCH-04 SearchResults browser PubChem", /searchPubChemInBrowser/.test(results));
ok("SEARCH-04 SearchResults local hub first", /resolveLocalSearchHits/.test(results));
ok("SEARCH-04 search page mounts SearchResults", /SearchResults/.test(searchPage));
ok("SEARCH-04 problem UI fetches /api/search/problem", /\/api\/search\/problem/.test(problemUi));

// SEARCH-05 campaign densify from problem
ok("SEARCH-05 createCampaignFromProblemHits", /export function createCampaignFromProblemHits/.test(problemCamp));
ok("SEARCH-05 createCampaignAndDensifyFromProblemHits", /export async function createCampaignAndDensifyFromProblemHits/.test(problemCamp));
ok("SEARCH-05 densify uses streamBatchDensifyCids", /streamBatchDensifyCids/.test(problemCamp));

// SEARCH-06 no invent / openable honesty
ok("SEARCH-06 MultiSourceHit openable field", /openable/.test(multi));
ok("SEARCH-06 results separate openable vs identity-only", /openable|identityOnly/.test(results));

console.log(`\n${passed} search-contract checks passed`);
