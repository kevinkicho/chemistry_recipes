/**
 * Unit tests for universal provenance contracts:
 * - AiProvenanceRecord fields for full prompt + pagination-friendly response
 * - ContentProvenance / ApiProvenance module surface
 * - Synthesize stores large response preview for pagination
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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
ok(
  "PROV-18 FreePublicProvenance can take filtered traces and skip identity live-fetch",
  /liveFetch/.test(freePub) &&
    /tracesProp \?\? slimTraces/.test(freePub) &&
    /liveFetch \? dossier\.cid : undefined/.test(freePub)
);

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

const processFactsPanel = read("components/ProcessFactsPanel.tsx");
ok(
  "PROV-15 process facts header uses factTraces not all harvest HTTP",
  /traces=\{factTraces\}/.test(processFactsPanel) &&
    /sourceRefs=\{factSourceRefs\}/.test(processFactsPanel) &&
    /isProcessFactTrace/.test(processFactsPanel) &&
    !/field="Process facts"[\s\S]{0,200}traces=\{traces\}/.test(processFactsPanel)
);
ok(
  "PROV-15 process fact rows filter traces by provenance family",
  /tracesForProcessFactProvenance/.test(processFactsPanel) &&
    /familyTraces/.test(processFactsPanel) &&
    !/pubchemCid=\{pubchemCid\}/.test(processFactsPanel)
);
ok(
  "PROV-29 process-facts header chip does not live-fetch leftover identity HTTP",
  /field="Process facts"/.test(processFactsPanel) &&
    /traces=\{factTraces\}/.test(processFactsPanel) &&
    /sourceRefs=\{factSourceRefs\}/.test(processFactsPanel) &&
    !/pubchemCid=/.test(processFactsPanel)
);
ok(
  "PROV-16 environment/apparatus chips use plantTraces not leftover harvest HTTP",
  /isProcessFactTrace/.test(aside) &&
    /plantTraces/.test(aside) &&
    /plantSourceRefs/.test(aside) &&
    /field="Plant environment baseline"[\s\S]{0,200}traces=\{plantTraces\}/.test(aside) &&
    /field="Apparatus catalog"[\s\S]{0,200}traces=\{plantTraces\}/.test(aside) &&
    !/field="Plant environment baseline"[\s\S]{0,200}traces=\{apiTraces\}/.test(aside) &&
    !/field="Apparatus catalog"[\s\S]{0,200}traces=\{apiTraces\}/.test(aside) &&
    !/field="Plant environment baseline"[\s\S]{0,200}pubchemCid=/.test(aside) &&
    !/field="Apparatus catalog"[\s\S]{0,200}pubchemCid=/.test(aside)
);
ok(
  "PROV-18 evidence-gaps chip uses plantTraces not leftover harvest HTTP",
  /isProcessFactTrace/.test(aside) &&
    /plantTraces/.test(aside) &&
    /plantSourceRefs/.test(aside) &&
    /field="Evidence gaps"[\s\S]{0,200}traces=\{plantTraces\}/.test(aside) &&
    !/field="Evidence gaps"[\s\S]{0,200}traces=\{allTraces\}/.test(aside) &&
    !/field="Evidence gaps"[\s\S]{0,200}pubchemCid=/.test(aside)
);

const processFactsLib = read("lib/dossier/processFacts.ts");
ok(
  "PROV-15 GHS process-fact ids use pubchem-view-ghs not leftover ghs:",
  /sourceId: `pubchem-view-ghs:\$\{evidence\.cid\}`/.test(processFactsLib) &&
    !/sourceId: `ghs:\$\{evidence\.cid\}`/.test(processFactsLib)
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
  "PROV-17 process recipe / route / control-points chips use processFactTraces not leftover harvest HTTP",
  /isProcessFactTrace/.test(liveDossier) &&
    /processFactTraces/.test(liveDossier) &&
    /processFactSourceRefs/.test(liveDossier) &&
    /field="Process recipe"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    /field="Route compare"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    /<RoutePanel[\s\S]{0,400}traces=\{processFactTraces\}/.test(liveDossier) &&
    /<CriticalParametersBoard[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    !/field="Process recipe"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Route compare"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Process recipe"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="Route compare"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/<RoutePanel[\s\S]{0,400}pubchemCid=/.test(liveDossier) &&
    !/<CriticalParametersBoard[\s\S]{0,200}pubchemCid=/.test(liveDossier)
);
ok(
  "PROV-18 related / unit-ops chips use processFactTraces not leftover harvest HTTP",
  /isProcessFactTrace/.test(liveDossier) &&
    /processFactTraces/.test(liveDossier) &&
    /processFactSourceRefs/.test(liveDossier) &&
    /field="Related materials"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    /field="Modality unit ops"[\s\S]{0,200}traces=\{processFactTraces\}/.test(liveDossier) &&
    !/field="Related materials"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Modality unit ops"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier) &&
    !/field="Related materials"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="Modality unit ops"[\s\S]{0,200}pubchemCid=/.test(liveDossier)
);

const processFraming = read("components/ProcessFramingBanner.tsx");
ok(
  "PROV-19 process-framing chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(processFraming) &&
    /isProcessFactSourceRef/.test(processFraming) &&
    /liveFetch=\{false\}/.test(processFraming) &&
    /field="Process framing"/.test(processFraming) &&
    /traces=\{traces\}/.test(processFraming) &&
    /sourceRefs=\{sourceRefs\}/.test(processFraming)
);
const conditionAtlas = read("components/frontier/ConditionAtlasPanel.tsx");
ok(
  "PROV-20 condition-atlas chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(conditionAtlas) &&
    /isProcessFactSourceRef/.test(conditionAtlas) &&
    /liveFetch=\{false\}/.test(conditionAtlas) &&
    /field="Condition atlas"/.test(conditionAtlas) &&
    /traces=\{traces\}/.test(conditionAtlas) &&
    /sourceRefs=\{sourceRefs\}/.test(conditionAtlas)
);
const operatorJobAid = read("components/OperatorJobAid.tsx");
ok(
  "PROV-21 operator-job-aid chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(operatorJobAid) &&
    /isProcessFactSourceRef/.test(operatorJobAid) &&
    /field="Operator job aid"/.test(operatorJobAid) &&
    /traces=\{traces\}/.test(operatorJobAid) &&
    /sourceRefs=\{sourceRefs\}/.test(operatorJobAid) &&
    !/field="Operator job aid"[\s\S]{0,200}pubchemCid=/.test(operatorJobAid)
);
ok(
  "SEARCH-24 process-facts empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("components/ProcessFactsPanel.tsx")) &&
    /export function formatProcessFactsEmptyCopy/.test(
      read("lib/dossier/sectionHonesty.ts")
    )
);
ok(
  "SEARCH-25 job-aid empty copy uses formatSectionEmptyCopy / formatProcessFactsEmptyCopy",
  /formatSectionEmptyCopy/.test(read("components/OperatorJobAid.tsx")) &&
    /formatProcessFactsEmptyCopy/.test(read("components/OperatorJobAid.tsx")) &&
    /hazardEmpty/.test(read("components/OperatorJobAid.tsx")) &&
    /sequenceEmpty/.test(read("components/OperatorJobAid.tsx"))
);
const mondayPack = read("components/MondayMorningPack.tsx");
ok(
  "PROV-22 monday-pack chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(mondayPack) &&
    /isProcessFactSourceRef/.test(mondayPack) &&
    /field="Monday pack"/.test(mondayPack) &&
    /traces=\{traces\}/.test(mondayPack) &&
    /sourceRefs=\{sourceRefs\}/.test(mondayPack) &&
    !/field="Monday pack"[\s\S]{0,200}pubchemCid=/.test(mondayPack)
);
ok(
  "SEARCH-26 monday-pack empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(mondayPack) &&
    /sequenceEmpty/.test(mondayPack)
);
ok(
  "SEARCH-27 condition-atlas empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(conditionAtlas) &&
    /atlasEmpty/.test(conditionAtlas)
);
ok(
  "SEARCH-28 route-panel empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("components/RoutePanel.tsx")) &&
    /recipeEmpty/.test(read("components/RoutePanel.tsx"))
);
ok(
  "SEARCH-29 route-compare empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("components/RouteCompare.tsx")) &&
    /compareEmpty/.test(read("components/RouteCompare.tsx"))
);
const routeHypotheses = read("components/frontier/RouteHypothesesPanel.tsx");
ok(
  "PROV-23 route-hypotheses chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(routeHypotheses) &&
    /isProcessFactSourceRef/.test(routeHypotheses) &&
    /liveFetch=\{false\}/.test(routeHypotheses) &&
    /field="Route hypotheses"/.test(routeHypotheses) &&
    /traces=\{traces\}/.test(routeHypotheses) &&
    /sourceRefs=\{sourceRefs\}/.test(routeHypotheses)
);
ok(
  "SEARCH-30 route-hypotheses empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(routeHypotheses) &&
    /hypoEmpty/.test(routeHypotheses)
);
const problemUnitOp = read("components/ProblemUnitOpSearch.tsx");
ok(
  "PROV-24 unit-op-search chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(problemUnitOp) &&
    /isProcessFactSourceRef/.test(problemUnitOp) &&
    /liveFetch=\{false\}/.test(problemUnitOp) &&
    /field="Unit-op search"/.test(problemUnitOp) &&
    /traces=\{traces\}/.test(problemUnitOp) &&
    /sourceRefs=\{sourceRefs\}/.test(problemUnitOp)
);
const procedureVault = read("components/ProcedureVaultPanel.tsx");
ok(
  "PROV-25 procedure-vault chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(procedureVault) &&
    /isProcessFactSourceRef/.test(procedureVault) &&
    /liveFetch=\{false\}/.test(procedureVault) &&
    /field="Procedure vault"/.test(procedureVault) &&
    /traces=\{traces\}/.test(procedureVault) &&
    /sourceRefs=\{sourceRefs\}/.test(procedureVault)
);
const pdfPack = read("components/PdfWorkerPack.tsx");
ok(
  "PROV-26 pdf-pack chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(pdfPack) &&
    /isProcessFactSourceRef/.test(pdfPack) &&
    /field="PDF pack"/.test(pdfPack) &&
    /traces=\{traces\}/.test(pdfPack) &&
    /sourceRefs=\{sourceRefs\}/.test(pdfPack) &&
    !/field="PDF pack"[\s\S]{0,200}pubchemCid=/.test(pdfPack)
);
const playbooks = read("components/WorkerPlaybookPanel.tsx");
ok(
  "PROV-26 playbook chips use process-fact traces not leftover harvest HTTP",
  /isProcessFactTrace/.test(playbooks) &&
    /isProcessFactSourceRef/.test(playbooks) &&
    /field="Playbooks"/.test(playbooks) &&
    /traces=\{traces\}/.test(playbooks) &&
    /sourceRefs=\{sourceRefs\}/.test(playbooks) &&
    !/field="Playbooks"[\s\S]{0,200}pubchemCid=/.test(playbooks)
);

const siteFill = read("components/SiteFillPanel.tsx");
ok(
  "PROV-27 site-fill chips do not live-fetch leftover identity HTTP",
  /field="Site fill"/.test(siteFill) &&
    /showNotAi/.test(siteFill) &&
    /ContentProvenance/.test(siteFill) &&
    !/pubchemCid=/.test(siteFill)
);
const ordBulk = read("components/OrdBulkPanel.tsx");
ok(
  "PROV-27 ord-bulk chips do not live-fetch leftover identity HTTP",
  /field="ORD bulk"/.test(ordBulk) &&
    /showNotAi/.test(ordBulk) &&
    /ContentProvenance/.test(ordBulk) &&
    !/pubchemCid=/.test(ordBulk)
);
const localText = read("components/LocalTextEnrich.tsx");
ok(
  "PROV-27 local-text-enrich chips do not live-fetch leftover identity HTTP",
  /title="Local public-text enrich"/.test(localText) &&
    /ApiProvenance/.test(localText) &&
    /FreePublicBadge/.test(localText) &&
    !/pubchemCid=/.test(localText)
);
const biologicParams = read("components/BiologicParametersPanel.tsx");
ok(
  "PROV-28 educational-parameters chips do not live-fetch leftover identity HTTP",
  /field="Educational parameters"/.test(biologicParams) &&
    /liveFetch=\{false\}/.test(biologicParams) &&
    /traces=\{\[\]\}/.test(biologicParams) &&
    /sourceRefs=\{\[\]\}/.test(biologicParams) &&
    !/pubchemCid=/.test(biologicParams)
);
ok(
  "PROV-28 educational-parameters section title does not claim leftover identity HTTP",
  /field="Educational parameters"/.test(liveDossier) &&
    !/field="Educational parameters"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="Educational parameters"[\s\S]{0,200}traces=\{identityTraces\}/.test(
      liveDossier
    )
);
ok(
  "SEARCH-31 unit-op-search empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(problemUnitOp) &&
    /factEmpty/.test(problemUnitOp) &&
    !/No process facts yet\./.test(problemUnitOp)
);
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
ok(
  "SEARCH-32 manager-brief empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(mgr) &&
    /formatSectionEmptyCopy/.test(mgr) &&
    /pathEmpty/.test(mgr) &&
    /patentEmpty/.test(mgr) &&
    /hazardEmpty/.test(mgr)
);
ok(
  "SEARCH-33 TOC empty copy uses tocSectionFlags / harvestFailed",
  /tocSectionFlags/.test(read("lib/dossier/sectionHonesty.ts")) &&
    /interpretTocFlags/.test(read("lib/tocNavigate.ts")) &&
    /harvestFailed/.test(read("components/TableOfContents.tsx")) &&
    /data-toc-error/.test(read("components/CollapsibleSection.tsx")) &&
    /harvestFailed=\{litEmpty\.kind === "error"\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    /tocSectionFlags/.test(read("components/dossier/LiveDossierAside.tsx"))
);

ok(
  "SEARCH-34 critique empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("components/EvidenceCritiquePanel.tsx")) &&
    /windowsEmpty/.test(read("components/EvidenceCritiquePanel.tsx")) &&
    /No procedure windows densified/.test(read("components/EvidenceCritiquePanel.tsx"))
);
ok(
  "SEARCH-35 science-QA empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("lib/frontier/evidenceQa.ts")) &&
    /honestScienceQaAnswer/.test(read("lib/frontier/evidenceQa.ts")) &&
    /No route hypotheses assembled/.test(read("lib/frontier/evidenceQa.ts"))
);
ok(
  "SEARCH-36 literature-depth empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("lib/frontier/literatureDepth.ts")) &&
    /honestLiteratureDepthSummary/.test(read("lib/frontier/literatureDepth.ts")) &&
    /No procedure-scored free-public windows yet/.test(read("lib/frontier/literatureDepth.ts"))
);
ok(
  "SEARCH-37 reaction-network empty copy uses formatProcessFactsEmptyCopy",
  /formatProcessFactsEmptyCopy/.test(read("lib/frontier/reactionNetwork.ts")) &&
    /honestReactionNetworkSummary/.test(read("lib/frontier/reactionNetwork.ts")) &&
    /Network is center-only/.test(read("lib/frontier/reactionNetwork.ts"))
);
ok(
  "SEARCH-38 process-sequence empty copy uses honestProcessSequenceStub",
  /honestProcessSequenceStub/.test(read("lib/dossier/scaffold.ts")) &&
    /honestProcessSequenceStub/.test(read("lib/dossier/processFacts.ts")) &&
    /isStubOnlyProcessSequence/.test(read("components/MondayMorningPack.tsx")) &&
    /No extractable public process sequence yet/.test(read("lib/dossier/sectionHonesty.ts"))
);
ok(
  "SEARCH-39 ideal-page empty copy uses honestIdealEmptyCopy",
  /honestIdealEmptyCopy/.test(read("lib/dossier/idealPage.ts")) &&
    /isStubOnlyProcessSequence/.test(read("lib/dossier/idealPage.ts")) &&
    /No GHS text for this CID/.test(read("lib/dossier/idealPage.ts"))
);
ok(
  "SEARCH-40 checklist empty copy uses honestChecklistGap",
  /honestChecklistGap/.test(read("lib/export/techTransfer.ts")) &&
    /isStubOnlyProcessSequence/.test(read("lib/export/techTransfer.ts")) &&
    /No process facts/.test(read("lib/export/techTransfer.ts"))
);
ok(
  "SEARCH-41 recipe-readiness empty copy uses honestIdealEmptyCopy",
  /honestIdealEmptyCopy/.test(read("lib/dossier/recipeReadiness.ts")) &&
    /harvestFail/.test(read("lib/dossier/recipeReadiness.ts")) &&
    /sourced condition atom/.test(read("lib/dossier/recipeReadiness.ts"))
);
ok(
  "SEARCH-42 campaign-brief empty copy uses honestCampaignBriefEmpty",
  /honestCampaignBriefEmpty/.test(read("lib/frontier/campaignBrief.ts")) &&
    /honestCampaignAgentEmpty/.test(read("lib/frontier/campaignAgent.ts")) &&
    /Few condition observations/.test(read("lib/dossier/sectionHonesty.ts"))
);
ok(
  "SEARCH-43 diagnostics empty copy uses honestDiagnosticsAnnotationStat",
  /honestDiagnosticsAnnotationStat/.test(read("components/DossierDiagnostics.tsx")) &&
    /honestDiagnosticsLitPatentStat/.test(read("components/DossierDiagnostics.tsx")) &&
    /none yet/.test(read("lib/dossier/sectionHonesty.ts"))
);
ok(
  "SEARCH-44 shift-pack empty copy uses honestShiftPackContent",
  /honestShiftPackContent/.test(read("lib/workspace/shiftPacks.ts")) &&
    /isProcessFactTrace/.test(read("components/ShiftPackPanel.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/ShiftPackPanel.tsx")) &&
    /field="Shift pack"/.test(read("components/ShiftPackPanel.tsx")) &&
    !/field="Shift pack"[\s\S]{0,200}pubchemCid=/.test(read("components/ShiftPackPanel.tsx"))
);
ok(
  "SEARCH-45 MSAT compare empty copy uses honestMsatCompareHint",
  /honestMsatCompareHint/.test(read("components/CompareMsatBoard.tsx")) &&
    /honestMsatCompareLitPatent/.test(read("components/CompareMsatBoard.tsx")) &&
    /formatProcessFactsEmptyCopy/.test(read("components/CompareMsatBoard.tsx")) &&
    /field="MSAT compare"/.test(read("components/CompareMsatBoard.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/CompareMsatBoard.tsx")) &&
    !/field="MSAT compare"[\s\S]{0,200}pubchemCid=/.test(read("components/CompareMsatBoard.tsx"))
);
ok(
  "SEARCH-47 MSAT compare GHS empty copy uses honestMsatCompareGhs",
  /honestMsatCompareGhs/.test(read("components/CompareMsatBoard.tsx")) &&
    /field="MSAT compare"/.test(read("components/CompareMsatBoard.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/CompareMsatBoard.tsx")) &&
    !/field="MSAT compare"[\s\S]{0,200}pubchemCid=/.test(read("components/CompareMsatBoard.tsx"))
);
ok(
  "SEARCH-46 PDF-pack manifest empty copy uses honestPdfPackManifestLitPatent",
  /honestPdfPackManifestLitPatent/.test(read("components/PdfWorkerPack.tsx")) &&
    /isProcessFactTrace/.test(read("components/PdfWorkerPack.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/PdfWorkerPack.tsx")) &&
    /field="PDF pack"/.test(read("components/PdfWorkerPack.tsx")) &&
    !/field="PDF pack"[\s\S]{0,200}pubchemCid=/.test(read("components/PdfWorkerPack.tsx"))
);
ok(
  "SEARCH-48 PDF-pack process-facts empty copy uses honestPdfPackManifestProcessFacts",
  /honestPdfPackManifestProcessFacts/.test(read("components/PdfWorkerPack.tsx")) &&
    /isProcessFactTrace/.test(read("components/PdfWorkerPack.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/PdfWorkerPack.tsx")) &&
    /field="PDF pack"/.test(read("components/PdfWorkerPack.tsx")) &&
    !/field="PDF pack"[\s\S]{0,200}pubchemCid=/.test(read("components/PdfWorkerPack.tsx"))
);
ok(
  "SEARCH-49 site-handoff process-facts empty copy uses honestSiteHandoffProcessFacts",
  /honestSiteHandoffProcessFacts/.test(read("lib/export/siteHandoff.ts")) &&
    /export function honestSiteHandoffProcessFacts/.test(
      read("lib/dossier/sectionHonesty.ts")
    )
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


// --- PROV-08: do not invent HTTP matches across PubChem families ---
ok(
  "PROV-08 pubchem-patents pred requires PatentID",
  /"pubchem-patents":[\s\S]{0,160}patentid/i.test(provLib)
);
ok(
  "PROV-08 pubchem-mfg-page pred is pug_view manufacturing",
  /"pubchem-mfg-page":[\s\S]{0,120}pug_view/.test(provLib) &&
    /"pubchem-mfg-page":[\s\S]{0,160}manufacturing/.test(provLib)
);
ok(
  "PROV-08 pubchem-class pred requires classification",
  /"pubchem-class":[\s\S]{0,160}classification/.test(provLib)
);
ok(
  "PROV-08 generic pubchem pred excludes pug_view / PatentID / classification",
  /pubchem: \(e\) =>[\s\S]{0,220}!e\.includes\("pug_view"\)/.test(provLib) &&
    /!e\.includes\("patentid"\)/.test(provLib)
);
ok(
  "PROV-08 live mfg provenance uses only mfgTraces",
  /traces=\{mfgTraces\}/.test(liveDossier)
);
ok(
  "PROV-08 live mfg provenance does not fall back to identity traces",
  !/mfgTraces\.length[\s\S]{0,160}pubchemTraces/.test(liveDossier)
);
ok(
  "PROV-08 live literature provenance uses only litTraces",
  /traces=\{litTraces\}/.test(liveDossier) &&
    !/litTraces\.length \? litTraces : traces/.test(liveDossier)
);
ok(
  "PROV-08 live patent provenance uses only patentTraces",
  /traces=\{patentTraces\}/.test(liveDossier) &&
    !/patentTraces\.length[\s\S]{0,180}: traces/.test(liveDossier)
);
ok(
  "PROV-08 PatentsView source ref only when harvest traces exist",
  /patentTraces\.some\(\(t\) =>/.test(liveDossier) &&
    /includes\("patentsview"\)/.test(liveDossier)
);

ok(
  "PROV-09 pubchem-view-ghs pred requires pug_view GHS/safety/hazards",
  /"pubchem-view-ghs":[\s\S]{0,160}pug_view/.test(provLib) &&
    /"pubchem-view-ghs":[\s\S]{0,220}ghs/.test(provLib) &&
    /"pubchem-view-ghs":[\s\S]{0,280}safety/.test(provLib)
);
ok(
  "PROV-09 unknown pubchem-* ids do not fall back to identity HTTP",
  /startsWith\("pubchem-"\)/.test(provLib)
);
ok(
  "PROV-09 live GHS traces filter Safety/Hazards headings",
  /const ghsTraces = pugViewTraces\.filter/.test(liveDossier) &&
    /GHS\|Safety\|Hazards/.test(liveDossier)
);
ok(
  "PROV-09 live hazards provenance uses only ghsTraces",
  /traces=\{ghsTraces\}/.test(aside) &&
    /title="PubChem PUG View · GHS \/ hazards"/.test(aside)
);
ok(
  "PROV-09 live hazards provenance does not fall back to identity traces",
  !/GHS \/ hazards[\s\S]{0,200}pugViewTraces\.length \? pugViewTraces : pubchemTraces/.test(aside) &&
    !/pugViewTraces\.length \? pugViewTraces : pubchemTraces[\s\S]{0,160}GHS \/ hazards/.test(aside)
);
ok(
  "PROV-09 compact EHS uses ghsTraces not identity traces",
  /traces=\{ghsTraces\}[\s\S]{0,80}sourceRefs=\{dossier\.hazards\.sourceRefs\}/.test(liveDossier)
);

ok(
  "PROV-10 pubchem-view-props pred requires pug_view chemical/physical",
  /"pubchem-view-props":[\s\S]{0,160}pug_view/.test(provLib) &&
    /"pubchem-view-props":[\s\S]{0,220}chemical/.test(provLib) &&
    /"pubchem-view-props":[\s\S]{0,280}physical/.test(provLib)
);
ok(
  "PROV-10 pubchem-view-patent pred requires pug_view/data/patent",
  /"pubchem-view-patent":[\s\S]{0,160}pug_view/.test(provLib) &&
    /"pubchem-view-patent":[\s\S]{0,200}\/data\/patent\//.test(provLib)
);
ok(
  "PROV-10 live property traces exclude patent pug_view and generic fallback",
  /const propertyTraces = traces\.filter/.test(liveDossier) &&
    /pug_view\/data\/patent\//.test(liveDossier) &&
    !/traces=\{pugViewTraces\.length \? pugViewTraces : pubchemTraces\}/.test(aside)
);
ok(
  "PROV-10 live properties provenance uses only propertyTraces",
  /traces=\{propertyTraces\}/.test(aside) &&
    /sourceRefs=\{propertySourceRefs\}/.test(aside) &&
    /title="PubChem properties"/.test(aside)
);
ok(
  "PROV-10 live patent traces include pug_view/data/patent densify",
  /patentTraces = traces\.filter/.test(liveDossier) &&
    /includes\("pug_view\/data\/patent\/"\)/.test(liveDossier)
);

ok(
  "PROV-11 pubchem-view-lit pred requires pug_view Literature heading",
  /"pubchem-view-lit":[\s\S]{0,160}pug_view/.test(provLib) &&
    /"pubchem-view-lit":[\s\S]{0,200}heading=literature/.test(provLib)
);
ok(
  "PROV-11 live overview provenance uses identityTraces not all pubchem",
  /traces=\{identityTraces\}/.test(liveDossier) &&
    /sourceRefs=\{overviewSourceRefs\}/.test(liveDossier) &&
    !/field=\"Overview\"[\s\S]{0,120}traces=\{pubchemTraces\}/.test(liveDossier)
);
ok(
  "PROV-11 live literature traces include pug_view Literature heading",
  /isLiteratureHeadingTrace\(t\.endpointUrl\)/.test(liveDossier)
);
ok(
  "PROV-11 live patent traces include compound Patents heading",
  /isCompoundPatentsHeadingTrace\(t\.endpointUrl\)/.test(liveDossier)
);
ok(
  "PROV-13 live applications provenance uses applicationTraces not all harvest HTTP",
  /field="Applications"[\s\S]{0,200}traces=\{applicationTraces\}/.test(liveDossier) &&
    /field="Applications"[\s\S]{0,260}sourceRefs=\{mfgSourceRefs\}/.test(liveDossier) &&
    !/field="Applications"[\s\S]{0,200}traces=\{traces\}/.test(liveDossier)
);
ok(
  "PROV-30 applications header chip does not live-fetch leftover identity HTTP",
  /field="Applications"/.test(liveDossier) &&
    /field="Applications"[\s\S]{0,200}traces=\{applicationTraces\}/.test(liveDossier) &&
    !/field="Applications"[\s\S]{0,200}pubchemCid=/.test(liveDossier)
);
ok(
  "PROV-30 patents header chip does not live-fetch leftover identity HTTP",
  /title="Patents & process IP"/.test(liveDossier) &&
    /traces=\{patentTraces\}/.test(liveDossier) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{patentTraces\}/.test(liveDossier)
);
ok(
  "PROV-30 manufacturing header chip does not live-fetch leftover identity HTTP",
  /title="Use & manufacturing"/.test(liveDossier) &&
    /traces=\{mfgTraces\}/.test(liveDossier) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{mfgTraces\}/.test(liveDossier)
);
ok(
  "PROV-30 EHS header chips do not live-fetch leftover identity HTTP",
  /field="EHS highlights"[\s\S]{0,220}traces=\{ghsTraces\}/.test(liveDossier) &&
    /field="EHS highlights"[\s\S]{0,220}traces=\{ghsTraces\}/.test(aside) &&
    !/field="EHS highlights"[\s\S]{0,200}pubchemCid=/.test(liveDossier) &&
    !/field="EHS highlights"[\s\S]{0,200}pubchemCid=/.test(aside) &&
    /title="PubChem PUG View · GHS \/ hazards"/.test(aside) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{ghsTraces\}/.test(aside)
);
const msatBoard = read("components/CompareMsatBoard.tsx");
ok(
  "PROV-31 MSAT compare chips stay composite but do not live-fetch leftover identity HTTP",
  /field="MSAT compare"/.test(msatBoard) &&
    /liveFetch=\{false\}/.test(msatBoard) &&
    /dossier=\{a\}/.test(msatBoard) &&
    /dossier=\{b\}/.test(msatBoard) &&
    !/field="MSAT compare"[\s\S]{0,200}pubchemCid=/.test(msatBoard)
);
const batchDensify = read("components/frontier/BatchDensifyPanel.tsx");
ok(
  "PROV-31 batch-densify chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Batch densify"/.test(batchDensify) &&
    /liveFetch=\{false\}/.test(batchDensify) &&
    /dossier=\{dossier\}/.test(batchDensify) &&
    !/field="Batch densify"[\s\S]{0,200}pubchemCid=/.test(batchDensify)
);
const edgeCompare = read("components/frontier/NetworkEdgeComparePanel.tsx");
ok(
  "PROV-31 network-edge-compare chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Network edge compare"/.test(edgeCompare) &&
    /liveFetch=\{false\}/.test(edgeCompare) &&
    /dossier=\{dossiers\[0\]\}/.test(edgeCompare) &&
    !/field="Network edge compare"[\s\S]{0,200}pubchemCid=/.test(edgeCompare)
);
const sourceCoverage = read("components/SourceCoverageMap.tsx");
ok(
  "PROV-32 source-coverage chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Source coverage"/.test(sourceCoverage) &&
    /liveFetch=\{false\}/.test(sourceCoverage) &&
    /dossier=\{dossier\}/.test(sourceCoverage) &&
    !/field="Source coverage"[\s\S]{0,200}pubchemCid=/.test(sourceCoverage)
);
const idealPage = read("components/IdealPageParityPanel.tsx");
ok(
  "PROV-33 ideal-page chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Ideal page"/.test(idealPage) &&
    /traces=\{slimTraces\(dossier\.traces/.test(idealPage) &&
    !/field="Ideal page"[\s\S]{0,200}pubchemCid=/.test(idealPage) &&
    !/pubchemCid=\{dossier\.cid\}/.test(idealPage)
);
const validationChecklist = read("components/ValidationChecklist.tsx");
ok(
  "PROV-34 validation-checklist chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Validation checklist"/.test(validationChecklist) &&
    /liveFetch=\{false\}/.test(validationChecklist) &&
    /dossier=\{dossier\}/.test(validationChecklist) &&
    !/field="Validation checklist"[\s\S]{0,200}pubchemCid=/.test(validationChecklist)
);
const thinToUseful = read("components/ThinToUsefulBanner.tsx");
ok(
  "PROV-34 thin-to-useful chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Thin-to-useful"/.test(thinToUseful) &&
    /liveFetch=\{false\}/.test(thinToUseful) &&
    /dossier=\{dossier\}/.test(thinToUseful) &&
    !/field="Thin-to-useful"[\s\S]{0,200}pubchemCid=/.test(thinToUseful)
);
const evidenceScore = read("components/EvidenceScoreExplainer.tsx");
ok(
  "PROV-34 evidence-score chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Evidence score"/.test(evidenceScore) &&
    /liveFetch=\{false\}/.test(evidenceScore) &&
    /dossier=\{dossier\}/.test(evidenceScore) &&
    !/field="Evidence score"[\s\S]{0,200}pubchemCid=/.test(evidenceScore)
);
const recipeReadiness = read("components/RecipeReadinessPanel.tsx");
ok(
  "PROV-35 recipe-readiness chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Recipe readiness"/.test(recipeReadiness) &&
    /traces=\{slimTraces\(dossier\.traces/.test(recipeReadiness) &&
    !/field="Recipe readiness"[\s\S]{0,200}pubchemCid=/.test(recipeReadiness) &&
    !/pubchemCid=\{dossier\.cid\}/.test(recipeReadiness)
);
const managerBrief = read("components/ManagerBriefPanel.tsx");
ok(
  "PROV-35 manager-brief chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Manager brief"/.test(managerBrief) &&
    /traces=\{slimTraces\(dossier\.traces/.test(managerBrief) &&
    !/field="Manager brief"[\s\S]{0,200}pubchemCid=/.test(managerBrief) &&
    !/pubchemCid=\{dossier\.cid\}/.test(managerBrief)
);
const critique = read("components/EvidenceCritiquePanel.tsx");
ok(
  "PROV-35 critique chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Critique"/.test(critique) &&
    /traces=\{allTraces\}/.test(critique) &&
    !/field="Critique"[\s\S]{0,200}pubchemCid=/.test(critique) &&
    !/pubchemCid=\{dossier\.cid\}/.test(critique)
);
const scienceAgent = read("components/frontier/ScienceAgentPanel.tsx");
ok(
  "PROV-36 science-agent chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Science agent"/.test(scienceAgent) &&
    /liveFetch=\{false\}/.test(scienceAgent) &&
    /dossier=\{dossier\}/.test(scienceAgent) &&
    /field="Science agent answer"/.test(scienceAgent) &&
    /traces=\{slimTraces\(dossier\.traces/.test(scienceAgent) &&
    !/field="Science agent"[\s\S]{0,200}pubchemCid=/.test(scienceAgent) &&
    !/field="Science agent answer"[\s\S]{0,200}pubchemCid=/.test(scienceAgent) &&
    !/pubchemCid=\{dossier\.cid\}/.test(scienceAgent)
);
const evidenceScience = read("components/frontier/EvidenceSciencePanel.tsx");
ok(
  "PROV-36 science-QA chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Evidence science Q&A"/.test(evidenceScience) &&
    /liveFetch=\{false\}/.test(evidenceScience) &&
    /dossier=\{dossier\}/.test(evidenceScience) &&
    !/field="Evidence science Q&A"[\s\S]{0,200}pubchemCid=/.test(evidenceScience)
);
const reactionNetwork = read("components/frontier/ReactionNetworkPanel.tsx");
ok(
  "PROV-36 reaction-network chips stay composite but do not live-fetch leftover identity HTTP",
  /field="Reaction network"/.test(reactionNetwork) &&
    /liveFetch=\{false\}/.test(reactionNetwork) &&
    /dossier=\{dossier\}/.test(reactionNetwork) &&
    !/field="Reaction network"[\s\S]{0,200}pubchemCid=/.test(reactionNetwork)
);
ok(
  "PROV-37 manufacturing-summary aside stays composite but does not live-fetch leftover identity HTTP",
  /field="Manufacturing summary"/.test(aside) &&
    /traces=\{apiTraces\}/.test(aside) &&
    !/field="Manufacturing summary"[\s\S]{0,200}pubchemCid=/.test(aside)
);
ok(
  "PROV-14 live multi-source provenance uses annotationTraces not all harvest HTTP",
  /traces=\{annotationTraces\}[\s\S]{0,200}title="Multi-source free APIs"/.test(liveDossier) &&
    /sourceRefs=\{annotationSourceRefs\}[\s\S]{0,200}title="Multi-source free APIs"/.test(liveDossier) &&
    !/traces=\{traces\}[\s\S]{0,200}title="Multi-source free APIs"/.test(liveDossier)
);

const { createRequire } = await import("node:module");
const { tmpdir } = await import("node:os");
const { pathToFileURL } = await import("node:url");
const requireTs = createRequire(import.meta.url);
const ts = requireTs("typescript");
const provFile = src("lib/provenance.ts");
let provSrc = readFileSync(provFile, "utf8");
provSrc = provSrc
  .replace(
    /import type \{[^}]+\} from "[^"]+";\s*/g,
    ""
  )
  .replace(
    /import \{ isFreePublicUrl \} from "@\/lib\/api\/publicSources";/,
    "function isFreePublicUrl(url) { try { const u = new URL(url); return u.protocol === \"http:\" || u.protocol === \"https:\"; } catch { return false; } }"
  )
  .replace(
    /import \{ pubchemDeepLink \} from "@\/lib\/api\/pubchem";/,
    "function pubchemDeepLink(cid) { return \"https://pubchem.ncbi.nlm.nih.gov/compound/\" + cid; }"
  );
