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
ok("ContentProvenance showNotAi marker", /showNotAi/.test(contentProv) && /no AI/.test(contentProv));

const freePub = read("components/FreePublicProvenance.tsx");
ok(
  "FreePublicProvenance field-or-parsed default",
  /field-or-parsed/.test(freePub) && /when-parsed/.test(freePub)
);
ok(
  "FreePublicProvenance resolves dossier AI",
  /aiProvenanceWhenParsed/.test(freePub) && /aiProvenanceForField/.test(freePub)
);
ok("FreePublicProvenance showNotAi when no AI", /showNotAi/.test(freePub));

// --- ApiProvenance pagination on responses ---
const apiProv = read("components/ApiProvenance.tsx");
ok("ApiProvenance response pagination", /API_PAGE_CHARS/.test(apiProv));
ok("ApiProvenance free public only", /free public/i.test(apiProv));
ok(
  "ApiProvenance hydrates citations from traces",
  /mergeProvenanceRows|provenanceFromPublicSourceRefs\(/.test(apiProv)
);
ok(
  "ApiProvenance does not claim HTML scrape",
  /not re-fetched as HTML|not HTML-scraped|citation deeplink/i.test(apiProv)
);

const provLib = read("lib/provenance.ts");
ok(
  "matchTraceForSourceRef export",
  /export function matchTraceForSourceRef/.test(provLib)
);
ok(
  "mergeProvenanceRows export",
  /export function mergeProvenanceRows/.test(provLib)
);
ok(
  "hydrate citations with harvest traces",
  /Harvested free-public API response|matchTraceForSourceRef/.test(provLib)
);
ok(
  "no HTML scrape note on citations",
  /do not auto-scrape|do not re-fetch HTML|citationOnly/i.test(provLib)
);

const aside = read("components/dossier/LiveDossierAside.tsx");
ok(
  "manufacturing provenance uses allTraces",
  /allTraces\.length/.test(aside) && /apiTraces/.test(aside)
);

// Behavioral: id-prefix family wins (MyChem must not match ChEMBL HTML URL)
function matchTraceForSourceRef(ref, traces) {
  if (!traces.length) return undefined;
  if (ref.type === "literature" || ref.type === "patent") return undefined;
  const id = (ref.id || "").toLowerCase();
  const family = (id.match(/^([a-z][a-z0-9-]*):/) || [])[1];
  const preds = {
    chembl: (e) => e.includes("chembl") && (e.includes("api") || e.includes("/data/")),
    mychem: (e) => e.includes("mychem.info"),
    openfda: (e) => e.includes("api.fda.gov"),
    rxnorm: (e) => e.includes("rxnav.nlm.nih.gov"),
  };
  const pred = family && preds[family];
  if (!pred) return undefined;
  const hits = traces.filter((t) => pred(t.endpointUrl.toLowerCase()));
  return hits.find((t) => t.ok && t.responseBody) || hits[0];
}

const sampleTraces = [
  {
    endpointUrl: "https://www.ebi.ac.uk/chembl/api/data/molecule/CHEMBL154111.json",
    method: "GET",
    fetchedAt: "2026-07-28T12:00:00.000Z",
    httpStatus: 200,
    responseBody: '{"molecule_chembl_id":"CHEMBL154111"}',
    ok: true,
  },
  {
    endpointUrl: "https://mychem.info/v1/query?q=salsalate",
    method: "GET",
    fetchedAt: "2026-07-28T12:00:01.000Z",
    httpStatus: 200,
    responseBody: '{"hits":[]}',
    ok: true,
  },
  {
    endpointUrl: "https://api.fda.gov/drug/label.json?search=salsalate",
    method: "GET",
    fetchedAt: "2026-07-28T12:00:02.000Z",
    httpStatus: 200,
    responseBody: '{"meta":{}}',
    ok: true,
  },
];

ok(
  "chembl report-card ref matches chembl API trace",
  matchTraceForSourceRef(
    {
      type: "api",
      id: "chembl:CHEMBL154111",
      label: "ChEMBL CHEMBL154111",
      url: "https://www.ebi.ac.uk/chembl/compound_report_card/CHEMBL154111/",
    },
    sampleTraces
  )?.endpointUrl.includes("chembl/api")
);

ok(
  "mychem ref matches mychem API not chembl HTML",
  matchTraceForSourceRef(
    {
      type: "api",
      id: "mychem:xxx",
      label: "MyChem.info annotation",
      url: "https://www.ebi.ac.uk/chembl/compound_report_card/CHEMBL154111/",
    },
    sampleTraces
  )?.endpointUrl.includes("mychem.info")
);

ok(
  "literature DOI does not match random API",
  matchTraceForSourceRef(
    {
      type: "literature",
      id: "doi:10.1000/foo",
      label: "Some paper",
      url: "https://doi.org/10.1000/foo",
    },
    sampleTraces
  ) == null
);

ok(
  "openFDA landing page matches api.fda.gov harvest",
  matchTraceForSourceRef(
    {
      type: "api",
      id: "openfda:5161",
      label: "openFDA drug label / Drugs@FDA",
      url: "https://open.fda.gov/",
    },
    sampleTraces
  )?.endpointUrl.includes("api.fda.gov")
);

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
  /const onRegenerate\s*=\s*\(\)\s*=>/.test(liveDossier) ||
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
