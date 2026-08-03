/**
 * Diagnostics honesty — Ollama readiness ≠ free-public content.
 * Maps to DIAG-* in docs/engineering/test-spec.md
 *
 * Run: node scripts/test-diagnostics-honesty.mjs
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

console.log("test-diagnostics-honesty");

const diagApi = read("app/api/diagnostics/route.ts");
const diagPage = read("app/diagnostics/page.tsx");
const dossierDiag = read("components/DossierDiagnostics.tsx");
const envCheck = read("components/EnvChecklist.tsx");
const aiStatus = read("app/api/ai/status/route.ts");
const pipeline = read("lib/dossier/pipeline.ts");
const scaffold = read("lib/dossier/scaffold.ts");

// DIAG-01 Ollama canCall exposed separately
ok("DIAG-01 ai status canCall", /canCall/.test(aiStatus));
ok("DIAG-01 diagnostics ollamaCanCall", /ollamaCanCall/.test(diagApi));
ok("DIAG-01 never returns raw key", !/apiKey:\s*env\.apiKey/.test(aiStatus));

// DIAG-02 advice explains free-public without Ollama
ok(
  "DIAG-02 advice free-public without Ollama",
  /free-public|evidence shell|without Ollama/i.test(diagApi)
);
ok(
  "DIAG-02 advice soft-fail probes",
  /soft-fail|other sources|Failed probes/i.test(diagApi)
);

// DIAG-03 UI labels distinguish dual-view vs free APIs
ok("DIAG-03 Ollama dual-view card", /Ollama dual-view/.test(diagPage));
ok("DIAG-03 Free API probes card", /Free API probes/.test(diagPage));
ok(
  "DIAG-03 dual-view hint free-public works",
  /free-public shells|without Ollama/i.test(diagPage)
);

// DIAG-04 dossier strip buildMode honesty
ok("DIAG-04 evidence-shell label", /evidence-shell/.test(dossierDiag));
ok("DIAG-04 free-public not Ollama chip", /free-public \(not Ollama\)|not Ollama/.test(dossierDiag));
ok("DIAG-04 no Ollama model when not ai mode", /no Ollama model/.test(dossierDiag));

// DIAG-05 env checklist uses canCall
ok("DIAG-05 EnvChecklist canCall", /canCall/.test(envCheck));
ok("DIAG-05 optional Ollama hint", /Optional|free-public shells/i.test(envCheck));

// DIAG-06 pipeline: densify shell always; AI dual-view when canCall
ok("DIAG-06 evidence-shell buildMode", /evidence-shell/.test(pipeline));
ok(
  "DIAG-06 AI dual-view unavailable path when no key",
  /AI dual-view unavailable|AI is integral|OLLAMA_CLOUD_API_KEY/.test(pipeline)
);
ok(
  "DIAG-06 runAi gated on canCall (AI-integral when key present)",
  /canCall|runAi/.test(pipeline) &&
    /AI dual-view|AI-integral|canCall && Boolean|runAi = aiEnv\.canCall/.test(
      pipeline
    )
);
ok("DIAG-06 scaffold without AI routes", /buildScaffoldDossier|evidence-shell|processRoutes/.test(scaffold));

// DIAG-07 probes separate from content
ok("DIAG-07 probe optional query", /probe=/.test(diagPage) || /probe/.test(diagApi));
ok("DIAG-07 runPublicApiProbes", /runPublicApiProbes/.test(diagApi));

console.log(`\n${passed} diagnostics-honesty checks passed`);