const { outputText: provJs } = ts.transpileModule(provSrc, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: provFile,
});
const provOut = join(tmpdir(), `provenance-match-${process.pid}.mjs`);
writeFileSync(provOut, provJs, "utf8");
const {
  matchTraceForSourceRef: matchLive,
  isIdentityOverviewTrace,
  isIdentityOverviewSourceRef,
  isLiteratureHeadingTrace,
  isCompoundPatentsHeadingTrace,
  isApplicationsTrace,
} = await import(pathToFileURL(provOut).href);

const propertyTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/Title/JSON",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:00.000Z",
  httpStatus: 200,
  responseBody: '{"PropertyTable":{}}',
  ok: true,
};
const patentIdTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/xrefs/PatentID/JSON",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:01.000Z",
  httpStatus: 200,
  responseBody: '{"InformationList":{}}',
  ok: true,
};
const mfgViewTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Use+and+Manufacturing",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:02.000Z",
  httpStatus: 200,
  responseBody: '{"Record":{}}',
  ok: true,
};
const classTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/classification/JSON",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:03.000Z",
  httpStatus: 200,
  responseBody: '{"Hierarchies":{}}',
  ok: true,
};
const mixedPubchem = [propertyTrace, patentIdTrace, mfgViewTrace, classTrace];

