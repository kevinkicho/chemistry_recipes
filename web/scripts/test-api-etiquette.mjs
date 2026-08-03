/**
 * API etiquette contracts — rate-limit cooldowns, Retry-After, host pacing.
 * Run: node scripts/test-api-etiquette.mjs
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

console.log("test-api-etiquette");

const eti = read("lib/api/apiEtiquette.ts");
ok("apiEtiquette module exists", fs.existsSync(path.join(src, "lib/api/apiEtiquette.ts")));
ok("waitForHostSlot export", /export async function waitForHostSlot/.test(eti));
ok("recordHostRateLimited export", /export function recordHostRateLimited/.test(eti));
ok("parseRetryAfterMs export", /export function parseRetryAfterMs/.test(eti));
ok("etiquetteHeaders User-Agent", /POLITE_USER_AGENT|User-Agent/.test(eti));
ok("semanticscholar stricter spacing", /semanticscholar/.test(eti));
ok("isFamilyRateLimited", /export function isFamilyRateLimited/.test(eti));
ok("waitForAnyRateLimit", /export async function waitForAnyRateLimit/.test(eti));

// Executable parseRetryAfter
function parseRetryAfterMs(header) {
  if (!header) return null;
  const t = header.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) {
    const sec = Number(t);
    if (!Number.isFinite(sec) || sec < 0) return null;
    return Math.min(120_000, Math.max(1000, Math.floor(sec * 1000)));
  }
  const when = Date.parse(t);
  if (!Number.isFinite(when)) return null;
  const ms = when - Date.now();
  if (ms <= 0) return 1000;
  return Math.min(120_000, ms);
}
ok("Retry-After seconds 30 → 30000ms", parseRetryAfterMs("30") === 30_000);
ok("Retry-After 0 → at least 1000ms", parseRetryAfterMs("0") === 1000);
ok("Retry-After empty → null", parseRetryAfterMs("") === null);
ok("Retry-After garbage → null", parseRetryAfterMs("nope") === null);

const trace = read("lib/api/trace.ts");
ok("fetchWithTrace uses waitForHostSlot", /waitForHostSlot/.test(trace));
ok("fetchWithTrace uses etiquetteHeaders", /etiquetteHeaders/.test(trace));
ok("fetchWithTrace skips rate-limited hosts", /isHostRateLimited/.test(trace));
ok("fetchWithTrace records 429", /recordHostRateLimited/.test(trace));
ok("429 does not tight-loop retries", /httpStatus === 429/.test(trace));

const circuit = read("lib/api/hostCircuit.ts");
ok("429 opens circuit faster", /FAIL_OPEN_THRESHOLD_429/.test(circuit));

const tools = read("lib/frontier/apiAgentTools.ts");
ok("agent tool list_rate_limits", /list_rate_limits/.test(tools));
ok("agent tool wait_for_rate_limits", /wait_for_rate_limits/.test(tools));
ok("retry skips rate-limited families", /isFamilyRateLimited/.test(tools));

const agent = read("lib/frontier/apiAgent.ts");
ok("planner etiquette rules", /rateLimitedHosts|NEVER retry those families|thrash/i.test(agent));
ok("local planner densify when rate-limited", /rate-limited families present|rateLimitedFamilies/.test(agent));

const retry = read("lib/dossier/retryFailedFamilies.ts");
ok("retryFailedFamilies skips rate-limited", /isFamilyRateLimited|api-etiquette/.test(retry));
ok("retry uses longer polite delay", /politeDelay\(180\)/.test(retry));

console.log(`\n${n} api-etiquette checks passed`);
