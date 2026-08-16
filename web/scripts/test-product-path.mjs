/**
 * Product-path contracts: Monday progressive UX, vault hero, MSAT workspace, honesty.
 * Run: node scripts/test-product-path.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");
const repo = path.join(__dirname, "..", "..");

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log("ok  ", name);
}

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

function readRepo(rel) {
  return fs.readFileSync(path.join(repo, rel), "utf8");
}

console.log("test-product-path");

const readme = readRepo("README.md");
ok("README no ~100+ packages claim", !/~\s*100\+\s*packages/i.test(readme));
ok("README no Tier-A examples feature row", !/\*\*Tier-A examples\*\*/.test(readme));
ok("README MSAT journey feature", /MSAT journey/i.test(readme));
ok("README packages redirect honesty", /Redirect to search|mocks retired/i.test(readme));
ok(
  "product-vision no Tier-A curated content table",
  !/Curated JSON \+ citations/.test(readRepo("docs/product-vision.md"))
);
ok(
  "docs/README no Tier-A examples route",
  !/Home \+ Tier-A examples/.test(readRepo("docs/README.md"))
);
ok(
  "diagnostics productMode live-densify",
  /productMode:\s*"live-densify"/.test(read("app/api/diagnostics/route.ts"))
);
ok(
  "diagnostics no mock curatedPackages counter",
  !/curatedPackages/.test(read("app/api/diagnostics/route.ts"))
);
ok(
  "mock extract-dossiers script removed",
  !fs.existsSync(path.join(__dirname, "extract-dossiers.mjs"))
);

const design = readRepo("docs/design/product-design.md");
ok("design live densify hub", /live densify/i.test(design));
ok("design no ~100+ packages", !/~\s*100\+\s*educational packages/i.test(design));

ok("default role msat", /DEFAULT_WORKER_ROLE[\s\S]*"msat"/.test(read("lib/worker/roleMode.ts")));
ok("mondayPath assess", /assessMondayPath/.test(read("lib/dossier/mondayPath.ts")));
ok("Live vault panel", /ProcedureVaultPanel/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("Live Monday pack before science", /MondayMorningPack[\s\S]*ProcedureVaultPanel[\s\S]*Science lab|MondayMorningPack[\s\S]*ProcedureVaultPanel/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("ThinToUseful densify-next queue", /runDensifyActionQueue/.test(read("components/ThinToUsefulBanner.tsx")));
ok("Workspace MSAT title", /MSAT campaigns/.test(read("app/workspace/page.tsx")));
ok("Diagnostics cold KPI", /ColdCidKpiPanel/.test(read("app/diagnostics/page.tsx")));
ok("coldCidKpi golden set", /GOLDEN_COLD_CIDS/.test(read("lib/dossier/coldCidKpi.ts")));
ok("bulkVault ingest", /ingestExcerptsToVault/.test(read("lib/idb/bulkVault.ts")));
ok("home MSAT journey CTA", /MSAT journey|runMsatJourney|runMsatPath/.test(read("components/ProblemFirstSearch.tsx")));
ok("MSAT wizard stepper", /wizardStep|MSAT wizard|Step 1/.test(read("components/ProblemFirstSearch.tsx")));
ok("campaignVault module", /CAMPAIGN_VAULT_SCHEMA|buildCampaignVaultBag/.test(read("lib/idb/campaignVault.ts")));
ok("ProcedureVault export bag", /exportVaultBag|Export vault bag/.test(read("components/ProcedureVaultPanel.tsx")));
ok("Workspace CampaignVaultPanel", /CampaignVaultPanel/.test(read("app/workspace/page.tsx")));
ok("coldCid report markdown", /formatColdCidKpiReportMarkdown|buildColdCidKpiReport/.test(read("lib/dossier/coldCidKpi.ts")));
ok("report-cold-cid-kpi script", fs.existsSync(path.join(__dirname, "report-cold-cid-kpi.mjs")));
ok("accuracy fixture file", fs.existsSync(path.join(__dirname, "fixtures/process-accuracy-fixture.json")));
ok(
  "batch route finite retries",
  /Number\.isFinite\(retriesRaw\)|Number\.isFinite\(concurrencyRaw\)/.test(
    read("app/api/dossier/batch/route.ts")
  )
);
ok(
  "agent pack vault fingerprint field",
  /vaultFingerprint/.test(read("lib/export/agentPack.ts"))
);
ok(
  "cold-cid workflow exists",
  fs.existsSync(path.join(repo, ".github/workflows/cold-cid-kpi.yml"))
);

const readinessUi = read("components/RecipeReadinessPanel.tsx");
const problemUi = read("components/ProblemFirstSearch.tsx");
ok("readiness UI has no Teaching package label", !/Teaching package/.test(readinessUi));
ok("problem search has no hub/live hits copy", !/hub\/live hits/.test(problemUi));
ok("problem search has no Local hits ready copy", !/Local hits ready/.test(problemUi));
ok("problem search UI has no hub-live chip", !/hub-live/.test(problemUi));
ok(
  "compare warm alert has no hub names",
  !/hub names/.test(read("app/compare/page.tsx"))
);
const e2e = fs.readFileSync(path.join(__dirname, "..", "e2e", "worker-path.spec.ts"), "utf8");
ok(
  "e2e home does not require dossier unit-op heading",
  !/Problem \/ unit-op search/.test(e2e)
);
ok("e2e home asserts live densify chrome", /Live densify/.test(e2e) && /AI dual-view/.test(e2e));
ok("e2e covers compare/search/workspace/diagnostics", /\/compare/.test(e2e) && /\/search/.test(e2e) && /\/workspace/.test(e2e) && /\/diagnostics/.test(e2e));

const comparePage = read("app/compare/page.tsx");
ok("compare placeholder does not advertise unresolved CAS", !/CID, CAS, or name/.test(comparePage));
ok("compare has no teaching-name aspirin shortcut", !/Teaching name/.test(comparePage) && !/toLowerCase\(\) === "aspirin"/.test(comparePage));
ok("ORD panel has no hub molecule leftover", !/hub molecule/.test(read("components/OrdBulkPanel.tsx")));

const gettingStarted = readRepo("docs/getting-started.md");
ok("getting-started has no hub twin leftover", !/hub twin/.test(gettingStarted));
ok("getting-started does not advertise header Google sign-in", !/Header \*\*Google sign-in\*\*/.test(gettingStarted));
ok(
  "security.md does not claim Google sign-in UI exists",
  !/Google sign-in\*\* UI exists/.test(readRepo("docs/security.md"))
);
ok(
  "product-vision has no unit-op hub hits",
  !/unit-op hub hits/.test(readRepo("docs/product-vision.md"))
);
ok(
  "chemistry-api-sources.json no curated overlays",
  !/curated overlays/.test(readRepo("docs/chemistry-api-sources.json"))
);

console.log(`\n${n} product-path checks passed`);