ok(
  "PROV-08 patents citation does not hydrate from property HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem-patents:2244",
      label: "PubChem patent xrefs",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Patents",
    },
    mixedPubchem
  )?.endpointUrl.includes("PatentID")
);
ok(
  "PROV-08 manufacturing citation does not hydrate from property HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem-mfg-page:2244",
      label: "PubChem · Use and Manufacturing",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Use-and-Manufacturing",
    },
    mixedPubchem
  )?.endpointUrl.includes("pug_view")
);
ok(
  "PROV-08 classification citation does not hydrate from property HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem-class:2244",
      label: "PubChem classification / MeSH",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Classification",
    },
    mixedPubchem
  )?.endpointUrl.includes("classification")
);
ok(
  "PROV-08 identity citation does not hydrate from PatentID HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem:2244",
      label: "PubChem compound record",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244",
    },
    mixedPubchem
  )?.endpointUrl.includes("/property/")
);
ok(
  "PROV-08 manufacturing citation stays unmatched without pug_view",
  matchLive(
    {
      type: "api",
      id: "pubchem-mfg-page:2244",
      label: "PubChem · Use and Manufacturing",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Use-and-Manufacturing",
    },
    [propertyTrace]
  ) == null
);

const ghsViewTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=GHS+Classification",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:04.000Z",
  httpStatus: 200,
  responseBody: '{"Record":{}}',
  ok: true,
};
const mixedWithGhs = [...mixedPubchem, ghsViewTrace];

