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

console.log(`\n${n} product-path checks passed`);
