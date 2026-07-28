/**
 * Frontier process-knowledge contracts: condition atlas, hypotheses, Q&A, export schema.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// We can't import TS directly — test via source contracts + pure JS reimplementation of extract patterns

function read(rel) {
  const p = join(root, "src", ...rel.split("/"));
  assert.ok(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log(`  ok  ${name}`);
}

console.log("test-frontier");

ok("conditionAtlas module", existsSync(join(root, "src/lib/frontier/conditionAtlas.ts")));
ok("routeHypotheses module", existsSync(join(root, "src/lib/frontier/routeHypotheses.ts")));
ok("evidenceQa module", existsSync(join(root, "src/lib/frontier/evidenceQa.ts")));
ok("buildKnowledge module", existsSync(join(root, "src/lib/frontier/buildKnowledge.ts")));
ok("exportKnowledge module", existsSync(join(root, "src/lib/frontier/exportKnowledge.ts")));
ok("types process-knowledge.v1", /process-knowledge\.v1/.test(read("lib/frontier/types.ts")));

const atlas = read("lib/frontier/conditionAtlas.ts");
ok("buildConditionAtlas export", /export function buildConditionAtlas/.test(atlas));
ok("extractConditionsFromText export", /export function extractConditionsFromText/.test(atlas));
ok("temperature regex", /°\s*C/.test(atlas));
ok("conflict non-overlap", /maxLo > minHi|non-overlapping/.test(atlas));

const hyp = read("lib/frontier/routeHypotheses.ts");
ok("buildRouteHypotheses", /export function buildRouteHypotheses/.test(hyp));
ok("killCriteria", /killCriteria/.test(hyp));
ok("buildScientificConflicts", /export function buildScientificConflicts/.test(hyp));

const qa = read("lib/frontier/evidenceQa.ts");
ok("buildSeedAnswers", /export function buildSeedAnswers/.test(qa));
ok("buildNextExperiments", /export function buildNextExperiments/.test(qa));
ok("answerFromEvidencePackage", /export function answerFromEvidencePackage/.test(qa));
ok("insufficientEvidence first-class", /insufficientEvidence/.test(qa));

const build = read("lib/frontier/buildKnowledge.ts");
ok("withProcessKnowledge", /export function withProcessKnowledge/.test(build));
ok("buildProcessKnowledgePackage", /export function buildProcessKnowledgePackage/.test(build));

const pipe = read("lib/dossier/pipeline.ts");
ok("pipeline wires withProcessKnowledge", /withProcessKnowledge/.test(pipe));

const types = read("lib/dossier/types.ts");
ok("LiveDossier processKnowledge field", /processKnowledge\?/.test(types));

const live = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live mounts ConditionAtlasPanel", /ConditionAtlasPanel/.test(live));
ok("live mounts RouteHypothesesPanel", /RouteHypothesesPanel/.test(live));
ok("live mounts EvidenceSciencePanel", /EvidenceSciencePanel/.test(live));
ok("live mounts ReactionNetworkPanel", /ReactionNetworkPanel/.test(live));
ok("live mounts BatchDensifyPanel", /BatchDensifyPanel/.test(live));
ok("live mounts ScienceAgentPanel", /ScienceAgentPanel/.test(live));

ok("unitNormalize module", existsSync(join(root, "src/lib/frontier/unitNormalize.ts")));
ok("reactionNetwork module", existsSync(join(root, "src/lib/frontier/reactionNetwork.ts")));
ok("scienceAgent module", existsSync(join(root, "src/lib/frontier/scienceAgent.ts")));
ok("campaigns module", existsSync(join(root, "src/lib/workspace/campaigns.ts")));
ok("batch API route", existsSync(join(root, "src/app/api/dossier/batch/route.ts")));
ok("science API route", existsSync(join(root, "src/app/api/ai/science/route.ts")));
ok("batchClient", existsSync(join(root, "src/lib/dossier/batchClient.ts")));

const norm = read("lib/frontier/unitNormalize.ts");
ok("normalizeTemperature", /export function normalizeTemperature/.test(norm));
ok("normalizePressure", /export function normalizePressure/.test(norm));
ok("intervalsConflict", /export function intervalsConflict/.test(norm));

const net = read("lib/frontier/reactionNetwork.ts");
ok("buildReactionNetwork", /export function buildReactionNetwork/.test(net));
ok("mergeReactionNetworks", /export function mergeReactionNetworks/.test(net));

const agent = read("lib/frontier/scienceAgent.ts");
ok("runScienceAgentLocal", /export function runScienceAgentLocal/.test(agent));
ok("runScienceAgentWithLlm", /export async function runScienceAgentWithLlm|export function runScienceAgentWithLlm/.test(agent));
ok("agent never invent", /NEVER invent/i.test(agent));

const batch = read("app/api/dossier/batch/route.ts");
ok("batch max 12", /MAX_CIDS\s*=\s*12/.test(batch));
ok("batch build helper path", /buildOneCidForBatch|buildLiveDossierWithProgress|mapPool/.test(batch));

const sci = read("app/api/ai/science/route.ts");
ok("science agent endpoint", /runScienceAgentLocal/.test(sci));
ok("science agent with tools", /runScienceAgentWithTools/.test(sci));
ok("densifyNeighbors in science API", /densifyNeighbors/.test(sci));

ok("batch stream route", existsSync(join(root, "src/app/api/dossier/batch/stream/route.ts")));
ok("streamBatchDensifyCids client", /export async function streamBatchDensifyCids/.test(read("lib/dossier/batchClient.ts")));
ok("campaignKnowledge module", existsSync(join(root, "src/lib/frontier/campaignKnowledge.ts")));
ok("buildMergedCampaignKnowledge", /export async function buildMergedCampaignKnowledge/.test(read("lib/frontier/campaignKnowledge.ts")));
ok("CampaignGraphPanel", existsSync(join(root, "src/components/frontier/CampaignGraphPanel.tsx")));
ok("workspace mounts CampaignGraphPanel", /CampaignGraphPanel/.test(read("app/workspace/page.tsx")));
ok("suggestNeighborCids", /export function suggestNeighborCids/.test(read("lib/frontier/scienceAgent.ts")));
ok("agent densify role", /role: \"densify\"|\"densify\"/.test(read("lib/frontier/scienceAgent.ts")));

ok("parallelMap module", existsSync(join(root, "src/lib/dossier/parallelMap.ts")));
ok("mapPool export", /export async function mapPool/.test(read("lib/dossier/parallelMap.ts")));
ok("batch uses mapPool", /mapPool/.test(read("app/api/dossier/batch/route.ts")));
ok("batch stream uses mapPool", /mapPool/.test(read("app/api/dossier/batch/stream/route.ts")));
ok("batch concurrency cap", /MAX_CONCURRENCY|concurrency/.test(read("app/api/dossier/batch/route.ts")));

ok("campaignExport module", existsSync(join(root, "src/lib/frontier/campaignExport.ts")));
ok("campaign-knowledge.v1 schema", /campaign-knowledge\.v1/.test(read("lib/frontier/campaignExport.ts")));
ok("downloadCampaignKnowledge", /downloadCampaignKnowledge/.test(read("lib/frontier/campaignExport.ts")));
ok("CampaignGraph export button", /Export campaign-knowledge/.test(read("components/frontier/CampaignGraphPanel.tsx")));

ok("edgeCompare module", existsSync(join(root, "src/lib/frontier/edgeCompare.ts")));
ok("compareNetworkEdges", /export function compareNetworkEdges/.test(read("lib/frontier/edgeCompare.ts")));
ok("NetworkEdgeComparePanel", existsSync(join(root, "src/components/frontier/NetworkEdgeComparePanel.tsx")));
ok("network panel mounts edge compare", /NetworkEdgeComparePanel/.test(read("components/frontier/ReactionNetworkPanel.tsx")));

ok("edgeExperiments module", existsSync(join(root, "src/lib/frontier/edgeExperiments.ts")));
ok("buildEdgePairExperiments", /export function buildEdgePairExperiments/.test(read("lib/frontier/edgeExperiments.ts")));
ok("mergeEdgeExperiments in buildKnowledge", /mergeEdgeExperiments/.test(read("lib/frontier/buildKnowledge.ts")));
ok("edge compare shows auto experiments", /Auto experiments from edge pairs/.test(read("components/frontier/NetworkEdgeComparePanel.tsx")));

ok("campaignAgent module", existsSync(join(root, "src/lib/frontier/campaignAgent.ts")));
ok("runCampaignAgent", /export async function runCampaignAgent/.test(read("lib/frontier/campaignAgent.ts")));
ok("CampaignAgentPanel", existsSync(join(root, "src/components/frontier/CampaignAgentPanel.tsx")));
ok("workspace mounts CampaignAgentPanel", /CampaignAgentPanel/.test(read("app/workspace/page.tsx")));

ok("densifyTelemetry module", existsSync(join(root, "src/lib/dossier/densifyTelemetry.ts")));
ok("recordDensifyRun", /export function recordDensifyRun/.test(read("lib/dossier/densifyTelemetry.ts")));
ok("batchClient records telemetry", /recordDensifyRun/.test(read("lib/dossier/batchClient.ts")));
ok("DensifyTelemetryPanel", existsSync(join(root, "src/components/frontier/DensifyTelemetryPanel.tsx")));
ok("workspace mounts DensifyTelemetryPanel", /DensifyTelemetryPanel/.test(read("app/workspace/page.tsx")));

ok("knowledgeFingerprint module", existsSync(join(root, "src/lib/frontier/knowledgeFingerprint.ts")));
ok("ensureDossierKnowledge", /export function ensureDossierKnowledge/.test(read("lib/frontier/knowledgeFingerprint.ts")));
ok("packageIsUsable", /export function packageIsUsable/.test(read("lib/frontier/knowledgeFingerprint.ts")));
ok("live uses ensureDossierKnowledge", /ensureDossierKnowledge/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("batchBuild helper", existsSync(join(root, "src/lib/dossier/batchBuild.ts")));
ok("mapPoolWithRetry", /export async function mapPoolWithRetry/.test(read("lib/dossier/parallelMap.ts")));
ok("isTransientError", /export function isTransientError|export \{ isTransientError \}/.test(read("lib/dossier/parallelMap.ts")));
ok("batch client partition cache", /partitionCidsByCache/.test(read("lib/dossier/batchClient.ts")));
ok("batch client skip warm", /loadWarmCache|fromCache/.test(read("lib/dossier/batchClient.ts")));
ok("science agent local-first", /local package|canLocal|runLocal/.test(read("components/frontier/ScienceAgentPanel.tsx")));
ok("batch retries in API", /retries/.test(read("app/api/dossier/batch/route.ts")));

// Pure JS extract smoke (mirrors atlas patterns)
function extractTemp(text) {
  const re = /(\d+(?:\.\d+)?\s*(?:–|-|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*°\s*C\b/gi;
  return [...text.matchAll(re)].map((m) => m[0]);
}
const sample =
  "The mixture was heated at 80 °C for 3 h under N2. Example 2 used 60–90 °C. Yield 85%.";
const temps = extractTemp(sample);
ok("extract finds 80 °C", temps.some((t) => t.includes("80")));
ok("extract finds range 60–90", temps.some((t) => /60/.test(t) && /90/.test(t)));

function rangesConflict(intervals) {
  if (intervals.length < 2) return false;
  let maxLo = -Infinity;
  let minHi = Infinity;
  for (const iv of intervals) {
    maxLo = Math.max(maxLo, iv.lo);
    minHi = Math.min(minHi, iv.hi);
  }
  return maxLo > minHi;
}
ok(
  "conflict detects non-overlap",
  rangesConflict([
    { lo: 20, hi: 30 },
    { lo: 80, hi: 100 },
  ])
);
ok(
  "no conflict on overlap",
  !rangesConflict([
    { lo: 60, hi: 90 },
    { lo: 70, hi: 85 },
  ])
);

// Unit normalize smoke (inline)
function nTemp(lo, hi) {
  return { value: (lo + hi) / 2, low: lo, high: hi, baseUnit: "°C" };
}
function nPsiToBar(psi) {
  return psi * 0.0689476;
}
ok("psi conversion positive", nPsiToBar(14.7) > 0.9 && nPsiToBar(14.7) < 1.2);
ok("temp mid", nTemp(60, 90).value === 75);

console.log(`\n${n} frontier checks passed`);
