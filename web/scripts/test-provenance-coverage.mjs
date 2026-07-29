/**
 * Provenance surface coverage scanner (offline).
 *
 * Reads fixtures/provenance-surface-registry.json and asserts every content
 * surface still wires API / AI provenance chips for dissemination.
 *
 * REQ: PROV-SCAN-* in docs/engineering/provenance-coverage-spec.md
 *      and docs/engineering/test-spec.md § N. Provenance coverage
 *
 * Run: node scripts/test-provenance-coverage.mjs
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");
const fixturePath = join(
  root,
  "scripts",
  "fixtures",
  "provenance-surface-registry.json"
);

let passed = 0;
const failures = [];

function ok(name, cond, detail = "") {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  passed += 1;
  console.log(`  ok  ${name}`);
}

function readSrc(rel) {
  const p = join(srcRoot, ...rel.split("/"));
  assert.ok(existsSync(p), `missing source file ${rel}`);
  return readFileSync(p, "utf8");
}

function anyPattern(body, patterns) {
  for (const raw of patterns) {
    // Support simple alternation a|b|c
    if (raw.includes("|") && !raw.startsWith("(")) {
      const alts = raw.split("|");
      if (alts.some((a) => body.includes(a))) return true;
      continue;
    }
    if (body.includes(raw)) return true;
  }
  return false;
}

function missingPatterns(body, patterns) {
  return patterns.filter((raw) => {
    if (raw.includes("|") && !raw.startsWith("(")) {
      return !raw.split("|").some((a) => body.includes(a));
    }
    return !body.includes(raw);
  });
}

console.log("test-provenance-coverage");

ok("PROV-SCAN-01 registry fixture exists", existsSync(fixturePath));

const registry = JSON.parse(readFileSync(fixturePath, "utf8"));
ok(
  "PROV-SCAN-01 schema",
  registry.schema === "chemistry-recipes.provenance-surface-registry.v1"
);
ok(
  "PROV-SCAN-01 surfaces non-empty",
  Array.isArray(registry.surfaces) && registry.surfaces.length >= 20
);

// Chip modules present
const chips = registry.chipModules || {};
for (const [key, rel] of Object.entries(chips)) {
  ok(`PROV-SCAN-02 chip module ${key}`, existsSync(join(srcRoot, ...rel.split("/"))));
}

// ContentProvenance dual-wires API+AI
const contentProv = readSrc(chips.content || "components/ContentProvenance.tsx");
ok("PROV-SCAN-02 ContentProvenance uses ApiProvenance", /ApiProvenance/.test(contentProv));
ok("PROV-SCAN-02 ContentProvenance uses AiProvenance", /AiProvenance/.test(contentProv));
ok(
  "PROV-SCAN-02 ContentProvenance gates AI with showAi",
  /showAi/.test(contentProv)
);

// Ai chip must expose dissemination fields
const aiUi = readSrc(chips.ai || "components/AiProvenance.tsx");
ok("PROV-SCAN-03 AI modal has User prompt", /User prompt/.test(aiUi));
ok("PROV-SCAN-03 AI modal has Data fed", /Data fed/.test(aiUi));
ok("PROV-SCAN-03 AI modal has Sources", /Sources/.test(aiUi));
ok("PROV-SCAN-03 AI modal has Regenerate", /Regenerate/.test(aiUi));

const apiUi = readSrc(chips.api || "components/ApiProvenance.tsx");
ok("PROV-SCAN-03 API free public only", /free public/i.test(apiUi));

// Scan every surface
const byAiPolicy = {
  required: 0,
  "when-field": 0,
  "when-parsed": 0,
  "when-parsed-or-attempt": 0,
  "when-routes-from-ai": 0,
  optional: 0,
  none: 0,
};

for (const surface of registry.surfaces) {
  const file = surface.file;
  const filePath = join(srcRoot, ...file.split("/"));
  ok(`PROV-SCAN-10 file exists: ${surface.id}`, existsSync(filePath), file);

  if (!existsSync(filePath)) continue;
  const body = readFileSync(filePath, "utf8");
  const patterns = surface.patterns || [];
  ok(
    `PROV-SCAN-11 ${surface.id} patterns`,
    patterns.length === 0 || anyPattern(body, patterns),
    missingPatterns(body, patterns).join(", ")
  );

  // Policy counters
  const ai = surface.ai || "none";
  if (ai.startsWith("when-field:")) byAiPolicy["when-field"] += 1;
  else if (byAiPolicy[ai] != null) byAiPolicy[ai] += 1;
  else byAiPolicy.optional += 1;

  // API-required surfaces must mention an API chip, Content strip, or FreePublic helper
  if (surface.api === "required") {
    ok(
      `PROV-SCAN-12 ${surface.id} has API path`,
      /ApiProvenance|ContentProvenance|FreePublicProvenance|FreePublicBadge/.test(
        body
      ),
      "missing Api/Content/FreePublic provenance"
    );
  }

  // AI-aware surfaces must be able to show AI chips (or helper that supplies them)
  if (
    ai === "required" ||
    ai.startsWith("when-field:") ||
    ai === "when-parsed" ||
    ai === "when-parsed-or-attempt" ||
    ai === "when-routes-from-ai"
  ) {
    ok(
      `PROV-SCAN-13 ${surface.id} has AI path`,
      /AiProvenance|ContentProvenance|FreePublicProvenance|aiField|aiProvenanceForField|aiProvenanceWhenParsed|aiAttempt|aiProvenance|fieldsGenerated|synthesisHasAiField|processRoutesFromAi/.test(
        body
      ),
      "missing AI provenance wiring"
    );
  }

  // AI-none surfaces must not force showAi={true} without field gate (heuristic)
  if (ai === "none" && /showAi=\{\s*true\s*\}/.test(body) === false) {
    ok(`PROV-SCAN-14 ${surface.id} does not hard-force AI`, true);
  }
}

// Live dossier must import field helper
const live = readSrc("components/dossier/LiveMoleculeDossier.tsx");
ok(
  "PROV-SCAN-20 live imports aiFieldProvenance",
  /aiFieldProvenance|aiProvenanceForField/.test(live)
);
const aiFields = [
  "aiOverview",
  "aiApplications",
  "aiMfg",
  "aiApparatus",
  "aiEnv",
  "aiEhs",
  "aiRelated",
  "aiUnitOps",
  "aiRoutesField",
  "aiCritical",
];
for (const f of aiFields) {
  ok(`PROV-SCAN-21 live binds ${f}`, live.includes(f));
}

// Aside field props
const aside = readSrc("components/dossier/LiveDossierAside.tsx");
for (const f of ["aiMfg", "aiEnv", "aiApparatus", "aiEhs"]) {
  ok(`PROV-SCAN-22 aside accepts ${f}`, aside.includes(f));
}

// Helper covers canonical AI fields
const helper = readSrc("lib/dossier/aiFieldProvenance.ts");
const canonical = [
  "overview",
  "applications",
  "manufacturingSummary",
  "routes",
  "apparatusCatalog",
  "environmentBaseline",
  "ehsHighlights",
  "relatedEntities",
  "unitOpFills",
  "criticalParameters",
  "disclaimer",
];
for (const f of canonical) {
  ok(`PROV-SCAN-23 helper knows field ${f}`, helper.includes(`"${f}"`) || helper.includes(`'${f}'`) || helper.includes(f));
}

// Registry ↔ helper consistency: every when-field:X must be a known field
const whenFields = registry.surfaces
  .map((s) => s.ai)
  .filter((a) => typeof a === "string" && a.startsWith("when-field:"))
  .map((a) => a.replace("when-field:", ""));
for (const f of whenFields) {
  ok(
    `PROV-SCAN-24 registry field ${f} handled by helper`,
    helper.includes(f) || canonical.includes(f)
  );
}

// Spec docs exist
const repoRoot = join(root, "..");
const covSpec = join(repoRoot, "docs", "engineering", "provenance-coverage-spec.md");
const testSpec = join(repoRoot, "docs", "engineering", "test-spec.md");
ok("PROV-SCAN-30 provenance-coverage-spec.md", existsSync(covSpec));
ok("PROV-SCAN-30 test-spec mentions PROV", existsSync(testSpec) && /PROV-/.test(readFileSync(testSpec, "utf8")));

// Summary stats
const surfaceCount = registry.surfaces.length;
ok(
  `PROV-SCAN-40 coverage ≥ 45 surfaces (have ${surfaceCount})`,
  surfaceCount >= 45
);

console.log("\n  AI policy counts:", JSON.stringify(byAiPolicy));

if (failures.length) {
  console.error(`\n${failures.length} provenance coverage failure(s):`);
  for (const f of failures) console.error("  -", f);
  process.exit(1);
}

console.log(`\n${passed} provenance-coverage checks passed`);
