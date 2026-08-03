/**
 * Contracts for API harvest agent (tools + local planner).
 * Run: node scripts/test-api-agent.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

console.log("test-api-agent");

ok("apiAgent module", fs.existsSync(path.join(src, "lib/frontier/apiAgent.ts")));
ok("apiAgentTools module", fs.existsSync(path.join(src, "lib/frontier/apiAgentTools.ts")));
ok("api-agent route", fs.existsSync(path.join(src, "app/api/ai/api-agent/route.ts")));

const agent = read("lib/frontier/apiAgent.ts");
ok("exports runApiHarvestAgent", /export async function runApiHarvestAgent/.test(agent));
ok("exports planLocalHarvestActions", /export function planLocalHarvestActions/.test(agent));
ok("LLM planner system", /free-public API harvest agent/.test(agent));
ok("local planner fallback", /planLocalHarvestActions/.test(agent));
ok("never invent plant", /NEVER invent|never invent plant/i.test(agent));
ok("bounded steps", /MAX_STEPS/.test(agent));

const tools = read("lib/frontier/apiAgentTools.ts");
ok("tool retry_failed_families", /retry_failed_families/.test(tools));
ok("tool run_densify_pass", /run_densify_pass/.test(tools));
ok("tool inspect_state", /inspect_state/.test(tools));
ok("tool promote_annotations", /promote_annotations/.test(tools));
ok("tool compliance_check", /compliance_check/.test(tools));
ok("assessHarvestCompliance", /export function assessHarvestCompliance/.test(tools));
ok("tool stop", /"stop"/.test(tools));
ok("executeApiTool export", /export async function executeApiTool/.test(tools));
ok("agent reactive roles", /role: \"react\"|\"compliance\"/.test(agent));
ok("agent stagnant handling", /stagnant/.test(agent));

const gather = read("lib/dossier/gather.ts");
ok("gather uses runApiHarvestAgent", /runApiHarvestAgent/.test(gather));
ok("gather no longer hardcodes densify-if tree", !/const shouldDensify\s*=/.test(gather));
ok("gather no longer hardcodes auto-retry chain", !/auto-redensify · after soft-fail/.test(gather));
ok("gather notes agent-orchestrated", /agent-orchestrated|api-agent/.test(gather));

// Local planner executable port (mirror policy)
function planLocal(state, already) {
  const softFails = Number(state.softFails || 0);
  const needsDensify = Boolean(state.needsDensify);
  const failed = state.failedFamilies || [];
  const thin = needsDensify || Number(state.procedureExcerpts || 0) < 3;
  if (!already.has("inspect_state")) return [{ tool: "inspect_state" }];
  if (thin && (softFails >= 2 || failed.length >= 1) && !already.has("retry_failed_families"))
    return [{ tool: "retry_failed_families" }];
  if (thin && !already.has("run_densify_pass")) return [{ tool: "run_densify_pass" }];
  if ((already.has("run_densify_pass") || already.has("retry_failed_families")) && !already.has("reextract_process_facts"))
    return [{ tool: "reextract_process_facts" }];
  if (!already.has("score_evidence")) return [{ tool: "score_evidence" }];
  return [{ tool: "stop" }];
}

const a = new Set();
ok("exec plan starts inspect", planLocal({ softFails: 0 }, a)[0].tool === "inspect_state");
a.add("inspect_state");
ok(
  "exec plan retries when thin+fails",
  planLocal({ softFails: 3, needsDensify: true, failedFamilies: ["europepmc"], procedureExcerpts: 0 }, a)[0]
    .tool === "retry_failed_families"
);
a.add("retry_failed_families");
ok(
  "exec plan densifies when thin",
  planLocal({ softFails: 0, needsDensify: true, procedureExcerpts: 0 }, a)[0].tool ===
    "run_densify_pass"
);
a.add("run_densify_pass");
ok(
  "exec plan reextracts",
  planLocal({ softFails: 0, needsDensify: false, procedureExcerpts: 5 }, a)[0].tool ===
    "reextract_process_facts"
);
a.add("reextract_process_facts");
ok(
  "exec plan scores",
  planLocal({ softFails: 0, needsDensify: false, procedureExcerpts: 5 }, a)[0].tool ===
    "score_evidence"
);
a.add("score_evidence");
ok("exec plan stops", planLocal({}, a)[0].tool === "stop");

console.log(`\n${n} api-agent checks passed`);
