/**
 * Contracts for live plant parity helpers (no Tier-A mock merge).
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

function exists(rel) {
  return fs.existsSync(path.join(src, rel));
}
ok("tier-A baseline module deleted", !exists("lib/dossier/tierABaseline.ts"));

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline has no tier-A baseline", !/applyTierABaseline/.test(pipe));
ok("pipeline applies plant deliverables", /applyPlantDeliverables/.test(pipe));
ok("pipeline runs AI when canCall", /runAi|canCall/.test(pipe));

const rc = read("components/RouteCompare.tsx");
ok("route compare supports single route", /usable\.length === 1/.test(rc));
ok("route compare shows BOM panel", /BOM \/ materials/.test(rc));

const live = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live densify dual-view banner", /Live free-public densify|dual-view/i.test(live));
ok("live has no Tier-A mock banner", !/Optional teaching baseline/.test(live));
ok("live recipe primary order", /Process recipe/.test(live));

console.log(`\nAll plant-parity contracts passed (${passed}).`);
