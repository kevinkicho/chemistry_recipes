/**
 * Golden contracts after Tier-A mock removal.
 * Product is live densify + AI dual-view; no molecule JSON mocks.
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

// No mock molecule JSON
const jsonFiles = fs.existsSync(molDir)
  ? fs.readdirSync(molDir).filter((f) => f.endsWith(".json"))
  : [];
ok("no tier-A molecule mock JSON files", jsonFiles.length === 0);

const examples = read("lib/data/examples.ts");
ok("examples stubs return empty catalog", /getExampleCatalog[\s\S]*return \[\]/.test(examples));
ok("getExampleById always undefined", /getExampleById[\s\S]*return undefined/.test(examples));

const tier = read("lib/dossier/tierABaseline.ts");
ok("tierA baseline is no-op", /No-op|never inject mock/i.test(tier));
ok("applyTierABaseline exported", /export function applyTierABaseline/.test(tier));

const hub = read("lib/data/hubIndex.ts");
ok("HUB_INDEX empty", /HUB_INDEX:\s*HubIndexEntry\[\]\s*=\s*\[\]/.test(hub));

const catalog = read("lib/data/hubCatalog.ts");
ok("hub catalog has no sample LIVE_HUB entries", /const LIVE_HUB[\s\S]*=\s*\[\s*\];/.test(catalog) || /LIVE_HUB[\s\S]*=\s*\[\]/.test(catalog));

const packages = read("lib/data/curatedPackages.ts");
ok("one teaching pointer Aspirin", packages.includes('name: "Aspirin"') && packages.includes("pubchemCid: 2244"));
ok("packages point live not mock exampleId", !packages.includes('exampleId: "aspirin"'));

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

console.log(`\nAll live-pipeline golden contracts passed (${passed}).`);
