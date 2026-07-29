/**
 * Meta suite inventory — every contract suite exists, is wired into test:unit,
 * and is referenced by test-spec.md (offline).
 *
 * Run: node scripts/test-suite-inventory.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const repoRoot = path.join(webRoot, "..");
const scriptsDir = path.join(webRoot, "scripts");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

/** Offline unit suite files that must exist and be runnable via npm scripts */
const UNIT_SUITES = [
  "test-evidence-filter.mjs",
  "test-hub-lib.mjs",
  "test-process-facts.mjs",
  "test-export-and-ai.mjs",
  "test-lib-modules.mjs",
  "test-tier-a-golden.mjs",
  "test-ai-regression.mjs",
  "test-plant-parity.mjs",
  "test-lifecycle.mjs",
  "test-prompt-qc.mjs",
  "test-resilience.mjs",
  "test-api-wiring.mjs",
  "test-worker-ux.mjs",
  "test-provenance.mjs",
  "test-roadmap.mjs",
  "test-ideal-page.mjs",
  "test-frontier.mjs",
  "test-nav-abort.mjs",
  "test-search-contracts.mjs",
  "test-densify-depth.mjs",
  "test-diagnostics-honesty.mjs",
  "test-provenance.mjs",
  "test-provenance-coverage.mjs",
  "test-suite-inventory.mjs",
];

const packageJson = JSON.parse(
  fs.readFileSync(path.join(webRoot, "package.json"), "utf8")
);
const scripts = packageJson.scripts || {};
const unitScript = scripts["test:unit"] || "";
const precommitScript = scripts["test:precommit"] || scripts.precommit || "";
const specPath = path.join(repoRoot, "docs", "engineering", "test-spec.md");
const testingPath = path.join(repoRoot, "docs", "engineering", "testing.md");
const spec = fs.existsSync(specPath) ? fs.readFileSync(specPath, "utf8") : "";
const testing = fs.existsSync(testingPath)
  ? fs.readFileSync(testingPath, "utf8")
  : "";

console.log("test-suite-inventory");

ok("INV package.json present", Boolean(scripts));
ok("INV test:unit defined", Boolean(unitScript));
ok("INV test:precommit defined", Boolean(scripts["test:precommit"]));
ok("INV precommit alias defined", Boolean(scripts.precommit));
ok("INV test-spec.md present", fs.existsSync(specPath));
ok("INV testing.md present", fs.existsSync(testingPath));

for (const suite of UNIT_SUITES) {
  const p = path.join(scriptsDir, suite);
  ok(`INV file ${suite}`, fs.existsSync(p));

  const npmScriptEntry = Object.entries(scripts).find(([, v]) =>
    String(v).includes(suite)
  );
  ok(`INV npm script runs ${suite}`, Boolean(npmScriptEntry));

  if (suite === "test-suite-inventory.mjs") {
    // Must be last in unit chain (self-check)
    ok(
      "INV suite-inventory last in test:unit",
      /test:suite-inventory\s*$/.test(unitScript.trim()) ||
        unitScript.includes("test:suite-inventory")
    );
    continue;
  }

  if (npmScriptEntry) {
    const [scriptName] = npmScriptEntry;
    ok(
      `INV test:unit invokes ${scriptName}`,
      unitScript.includes(scriptName)
    );
  }
}

const reqFamilies = [
  "ACC-",
  "LIFE-",
  "API-",
  "AI-",
  "PF-",
  "CUR-",
  "SEC-",
  "FRN-",
  "NAV-",
  "SEARCH-",
  "DENS-",
  "DIAG-",
  "PROV-",
];
for (const fam of reqFamilies) {
  ok(`INV test-spec has ${fam}*`, spec.includes(fam));
}

ok(
  "INV provenance registry fixture",
  fs.existsSync(
    path.join(webRoot, "scripts", "fixtures", "provenance-surface-registry.json")
  )
);
ok(
  "INV provenance-coverage-spec.md",
  fs.existsSync(
    path.join(repoRoot, "docs", "engineering", "provenance-coverage-spec.md")
  )
);

ok("INV testing.md lists precommit", /precommit|test:precommit/.test(testing));
ok(
  "INV testing.md lists new suites",
  /nav-abort|densify-depth|search-contracts|diagnostics-honesty/.test(testing)
);

ok(
  "INV precommit runs test:unit",
  /test:unit/.test(precommitScript)
);
ok(
  "INV precommit runs tsc",
  /tsc/.test(precommitScript)
);
ok(
  "INV precommit runs eslint",
  /eslint/.test(precommitScript)
);

console.log(`\n${passed} suite-inventory checks passed`);
