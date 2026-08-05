/**
 * Live-only product contracts: no mock molecule JSON, no example/package catalogs.
 * Run: node scripts/test-tier-a-golden.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const molDir = path.join(root, "src", "data", "molecules");
const src = path.join(root, "src");

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

// No mock molecule JSON
const jsonFiles = fs.existsSync(molDir)
  ? fs.readdirSync(molDir).filter((f) => f.endsWith(".json"))
  : [];
ok("no molecule mock JSON files", jsonFiles.length === 0);

// Mock modules removed entirely
ok("examples.ts deleted", !exists("lib/data/examples.ts"));
ok("curatedPackages.ts deleted", !exists("lib/data/curatedPackages.ts"));
ok("catalog.ts deleted", !exists("lib/data/catalog.ts"));
ok("hubCatalog.ts deleted", !exists("lib/data/hubCatalog.ts"));
ok("tierABaseline.ts deleted", !exists("lib/dossier/tierABaseline.ts"));
ok("ExampleDossierView deleted", !exists("components/ExampleDossierView.tsx"));
ok("ForShowBanner deleted", !exists("components/ForShowBanner.tsx"));

const hub = read("lib/data/hubIndex.ts");
ok("HUB_INDEX empty", /HUB_INDEX:\s*HubIndexEntry\[\]\s*=\s*\[\]/.test(hub));
ok("findHubByCid always undefined", /return undefined/.test(hub));

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline does not apply tier-A baseline", !/applyTierABaseline/.test(pipe));

const enrich = read("lib/dossier/enrichClientFacts.ts");
ok("enrich does not apply tier-A baseline", !/applyTierABaseline/.test(enrich));

const tt = read("lib/export/techTransfer.ts");
ok("no buildTechTransferFromExample", !/buildTechTransferFromExample/.test(tt));

const ui = read("components/TechTransferExport.tsx");
ok("export is live-only", /kind:\s*\"live\"/.test(ui) && !/example/.test(ui));

// Accuracy policy still present
ok(
  "processFacts law file exists",
  fs.existsSync(path.join(src, "lib", "dossier", "processFacts.ts"))
);
ok(
  "AI package process-first instruction",
  /overview MUST open with process|lead with process/i.test(
    read("lib/dossier/aiEvidencePackage.ts")
  )
);
ok(
  "synthesize cold-start rule",
  /coldStart|Cold\/thin densify/i.test(read("lib/dossier/synthesize.ts"))
);

console.log(`\nAll live-only golden contracts passed (${passed}).`);
