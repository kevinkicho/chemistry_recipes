/**
 * Navigation / leave-page abort contracts (offline).
 * Maps to NAV-* in docs/engineering/test-spec.md
 *
 * Run: node scripts/test-nav-abort.mjs
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

console.log("test-nav-abort");

const batch = read("lib/dossier/batchClient.ts");
const warm = read("lib/dossier/warmCache.ts");
const problem = read("lib/search/problemCampaign.ts");
const queue = read("lib/frontier/densifyActionQueue.ts");
const loader = read("components/dossier/DossierClientLoader.tsx");
const searchRes = read("components/SearchResults.tsx");
const searchForm = read("components/SearchForm.tsx");
const problemUi = read("components/ProblemFirstSearch.tsx");

// NAV-01 batch densify abortable
ok("NAV-01 streamBatchDensifyCids accepts signal", /signal\?:\s*AbortSignal/.test(batch));
ok("NAV-01 fetch uses signal", /signal:\s*opts\?\.signal/.test(batch));
ok("NAV-01 aborted error path", /error:\s*[\"']aborted[\"']/.test(batch));
ok("NAV-01 reader cancel on abort", /reader\.cancel/.test(batch));

// NAV-02 warm live dossier abortable
ok("NAV-02 warmLiveDossier signal", /signal\?:\s*AbortSignal/.test(warm));
ok("NAV-02 warm fetch signal", /signal:\s*opts\?\.signal/.test(warm));
ok("NAV-02 warm does not promote incomplete on abort", /completed \? last : null|Aborted CID/.test(warm));
ok(
  "NAV-02 warm does not promote incomplete on stream drop",
  /Stream incomplete CID/.test(warm) &&
    /!completed \|\| !last/.test(warm)
);

// NAV-03 problem densify abort
ok("NAV-03 problem densify signal option", /signal\?:\s*AbortSignal/.test(problem));
ok("NAV-03 problem passes signal to batch", /signal:\s*opts\?\.signal/.test(problem));

// NAV-04 densify action queue
ok("NAV-04 runDensifyActionQueue signal", /signal\?:\s*AbortSignal/.test(queue));
ok("NAV-04 runCampaignDensifyQueue signal", /runCampaignDensifyQueue[\s\S]*signal\?:/.test(queue));

// NAV-05 dossier SSE closed on unmount
ok("NAV-05 EventSource close on cleanup", /es\.close\(\)/.test(loader));
ok("NAV-05 cancelled flag on boot cleanup", /cancelled\s*=\s*true/.test(loader));
ok("NAV-05 force stream query", /force=1|forceRefresh/.test(loader));

// NAV-06 search abort on unmount
ok("NAV-06 SearchResults AbortController", /AbortController/.test(searchRes));
ok("NAV-06 SearchResults cleanup abort", /ac\.abort\(\)/.test(searchRes));
ok("NAV-06 SearchForm abortRef", /abortRef|AbortController/.test(searchForm));

// NAV-07 problem UI aborts densify on leave
ok("NAV-07 densifyAbortRef", /densifyAbortRef/.test(problemUi));
ok("NAV-07 unmount abort densify", /densifyAbortRef\.current\?\.abort/.test(problemUi));
ok("NAV-07 beforeunload while densifyBusy", /beforeunload/.test(problemUi));

console.log(`\n${passed} nav-abort checks passed`);
