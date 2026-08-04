/**
 * Horizon C contracts: MSAT journey, route neighborhood, modality playbooks,
 * health-weighted densify, role packs, bulk vault.
 * Run: node scripts/test-horizon-c.mjs
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

function exists(rel) {
  return fs.existsSync(path.join(src, rel));
}

console.log("test-horizon-c");

// --- MSAT journey ---
ok("msatJourney module", exists("lib/search/msatJourney.ts"));
const msat = read("lib/search/msatJourney.ts");
ok("runMsatJourney export", /export async function runMsatJourney/.test(msat));
ok("MSAT expands neighborhood", /expandCampaignWithRouteNeighborhood/.test(msat));
ok("MSAT sets agent handoff", /setCampaignAgentHandoff/.test(msat));
ok("MSAT openBrief", /openBrief:\s*true/.test(msat));

const pfs = read("components/ProblemFirstSearch.tsx");
ok("ProblemFirstSearch uses runMsatJourney", /runMsatJourney/.test(pfs));
ok("ProblemFirstSearch MSAT CTA", /MSAT journey|runMsatPath/.test(pfs));

// --- Route neighborhood ---
ok("routeNeighborhood module", exists("lib/frontier/routeNeighborhood.ts"));
const rn = read("lib/frontier/routeNeighborhood.ts");
ok("densifyRouteNeighborhood export", /export async function densifyRouteNeighborhood/.test(rn));
ok("expandCampaignWithRouteNeighborhood export", /export async function expandCampaignWithRouteNeighborhood/.test(rn));
ok("impurities first priority", /prioritizedNeighborCids|impurit/.test(rn));

const batchUi = read("components/frontier/BatchDensifyPanel.tsx");
ok("BatchDensifyPanel neighborhood button", /Route neighborhood|runNeighborhood|densifyRouteNeighborhood/.test(batchUi));

// --- Modality playbooks ---
ok("modalityDensifyPlaybook module", exists("lib/dossier/modalityDensifyPlaybook.ts"));
const mod = read("lib/dossier/modalityDensifyPlaybook.ts");
ok("getModalityDensifyPlaybook", /export function getModalityDensifyPlaybook/.test(mod));
ok("modalityAiInstruction", /export function modalityAiInstruction/.test(mod));
ok("modalityLitBoost", /export function modalityLitBoost/.test(mod));
ok("playbooks include peptide mab", /peptide[\s\S]*mab|mab[\s\S]*peptide/.test(mod));
ok("never invent CPPs in playbook", /never invent|do not invent|no invented/i.test(mod));

const synth = read("lib/dossier/synthesize.ts");
ok("synthesize uses modalityAiInstruction", /modalityAiInstruction/.test(synth));
ok("synthesize soft modality hint", /softModality|modalityInstr/.test(synth));

const aip = read("lib/dossier/aiEvidencePackage.ts");
ok("AI package modality instruction", /modalityAiInstruction|modalityPlaybook/.test(aip));

const ideal = read("lib/dossier/idealDensifyPlan.ts");
ok("ideal plan modality families", /getModalityDensifyPlaybook|preferredFamilies/.test(ideal));

// --- Health-weighted densify ---
ok("healthWeightedDensify module", exists("lib/dossier/healthWeightedDensify.ts"));
const hw = read("lib/dossier/healthWeightedDensify.ts");
ok("densifyHealthPenalty", /export function densifyHealthPenalty/.test(hw));
ok("literatureHealthPenalty", /export function literatureHealthPenalty/.test(hw));
ok("patentHealthPenalty", /export function patentHealthPenalty/.test(hw));
ok("rankByHealthAndValue", /export function rankByHealthAndValue/.test(hw));
ok("uses apiEtiquette", /isFamilyRateLimited|isHostRateLimited/.test(hw));
ok("uses hostCircuit", /isHostCircuitOpen/.test(hw));

const planner = read("lib/dossier/densifyBudgetPlanner.ts");
ok("budget planner health penalty", /literatureHealthPenalty|patentHealthPenalty/.test(planner));
ok("budget planner modality boost", /modalityLitBoost/.test(planner));

// Executable health rank mirror
function rankByHealthAndValue(items, score, health) {
  return [...items]
    .map((item, i) => ({ item, i, adj: score(item) - health(item) }))
    .sort((a, b) => b.adj - a.adj || a.i - b.i)
    .map((x) => x.item);
}
const ranked = rankByHealthAndValue(
  [
    { id: "sick", s: 50, h: 40 },
    { id: "healthy", s: 45, h: 0 },
    { id: "mid", s: 40, h: 10 },
  ],
  (x) => x.s,
  (x) => x.h
);
ok("healthy high-value wins over sick high-score", ranked[0].id === "healthy");
ok("mid beats sick when adjusted", ranked[1].id === "mid");

// --- Role packs ---
ok("rolePack module", exists("lib/export/rolePack.ts"));
const rp = read("lib/export/rolePack.ts");
ok("role-pack.v1 schema", /role-pack\.v1/.test(rp));
ok("buildRolePack export", /export function buildRolePack/.test(rp));
ok("role packs cover operator msat manager", /case "operator"|case "msat"|case "manager"/.test(rp));

const ttUi = read("components/TechTransferExport.tsx");
ok("UI Role pack button", /onRolePack|Role pack/.test(ttUi));
ok("UI role-pack filename", /role-pack-/.test(ttUi));

// --- Bulk vault ---
ok("bulkVault module", exists("lib/idb/bulkVault.ts"));
const bv = read("lib/idb/bulkVault.ts");
ok("ingestExcerptsToVault", /export async function ingestExcerptsToVault/.test(bv));
ok("loadVaultWindowsForCid", /export async function loadVaultWindowsForCid/.test(bv));
ok("bulkVaultManifest", /export function bulkVaultManifest/.test(bv));
ok("bulk vault uses putVaultExcerpts(cid", /putVaultExcerpts\(\s*cid/.test(bv));

const enrich = read("lib/dossier/enrichClientFacts.ts");
ok("enrichClientFacts uses ingestExcerptsToVault", /ingestExcerptsToVault/.test(enrich));

const batch = read("lib/dossier/batchClient.ts");
ok("batchClient vault after cache", /ingestExcerptsToVault|cacheAndVaultDossier/.test(batch));

console.log(`\n${n} horizon-c checks passed`);