ok(
  "PROV-09 GHS citation hydrates from GHS pug_view not property HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-ghs:2244",
      label: "PubChem PUG View · GHS / Safety",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Safety-and-Hazards",
    },
    mixedWithGhs
  )?.endpointUrl.includes("GHS")
);
ok(
  "PROV-09 GHS citation stays unmatched without GHS pug_view",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-ghs:2244",
      label: "PubChem PUG View · GHS / Safety",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Safety-and-Hazards",
    },
    mixedPubchem
  ) == null
);
ok(
  "PROV-09 unknown pubchem-spectra citation does not steal identity HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem-spectra:2244",
      label: "PubChem spectra",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Spectra",
    },
    mixedWithGhs
  ) == null
);

const propsViewTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Chemical+and+Physical+Properties",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:05.000Z",
  httpStatus: 200,
  responseBody: '{"Record":{}}',
  ok: true,
};
const patentViewTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/patent/US-10029448-B2/JSON",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:06.000Z",
  httpStatus: 200,
  responseBody: '{"Record":{}}',
  ok: true,
};
const litViewTrace = {
  endpointUrl:
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Literature",
  method: "GET",
  fetchedAt: "2026-08-16T18:00:07.000Z",
  httpStatus: 200,
  responseBody: '{"Record":{}}',
  ok: true,
};
const leftoverPubchem = [...mixedWithGhs, propsViewTrace, patentViewTrace, litViewTrace];

