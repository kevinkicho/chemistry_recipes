/**
 * Ideal page parity contracts — live densify depth goal (no Tier-A mock JSON).
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
ok("goal mentions process depth", /ideal|process recipe|depth/i.test(ideal));

const tiera = read("lib/dossier/tierABaseline.ts");
ok("tierA is no-op (mocks removed)", /No-op|never inject mock/i.test(tiera));
ok("tierA exports applyTierABaseline", /export function applyTierABaseline/.test(tiera));

const live = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live Ideal chip", /Ideal.*idealParity|idealParity\.score/.test(live));
ok("live IdealPageParityPanel", /IdealPageParityPanel/.test(live));

const thin = read("components/ThinToUsefulBanner.tsx");
ok("thin path mentions ideal", /ideal|Ideal/.test(thin));

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline attaches ideal parity", /withIdealPageParity/.test(pipe));

const types = read("lib/dossier/types.ts");
ok("LiveDossier idealParity field", /idealParity\?/.test(types));

// Mock molecule JSON removed — live densify is the product
const moleculesDir = join(root, "src/data/molecules");
ok("molecules dir exists", existsSync(moleculesDir));
ok(
  "no aspirin mock JSON",
  !existsSync(join(moleculesDir, "aspirin.json"))
);

const examples = read("lib/data/examples.ts");
ok("examples catalog empty stubs", /return \[\]/.test(examples));
ok("getExampleById always undefined", /return undefined/.test(examples));

console.log(`\n${n} ideal-page checks passed`);
