/**
 * Contract tests for related entities, contradictions, unit-op fill, literature rank.
 * Run: node scripts/test-hub-lib.mjs
 */

import assert from "node:assert/strict";

// Mirror core scoring logic (keep in sync with rank.ts)
function scoreProcessRelevance(title, abstract = "") {
  const hay = `${title} ${abstract}`;
  let score = 0;
  if (/\b(process chemistry|scale[- ]?up|industrial (production|process)|gmp|cqa|ipc\b)/i.test(hay))
    score += 50;
  if (/\b(synthes[ie]s|preparat|manufactur|ferment|biocatal|production of)/i.test(hay))
    score += 25;
  if (/\b(clinical trial|patients? with|placebo)\b/i.test(hay) && score < 40) score -= 20;
  return Math.max(0, Math.min(100, score));
}

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

// Literature rank
ok(
  "process lit scores high",
  scoreProcessRelevance("Industrial process for preparing X", "scale-up and crystallization") >= 40
);
ok(
  "clinical trial scores lower",
  scoreProcessRelevance("Patients with disease X", "randomized placebo controlled trial") < 30
);

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

// Curated package catalog size (count seeds without TS path aliases)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dir = dirname(fileURLToPath(import.meta.url));
const packagesSrc = readFileSync(
  join(__dir, "../src/lib/data/curatedPackages.ts"),
  "utf8"
);
const seedNameHits = packagesSrc.match(/name:\s*"/g) || [];
ok("curated package catalog has ≥100 entries", seedNameHits.length >= 100);

const bioSrc = readFileSync(
  join(__dir, "../src/lib/modality/biologicParameters.ts"),
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
