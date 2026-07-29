/**
 * Unit tests for universal provenance contracts:
 * - AiProvenanceRecord fields for full prompt + pagination-friendly response
 * - ContentProvenance / ApiProvenance module surface
 * - Synthesize stores large response preview for pagination
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

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  passed += 1;
  console.log(`  ok  ${name}`);
}

console.log("test-provenance");

// --- AiProvenance v2: prompt + regenerate + pagination ---
const aiProv = read("components/AiProvenance.tsx");
ok("AiProvenance exports onRegenerate prop", /onRegenerate\?:/.test(aiProv));
ok("AiProvenance has pagination PAGE_CHARS", /PAGE_CHARS\s*=\s*\d+/.test(aiProv));
ok("AiProvenance paginates with Prev/Next", /Prev/.test(aiProv) && /Next/.test(aiProv));
ok("AiProvenance has tab for user prompt", /User prompt/.test(aiProv));
ok("AiProvenance has tab for system prompt", /System/.test(aiProv));
ok("AiProvenance has data fed tab", /Data fed/.test(aiProv));
ok("AiProvenance has regenerate control", /Regenerate/.test(aiProv));
ok("AiProvenance copies full text", /Copy full/.test(aiProv));
ok("AiProvenance jump-to-page for long prompts", /Jump to page|Go/.test(aiProv));

// --- ContentProvenance universal strip ---
const contentProv = read("components/ContentProvenance.tsx");
ok("ContentProvenance wires Api + Ai", /ApiProvenance/.test(contentProv) && /AiProvenance/.test(contentProv));
ok("ContentProvenance accepts onRegenerate", /onRegenerate/.test(contentProv));
ok("ContentProvenance accepts traces + sourceRefs", /traces/.test(contentProv) && /sourceRefs/.test(contentProv));

// --- ApiProvenance pagination on responses ---
const apiProv = read("components/ApiProvenance.tsx");
ok("ApiProvenance response pagination", /API_PAGE_CHARS/.test(apiProv));
ok("ApiProvenance free public only", /free public/i.test(apiProv));

// --- Types ---
const types = read("lib/dossier/types.ts");
ok("AiProvenanceRecord has systemPrompt", /systemPrompt:\s*string/.test(types));
ok("AiProvenanceRecord has userPrompt", /userPrompt:\s*string/.test(types));
ok("AiProvenanceRecord has dataFed", /dataFed:\s*string/.test(types));
ok("AiProvenanceRecord has dataSources", /dataSources:/.test(types));
ok("AiProvenanceRecord has responsePreview", /responsePreview\?/.test(types));

// --- Synthesize keeps large response for pagination ---
const synth = read("lib/dossier/synthesize.ts");
ok("synthesize keeps large response preview (48k)", /48_000|48000/.test(synth));

// --- Panels carry ContentProvenance ---
const panels = [
  "components/ProcessFactsPanel.tsx",
  "components/ManagerBriefPanel.tsx",
  "components/OperatorJobAid.tsx",
  "components/MondayMorningPack.tsx",
  "components/RecipeReadinessPanel.tsx",
  "components/CriticalParametersBoard.tsx",
];
for (const p of panels) {
  const body = read(p);
  ok(`${p} has ContentProvenance or Api/Ai chips`, /ContentProvenance|ApiProvenance|AiProvenance/.test(body));
}

// --- Horizon surfaces exist ---
ok("ProblemUnitOpSearch exists", existsSync(src("components/ProblemUnitOpSearch.tsx")));

// --- Per-field AI provenance on live compound dossier ---
const fieldProv = read("lib/dossier/aiFieldProvenance.ts");
ok("aiFieldProvenance helper module", true);
ok("synthesisHasAiField export", /export function synthesisHasAiField/.test(fieldProv));
ok("aiProvenanceForField export", /export function aiProvenanceForField/.test(fieldProv));
ok("processRoutesFromAi export", /export function processRoutesFromAi/.test(fieldProv));

const liveDossier = read("components/dossier/LiveMoleculeDossier.tsx");
ok("live dossier uses aiProvenanceForField", /aiProvenanceForField/.test(liveDossier));
ok(
  "live overview ContentProvenance",
  /field=\"Overview\"/.test(liveDossier) ||
    (/Overview/.test(liveDossier) && /ContentProvenance/.test(liveDossier))
);
ok(
  "live applications ContentProvenance",
  /Applications/.test(liveDossier) && /ContentProvenance/.test(liveDossier)
);
ok("live processRoutesFromAi", /processRoutesFromAi/.test(liveDossier));

const aside = read("components/dossier/LiveDossierAside.tsx");
ok(
  "aside ContentProvenance manufacturing",
  /Manufacturing summary/.test(aside) && /ContentProvenance/.test(aside)
);
ok("aside field-specific aiMfg prop", /aiMfg/.test(aside));
ok("aside free-public label when not AI", /free-public/.test(aside));

ok("fieldsFromSynthesis includes unitOpFills", /unitOpFills/.test(synth));
ok(
  "fieldsFromSynthesis includes criticalParameters",
  /criticalParameters/.test(synth)
);

const mgr = read("components/ManagerBriefPanel.tsx");
ok(
  "manager brief field-aware AI",
  /processRoutesFromAi|aiProvenanceForField/.test(mgr)
);
ok("EvidenceCritiquePanel exists", existsSync(src("components/EvidenceCritiquePanel.tsx")));
ok("WorkerPlaybookPanel exists", existsSync(src("components/WorkerPlaybookPanel.tsx")));
ok("PdfWorkerPack exists", existsSync(src("components/PdfWorkerPack.tsx")));
ok("Paste wizard steps in LocalTextEnrich", /WizardStep|Paste wizard/.test(read("components/LocalTextEnrich.tsx")));

// --- Live dossier wires onRegenerate ---
ok(
  "LiveMoleculeDossier defines onRegenerate",
  /onRegenerate\s*=\s*chrome\?\.onRefresh/.test(liveDossier)
);
ok(
  "LiveMoleculeDossier passes onRegenerate to AiProvenance",
  /onRegenerate=\{onRegenerate\}/.test(liveDossier)
);
ok(
  "LiveMoleculeDossier mounts horizon panels",
  /ProblemUnitOpSearch/.test(liveDossier) && /EvidenceCritiquePanel/.test(liveDossier)
);

// --- DossierSectionTitle dual provenance ---
const section = read("components/dossier/DossierSectionTitle.tsx");
ok("DossierSectionTitle uses ContentProvenance", /ContentProvenance/.test(section));
ok("DossierSectionTitle accepts traces", /traces\?:/.test(section));

// Golden fixture for AI provenance shape regression
const fixturePath = join(root, "scripts", "fixtures", "ai-provenance-golden.json");
ok("AI provenance golden fixture exists", existsSync(fixturePath));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
for (const k of fixture.requiredKeys || []) {
  ok(`fixture provenance has ${k}`, fixture.provenance?.[k] != null);
}

console.log(`\n${passed} provenance checks passed`);
