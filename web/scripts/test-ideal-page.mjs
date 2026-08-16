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

ok("tierA baseline deleted", !existsSync(join(root, "src/lib/dossier/tierABaseline.ts")));
ok("examples.ts deleted", !existsSync(join(root, "src/lib/data/examples.ts")));

const live = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live Ideal chip", /Ideal.*idealParity|idealParity\.score/.test(live));
ok("live IdealPageParityPanel", /IdealPageParityPanel/.test(live));

const thin = read("components/ThinToUsefulBanner.tsx");
ok("thin path mentions ideal", /ideal|Ideal/.test(thin));

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline attaches ideal parity", /withIdealPageParity/.test(pipe));
ok("pipeline has no tier-A baseline", !/applyTierABaseline/.test(pipe));

const types = read("lib/dossier/types.ts");
ok("LiveDossier idealParity field", /idealParity\?/.test(types));
ok(
  "ideal page overlays harvest-failure copy",
  /honestIdealEmptyCopy/.test(ideal) &&
    /isStubOnlyProcessSequence/.test(ideal) &&
    /harvest-fail/.test(ideal)
);
ok(
  "ideal panel labels harvest-fail",
  /harvest-fail/.test(read("components/IdealPageParityPanel.tsx"))
);

// Mock molecule JSON removed — live densify is the product
const moleculesDir = join(root, "src/data/molecules");
ok("molecules dir exists", existsSync(moleculesDir));
ok(
  "no aspirin mock JSON",
  !existsSync(join(moleculesDir, "aspirin.json"))
);

console.log(`\n${n} ideal-page checks passed`);
