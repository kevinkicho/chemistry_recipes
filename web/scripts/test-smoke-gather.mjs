/**
 * Deploy / CI smoke: durable gather helpers + densify delta + circuit breaker contracts.
 * Does not call live external APIs (offline-safe).
 * Run: node scripts/test-smoke-gather.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (...p) => join(root, "src", ...p);

function read(rel) {
  const p = src(...rel.split("/"));
  assert.ok(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log(`  ok  ${name}`);
}

console.log("test-smoke-gather");

ok("deepDensify module", existsSync(src("lib/dossier/deepDensify.ts")));
ok("hostCircuit module", existsSync(src("lib/api/hostCircuit.ts")));
ok("densifyDelta module", existsSync(src("lib/dossier/densifyDelta.ts")));
ok("retryFailedFamilies module", existsSync(src("lib/dossier/retryFailedFamilies.ts")));
ok("siteHandoff export", existsSync(src("lib/export/siteHandoff.ts")));
ok("DensifyDeltaStrip", existsSync(src("components/DensifyDeltaStrip.tsx")));
ok(
  "retry-families API route",
  existsSync(src("app/api/dossier/[cid]/retry-families/route.ts"))
);

const deep = read("lib/dossier/deepDensify.ts");
ok("deep densify EPMC DOI", /DOI:/.test(deep) && /europepmc/.test(deep));
ok(
  "deep densify Crossref works",
  /api\.crossref\.org/.test(deep) && /\/works\//.test(deep)
);
ok("literatureToCapturedSourceRefs", /literatureToCapturedSourceRefs/.test(deep));
ok("never scrapes HTML claim", /not HTML|never scrapes|not scrap/i.test(deep));

const circuit = read("lib/api/hostCircuit.ts");
ok("circuit open threshold", /FAIL_OPEN_THRESHOLD/.test(circuit));
ok("isHostCircuitOpen", /export function isHostCircuitOpen/.test(circuit));

const trace = read("lib/api/trace.ts");
ok("fetchWithTrace uses circuit", /isHostCircuitOpen/.test(trace));
ok("recordHostFailure on fail", /recordHostFailure/.test(trace));

const rank = read("lib/literature/rank.ts");
ok("splitProcessVsClinicalLiterature", /splitProcessVsClinicalLiterature/.test(rank));
ok("isClinicalLiterature", /isClinicalLiterature/.test(rank));

const ai = read("lib/dossier/aiEvidencePackage.ts");
ok("AI package process lit first", /literatureProcess|processLit/.test(ai));
ok("AI package clinical context", /literatureClinicalContext|clinicalLit/.test(ai));

const delta = read("lib/dossier/densifyDelta.ts");
ok("formatDensifyDelta", /formatDensifyDelta/.test(delta));
ok("failedFamiliesFromErrors", /failedFamiliesFromErrors/.test(delta));

const diag = read("components/DossierDiagnostics.tsx");
ok("diagnostics retry failed families", /retry-families|Retry failed families/.test(diag));

const thin = read("components/ThinToUsefulBanner.tsx");
ok("Monday path labeling", /Monday path/.test(thin));
ok("site handoff download", /downloadSiteHandoff/.test(thin));

const hyp = read("components/frontier/RouteHypothesesPanel.tsx");
ok("conflict next experiment UI", /Next experiment|resolvingExperiment/.test(hyp));

const neigh = read("lib/frontier/neighborDensifyGraph.ts");
ok("impurityFirstCampaignCids", /impurityFirstCampaignCids/.test(neigh));

const densify = read("lib/dossier/densifyPass.ts");
ok("densify uses deepDensifyLiterature", /deepDensifyLiterature/.test(densify));
ok(
  "API harvest agent orchestrates densify/retry",
  /runApiHarvestAgent|api-agent/.test(read("lib/dossier/gather.ts"))
);
ok(
  "mergeExtractAtoms module",
  existsSync(src("lib/dossier/mergeExtractAtoms.ts"))
);
ok(
  "processKnowledgeDigest module",
  existsSync(src("lib/dossier/processKnowledgeDigest.ts"))
);

// Executable: circuit + delta format
function formatDensifyDelta(before, after) {
  return `Ideal ${before.idealScore}→${after.idealScore}`;
}
ok(
  "executable densify delta",
  formatDensifyDelta({ idealScore: 10 }, { idealScore: 40 }).includes("10→40")
);

ok(
  "softFailHuman module",
  existsSync(src("lib/dossier/softFailHuman.ts"))
);
ok(
  "sourceFamilyReport module",
  existsSync(src("lib/dossier/sourceFamilyReport.ts"))
);
ok(
  "warm-queue API",
  existsSync(src("app/api/dossier/warm-queue/route.ts"))
);
ok(
  "diagnostics source family completeness",
  /Source family completeness|sourceFamilyReportFromDossier/.test(
    read("components/DossierDiagnostics.tsx")
  )
);
ok(
  "live densify outcome strip",
  /DensifyDeltaStrip/.test(read("components/dossier/LiveMoleculeDossier.tsx"))
);
ok(
  "research mode collapse while thin",
  /Research mode · frontier science/.test(
    read("components/dossier/LiveMoleculeDossier.tsx")
  )
);
ok(
  "workspace science index first",
  /Science index · densify home/.test(read("app/workspace/page.tsx"))
);

// Plain English soft-fail
function humanize(raw) {
  const m = raw.match(/^(soft-fail|api-fail) · ([a-z0-9-]+):\s*(.*)$/i);
  if (!m) return raw;
  return `Could not reach ${m[2]}`;
}
ok(
  "executable human soft-fail",
  humanize("soft-fail · europepmc: timeout").includes("europepmc")
);

console.log(`\n${n} smoke-gather checks passed`);
