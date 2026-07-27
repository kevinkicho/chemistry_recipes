/**
 * Contracts for live≈curated plant parity helpers.
 * Run: node scripts/test-plant-parity.mjs
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

// Chemical mention heuristics (mirror)
const KNOWN = ["salicylic acid", "acetic anhydride", "methanol", "toluene"];
function extract(text) {
  const hay = text.toLowerCase();
  return KNOWN.filter((n) => hay.includes(n));
}

const sample =
  "Acetylation of salicylic acid with acetic anhydride in toluene yields ASA.";
ok("mentions salicylic acid", extract(sample).includes("salicylic acid"));
ok("mentions acetic anhydride", extract(sample).includes("acetic anhydride"));
ok("mentions toluene", extract(sample).includes("toluene"));
ok("no false positive caffeine", !extract(sample).includes("caffeine"));

const plant = read("lib/dossier/plantDeliverables.ts");
ok("plant builds manufacturing narrative train", /Public process cues/.test(plant));
ok("plant enriches steps for plant view", /enrichStepsForPlantView|Plant unit-op/.test(plant));
ok("plant uses chemical mentions", /extractChemicalMentions|materialsFromMentions/.test(plant));

const tier = read("lib/dossier/tierABaseline.ts");
ok("tier-A merge labeled teaching", /Tier-A teaching/.test(tier));
ok("tier-A uses getExampleById", /getExampleById/.test(tier));
ok("tier-A merges related entities", /relatedEntities/.test(tier));

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline applies tier-A baseline", /applyTierABaseline/.test(pipe));
ok("pipeline applies plant deliverables", /applyPlantDeliverables/.test(pipe));

const rc = read("components/RouteCompare.tsx");
ok("route compare supports single route", /usable\.length === 1/.test(rc));
ok("route compare shows BOM panel", /BOM \/ materials/.test(rc));

const live = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live shows tier-A merged banner", /Optional teaching baseline|Tier-A teaching baseline/.test(live));
ok("live recipe primary order", /Process recipe/.test(live));

console.log(`\nAll plant-parity contracts passed (${passed}).`);
