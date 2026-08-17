/**
 * Product-path contracts: Monday progressive UX, vault hero, MSAT workspace, honesty.
 * Run: node scripts/test-product-path.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");
const repo = path.join(__dirname, "..", "..");

let n = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  n += 1;
  console.log("ok  ", name);
}

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

function readRepo(rel) {
  return fs.readFileSync(path.join(repo, rel), "utf8");
}

console.log("test-product-path");

const readme = readRepo("README.md");
ok("README no ~100+ packages claim", !/~\s*100\+\s*packages/i.test(readme));
ok("README no Tier-A examples feature row", !/\*\*Tier-A examples\*\*/.test(readme));
ok("README MSAT journey feature", /MSAT journey/i.test(readme));
ok("README packages redirect honesty", /Redirect to search|mocks retired/i.test(readme));
ok(
  "product-vision no Tier-A curated content table",
  !/Curated JSON \+ citations/.test(readRepo("docs/product-vision.md"))
);
ok(
  "docs/README no Tier-A examples route",
  !/Home \+ Tier-A examples/.test(readRepo("docs/README.md"))
);
ok(
  "diagnostics productMode live-densify",
  /productMode:\s*"live-densify"/.test(read("app/api/diagnostics/route.ts"))
);
ok(
  "diagnostics no mock curatedPackages counter",
  !/curatedPackages/.test(read("app/api/diagnostics/route.ts"))
);
ok(
  "mock extract-dossiers script removed",
  !fs.existsSync(path.join(__dirname, "extract-dossiers.mjs"))
);

const design = readRepo("docs/design/product-design.md");
ok("design live densify hub", /live densify/i.test(design));
ok("design no ~100+ packages", !/~\s*100\+\s*educational packages/i.test(design));

