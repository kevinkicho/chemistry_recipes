/**
 * Cold-CID densify quality floors + contract wiring.
 * Offline: module floors + golden set + UI mounts.
 * Live: BASE_URL=… optional search probes.
 *
 * Run: node scripts/test-cold-cid-kpi.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "src");

let n = 0;
function ok(label, cond) {
  assert.ok(cond, label);
  n += 1;
  console.log("ok  ", label);
}

function read(rel) {
  return readFileSync(join(src, rel), "utf8");
}

console.log("test-cold-cid-kpi");

ok("coldCidKpi module", existsSync(join(src, "lib/dossier/coldCidKpi.ts")));
const kpi = read("lib/dossier/coldCidKpi.ts");
ok("GOLDEN_COLD_CIDS", /export const GOLDEN_COLD_CIDS/.test(kpi));
ok("COLD_CID_FLOORS", /export const COLD_CID_FLOORS/.test(kpi));
ok("evaluateColdCidFloors", /export function evaluateColdCidFloors/.test(kpi));
ok("procedure chars floor", /procedureChars:\s*800/.test(kpi));
ok("includes aspirin 2244", /cid:\s*2244/.test(kpi));
ok("includes baricitinib cold", /44205240/.test(kpi));

// Executable floor mirror
function evaluate(input) {
  const floors = { procedureChars: 800, processFacts: 2, idealParity: 35, evidenceScore: 28 };
  const gaps = [];
  if ((input.procedureChars ?? 0) < floors.procedureChars) gaps.push("proc");
  if ((input.processFacts ?? 0) < floors.processFacts) gaps.push("facts");
  if ((input.idealParity ?? 0) < floors.idealParity) gaps.push("ideal");
  if ((input.evidenceScore ?? 0) < floors.evidenceScore) gaps.push("ev");
  return { meetsFloor: gaps.length === 0, gaps };
}
ok("thin fails floor", !evaluate({ procedureChars: 100, processFacts: 0, idealParity: 10, evidenceScore: 10 }).meetsFloor);
ok("rich meets floor", evaluate({ procedureChars: 900, processFacts: 3, idealParity: 40, evidenceScore: 40 }).meetsFloor);

ok("mondayPath module", existsSync(join(src, "lib/dossier/mondayPath.ts")));
const mon = read("lib/dossier/mondayPath.ts");
ok("assessMondayPath", /export function assessMondayPath/.test(mon));
ok("collapseScienceLab", /collapseScienceLab/.test(mon));

ok("default worker role msat", /DEFAULT_WORKER_ROLE:\s*WorkerRole\s*=\s*"msat"/.test(read("lib/worker/roleMode.ts")));

const thin = read("components/ThinToUsefulBanner.tsx");
ok("ThinToUseful queue high densify", /Queue high densify|runDensifyActionQueue/.test(thin));
ok("ThinToUseful route neighborhood", /densifyRouteNeighborhood|Route neighborhood/.test(thin));
ok("ThinToUseful vault scroll", /procedure-vault/.test(thin));

ok("ProcedureVaultPanel", existsSync(join(src, "components/ProcedureVaultPanel.tsx")));
ok("ColdCidKpiPanel", existsSync(join(src, "components/ColdCidKpiPanel.tsx")));
ok("Live mounts ProcedureVaultPanel", /ProcedureVaultPanel/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("Live Science lab progressive", /Science lab · frontier|collapseScienceLab|assessMondayPath/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("Diagnostics ColdCidKpiPanel", /ColdCidKpiPanel/.test(read("app/diagnostics/page.tsx")));
ok("Workspace MSAT campaign first", /MSAT primary path|campaigns/.test(read("app/workspace/page.tsx")));

// Hub must not claim golden cold as curated mocks
const hub = read("lib/data/hubIndex.ts");
for (const cid of [44205240, 49831257, 46188928]) {
  ok(
    `cold CID ${cid} not in hubIndex`,
    !new RegExp(`pubchemCid:\\s*${cid}\\b`).test(hub)
  );
}

const BASE = process.env.BASE_URL || process.env.APPHOSTING_URL || "";
if (BASE) {
  console.log("\nLive KPI against", BASE);
  const smoke = [
    { name: "Aspirin", cid: 2244 },
    { name: "Baricitinib", cid: 44205240 },
  ];
  for (const c of smoke) {
    try {
      const r = await fetch(
        `${BASE}/api/search/pubchem?q=${encodeURIComponent(c.name)}`,
        { signal: AbortSignal.timeout(60_000) }
      );
      const j = await r.json();
      const hit = j.hits?.[0];
      ok(`live search ${c.name}`, hit?.cid === c.cid || (j.hits || []).some((h) => h.cid === c.cid));
    } catch (e) {
      ok(`live search ${c.name}`, false);
      console.error(" ", e.message || e);
    }
  }
} else {
  console.log("\n(No BASE_URL — contract-only KPI)");
}

console.log(`\n${n} cold-cid-kpi checks passed`);
