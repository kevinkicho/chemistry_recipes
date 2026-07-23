/**
 * Golden-structure contracts for Tier-A curated dossiers.
 * Ensures curated examples keep dual-view depth AI should not invent past.
 * Run: node scripts/test-tier-a-golden.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const molDir = path.join(__dirname, "..", "src", "data", "molecules");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

const files = fs.readdirSync(molDir).filter((f) => f.endsWith(".json"));
ok("tier-A molecule files exist", files.length >= 5);

for (const file of files) {
  const raw = fs.readFileSync(path.join(molDir, file), "utf8");
  const d = JSON.parse(raw);
  const id = d.id || file;
  ok(`${id}: has identifiers.name`, Boolean(d.identifiers?.name));
  ok(`${id}: has disclaimer`, Boolean(d.disclaimer));
  ok(`${id}: has routes array`, Array.isArray(d.routes) && d.routes.length >= 1);
  const route = d.routes[0];
  ok(`${id}: preferred route has steps`, Array.isArray(route.steps) && route.steps.length >= 2);
  ok(
    `${id}: steps have titles+descriptions`,
    route.steps.every(
      (s) => s.title && s.description && String(s.description).length >= 20
    )
  );
  // Golden: curated steps should carry sourceRefs when claiming process detail
  const withSrc = route.steps.filter((s) => s.sourceRefs?.length);
  ok(
    `${id}: at least one step has sourceRefs (citation discipline)`,
    withSrc.length >= 1 || route.sourceRefs?.length >= 1
  );
}

// Accuracy policy: AI must not invent IPC on thin evidence — mirrored law
ok(
  "product law file exists",
  fs.existsSync(path.join(__dirname, "..", "src", "lib", "dossier", "processFacts.ts"))
);

console.log(`\nAll Tier-A golden contracts passed (${passed}).`);
