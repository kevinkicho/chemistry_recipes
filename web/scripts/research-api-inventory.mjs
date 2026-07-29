/**
 * Research inventory: every free-public URL pattern used by Chemistry Recipes.
 * Run: node scripts/research-api-inventory.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const libRoot = path.join(webRoot, "src", "lib");
const apiRoot = path.join(libRoot, "api");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(webRoot, p).replace(/\\/g, "/");
}

const SKIP =
  /localhost|127\.0\.0\.1|example\.com|schema\.org|w3\.org|googleapis|firebaseio|gstatic|ollama\.com|openai\.com|anthropic|github\.com\/open-reaction-database\/ord-data|docs\.open-reaction|precision\.fda\.gov\/uniisearch/;

const files = walk(libRoot);
const byHost = new Map();
const byFile = new Map();

for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  const re = /https?:\/\/[^\s"'`\)\]\},]+/g;
  let m;
  while ((m = re.exec(t))) {
    let u = m[0].replace(/[,;.]+$/, "").replace(/\\n.*/, "");
    // Strip template junk
    u = u.replace(/\$\{[^}]+\}/g, "X");
    if (SKIP.test(u)) continue;
    let host;
    try {
      host = new URL(u).hostname;
    } catch {
      continue;
    }
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host).add(u);
    if (!byFile.has(rel(f))) byFile.set(rel(f), new Set());
    byFile.get(rel(f)).add(u);
  }
}

// API client modules only
const apiFiles = fs
  .readdirSync(apiRoot)
  .filter((n) => n.endsWith(".ts"))
  .sort();

console.log("=== API client modules (" + apiFiles.length + ") ===");
for (const n of apiFiles) {
  const urls = byFile.get("src/lib/api/" + n);
  console.log(n + (urls ? " · " + urls.size + " url(s)" : " · (no absolute urls)"));
  if (urls) {
    for (const u of [...urls].slice(0, 8)) console.log("   " + u);
  }
}

console.log("\n=== Host inventory (" + byHost.size + " hosts) ===");
for (const host of [...byHost.keys()].sort()) {
  const urls = [...byHost.get(host)];
  console.log(host + " · " + urls.length + " pattern(s)");
  for (const u of urls.slice(0, 5)) console.log("   " + u);
  if (urls.length > 5) console.log("   … +" + (urls.length - 5) + " more");
}

// Registry count
const reg = fs.readFileSync(
  path.join(libRoot, "sources", "registry.ts"),
  "utf8"
);
const regIds = [...reg.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
console.log("\n=== CHEMISTRY_API_SOURCES registry ids (" + regIds.length + ") ===");
console.log(regIds.join(", "));

// Gather soft labels / family names
const gather = fs.readFileSync(path.join(libRoot, "dossier", "gather.ts"), "utf8");
const softLabels = [
  ...new Set(
    [...gather.matchAll(/soft\(\s*"([a-z0-9-]+)"/gi)].map((m) => m[1])
  ),
].sort();
console.log("\n=== gather soft() family labels (" + softLabels.length + ") ===");
console.log(softLabels.join(", "));

// Diagnostics probes currently wired
const probes = fs.readFileSync(
  path.join(libRoot, "diagnostics", "probes.ts"),
  "utf8"
);
const probeIds = [...probes.matchAll(/probeGet\(\s*"([a-z0-9-]+)"/g)].map(
  (m) => m[1]
);
console.log("\n=== Current runPublicApiProbes ids (" + probeIds.length + ") ===");
console.log(probeIds.join(", "));

const missingFromProbes = regIds.filter((id) => {
  // rough map
  const base = id.replace(/-oa$|-patents$|-patent$/, "").replace("pubchem-pug", "pubchem");
  return !probeIds.some(
    (p) =>
      id.includes(p) ||
      p.includes(id.split("-")[0]) ||
      base.includes(p) ||
      p.includes(base)
  );
});
console.log(
  "\n=== Registry ids with no clear probe counterpart (heuristic) ==="
);
console.log(missingFromProbes.join(", ") || "(none)");