ok(
  "PROV-10 properties citation hydrates from properties pug_view not GHS/identity",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-props:2244",
      label: "PubChem · Chemical and Physical Properties",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Chemical-and-Physical-Properties",
    },
    leftoverPubchem
  )?.endpointUrl.includes("Chemical+and+Physical")
);
ok(
  "PROV-10 properties citation stays unmatched without properties pug_view",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-props:2244",
      label: "PubChem · Chemical and Physical Properties",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Chemical-and-Physical-Properties",
    },
    mixedWithGhs
  ) == null
);
ok(
  "PROV-10 patent-view citation hydrates from pug_view/data/patent not PatentID",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-patent:US-10029448-B2",
      label: "PubChem PUG View patent record",
      url: "https://pubchem.ncbi.nlm.nih.gov/patent/US-10029448-B2",
    },
    leftoverPubchem
  )?.endpointUrl.includes("/data/patent/")
);
ok(
  "PROV-10 patent-view citation stays unmatched without patent pug_view",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-patent:US-10029448-B2",
      label: "PubChem PUG View patent record",
      url: "https://pubchem.ncbi.nlm.nih.gov/patent/US-10029448-B2",
    },
    mixedWithGhs
  ) == null
);
ok(
  "PROV-10 literature pug_view heading does not hydrate properties citation",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-props:2244",
      label: "PubChem · Chemical and Physical Properties",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Chemical-and-Physical-Properties",
    },
    [propertyTrace, litViewTrace, ghsViewTrace]
  ) == null
);

