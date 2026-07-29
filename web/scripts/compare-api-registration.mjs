/**
 * Compare registered sources vs gather families vs health probes.
 * Run: node scripts/compare-api-registration.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(web, rel), "utf8");
}

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

const reg = read("src/lib/sources/registry.ts");
const regIds = [...reg.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
const uniqueReg = [...new Set(regIds)];

const gather = read("src/lib/dossier/gather.ts");
const softAll = [
  ...new Set(
    [...gather.matchAll(/soft\(\s*"([a-z0-9-]+)"/gi)].map((m) => m[1])
  ),
].sort();
const softBase = softAll.filter((s) => !s.endsWith("-retry"));

const apiMods = fs
  .readdirSync(path.join(web, "src/lib/api"))
  .filter((f) => f.endsWith(".ts"))
  .filter(
    (f) =>
      ![
        "trace.ts",
        "rateLimit.ts",
        "hostCircuit.ts",
        "publicSources.ts",
      ].includes(f)
  )
  .map((f) => f.replace(/\.ts$/, ""))
  .sort();

const health = read("scripts/test-api-health-full.mjs");
const probeIds = [...health.matchAll(/^\s*id:\s*"([^"]+)"/gm)]
  .map((m) => m[1])
  .filter((id) => !id.startsWith("app-"));
const probeGather = [
  ...new Set(
    [...health.matchAll(/gather:\s*"([^"]+)"/g)].map((m) => m[1])
  ),
].sort();

const cat = read("src/lib/diagnostics/publicApiProbes.ts");
const catIds = [...cat.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);

const routes = walk(path.join(web, "src/app/api")).map((p) =>
  path
    .relative(path.join(web, "src/app"), p)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "")
    .replace(/^/, "/")
);

// docs manifest counts if present
let biointel = null;
const manPath = path.join(web, "..", "docs", "api-sources-manifest.json");
if (fs.existsSync(manPath)) {
  try {
    const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
    biointel = {
      uniqueSources: man.counts?.uniqueSources ?? man.sources?.length,
      panels: man.counts?.panels,
      title: man.title,
    };
  } catch {
    /* ignore */
  }
}

// soft base families not tagged on any health probe
const softUncovered = softBase.filter((s) => !probeGather.includes(s));

// registry ids without a fuzzy health probe match
function regCovered(id) {
  const tokens = id.split("-");
  const blob = (probeIds.join(" ") + " " + probeGather.join(" ")).toLowerCase();
  if (blob.includes(id.toLowerCase())) return true;
  if (tokens.every((t) => t.length < 3 || blob.includes(t))) return true;
  // special maps
  const aliases = {
    "pubchem-pug": "pubchem-pug",
    "pubchem-pug-view": "pubchem-pug-view",
    "europepmc-oa": "europepmc",
    "europepmc-patents": "europepmc",
    "uspto-pubchem-patent": "pubchem-patent",
    "pubchem-classification": "pubchem-class",
    "semantic-scholar": "semantic",
    massbank: "massbank",
    orgsyn: "orgsyn",
    ord: "ord",
  };
  if (aliases[id] && blob.includes(aliases[id])) return true;
  return false;
}
const regUncovered = uniqueReg.filter((id) => !regCovered(id));

console.log("=== Chemistry Recipes API registration layers ===\n");
console.log(
  `1. CHEMISTRY_API_SOURCES (product registry): ${uniqueReg.length} unique ids (${regIds.length} entries; ${regIds.length - uniqueReg.length} duplicate id(s))`
);
console.log(`2. gather soft() families:           ${softAll.length} (${softBase.length} base + retries)`);
console.log(`3. lib/api network clients:          ${apiMods.length}`);
console.log(`4. Full health suite probes:         ${probeIds.length} free-public (+ app probes separate)`);
console.log(`5. publicApiProbes catalog:          ${catIds.length}`);
console.log(`6. Next.js /api/* app routes:        ${routes.length}`);
if (biointel) {
  console.log(
    `7. docs/api-sources-manifest (BioIntel-era list): ~${biointel.uniqueSources} sources — NOT the live Chemistry Recipes gather set`
  );
}

console.log("\n=== Product registry IDs ===");
console.log(uniqueReg.join(", "));

console.log("\n=== Gather soft families (base) ===");
console.log(softBase.join(", "));

console.log("\n=== lib/api clients ===");
console.log(apiMods.join(", "));

console.log("\n=== Health probe gather= tags ===");
console.log(probeGather.join(", "));

console.log("\n=== Soft families with NO health gather= tag ===");
console.log(softUncovered.join(", ") || "(none)");

console.log("\n=== Registry IDs weakly / not matched by health suite ===");
console.log(regUncovered.join(", ") || "(none — fuzzy match)");

const regDupes = regIds.filter((id, i) => regIds.indexOf(id) !== i);
console.log("\n=== Registry duplicate ids ===");
console.log(regDupes.length ? regDupes.join(", ") : "(none)");

console.log("\n=== App /api routes (our backend, not free-public sources) ===");
for (const r of routes.sort()) console.log(" ", r);

console.log(`
=== How to read this ===
• The Sources / Diagnostics "registry" count is CHEMISTRY_API_SOURCES (~${uniqueReg.length}).
• Live densify uses gather soft() families (~${softBase.length} base APIs), not the BioIntel 100+ list.
• Health suite targets free-public *upstream* sources used by gather, not every /api/* app route.
• docs/api-sources-manifest.json is a broader historical BioIntel inventory — aspirational, not all wired.
`);

// Exit non-zero if coverage/duplicates regress
let code = 0;
if (softUncovered.length) {
  console.error(
    "FAIL: gather soft families missing health gather= tags: " +
      softUncovered.join(", ")
  );
  code = 2;
}
if (regDupes.length) {
  console.error("FAIL: duplicate registry ids: " + regDupes.join(", "));
  code = 2;
}
process.exit(code);
