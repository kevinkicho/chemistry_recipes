/**
 * Ideal page parity contracts — curated Tier-A is the depth goal.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (...p) => join(root, "src", ...p);

function read(rel) {
  const p = src(...rel.split("/"));
  assert.ok(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log(`  ok  ${name}`);
}

console.log("test-ideal-page");

const ideal = read("lib/dossier/idealPage.ts");
ok("exports assessIdealPageParity", /export function assessIdealPageParity/.test(ideal));
ok("exports withIdealPageParity", /export function withIdealPageParity/.test(ideal));
ok("exports isPreferredRouteThin", /export function isPreferredRouteThin/.test(ideal));
ok("process-recipe section", /process-recipe/.test(ideal));
ok("apparatus section", /apparatus/.test(ideal));
ok("environment section", /environment/.test(ideal));
ok("goal mentions curated", /curated Tier-A|ExampleDossierView/i.test(ideal));

const tiera = read("lib/dossier/tierABaseline.ts");
ok("tierA uses isPreferredRouteThin", /isPreferredRouteThin/.test(tiera));
ok("tierA promotes preference when thin", /thinLive \? 1/.test(tiera) || /preference: thinLive/.test(tiera));
ok("tierA labels ideal-page", /ideal-page|ideal page/i.test(tiera));

const live = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live Ideal chip", /Ideal.*idealParity|idealParity\.score/.test(live));
ok("live IdealPageParityPanel", /IdealPageParityPanel/.test(live));

const thin = read("components/ThinToUsefulBanner.tsx");
ok("thin path mentions ideal", /ideal|Ideal/.test(thin));

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline attaches ideal parity", /withIdealPageParity/.test(pipe));

const types = read("lib/dossier/types.ts");
ok("LiveDossier idealParity field", /idealParity\?/.test(types));

// Curated aspirin has ideal inventory keys
const asa = JSON.parse(
  readFileSync(join(root, "src/data/molecules/aspirin.json"), "utf8")
);
ok("curated aspirin has routes", Array.isArray(asa.routes) && asa.routes.length >= 1);
ok("curated aspirin has apparatusCatalog", Array.isArray(asa.apparatusCatalog));
ok("curated aspirin has environmentBaseline", Boolean(asa.environmentBaseline));
ok("curated aspirin has ehsHighlights", Array.isArray(asa.ehsHighlights));
ok("curated aspirin has manufacturingSummary", Boolean(asa.manufacturingSummary));
ok("curated aspirin has relatedEntities", Array.isArray(asa.relatedEntities));

console.log(`\n${n} ideal-page checks passed`);