ok(
  "PROV-11 identity/overview keeps PUG REST property HTTP",
  isIdentityOverviewTrace(propertyTrace.endpointUrl)
);
ok(
  "PROV-11 identity/overview keeps pharmacology pug_view",
  isIdentityOverviewTrace(
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Pharmacology+and+Biochemistry"
  )
);
ok(
  "PROV-11 identity/overview rejects Literature heading HTTP",
  !isIdentityOverviewTrace(litViewTrace.endpointUrl)
);
ok(
  "PROV-11 identity/overview rejects classification HTTP",
  !isIdentityOverviewTrace(classTrace.endpointUrl)
);
ok(
  "PROV-11 identity/overview rejects GHS pug_view",
  !isIdentityOverviewTrace(ghsViewTrace.endpointUrl)
);
ok(
  "PROV-11 identity/overview rejects PatentID HTTP",
  !isIdentityOverviewTrace(patentIdTrace.endpointUrl)
);
ok(
  "PROV-11 literature heading matcher accepts pug_view Literature",
  isLiteratureHeadingTrace(litViewTrace.endpointUrl)
);
ok(
  "PROV-11 compound patents heading is not /data/patent densify",
  isCompoundPatentsHeadingTrace(
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/2244/JSON?heading=Patents"
  ) && !isCompoundPatentsHeadingTrace(patentViewTrace.endpointUrl)
);
ok(
  "PROV-11 literature heading citation does not hydrate from identity HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-lit:2244",
      label: "PubChem PUG View · Literature",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Literature",
    },
    leftoverPubchem
  )?.endpointUrl.includes("heading=Literature")
);
ok(
  "PROV-11 literature heading citation stays unmatched without Literature pug_view",
  matchLive(
    {
      type: "api",
      id: "pubchem-view-lit:2244",
      label: "PubChem PUG View · Literature",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Literature",
    },
    mixedWithGhs
  ) == null
);
ok(
  "PROV-11 identity source ref kept; classification leftover dropped",
  isIdentityOverviewSourceRef({
    type: "api",
    id: "pubchem:2244",
    label: "PubChem compound record",
  }) &&
    !isIdentityOverviewSourceRef({
      type: "api",
      id: "pubchem-class:2244",
      label: "PubChem classification / MeSH",
    }) &&
    !isIdentityOverviewSourceRef({
      type: "literature",
      id: "doi:10.1000/foo",
      label: "Some paper",
    })
);

