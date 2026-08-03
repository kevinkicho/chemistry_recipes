/**
 * Contracts for horizon roadmap recommendations (T1–T5).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
// Node can't import TS; assert file presence + source contracts.

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

console.log("test-roadmap");

// T1
ok("shift packs module", existsSync(join(root, "src/lib/workspace/shiftPacks.ts")));
ok("ShiftPackPanel", existsSync(join(root, "src/components/ShiftPackPanel.tsx")));
ok("ThinToUsefulBanner", existsSync(join(root, "src/components/ThinToUsefulBanner.tsx")));
ok("CompareMsatBoard", existsSync(join(root, "src/components/CompareMsatBoard.tsx")));
ok("ProcessFacts per-claim ApiProvenance", /ApiProvenance/.test(read("components/ProcessFactsPanel.tsx")));
ok("Critique has actions", /runAction|inferGapAction/.test(read("components/EvidenceCritiquePanel.tsx")));

// T2
ok("ordBulk hooks", existsSync(join(root, "src/lib/api/ordBulk.ts")));
ok("OrdBulkPanel", existsSync(join(root, "src/components/OrdBulkPanel.tsx")));
ok("densifySchedule", existsSync(join(root, "src/lib/dossier/densifySchedule.ts")));
ok("DensifySchedulePanel", existsSync(join(root, "src/components/DensifySchedulePanel.tsx")));
ok("problemFirst search", existsSync(join(root, "src/lib/search/problemFirst.ts")));
ok("ProblemFirstSearch UI", existsSync(join(root, "src/components/ProblemFirstSearch.tsx")));
ok("procedureWindowScore", existsSync(join(root, "src/lib/literature/procedureWindowScore.ts")));
ok("uspto densify ranks procedure windows", /rankByProcedureWindow/.test(read("lib/api/usptoFullText.ts")));
ok("EntityGraph multi-CID", /Multi-CID process graph|centerCid/.test(read("components/EntityGraph.tsx")));

// T3
ok("quoteGrounding module", existsSync(join(root, "src/lib/dossier/quoteGrounding.ts")));
ok("pipeline uses groundRoutesAgainstEvidence", /groundRoutesAgainstEvidence/.test(read("lib/dossier/pipeline.ts")));
ok("LiveDossier groundingReport field", /groundingReport/.test(read("lib/dossier/types.ts")));
ok("AiAccuracyBadge", existsSync(join(root, "src/components/AiAccuracyBadge.tsx")));
ok("FieldRegenerateBar", existsSync(join(root, "src/components/FieldRegenerateBar.tsx")));

// T4
ok("operator role floor-first", /Floor-first/.test(read("lib/worker/roleMode.ts")));
ok("site fill templates", existsSync(join(root, "src/lib/idb/siteFillTemplates.ts")));
ok("SiteFillPanel modality", /modality/.test(read("components/SiteFillPanel.tsx")));
ok(
  "home primary AI dossier vs training",
  /Primary · live AI dossier|Secondary · training|AI dual-view|densify/i.test(
    read("app/page.tsx")
  )
);
ok("print write-in CSS", /print-write-in/.test(readFileSync(join(root, "src/app/globals.css"), "utf8")));

// T5
ok("buildAudit densifyQuality", /densifyQuality/.test(read("lib/dossier/types.ts")));
ok("pipeline fills densifyQuality", /densifyQuality:/.test(read("lib/dossier/pipeline.ts")));
ok("playwright config or e2e scaffold", existsSync(join(root, "playwright.config.ts")) || existsSync(join(root, "e2e")));
ok("live mounts ThinToUseful", /ThinToUsefulBanner/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("live mounts ShiftPack", /ShiftPackPanel/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("compare mounts MSAT board", /CompareMsatBoard/.test(read("app/compare/page.tsx")));
ok("idealPage module", existsSync(join(root, "src/lib/dossier/idealPage.ts")));
ok("IdealPageParityPanel", existsSync(join(root, "src/components/IdealPageParityPanel.tsx")));
ok("live mounts IdealPageParity", /IdealPageParityPanel/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("pipeline withIdealPageParity", /withIdealPageParity/.test(read("lib/dossier/pipeline.ts")));
ok(
  "tierA is no-op (mocks removed)",
  /No-op|never inject mock/i.test(read("lib/dossier/tierABaseline.ts"))
);
ok(
  "product goal ideal depth",
  /ideal page|Tier-A is the ideal|process recipe|Ideal page/i.test(
    readFileSync(join(root, "..", "docs", "product-vision.md"), "utf8")
  ) || /ideal-page|Ideal page|process-recipe/.test(read("lib/dossier/idealPage.ts"))
);

// Executable quote grounding (via dynamic eval of TS is hard) — pure logic port
function isTextGrounded(text, evidenceLower) {
  const re = /\b\d+(?:\.\d+)?\s*(?:°\s*C|C\b|bar|psi|h\b|equiv|%)\b/gi;
  const matches = text.match(re);
  if (!matches?.length) return true;
  for (const m of matches) {
    const core = m.toLowerCase().replace(/[^0-9.]/g, "");
    if (core && !evidenceLower.includes(core)) return false;
  }
  return true;
}
ok("grounding: bare prose ok", isTextGrounded("heated under nitrogen", "heated under nitrogen"));
ok(
  "grounding: number in evidence ok",
  isTextGrounded("heated at 80 °C", "the mixture was heated at 80 °C for 2 h")
);
ok(
  "grounding: invented number fails",
  !isTextGrounded("heated at 999 °C", "the mixture was stirred at room temperature")
);

// procedure window score shapes
const scoreSrc = read("lib/literature/procedureWindowScore.ts");
ok("scoreProcedureWindow export", /export function scoreProcedureWindow/.test(scoreSrc));
ok("pickBestProcedureText export", /export function pickBestProcedureText/.test(scoreSrc));

console.log(`\n${n} roadmap checks passed`);