ok("default role msat", /DEFAULT_WORKER_ROLE[\s\S]*"msat"/.test(read("lib/worker/roleMode.ts")));
ok("mondayPath assess", /assessMondayPath/.test(read("lib/dossier/mondayPath.ts")));
ok("Live vault panel", /ProcedureVaultPanel/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("Live Monday pack before science", /MondayMorningPack[\s\S]*ProcedureVaultPanel[\s\S]*Science lab|MondayMorningPack[\s\S]*ProcedureVaultPanel/.test(read("components/dossier/LiveMoleculeDossier.tsx")));
ok("ThinToUseful densify-next queue", /runDensifyActionQueue/.test(read("components/ThinToUsefulBanner.tsx")));
ok("Workspace MSAT title", /MSAT campaigns/.test(read("app/workspace/page.tsx")));
ok("Diagnostics cold KPI", /ColdCidKpiPanel/.test(read("app/diagnostics/page.tsx")));
ok("coldCidKpi golden set", /GOLDEN_COLD_CIDS/.test(read("lib/dossier/coldCidKpi.ts")));
ok("bulkVault ingest", /ingestExcerptsToVault/.test(read("lib/idb/bulkVault.ts")));
ok("home MSAT journey CTA", /MSAT journey|runMsatJourney|runMsatPath/.test(read("components/ProblemFirstSearch.tsx")));
ok("MSAT wizard stepper", /wizardStep|MSAT wizard|Step 1/.test(read("components/ProblemFirstSearch.tsx")));
ok("campaignVault module", /CAMPAIGN_VAULT_SCHEMA|buildCampaignVaultBag/.test(read("lib/idb/campaignVault.ts")));
ok("ProcedureVault export bag", /exportVaultBag|Export vault bag/.test(read("components/ProcedureVaultPanel.tsx")));
ok("Workspace CampaignVaultPanel", /CampaignVaultPanel/.test(read("app/workspace/page.tsx")));
ok("coldCid report markdown", /formatColdCidKpiReportMarkdown|buildColdCidKpiReport/.test(read("lib/dossier/coldCidKpi.ts")));
ok("report-cold-cid-kpi script", fs.existsSync(path.join(__dirname, "report-cold-cid-kpi.mjs")));
ok("accuracy fixture file", fs.existsSync(path.join(__dirname, "fixtures/process-accuracy-fixture.json")));
ok(
  "batch route finite retries",
  /Number\.isFinite\(retriesRaw\)|Number\.isFinite\(concurrencyRaw\)/.test(
    read("app/api/dossier/batch/route.ts")
  )
);
ok(
  "agent pack vault fingerprint field",
  /vaultFingerprint/.test(read("lib/export/agentPack.ts"))
);
ok(
  "cold-cid workflow exists",
  fs.existsSync(path.join(repo, ".github/workflows/cold-cid-kpi.yml"))
);

const readinessUi = read("components/RecipeReadinessPanel.tsx");
const problemUi = read("components/ProblemFirstSearch.tsx");
ok("readiness UI has no Teaching package label", !/Teaching package/.test(readinessUi));
ok("problem search has no hub/live hits copy", !/hub\/live hits/.test(problemUi));
ok("problem search has no Local hits ready copy", !/Local hits ready/.test(problemUi));
ok("problem search UI has no hub-live chip", !/hub-live/.test(problemUi));
ok(
  "compare warm alert has no hub names",
  !/hub names/.test(read("app/compare/page.tsx"))
);
const e2e = fs.readFileSync(path.join(__dirname, "..", "e2e", "worker-path.spec.ts"), "utf8");
ok(
  "e2e home does not require dossier unit-op heading",
  !/Problem \/ unit-op search/.test(e2e)
);
ok("e2e home asserts live densify chrome", /Live densify/.test(e2e) && /AI dual-view/.test(e2e));
ok("e2e covers compare/search/workspace/diagnostics", /\/compare/.test(e2e) && /\/search/.test(e2e) && /\/workspace/.test(e2e) && /\/diagnostics/.test(e2e));

const comparePage = read("app/compare/page.tsx");
ok("compare placeholder does not advertise unresolved CAS", !/CID, CAS, or name/.test(comparePage));
ok(
  "compare warms prefixed CID via parsePubchemCidQuery",
  /parsePubchemCidQuery/.test(comparePage) &&
    /normalizeChemicalQuery/.test(comparePage)
);
ok("compare has no teaching-name aspirin shortcut", !/Teaching name/.test(comparePage) && !/toLowerCase\(\) === "aspirin"/.test(comparePage));
ok("ORD panel has no hub molecule leftover", !/hub molecule/.test(read("components/OrdBulkPanel.tsx")));

const gettingStarted = readRepo("docs/getting-started.md");
ok("getting-started has no hub twin leftover", !/hub twin/.test(gettingStarted));
ok("getting-started does not advertise header Google sign-in", !/Header \*\*Google sign-in\*\*/.test(gettingStarted));
ok(
  "security.md does not claim Google sign-in UI exists",
  !/Google sign-in\*\* UI exists/.test(readRepo("docs/security.md"))
);
ok(
  "product-vision has no unit-op hub hits",
  !/unit-op hub hits/.test(readRepo("docs/product-vision.md"))
);
ok(
  "chemistry-api-sources.json no curated overlays",
  !/curated overlays/.test(readRepo("docs/chemistry-api-sources.json"))
);
ok(
  "home compare has no pinned routes leftover",
  !/pinned routes/.test(read("app/page.tsx"))
);
ok(
  "route compare has no teaching-route leftover",
  !/public\/teaching route/.test(read("components/RouteCompare.tsx"))
);
ok(
  "firebase diagnostics has no Google sign-in leftover",
  !/Google sign-in \(client\)/.test(read("app/api/diagnostics/firebase/route.ts"))
);

ok(
  "compare does not claim warm complete unconditionally",
  !/Warm complete — dual export ready when both sides loaded/.test(comparePage)
);
ok(
  "compare uses formatCompareWarmStatus",
  /formatCompareWarmStatus/.test(comparePage)
);
ok(
  "compare export alert does not require both when one loaded",
  !/Warm or open both live dossiers first/.test(comparePage)
);
const densifySched = read("components/DensifySchedulePanel.tsx");
ok(
  "densify schedule only marks warmed when dossier returned",
  /const d = await warmLiveDossier/.test(densifySched) &&
    /if \(!d\)/.test(densifySched) &&
    /markDensifyWarmed/.test(densifySched) &&
    /Warm failed for CID/.test(densifySched)
);


ok(
  "densify schedule uses formatBatchDensifyStatus not unconditional done",
  /formatBatchDensifyStatus/.test(densifySched) &&
    !/`Due densify done/.test(densifySched)
);
ok(
  "campaign agent local cache warm is not leftover complete copy",
  /formatBatchDensifyStatus/.test(read("components/frontier/CampaignAgentPanel.tsx")) &&
    !/Local cache warm complete`/.test(read("components/frontier/CampaignAgentPanel.tsx"))
);
ok(
  "warmCache does not promote incomplete stream as cache",
  /Stream incomplete CID/.test(read("lib/dossier/warmCache.ts")) &&
    !/Ensure cache even if complete event lacked type/.test(read("lib/dossier/warmCache.ts"))
);
ok(
  "science agent neighbor fail is not leftover none-needed copy",
  /formatNeighborDensifyStatus/.test(read("components/frontier/ScienceAgentPanel.tsx")) &&
    /neighborFailedCids/.test(read("lib/frontier/scienceAgent.ts")) &&
    !/`Neighbors densified: \$\{neighborCids\.join/.test(
      read("components/frontier/ScienceAgentPanel.tsx")
    )
);
ok(
  "batch densify stream log has no leftover success checkmark",
  !/`✓ CID \$\{ev\.cid\}/.test(read("components/frontier/BatchDensifyPanel.tsx"))
);
ok(
  "live dossier schedule warm requires cache, not phase ready",
  /shouldMarkScheduleWarmed/.test(
    read("components/dossier/LiveMoleculeDossier.tsx")
  ) &&
    !/warmed:\s*chrome\?\.phase === ["']ready["']/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    )
);



ok(
  "live dossier literature empty copy is not unconditional No hits",
  /formatSectionEmptyCopy/.test(read("components/dossier/LiveMoleculeDossier.tsx")) &&
    /litEmpty\.summary/.test(read("components/dossier/LiveMoleculeDossier.tsx")) &&
    /patentEmpty\.summary/.test(read("components/dossier/LiveMoleculeDossier.tsx"))
);
ok(
  "live dossier manufacturing/GHS/properties empty copy is not unconditional",
  /mfgEmpty\.summary/.test(read("components/dossier/LiveMoleculeDossier.tsx")) &&
    /emptyMessage=\{mfgEmpty\.message\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    /hazardEmpty/.test(read("components/dossier/LiveDossierAside.tsx")) &&
    /propertyEmpty/.test(read("components/dossier/LiveDossierAside.tsx")) &&
    /mfgEmpty/.test(read("components/dossier/LiveDossierAside.tsx")) &&
    !/Awaiting PubChem \/ process-fact excerpts/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    )
);
ok(
  "live dossier overview empty copy is not unconditional",
  /overviewEmpty/.test(read("components/dossier/LiveMoleculeDossier.tsx")) &&
    /family: "overview"/.test(read("components/dossier/LiveMoleculeDossier.tsx"))
);
ok(
  "problem search empty copy is not unconditional No live hits",
  /formatSearchNoHitsMessage/.test(problemUi) &&
    /formatProblemSearchSummary/.test(read("lib/search/problemMultiSource.ts"))
);
ok(
  "live dossier multi-source chip does not dump all harvest traces",
  /traces=\{annotationTraces\}/.test(
    read("components/dossier/LiveMoleculeDossier.tsx")
  ) &&
    /isAnnotationSectionTrace/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/title="Multi-source free APIs"[\s\S]{0,200}traces=\{traces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    )
);
ok(
  "live dossier process recipe chips do not dump leftover harvest HTTP",
  /traces=\{processFactTraces\}/.test(
    read("components/dossier/LiveMoleculeDossier.tsx")
  ) &&
    /isProcessFactTrace/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/field="Process recipe"[\s\S]{0,200}traces=\{traces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    )
);
ok(
  "live dossier related / unit-ops / gaps chips do not dump leftover harvest HTTP",
  /field="Related materials"[\s\S]{0,200}traces=\{processFactTraces\}/.test(
    read("components/dossier/LiveMoleculeDossier.tsx")
  ) &&
    /field="Modality unit ops"[\s\S]{0,200}traces=\{processFactTraces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    /field="Evidence gaps"[\s\S]{0,200}traces=\{plantTraces\}/.test(
      read("components/dossier/LiveDossierAside.tsx")
    ) &&
    !/field="Related materials"[\s\S]{0,200}traces=\{traces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/field="Modality unit ops"[\s\S]{0,200}traces=\{traces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/field="Evidence gaps"[\s\S]{0,200}traces=\{allTraces\}/.test(
      read("components/dossier/LiveDossierAside.tsx")
    )
);

ok(
  "process framing chips do not dump leftover harvest HTTP",
  /isProcessFactTrace/.test(read("components/ProcessFramingBanner.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/ProcessFramingBanner.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/ProcessFramingBanner.tsx")) &&
    /field="Process framing"/.test(read("components/ProcessFramingBanner.tsx"))
);
ok(
  "condition atlas chips do not dump leftover harvest HTTP",
  /isProcessFactTrace/.test(read("components/frontier/ConditionAtlasPanel.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/frontier/ConditionAtlasPanel.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/frontier/ConditionAtlasPanel.tsx")) &&
    /field="Condition atlas"/.test(read("components/frontier/ConditionAtlasPanel.tsx"))
);
ok(
  "operator job-aid chips do not dump leftover harvest HTTP",
  /isProcessFactTrace/.test(read("components/OperatorJobAid.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/OperatorJobAid.tsx")) &&
    /field="Operator job aid"/.test(read("components/OperatorJobAid.tsx")) &&
    !/field="Operator job aid"[\s\S]{0,200}pubchemCid=/.test(
      read("components/OperatorJobAid.tsx")
    )
);
ok(
  "process facts empty copy is not unconditional extracted-yet",
  /formatProcessFactsEmptyCopy/.test(read("components/ProcessFactsPanel.tsx")) &&
    /factEmpty\.message/.test(read("components/ProcessFactsPanel.tsx")) &&
    !/No condition \/ unit-op atoms extracted from titles and abstracts yet\./.test(
      read("components/ProcessFactsPanel.tsx")
    )
);
ok(
  "SEARCH-25 job-aid empty copy is not unconditional GHS/sequence miss",
  /formatSectionEmptyCopy/.test(read("components/OperatorJobAid.tsx")) &&
    /formatProcessFactsEmptyCopy/.test(read("components/OperatorJobAid.tsx")) &&
    /hazardEmpty\.message/.test(read("components/OperatorJobAid.tsx")) &&
    /sequenceEmpty\.kind === "error"/.test(read("components/OperatorJobAid.tsx")) &&
    !/No GHS hazard statements on file/.test(read("components/OperatorJobAid.tsx"))
);
ok(
  "monday-pack chips do not dump leftover harvest HTTP",
  /isProcessFactTrace/.test(read("components/MondayMorningPack.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/MondayMorningPack.tsx")) &&
    /field="Monday pack"/.test(read("components/MondayMorningPack.tsx")) &&
    !/field="Monday pack"[\s\S]{0,200}pubchemCid=/.test(
      read("components/MondayMorningPack.tsx")
    )
);
ok(
  "procedure-vault chips do not dump leftover harvest HTTP",
  /isProcessFactTrace/.test(read("components/ProcedureVaultPanel.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/ProcedureVaultPanel.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/ProcedureVaultPanel.tsx")) &&
    /field="Procedure vault"/.test(read("components/ProcedureVaultPanel.tsx"))
);
ok(
  "pdf-pack chips do not dump leftover harvest HTTP",
  /isProcessFactTrace/.test(read("components/PdfWorkerPack.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/PdfWorkerPack.tsx")) &&
    /field="PDF pack"/.test(read("components/PdfWorkerPack.tsx")) &&
    !/field="PDF pack"[\s\S]{0,200}pubchemCid=/.test(
      read("components/PdfWorkerPack.tsx")
    )
);
ok(
  "playbook chips do not dump leftover harvest HTTP",
  /isProcessFactTrace/.test(read("components/WorkerPlaybookPanel.tsx")) &&
    /isProcessFactSourceRef/.test(read("components/WorkerPlaybookPanel.tsx")) &&
    /field="Playbooks"/.test(read("components/WorkerPlaybookPanel.tsx")) &&
    !/field="Playbooks"[\s\S]{0,200}pubchemCid=/.test(
      read("components/WorkerPlaybookPanel.tsx")
    )
);

ok(
  "site-fill chips do not dump leftover harvest HTTP",
  /field="Site fill"/.test(read("components/SiteFillPanel.tsx")) &&
    /showNotAi/.test(read("components/SiteFillPanel.tsx")) &&
    !/pubchemCid=/.test(read("components/SiteFillPanel.tsx"))
);
ok(
  "ord-bulk chips do not dump leftover harvest HTTP",
  /field="ORD bulk"/.test(read("components/OrdBulkPanel.tsx")) &&
    /showNotAi/.test(read("components/OrdBulkPanel.tsx")) &&
    !/pubchemCid=/.test(read("components/OrdBulkPanel.tsx"))
);
ok(
  "local-text-enrich chips do not dump leftover harvest HTTP",
  /title="Local public-text enrich"/.test(
    read("components/LocalTextEnrich.tsx")
  ) &&
    /ApiProvenance/.test(read("components/LocalTextEnrich.tsx")) &&
    !/pubchemCid=/.test(read("components/LocalTextEnrich.tsx"))
);
ok(
  "educational-parameters chips do not dump leftover harvest HTTP",
  /field="Educational parameters"/.test(
    read("components/BiologicParametersPanel.tsx")
  ) &&
    /liveFetch=\{false\}/.test(read("components/BiologicParametersPanel.tsx")) &&
    /traces=\{\[\]\}/.test(read("components/BiologicParametersPanel.tsx")) &&
    /sourceRefs=\{\[\]\}/.test(read("components/BiologicParametersPanel.tsx")) &&
    !/pubchemCid=/.test(read("components/BiologicParametersPanel.tsx")) &&
    !/field="Educational parameters"[\s\S]{0,200}pubchemCid=/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/field="Educational parameters"[\s\S]{0,200}traces=\{identityTraces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    )
);
ok(
  "process-facts header chip does not dump leftover harvest HTTP",
  /field="Process facts"/.test(read("components/ProcessFactsPanel.tsx")) &&
    /traces=\{factTraces\}/.test(read("components/ProcessFactsPanel.tsx")) &&
    /sourceRefs=\{factSourceRefs\}/.test(read("components/ProcessFactsPanel.tsx")) &&
    !/pubchemCid=/.test(read("components/ProcessFactsPanel.tsx"))
);
ok(
  "applications/patents/mfg/EHS header chips do not dump leftover harvest HTTP",
  /field="Applications"[\s\S]{0,200}traces=\{applicationTraces\}/.test(
    read("components/dossier/LiveMoleculeDossier.tsx")
  ) &&
    !/field="Applications"[\s\S]{0,200}pubchemCid=/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{patentTraces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{mfgTraces\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/field="EHS highlights"[\s\S]{0,200}pubchemCid=/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    ) &&
    !/field="EHS highlights"[\s\S]{0,200}pubchemCid=/.test(
      read("components/dossier/LiveDossierAside.tsx")
    ) &&
    !/pubchemCid=\{cid\}[\s\S]{0,80}traces=\{ghsTraces\}/.test(
      read("components/dossier/LiveDossierAside.tsx")
    )
);
ok(
  "SEARCH-26 monday-pack empty copy is not unconditional density miss",
  /formatProcessFactsEmptyCopy/.test(read("components/MondayMorningPack.tsx")) &&
    /sequenceEmpty\.kind === "error"/.test(read("components/MondayMorningPack.tsx")) &&
    /sequenceEmpty\.message/.test(read("components/MondayMorningPack.tsx"))
);
ok(
  "SEARCH-27 condition-atlas empty copy is not unconditional extracted miss",
  /formatProcessFactsEmptyCopy/.test(read("components/frontier/ConditionAtlasPanel.tsx")) &&
    /atlasEmpty\.kind === "error"/.test(read("components/frontier/ConditionAtlasPanel.tsx")) &&
    /atlasEmpty\.message/.test(read("components/frontier/ConditionAtlasPanel.tsx"))
);
ok(
  "SEARCH-28 route-panel empty copy is not unconditional literature miss",
  /formatProcessFactsEmptyCopy/.test(read("components/RoutePanel.tsx")) &&
    /recipeEmpty\.kind === "error"/.test(read("components/RoutePanel.tsx")) &&
    /recipeEmpty\.message/.test(read("components/RoutePanel.tsx"))
);
ok(
  "SEARCH-29 route-compare empty copy is not unconditional routes miss",
  /formatProcessFactsEmptyCopy/.test(read("components/RouteCompare.tsx")) &&
    /compareEmpty\.kind === "error"/.test(read("components/RouteCompare.tsx")) &&
    /compareEmpty\.message/.test(read("components/RouteCompare.tsx"))
);
ok(
  "SEARCH-30 route-hypotheses empty copy is not unconditional hypothesis miss",
  /formatProcessFactsEmptyCopy/.test(read("components/frontier/RouteHypothesesPanel.tsx")) &&
    /hypoEmpty\.kind === "error"/.test(read("components/frontier/RouteHypothesesPanel.tsx")) &&
    /hypoEmpty\.message/.test(read("components/frontier/RouteHypothesesPanel.tsx"))
);
ok(
  "SEARCH-31 unit-op-search empty copy is not unconditional process-facts miss",
  /formatProcessFactsEmptyCopy/.test(read("components/ProblemUnitOpSearch.tsx")) &&
    /factEmpty\.kind === "error"/.test(read("components/ProblemUnitOpSearch.tsx")) &&
    /factEmpty\.message/.test(read("components/ProblemUnitOpSearch.tsx")) &&
    !/No process facts yet\./.test(read("components/ProblemUnitOpSearch.tsx"))
);
ok(
  "SEARCH-32 manager-brief empty copy is not unconditional await-literature miss",
  /formatProcessFactsEmptyCopy/.test(read("components/ManagerBriefPanel.tsx")) &&
    /formatSectionEmptyCopy/.test(read("components/ManagerBriefPanel.tsx")) &&
    /pathEmpty\.kind === "error"/.test(read("components/ManagerBriefPanel.tsx")) &&
    /patentEmpty\.kind === "error"/.test(read("components/ManagerBriefPanel.tsx")) &&
    /hazardEmpty\.kind === "error"/.test(read("components/ManagerBriefPanel.tsx")) &&
    /pathEmpty\.message/.test(read("components/ManagerBriefPanel.tsx"))
);
ok(
  "SEARCH-33 TOC empty copy is not unconditional no-content-yet miss",
  /harvestFailed/.test(read("components/TableOfContents.tsx")) &&
    /Sources failed — not empty/.test(read("components/TableOfContents.tsx")) &&
    /harvestFailed/.test(read("components/CollapsibleSection.tsx")) &&
    /data-toc-error/.test(read("components/CollapsibleSection.tsx")) &&
    /tocSectionFlags/.test(read("components/dossier/LiveMoleculeDossier.tsx")) &&
    /harvestFailed=\{litEmpty\.kind === "error"\}/.test(
      read("components/dossier/LiveMoleculeDossier.tsx")
    )
);
ok(
  "SEARCH-34 critique empty copy is not unconditional windows-densified miss",
  /formatProcessFactsEmptyCopy/.test(read("components/EvidenceCritiquePanel.tsx")) &&
    /windowsEmpty\.kind === "error"/.test(read("components/EvidenceCritiquePanel.tsx")) &&
    /windowsEmpty\.message/.test(read("components/EvidenceCritiquePanel.tsx")) &&
    /No procedure windows densified/.test(read("components/EvidenceCritiquePanel.tsx"))
);
ok(
  "SEARCH-35 science-QA empty copy is not unconditional no-hypotheses miss",
  /honestScienceQaAnswer/.test(read("lib/frontier/evidenceQa.ts")) &&
    /formatProcessFactsEmptyCopy/.test(read("lib/frontier/evidenceQa.ts")) &&
    /harvest\.kind === "error"/.test(read("lib/frontier/evidenceQa.ts")) &&
    /No route hypotheses assembled/.test(read("lib/frontier/evidenceQa.ts"))
);
ok(
  "SEARCH-36 literature-depth empty copy is not unconditional no-windows miss",
  /honestLiteratureDepthSummary/.test(read("lib/frontier/literatureDepth.ts")) &&
    /formatProcessFactsEmptyCopy/.test(read("lib/frontier/literatureDepth.ts")) &&
    /harvest\.kind === "error"/.test(read("lib/frontier/literatureDepth.ts")) &&
    /No procedure-scored free-public windows yet/.test(read("lib/frontier/literatureDepth.ts")) &&
    /litDepth\.totalWindows === 0/.test(read("components/frontier/EvidenceSciencePanel.tsx"))
);
ok(
  "SEARCH-37 reaction-network empty copy is not unconditional center-only miss",
  /honestReactionNetworkSummary/.test(read("lib/frontier/reactionNetwork.ts")) &&
    /formatProcessFactsEmptyCopy/.test(read("lib/frontier/reactionNetwork.ts")) &&
    /harvest\.kind === "error"/.test(read("lib/frontier/reactionNetwork.ts")) &&
    /Network is center-only/.test(read("lib/frontier/reactionNetwork.ts")) &&
    /networkEmpty\.kind === "error"/.test(read("components/frontier/ReactionNetworkPanel.tsx")) &&
    /networkSummary/.test(read("components/frontier/ReactionNetworkPanel.tsx"))
);
ok(
  "SEARCH-38 process-sequence empty copy is not unconditional retrieved-yet miss",
  /honestProcessSequenceStub/.test(read("lib/dossier/scaffold.ts")) &&
    /honestProcessSequenceStub/.test(read("lib/dossier/processFacts.ts")) &&
    /isStubOnlyProcessSequence/.test(read("components/MondayMorningPack.tsx")) &&
    /isStubOnlyProcessSequence/.test(read("components/OperatorJobAid.tsx")) &&
    /isStubOnlyProcessSequence/.test(read("components/RoutePanel.tsx")) &&
    /isStubOnlyProcessSequence/.test(read("components/RouteCompare.tsx")) &&
    /No extractable public process sequence yet/.test(read("lib/dossier/sectionHonesty.ts"))
);
ok(
  "SEARCH-39 ideal-page empty copy is not unconditional No GHS / No process steps miss",
  /honestIdealEmptyCopy/.test(read("lib/dossier/idealPage.ts")) &&
    /isStubOnlyProcessSequence/.test(read("lib/dossier/idealPage.ts")) &&
    /harvest-fail/.test(read("lib/dossier/idealPage.ts")) &&
    /harvest-fail/.test(read("components/IdealPageParityPanel.tsx")) &&
    /No GHS text for this CID/.test(read("lib/dossier/idealPage.ts")) &&
    /No process steps yet/.test(read("lib/dossier/idealPage.ts"))
);
ok(
  "SEARCH-40 checklist empty copy is not unconditional Gap / No process facts miss",
  /honestChecklistGap/.test(read("lib/export/techTransfer.ts")) &&
    /isStubOnlyProcessSequence/.test(read("lib/export/techTransfer.ts")) &&
    /honestChecklistGap/.test(read("lib/dossier/sectionHonesty.ts")) &&
    /No process facts/.test(read("lib/export/techTransfer.ts"))
);
ok(
  "SEARCH-41 recipe-readiness empty copy is not unconditional Only 0 condition atoms miss",
  /honestIdealEmptyCopy/.test(read("lib/dossier/recipeReadiness.ts")) &&
    /harvestFail/.test(read("lib/dossier/recipeReadiness.ts")) &&
    /sourced condition atom/.test(read("lib/dossier/recipeReadiness.ts")) &&
    /traces: dossier\.traces/.test(read("lib/dossier/recipeReadiness.ts"))
);
ok(
  "SEARCH-42 campaign-brief empty copy is not unconditional Few condition observations miss",
  /honestCampaignBriefEmpty/.test(read("lib/frontier/campaignBrief.ts")) &&
    /honestCampaignAgentEmpty/.test(read("lib/frontier/campaignAgent.ts")) &&
    /harvestEmpty\.harvestFail/.test(read("lib/frontier/campaignBrief.ts")) &&
    /Few condition observations/.test(read("lib/dossier/sectionHonesty.ts")) &&
    /No reaction-network edges yet/.test(read("lib/dossier/sectionHonesty.ts"))
);

ok(
  "SEARCH-43 diagnostics empty copy is not unconditional none yet miss",
  /honestDiagnosticsAnnotationStat/.test(read("components/DossierDiagnostics.tsx")) &&
    /honestDiagnosticsLitPatentStat/.test(read("components/DossierDiagnostics.tsx")) &&
    /annotationStat\.harvestFail/.test(read("components/DossierDiagnostics.tsx")) &&
    /none yet/.test(read("lib/dossier/sectionHonesty.ts"))
);
ok(
  "SEARCH-44 shift-pack empty copy is not unconditional N-step / 0/0 miss",
  /honestShiftPackContent/.test(read("lib/workspace/shiftPacks.ts")) &&
    /shiftPackSaveDetail/.test(read("components/ShiftPackPanel.tsx")) &&
    /harvestEmpty\.kind === "error"/.test(read("components/ShiftPackPanel.tsx")) &&
    /isProcessFactTrace/.test(read("components/ShiftPackPanel.tsx")) &&
    /No saved shift packs for this CID yet/.test(read("components/ShiftPackPanel.tsx"))
);
ok(
  "MSAT/batch-densify/edge-compare chips do not dump leftover harvest HTTP",
  /field="MSAT compare"/.test(read("components/CompareMsatBoard.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/CompareMsatBoard.tsx")) &&
    /field="Batch densify"/.test(read("components/frontier/BatchDensifyPanel.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/frontier/BatchDensifyPanel.tsx")) &&
    /field="Network edge compare"/.test(
      read("components/frontier/NetworkEdgeComparePanel.tsx")
    ) &&
    /liveFetch=\{false\}/.test(
      read("components/frontier/NetworkEdgeComparePanel.tsx")
    )
);
ok(
  "Source-coverage chips do not dump leftover harvest HTTP",
  /field="Source coverage"/.test(read("components/SourceCoverageMap.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/SourceCoverageMap.tsx"))
);
ok(
  "Ideal-page chips do not dump leftover harvest HTTP",
  /field="Ideal page"/.test(read("components/IdealPageParityPanel.tsx")) &&
    /traces=\{slimTraces\(dossier\.traces/.test(
      read("components/IdealPageParityPanel.tsx")
    ) &&
    !/pubchemCid=\{dossier\.cid\}/.test(
      read("components/IdealPageParityPanel.tsx")
    )
);
ok(
  "Validation-checklist / thin-to-useful / evidence-score chips do not dump leftover harvest HTTP",
  /field="Validation checklist"/.test(read("components/ValidationChecklist.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/ValidationChecklist.tsx")) &&
    /field="Thin-to-useful"/.test(read("components/ThinToUsefulBanner.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/ThinToUsefulBanner.tsx")) &&
    /field="Evidence score"/.test(read("components/EvidenceScoreExplainer.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/EvidenceScoreExplainer.tsx"))
);
ok(
  "Recipe-readiness / manager-brief / critique chips do not dump leftover harvest HTTP",
  /field="Recipe readiness"/.test(read("components/RecipeReadinessPanel.tsx")) &&
    !/pubchemCid=\{dossier\.cid\}/.test(read("components/RecipeReadinessPanel.tsx")) &&
    /field="Manager brief"/.test(read("components/ManagerBriefPanel.tsx")) &&
    !/pubchemCid=\{dossier\.cid\}/.test(read("components/ManagerBriefPanel.tsx")) &&
    /field="Critique"/.test(read("components/EvidenceCritiquePanel.tsx")) &&
    !/pubchemCid=\{dossier\.cid\}/.test(read("components/EvidenceCritiquePanel.tsx"))
);
ok(
  "Science-QA / science-agent / reaction-network chips do not dump leftover harvest HTTP",
  /field="Evidence science Q&A"/.test(read("components/frontier/EvidenceSciencePanel.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/frontier/EvidenceSciencePanel.tsx")) &&
    /field="Science agent"/.test(read("components/frontier/ScienceAgentPanel.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/frontier/ScienceAgentPanel.tsx")) &&
    !/pubchemCid=\{dossier\.cid\}/.test(read("components/frontier/ScienceAgentPanel.tsx")) &&
    /field="Reaction network"/.test(read("components/frontier/ReactionNetworkPanel.tsx")) &&
    /liveFetch=\{false\}/.test(read("components/frontier/ReactionNetworkPanel.tsx"))
);
ok(
  "Manufacturing-summary aside stays composite but does not dump leftover harvest HTTP",
  /field="Manufacturing summary"/.test(read("components/dossier/LiveDossierAside.tsx")) &&
    /traces=\{apiTraces\}/.test(read("components/dossier/LiveDossierAside.tsx")) &&
    !/field="Manufacturing summary"[\s\S]{0,200}pubchemCid=/.test(
      read("components/dossier/LiveDossierAside.tsx")
    )
);
ok(
  "SEARCH-45 MSAT compare empty copy is not unconditional Similar public density / 0/0",
  /honestMsatCompareHint/.test(read("components/CompareMsatBoard.tsx")) &&
    /honestMsatCompareLitPatent/.test(read("components/CompareMsatBoard.tsx")) &&
    /formatProcessFactsEmptyCopy/.test(read("components/CompareMsatBoard.tsx")) &&
    /harvest failed.{0,3}not 0\/0/.test(read("lib/dossier/sectionHonesty.ts")) &&
    /Similar public density/.test(read("lib/dossier/sectionHonesty.ts"))
);

ok(
  "SEARCH-46 PDF-pack manifest empty copy is not unconditional Lit: 0 · Patents: 0",
  /honestPdfPackManifestLitPatent/.test(read("components/PdfWorkerPack.tsx")) &&
    /export function honestPdfPackManifestLitPatent/.test(
      read("lib/dossier/sectionHonesty.ts")
    ) &&
    /Lit\/patents: harvest failed/.test(read("lib/dossier/sectionHonesty.ts")) &&
    !/`Lit: \$\{dossier\.literature/.test(read("components/PdfWorkerPack.tsx"))
);

console.log(`\n${n} product-path checks passed`);