ok(
  "PROV-13 applications keeps Use and Manufacturing pug_view",
  isApplicationsTrace(mfgViewTrace.endpointUrl)
);
ok(
  "PROV-13 applications rejects identity /property/ HTTP",
  !isApplicationsTrace(propertyTrace.endpointUrl)
);
ok(
  "PROV-30 leftover identity /property/ is not applications / patents heading / manufacturing pug_view",
  !isApplicationsTrace(propertyTrace.endpointUrl) &&
    !isCompoundPatentsHeadingTrace(propertyTrace.endpointUrl) &&
    !isApplicationsTrace("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/Title/JSON")
);
ok(
  "PROV-13 applications rejects GHS pug_view",
  !isApplicationsTrace(ghsViewTrace.endpointUrl)
);
ok(
  "PROV-13 applications rejects Literature heading HTTP",
  !isApplicationsTrace(litViewTrace.endpointUrl)
);
ok(
  "PROV-13 applications rejects classification HTTP",
  !isApplicationsTrace(classTrace.endpointUrl)
);
ok(
  "PROV-13 applications rejects patent pug_view densify",
  !isApplicationsTrace(patentViewTrace.endpointUrl)
);
ok(
  "PROV-13 applications rejects MassBank leftover HTTP",
  !isApplicationsTrace("https://massbank.eu/MassBank-api/records?query=aspirin")
);
ok(
  "PROV-13 applications citation hydrates from manufacturing pug_view not leftover HTTP",
  matchLive(
    {
      type: "api",
      id: "pubchem-mfg-page:2244",
      label: "PubChem · Use and Manufacturing",
      url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Use-and-Manufacturing",
    },
    leftoverPubchem
  )?.endpointUrl.includes("Use+and+Manufacturing")
);



