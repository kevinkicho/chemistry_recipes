/**
 * Horizon B contracts: adaptive gather + agent pack export.
 * Run: node scripts/test-horizon-b.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log("ok  ", name);
}

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

console.log("test-horizon-b");

const adaptive = read("lib/dossier/gatherAdaptive.ts");
ok("gatherAdaptive module", fs.existsSync(path.join(src, "lib/dossier/gatherAdaptive.ts")));
ok("recommendedGatherConcurrency", /export function recommendedGatherConcurrency/.test(adaptive));
ok("mapSoftWave", /export async function mapSoftWave/.test(adaptive));
ok("uses rateLimitedHosts", /rateLimitedHosts/.test(adaptive));
ok("uses mapPool", /mapPool/.test(adaptive));
ok("concurrency tightens under pressure", /pressure >= 4|return 3/.test(adaptive));

// Executable concurrency mirror
function recommended(rl, circuits) {
  const pressure = rl + Math.min(3, Math.floor(circuits / 1));
  if (pressure >= 4) return 3;
  if (pressure >= 2) return 5;
  if (pressure >= 1) return 7;
  return 10;
}
ok("no pressure → 10", recommended(0, 0) === 10);
ok("1 RL → 7", recommended(1, 0) === 7);
ok("2 RL → 5", recommended(2, 0) === 5);
ok("4 RL → 3", recommended(4, 0) === 3);

const gather = read("lib/dossier/gather.ts");
ok("gather uses mapSoftWave", /mapSoftWave/.test(gather));
ok("gather etiquette snapshot note", /gather-etiquette|gatherEtiquetteSnapshot/.test(gather));
ok("gather adaptive inter-wave delay", /recommendedInterWaveDelayMs/.test(gather));

const agentPack = read("lib/export/agentPack.ts");
ok("agentPack schema v1", /agent-pack\.v1/.test(agentPack));
ok("buildAgentPack export", /export function buildAgentPack/.test(agentPack));
ok("includes aiGuidance", /aiGuidance/.test(agentPack));
ok("includes processKnowledge", /processKnowledge/.test(agentPack));
ok("includes densifyNext", /densifyNext/.test(agentPack));
ok("includes harvestAgent", /harvestAgent/.test(agentPack));
ok("includes idealParity", /idealParity/.test(agentPack));

const tt = read("lib/export/techTransfer.ts");
ok("techTransfer re-exports agent pack", /buildAgentPack/.test(tt));

const ui = read("components/TechTransferExport.tsx");
ok("UI Agent pack button", /onAgentPack|Agent pack/.test(ui));
ok("UI downloads agent-pack-v1", /agent-pack-v1/.test(ui));

console.log(`\n${n} horizon-b checks passed`);
