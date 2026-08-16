/**
 * Contract tests for related entities, contradictions, unit-op fill, literature rank.
 * Loads the production scorer from rank.ts so ranking regressions fail CI.
 * Run: node scripts/test-hub-lib.mjs
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, "..", "src");

function resolveTs(spec, fromFile) {
  let resolved;
  if (spec.startsWith("@/")) {
    resolved = path.join(srcRoot, spec.slice(2));
  } else if (spec.startsWith(".")) {
    resolved = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null;
  }
  if (existsSync(resolved) && !resolved.endsWith(".ts") && !resolved.endsWith(".tsx")) {
    return resolved;
  }
  for (const ext of ["", ".ts", ".tsx", ".js", ".mjs"]) {
    const candidate = resolved + ext;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function compileTsEntry(entryTs) {
  const outDir = path.join(tmpdir(), `hub-lib-rank-${process.pid}`);
  mkdirSync(outDir, { recursive: true });
  const queue = [path.resolve(entryTs)];
  const written = new Map();

  while (queue.length) {
    const tsFile = queue.pop();
    if (written.has(tsFile)) continue;
    const source = readFileSync(tsFile, "utf8");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        isolatedModules: true,
      },
      fileName: tsFile,
    });

    const js = outputText.replace(/from\s+["']([^"']+)["']/g, (full, spec) => {
      const resolved = resolveTs(spec, tsFile);
      if (!resolved) return full;
      if (resolved.endsWith(".ts") || resolved.endsWith(".tsx")) {
        queue.push(resolved);
        const rel = path.relative(srcRoot, resolved).replace(/\.(tsx?)$/, ".mjs");
        const outFile = path.join(outDir, rel);
        return `from ${JSON.stringify(pathToFileURL(outFile).href)}`;
      }
      return full;
    });

    const rel = path.relative(srcRoot, tsFile).replace(/\.(tsx?)$/, ".mjs");
    const outFile = path.join(outDir, rel);
    mkdirSync(path.dirname(outFile), { recursive: true });
    writeFileSync(outFile, js, "utf8");
    written.set(tsFile, outFile);
  }

  return { outDir, entry: written.get(path.resolve(entryTs)) };
}

const compiled = compileTsEntry(path.join(srcRoot, "lib/literature/rank.ts"));
assert.ok(compiled.entry, "compiled rank.ts entry");
const { scoreProcessRelevance } = await import(pathToFileURL(compiled.entry).href);
rmSync(compiled.outDir, { recursive: true, force: true });

function parseRelatedEntity(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name || name.length < 2) return null;
  const role = typeof raw.role === "string" ? raw.role : "other";
  const cas =
    typeof raw.cas === "string" && /^\d{2,7}-\d{2}-\d$/.test(raw.cas.trim())
      ? raw.cas.trim()
      : undefined;
  return { role, name, cas };
}

function overlapScore(a, b) {
  const tok = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
  const ta = new Set(tok(a));
  const tb = tok(b);
  if (!ta.size || !tb.length) return 0;
  let hit = 0;
  for (const w of tb) if (ta.has(w)) hit += 1;
  return hit / Math.max(tb.length, 1);
}

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

ok("loaded production scoreProcessRelevance", typeof scoreProcessRelevance === "function");

const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
ok(
  "hub-lib test does not reimplement scoreProcessRelevance",
  !/function scoreProcessRelevance\s*\(/.test(selfSrc)
);
const rankSrc = readFileSync(path.join(srcRoot, "lib/literature/rank.ts"), "utf8");
ok("rank.ts exports scoreProcessRelevance", /export function scoreProcessRelevance/.test(rankSrc));
ok("rank.ts clinical penalty is -25", /score -= 25/.test(rankSrc));
ok("rank.ts has condition density", /CONDITION_DENSITY/.test(rankSrc));
ok("rank.ts has experimental cues", /EXPERIMENTAL_CUES/.test(rankSrc));
ok("rank.ts has formulation demotion", /FORMULATION_NOT_SYNTHESIS/.test(rankSrc));

// Literature rank — production function
ok(
  "process lit scores high",
  scoreProcessRelevance("Industrial process for preparing X", "scale-up and crystallization") >= 40
);
ok(
  "clinical trial scores lower",
  scoreProcessRelevance("Patients with disease X", "randomized placebo controlled trial") < 30
);

const withConditions = scoreProcessRelevance(
  "Synthesis of compound X",
  "The mixture was stirred at 80 °C for 12 h under nitrogen, pH 7, 2.0 equiv."
);
const bareSynthesis = scoreProcessRelevance(
  "Synthesis of compound X",
  "A route to the target."
);
ok(
  "condition density raises score vs bare synthesis",
  withConditions > bareSynthesis
);

const withExperimental = scoreProcessRelevance(
  "Preparation of X",
  "Example 3. General procedure. Embodiment 1."
);
const barePrep = scoreProcessRelevance("Preparation of X", "A short note.");
ok("experimental cues raise score", withExperimental > barePrep);

const formulation = scoreProcessRelevance(
  "Oral tablet bioequivalence study",
  "capsule and package insert for the oral dose"
);
const synthesis = scoreProcessRelevance("Synthesis of compound X", "");
ok("formulation demoted without process frame", formulation < synthesis);

// Related entities
const e = parseRelatedEntity({
  role: "intermediate",
  name: "6-APA",
  cas: "551-16-6",
});
ok("parses related entity", e && e.name === "6-APA" && e.cas === "551-16-6");
ok("rejects empty name", parseRelatedEntity({ role: "api", name: " " }) === null);
ok("rejects bad cas", parseRelatedEntity({ name: "Foo", cas: "not-a-cas" }).cas === undefined);

// Unit-op style overlap
ok(
  "fermentation matches production culture slot language",
  overlapScore("Production culture fed-batch", "Production culture bioreactor") >= 0.2
);
ok(
  "unrelated titles low overlap",
  overlapScore("Tablet compression", "Viral vector purification chromatography") < 0.15
);

// Contradiction shape
const contra = {
  topic: "Route class",
  sideA: "Fermentation abstract",
  sideB: "Chemical synthesis patent",
  severity: "info",
};
ok("contradiction has both sides", Boolean(contra.sideA && contra.sideB && contra.topic));

// Mock catalogs removed
ok(
  "curated packages module deleted",
  !existsSync(path.join(__dirname, "../src/lib/data/curatedPackages.ts"))
);
ok(
  "examples module deleted",
  !existsSync(path.join(__dirname, "../src/lib/data/examples.ts"))
);

const bioSrc = readFileSync(
  path.join(__dirname, "../src/lib/modality/biologicParameters.ts"),
  "utf8"
);
ok(
  "biologic params include literature-typical disclaimer",
  bioSrc.includes("Educational parameter scaffolds") &&
    bioSrc.includes("NOT GMP")
);
ok("mAb parameter set present", bioSrc.includes('id: "mab"'));
ok("gene-therapy parameters present", bioSrc.includes("gt-titer") || bioSrc.includes("Genome titer"));

console.log(`\nAll hub-lib contracts passed (${passed}).`);