const massbankSrc = read("lib/api/massbank.ts");
const gatherSrc = read("lib/dossier/gather.ts");
ok(
  "PROV-12 MassBank client does not fetch PubChem identity as spectra",
  !/pubchem\.ncbi\.nlm\.nih\.gov\/rest\/pug/.test(massbankSrc) &&
    /isHarvestedMassBankRecord/.test(massbankSrc) &&
    /isMassBankSpectraTrace/.test(massbankSrc)
);
ok(
  "PROV-12 gather claims MassBank spectra only after harvested-record filter",
  /isHarvestedMassBankRecord/.test(gatherSrc) &&
    /spectraHits\.length/.test(gatherSrc) &&
    !/`\$\{massBankResult\.hits\.length\} MS record/.test(gatherSrc)
);

const mbFile = src("lib/api/massbank.ts");
let mbSrc = readFileSync(mbFile, "utf8");
mbSrc = mbSrc.replace(/import type \{[^}]+\} from "[^"]+";\s*/g, "");
const { outputText: mbJs } = ts.transpileModule(mbSrc, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: mbFile,
});
const mbOut = join(tmpdir(), `massbank-honesty-${process.pid}.mjs`);
writeFileSync(mbOut, mbJs, "utf8");
const {
  isHarvestedMassBankRecord,
  isMassBankSpectraTrace,
  fetchMassBankByName,
} = await import(pathToFileURL(mbOut).href);

ok(
  "PROV-12 site-search stand-in is not an MS record",
  !isHarvestedMassBankRecord({
    accession: "massbank-search:aspirin",
    title: "MassBank EU search: aspirin",
    url: "https://massbank.eu/MassBank/Search",
  })
);
ok(
  "PROV-12 PubChem CID stand-in is not an MS record",
  !isHarvestedMassBankRecord({
    accession: "pubchem:2244",
    title: "aspirin · free-public analytical identity",
    url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Spectral-Information",
  })
);
ok(
  "PROV-12 PubChem InChIKey stand-in is not an MS record",
  !isHarvestedMassBankRecord({
    accession: "BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
    title: "aspirin · free-public analytical identity",
    url: "https://pubchem.ncbi.nlm.nih.gov/compound/2244#section=Spectral-Information",
  })
);
ok(
  "PROV-12 real MassBank accession is an MS record",
  isHarvestedMassBankRecord({
    accession: "SM858002",
    title: "Aspirin; LC-ESI-QQ; MS2",
    url: "https://massbank.eu/MassBank/RecordDisplay?id=SM858002",
  })
);
ok(
  "PROV-12 PubChem identity HTTP is not MassBank spectra",
  !isMassBankSpectraTrace(
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/MolecularFormula,Title,InChIKey/JSON"
  )
);
ok(
  "PROV-12 MassBank host HTTP is spectra",
  isMassBankSpectraTrace("https://massbank.eu/MassBank-api/records?query=aspirin")
);
ok(
  "PROV-12 massbank citation does not hydrate from leftover PubChem identity HTTP",
  matchLive(
    {
      type: "api",
      id: "massbank:2244",
      label: "MassBank spectra",
      url: "https://massbank.eu/",
    },
    leftoverPubchem
  ) == null
);

const emptyHarvest = await fetchMassBankByName("aspirin", { limit: 5 });
ok(
  "PROV-12 retired MassBank harvest is empty (no invented MS records or PubChem traces)",
  emptyHarvest.hits.length === 0 &&
    emptyHarvest.annotations.length === 0 &&
    emptyHarvest.traces.length === 0 &&
    emptyHarvest.query === "aspirin"
);


console.log(`\n${passed} provenance checks passed`);
