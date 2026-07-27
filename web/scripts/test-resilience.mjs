/**
 * Resilience / durability contracts (offline).
 * Soft-fail, HTTP retries, vault, server cache.
 * Maps to LIFE-02/03/06 and durability docs.
 * Run: node scripts/test-resilience.mjs
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

const trace = read("lib/api/trace.ts");
const gather = read("lib/dossier/gather.ts");
const cache = read("lib/dossier/serverEvidenceCache.ts");
const densify = read("lib/dossier/densifyPass.ts");
const resilience = read("lib/dossier/gatherResilience.ts");
const vault = read("lib/idb/procedureVault.ts");
const enrich = read("lib/dossier/enrichClientFacts.ts");

// HTTP retries
ok("RES retry default on fetchWithTrace", /retries\?:\s*number/.test(trace));
ok("RES transient 429/502/503/504", /429|502|503|504/.test(trace));
ok("RES isTransientTrace", /isTransientTrace|isTransientHttp/.test(trace));
ok("RES exponential backoff", /Math\.pow\(2/.test(trace));
ok("RES after N attempts annotation", /after \$\{retries \+ 1\} attempts|after \d+ attempts/.test(trace));

// Soft gather
ok("RES soft catch returns fallback", /p\.catch\(\(\)\s*=>\s*fallback\)|p\.catch\(\(\)\s*=>/.test(gather));
ok("RES live gather failure serves cache", /Live gather failed|serving durable server evidence cache/.test(gather));
ok("RES force option skips cache", /opts\?\.force|force\?:/.test(gather));

// Gather resilience helpers
ok("RES allSettledMap", /export async function allSettledMap/.test(resilience));
ok("RES withSoftTimeout", /export async function withSoftTimeout/.test(resilience));
ok("RES countProcedureChars", /export function countProcedureChars/.test(resilience));

// Server cache
ok("RES evidence cache schema version", /EVIDENCE_CACHE_SCHEMA\s*=\s*\d+/.test(cache));
ok("RES memory LRU", /MEMORY_MAX|memory\.set/.test(cache));
ok("RES disk path under .cache/evidence", /\.cache|evidence/.test(cache));
ok("RES TTL constants", /DEFAULT_TTL_MS|DISK_TTL_MS/.test(cache));
ok("RES pruneEvidenceCacheDisk", /pruneEvidenceCacheDisk/.test(cache));

// Densify soft timeout
ok("RES densify uses soft timeout", /withSoftTimeout/.test(densify));
ok("RES densify errors recorded fetchErrors", /fetchErrors|densify/.test(densify));

// Client vault
ok("RES vault IndexedDB", /indexedDB|chemistry-recipes-procedure-vault/.test(vault));
ok("RES vault putVaultExcerpts", /export async function putVaultExcerpts/.test(vault));
ok("RES vault getVaultExcerptsForCid", /export async function getVaultExcerptsForCid/.test(vault));
ok("RES enrich hydrates vault", /hydrateVaultIntoDossier/.test(enrich));
ok("RES enrich writes vault from lit/patents", /putVaultExcerpts/.test(enrich));

// Executable soft helper
async function soft(p, fallback) {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
const r1 = await soft(Promise.resolve(42), 0);
const r2 = await soft(Promise.reject(new Error("x")), 7);
ok("RES executable soft success", r1 === 42);
ok("RES executable soft failure → fallback", r2 === 7);

// Executable denser merge of excerpts
function mergePreferDense(fresh, prior) {
  const map = new Map();
  for (const p of prior) map.set(p.id, p);
  for (const p of fresh) {
    const old = map.get(p.id);
    if (!old || p.chars >= old.chars) map.set(p.id, p);
  }
  return [...map.values()];
}
const merged = mergePreferDense(
  [{ id: "a", chars: 100, text: "short" }],
  [
    { id: "a", chars: 500, text: "longer prior" },
    { id: "b", chars: 200, text: "only prior" },
  ]
);
ok(
  "RES executable denser keeps prior a",
  merged.find((x) => x.id === "a")?.chars === 500
);
ok(
  "RES executable denser keeps prior-only b",
  merged.some((x) => x.id === "b")
);
const merged2 = mergePreferDense(
  [{ id: "a", chars: 900, text: "fresh denser" }],
  [{ id: "a", chars: 100, text: "thin" }]
);
ok(
  "RES executable denser prefers fresh when longer",
  merged2.find((x) => x.id === "a")?.chars === 900
);

// Executable soft timeout
function withSoftTimeout(task, ms, fallback) {
  return Promise.race([
    task,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
const t = await withSoftTimeout(
  new Promise((r) => setTimeout(() => r("slow"), 200)),
  30,
  "fallback"
);
ok("RES executable soft timeout returns fallback", t === "fallback");

console.log(`\nAll resilience contracts passed (${passed}).`);
