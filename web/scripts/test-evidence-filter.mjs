/**
 * Lightweight contract checks for evidence quality filters (no jest required).
 * Run: node scripts/test-evidence-filter.mjs
 */

function isTocBoilerplate(text) {
  const t = text.trim();
  if (t.length < 20) return true;
  return /this section provides information|major uses of this chemical, including both consumer|various chemical and physical properties that are experimentally|information on safety and hazards for this compound/i.test(
    t
  );
}

function isUsefulEvidenceText(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 24) return false;
  if (isTocBoilerplate(t)) return false;
  if (
    /not specified in public excerpt|define ipc\/cqas|validate on site|placeholder class|public manufacturing \/ use note|extracted from pubchem pug view/i.test(
      t
    )
  )
    return false;
  return true;
}

function looksLikeProcessLiterature(title, abstract = "") {
  const hay = `${title} ${abstract}`.toLowerCase();
  return /synthes|preparat|manufactur|process|ferment|biocatal|enzymatic|industrial|scale.?up|production of|method of making|route to|catalys|hydrogenat|crystalliz|isolation of|acetylation/i.test(
    hay
  );
}

function scoreEvidence(ev) {
  let score = 0;
  if (ev.identity) score += 12;
  score += Math.min(18, (ev.mfg || 0) * 3);
  score += Math.min(28, (ev.processLit || 0) * 5);
  score += Math.min(16, (ev.processPat || 0) * 4);
  return Math.min(100, score);
}

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error("FAIL", name);
    failed++;
  } else {
    console.log("ok  ", name);
  }
}

assert(
  "rejects TOC blurb",
  !isUsefulEvidenceText(
    "This section provides information on the use and manufacturing information for this chemical, such as uses."
  )
);
assert(
  "rejects placeholder IPC",
  !isUsefulEvidenceText(
    "Not specified in public excerpt — define IPC/CQAs before scale-up"
  )
);
assert(
  "accepts real use note",
  isUsefulEvidenceText(
    "Used as a nutritional supplement for foods; biochemical research and pharmaceuticals."
  )
);
assert(
  "process lit detects synthesis",
  looksLikeProcessLiterature("Industrial synthesis of metformin hydrochloride", "A process for preparing…")
);
assert(
  "process lit rejects pure clinical",
  !looksLikeProcessLiterature("Metformin in type 2 diabetes outcomes trial", "Patients received…")
);
assert("score identity only low", scoreEvidence({ identity: true }) < 20);
assert(
  "score rich evidence higher",
  scoreEvidence({ identity: true, mfg: 4, processLit: 3, processPat: 2 }) >= 40
);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nAll evidence-filter contracts passed.");
