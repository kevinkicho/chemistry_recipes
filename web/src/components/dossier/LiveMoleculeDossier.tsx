/**
 * Live PubChem dossier — plant-ready layout aligned with curated ExampleDossierView.
 * Content from free APIs + optional Ollama; AI blocks keep provenance chips.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AiProvenance } from "@/components/AiProvenance";
import { ContentProvenance } from "@/components/ContentProvenance";
import {
  aiAttemptProvenance,
  aiProvenanceForField,
  aiProvenanceWhenParsed,
  processRoutesFromAi,
} from "@/lib/dossier/aiFieldProvenance";
import { ApiProvenance } from "@/components/ApiProvenance";
import { RoutePanel } from "@/components/RoutePanel";
import { RouteCompare } from "@/components/RouteCompare";
import { TierBadge } from "@/components/TierBadge";
import { pubchemStructureUrl } from "@/lib/api/pubchem";
import type { LiveDossier } from "@/lib/dossier/types";
import { slimTraces } from "@/lib/api/trace";
import { routes } from "@/lib/routes";
import { Tooltip } from "@/components/Tooltip";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { TechTransferExport } from "@/components/TechTransferExport";
import { AddToProject } from "@/components/AddToProject";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { EvidenceContradictions } from "@/components/EvidenceContradictions";
import { UnitOpFillPanel } from "@/components/UnitOpFillPanel";
import { CriticalParametersBoard } from "@/components/CriticalParametersBoard";
import { EntityGraph } from "@/components/EntityGraph";
import { MODALITY_TEMPLATES } from "@/lib/modality/templates";
import {
  annotateParametersForDossier,
  getParameterSetForModality,
} from "@/lib/modality/biologicParameters";
import { BiologicParametersPanel } from "@/components/BiologicParametersPanel";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { navigateToSection } from "@/lib/tocNavigate";
import { DossierDiagnostics } from "@/components/DossierDiagnostics";
import { SourceCoverageMap } from "@/components/SourceCoverageMap";
import { EvidenceScoreExplainer } from "@/components/EvidenceScoreExplainer";
import { ValidationChecklist } from "@/components/ValidationChecklist";
import { ProcessFactsPanel } from "@/components/ProcessFactsPanel";
import { ManagerBriefPanel } from "@/components/ManagerBriefPanel";
import { OperatorJobAid } from "@/components/OperatorJobAid";
import { LocalTextEnrich } from "@/components/LocalTextEnrich";
import { ProcessFramingBanner } from "@/components/ProcessFramingBanner";
import { RecipeReadinessPanel } from "@/components/RecipeReadinessPanel";
import { ManufacturingTextTable } from "@/components/ManufacturingTextTable";
import { LiteratureTable } from "@/components/LiteratureTable";
import { PatentsTable } from "@/components/PatentsTable";
import {
  applyLocalFactEnrichment,
  hydrateVaultIntoDossier,
} from "@/lib/dossier/enrichClientFacts";
import { formatCacheAge } from "@/lib/idb/dossierCache";
import { findHubByCid } from "@/lib/data/hubIndex";
import { DossierSectionTitle as SectionTitle } from "@/components/dossier/DossierSectionTitle";
import {
  extractMp,
  extractAppearance,
  extractSolubility,
} from "@/components/dossier/propertyExtract";
import { buildMfgTableRows } from "@/components/dossier/buildMfgTableRows";
import { LiveDossierAside } from "@/components/dossier/LiveDossierAside";
import { WorkerRoleBar } from "@/components/WorkerRoleBar";
import { MondayMorningPack } from "@/components/MondayMorningPack";
import { SiteFillPanel } from "@/components/SiteFillPanel";
import { SiteGapsExport } from "@/components/SiteGapsExport";
import { WorkPackPanel } from "@/components/WorkPackPanel";
import { ProblemUnitOpSearch } from "@/components/ProblemUnitOpSearch";
import { EvidenceCritiquePanel } from "@/components/EvidenceCritiquePanel";
import { WorkerPlaybookPanel } from "@/components/WorkerPlaybookPanel";
import { PdfWorkerPack } from "@/components/PdfWorkerPack";
import { ShiftPackPanel } from "@/components/ShiftPackPanel";
import { ThinToUsefulBanner } from "@/components/ThinToUsefulBanner";
import { AiAccuracyBadge } from "@/components/AiAccuracyBadge";
import { OrdBulkPanel } from "@/components/OrdBulkPanel";
import { DensifySchedulePanel } from "@/components/DensifySchedulePanel";
import { FieldRegenerateBar } from "@/components/FieldRegenerateBar";
import { IdealPageParityPanel } from "@/components/IdealPageParityPanel";
import { ConditionAtlasPanel } from "@/components/frontier/ConditionAtlasPanel";
import { RouteHypothesesPanel } from "@/components/frontier/RouteHypothesesPanel";
import { EvidenceSciencePanel } from "@/components/frontier/EvidenceSciencePanel";
import { ReactionNetworkPanel } from "@/components/frontier/ReactionNetworkPanel";
import { BatchDensifyPanel } from "@/components/frontier/BatchDensifyPanel";
import { ScienceAgentPanel } from "@/components/frontier/ScienceAgentPanel";
import {
  readWorkerRole,
  sectionVisible,
  type WorkerRole,
} from "@/lib/worker/roleMode";
import { touchDensifySchedule } from "@/lib/dossier/densifySchedule";
import { ensureDossierKnowledge } from "@/lib/frontier/knowledgeFingerprint";

export type LiveDossierChrome = {
  fromCache?: boolean;
  cachedAt?: number | null;
  phase?: "shell" | "ready" | string;
  onRefresh?: () => void;
  snapshots?: ReactNode;
};

export function LiveMoleculeDossier({
  dossier: dossierIn,
  chrome,
}: {
  dossier: LiveDossier;
  chrome?: LiveDossierChrome;
}) {
  const [enrichTick, setEnrichTick] = useState(0);
  const [vaultDossier, setVaultDossier] = useState<LiveDossier | null>(null);
  const [workerRole, setWorkerRole] = useState<WorkerRole>("chemist");
  const [pasteDeltaMsg, setPasteDeltaMsg] = useState<string | null>(null);
  const pendingPasteDelta = useRef<{
    ideal: number;
    facts: number;
    chars: number;
  } | null>(null);

  useEffect(() => {
    setWorkerRole(readWorkerRole());
  }, []);

  // Client densify schedule: remember thin CIDs for background warm
  useEffect(() => {
    const litChars = (dossierIn.literature || []).reduce(
      (n, h) => n + (h.fullTextExcerpt?.length || 0),
      0
    );
    const patChars = (dossierIn.patents || []).reduce(
      (n, h) => n + (h.procedureExcerpt?.length || 0),
      0
    );
    touchDensifySchedule(dossierIn.cid, {
      label: dossierIn.identity?.name,
      evidenceScore: dossierIn.evidenceScore?.score,
      procedureCharsHint: litChars + patChars,
      warmed: chrome?.phase === "ready",
    });
  }, [dossierIn, chrome?.phase]);

  const show = (id: Parameters<typeof sectionVisible>[1]) =>
    sectionVisible(workerRole, id);

  const scrollTo = (id: string) => {
    if (!navigateToSection(id)) {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Durable procedure vault hydrate (async IndexedDB)
  useEffect(() => {
    let cancelled = false;
    void hydrateVaultIntoDossier(dossierIn).then((d) => {
      if (!cancelled) setVaultDossier(d);
    });
    return () => {
      cancelled = true;
    };
  }, [dossierIn, enrichTick]);

  const dossier = useMemo(() => {
    void enrichTick;
    const base =
      vaultDossier && vaultDossier.cid === dossierIn.cid
        ? applyLocalFactEnrichment(vaultDossier)
        : applyLocalFactEnrichment(dossierIn);
    // Rebuild process-knowledge only when densify fingerprint changes
    return ensureDossierKnowledge(base);
  }, [dossierIn, enrichTick, vaultDossier]);

  // After paste re-extract, report Ideal score / fact count delta
  useEffect(() => {
    const pending = pendingPasteDelta.current;
    if (!pending) return;
    pendingPasteDelta.current = null;
    const afterIdeal = dossier.idealParity?.score ?? 0;
    const afterFacts =
      dossier.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ??
      0;
    const dIdeal = afterIdeal - pending.ideal;
    const dFacts = afterFacts - pending.facts;
    const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
    setPasteDeltaMsg(
      `Paste densify · ${pending.chars.toLocaleString()} chars → Ideal ${pending.ideal}→${afterIdeal} (${sign(dIdeal)}) · process facts ${pending.facts}→${afterFacts} (${sign(dFacts)}). Not GMP.`
    );
  }, [dossier, enrichTick]);

  const hit = dossier.identity;
  const cid = dossier.cid;
  const name = hit?.name || `CID ${cid}`;
  const traces = slimTraces(dossier.traces);
  const ai = dossier.synthesis;
  /** Full successful parse chip (dossier-level) */
  const aiChip = aiProvenanceWhenParsed(ai);
  /** Any attempt including failed parse (error modal) */
  const aiAttempt = aiAttemptProvenance(ai);
  /** Per-field AI chips — always prefer field-specific so users can disseminate */
  const aiOverview = aiProvenanceForField(ai, "overview");
  const aiApplications = aiProvenanceForField(ai, "applications");
  const aiMfg = aiProvenanceForField(ai, "manufacturingSummary");
  const aiApparatus = aiProvenanceForField(ai, "apparatusCatalog");
  const aiEnv = aiProvenanceForField(ai, "environmentBaseline");
  const aiEhs = aiProvenanceForField(ai, "ehsHighlights");
  const aiRelated = aiProvenanceForField(ai, "relatedEntities");
  const aiUnitOps = aiProvenanceForField(ai, "unitOpFills");
  const aiRoutesField = aiProvenanceForField(ai, "routes");
  const aiCritical = aiProvenanceForField(ai, "criticalParameters");
  const aiDisclaimer = aiProvenanceForField(ai, "disclaimer");
  /** Re-run free APIs + Ollama — exposed on every AI provenance modal */
  const onRegenerate = chrome?.onRefresh;

  const overviewFromAi = Boolean(aiOverview);
  const overview =
    ai.overview || dossier.descriptionTexts[0] || null;

  const mfgFromAi = Boolean(aiMfg);
  const manufacturingSummary =
    ai.manufacturingSummary ||
    (dossier.manufacturingTexts.length
      ? dossier.manufacturingTexts.slice(0, 3).join(" ")
      : null);

  const pubchemMfgHref = `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Use-and-Manufacturing`;

  const mfgTableRows = useMemo(() => buildMfgTableRows(dossier), [dossier]);

  const mfgPanelTexts = useMemo(
    () => mfgTableRows.map((r) => r.text),
    [mfgTableRows]
  );

  const applications = ai.applications ?? [];

  const apparatusCatalog = ai.apparatusCatalog ?? [];
  const apparatusFromAi = Boolean(aiApparatus);

  const environmentBaseline = ai.environmentBaseline;
  const envFromAi = Boolean(aiEnv);

  const ehsFromAi = Boolean(aiEhs);
  const ehs =
    ai.ehsHighlights && ai.ehsHighlights.length > 0
      ? ai.ehsHighlights
      : dossier.hazards.hazardStatements?.slice(0, 8) ?? [];

  const routesFromAi =
    Boolean(aiRoutesField) || processRoutesFromAi(dossier);

  const litTraces = traces.filter(
    (t) =>
      t.endpointUrl.includes("europepmc") || t.endpointUrl.includes("ebi.ac.uk/europepmc")
  );
  const patentTraces = traces.filter(
    (t) =>
      t.endpointUrl.includes("patentsview") ||
      t.endpointUrl.includes("search.patentsview.org") ||
      (t.endpointUrl.includes("europepmc") &&
        /patent|USPTO|process for preparing|method of manufacturing/i.test(
          decodeURIComponent(t.endpointUrl)
        ))
  );
  const pugViewTraces = traces.filter((t) => t.endpointUrl.includes("pug_view"));
  const pubchemTraces = traces.filter((t) => t.endpointUrl.includes("pubchem"));
  const mfgTraces = pugViewTraces.filter((t) =>
    /Use\+and\+Manufacturing|Use%20and%20Manufacturing|manufacturing/i.test(
      t.endpointUrl
    )
  );
  const litRefs = dossier.sourceRefs.filter((r) => r.type === "literature");
  const patentRefsFromDossier = dossier.sourceRefs.filter((r) => r.type === "patent");
  const patentSourceRefs = [
    ...patentRefsFromDossier,
    {
      type: "api" as const,
      id: `patentsview-api:${cid}`,
      label: "PatentsView (USPTO) search API",
      url: "https://search.patentsview.org/api/v1/patent/",
      note: "Free public USPTO PatentsView endpoint (API key optional)",
    },
  ];
  const mfgSourceRefs = [
    {
      type: "api" as const,
      id: `pubchem-mfg-page:${cid}`,
      label: "PubChem · Use and Manufacturing",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Use-and-Manufacturing`,
      note: "NIH free public compound section",
    },
  ];

  const modality = dossier.modality || "small-molecule";
  const modalityMeta = MODALITY_TEMPLATES[modality];
  const paramSet = annotateParametersForDossier(
    getParameterSetForModality(modality),
    {
      hasAiRoutes: routesFromAi,
      evidenceScore: dossier.evidenceScore?.score,
    }
  );
  const hubTwin = findHubByCid(cid);
  const tierAHref =
    hubTwin?.kind === "example" && hubTwin.exampleId
      ? routes.example(hubTwin.exampleId)
      : null;

  // Properties for example-like sidebar (PubChem identity + property texts)
  const plantProps = {
    molecularWeight: hit?.molecularWeight,
    formula: hit?.formula,
    meltingPointC: extractMp(dossier.propertyTexts),
    appearance: extractAppearance(dossier.propertyTexts),
    solubility: extractSolubility(dossier.propertyTexts),
  };

  const liveStatusLabel =
    chrome?.fromCache && chrome.cachedAt
      ? `Cached · ${formatCacheAge(chrome.cachedAt)}`
      : chrome?.phase === "shell"
        ? "Live shell · AI in progress"
        : "Live free-API dossier";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Breadcrumb — live path only (mock catalog lives under Info) */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link href={routes.home()} className="hover:text-teal-400">
          Home
        </Link>
        <span className="mx-1">/</span>
        <Link href={routes.search()} className="hover:text-teal-400">
          Search
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-400">{name}</span>
        <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-200 ring-1 ring-teal-500/30">
          Live dossier
        </span>
      </div>

      <div className="mb-6">
        <RegulatoryDisclaimer compact />
      </div>

      {/* Identity hero — mirrors ExampleDossierView */}
      <div
        id="identity"
        className="scroll-mt-24 flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <div
          id="structure"
          className="scroll-mt-24 flex h-40 w-40 shrink-0 flex-col items-center justify-center rounded-xl bg-white p-3 shadow-lg shadow-black/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pubchemStructureUrl(cid, "large")}
            alt={`2D structure of ${name} (PubChem CID ${cid})`}
            className="max-h-full max-w-full object-contain"
            loading="eager"
            decoding="async"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const fallback = el.nextElementSibling;
              if (fallback instanceof HTMLElement) fallback.hidden = false;
            }}
          />
          <span
            hidden
            className="px-1 text-center text-[10px] font-medium leading-tight text-slate-600"
          >
            Structure image unavailable
            <br />
            <a
              href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`}
              className="text-teal-700 underline"
              target="_blank"
              rel="noreferrer"
            >
              Open PubChem CID {cid}
            </a>
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{name}</h1>
            <TierBadge tier={dossier.tier} />
            <ConfidenceBadge
              level={dossier.evidenceScore?.confidence || ai.confidence}
              score={dossier.evidenceScore?.score}
              reasons={dossier.evidenceScore?.reasons}
            />
            <AiAccuracyBadge
              dossier={dossier}
              grounding={dossier.groundingReport}
            />
            {dossier.idealParity ? (
              <button
                type="button"
                onClick={() => scrollTo("ideal-page-parity")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                  dossier.idealParity.score >= 75
                    ? "bg-emerald-500/15 text-emerald-100 ring-emerald-500/35"
                    : dossier.idealParity.score >= 50
                      ? "bg-amber-500/15 text-amber-50 ring-amber-400/40"
                      : "bg-slate-800 text-slate-400 ring-slate-700"
                }`}
                title="Progress toward curated Tier-A ideal page depth"
              >
                Ideal {dossier.idealParity.score}/100
              </button>
            ) : null}
            <span className="print:hidden inline-flex flex-wrap items-center gap-1.5">
              <TechTransferExport source={{ kind: "live", dossier }} compact />
              <AddToProject
                kind="live-cid"
                refId={String(cid)}
                label={name}
                href={routes.pubchem(cid)}
                cas={hit?.cas}
                modality={modality}
              />
              {chrome?.onRefresh ? (
                <Tooltip content="Clear IndexedDB cache and re-run free APIs + Ollama">
                  <button
                    type="button"
                    onClick={chrome.onRefresh}
                    className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-teal-500/40 hover:text-teal-200"
                  >
                    Refresh live data
                  </button>
                </Tooltip>
              ) : null}
            </span>
          </div>

          {/* Secondary meta pills — not crowding the title */}
          <div className="flex flex-wrap items-center gap-1.5">
            {ai.parsed ? (
              <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-300 ring-1 ring-inset ring-violet-500/30">
                Ollama · {ai.model || "cloud"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-500/15 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 ring-1 ring-inset ring-slate-500/30">
                {dossier.buildMode === "ai-skipped-thin-evidence"
                  ? "Evidence shell · AI skipped"
                  : "Evidence shell"}
              </span>
            )}
            {modalityMeta ? (
              <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-200 ring-1 ring-inset ring-sky-500/25">
                {modalityMeta.label}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-700">
              {liveStatusLabel}
            </span>
            <ApiProvenance
              pubchemCid={cid}
              traces={traces}
              title={name}
              label="API"
              sourceRefs={dossier.sourceRefs}
            />
            {aiAttempt ? (
              <AiProvenance
                provenance={aiAttempt}
                field="Full dossier synthesis call"
                label="AI"
                onRegenerate={onRegenerate}
              />
            ) : null}
          </div>

          {hit?.iupacName ? (
            <p className="text-sm text-slate-400">{hit.iupacName}</p>
          ) : null}

          {/* Identifier row — same shape as curated dossiers */}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-slate-400">
            {hit?.formula ? (
              <div>
                <dt className="inline text-slate-600">Formula </dt>
                <dd className="inline text-slate-300">{hit.formula}</dd>
              </div>
            ) : null}
            {hit?.cas ? (
              <div>
                <dt className="inline text-slate-600">CAS </dt>
                <dd className="inline text-slate-300">{hit.cas}</dd>
              </div>
            ) : null}
            {hit?.molecularWeight != null ? (
              <div>
                <dt className="inline text-slate-600">MW </dt>
                <dd className="inline text-slate-300">{hit.molecularWeight} g/mol</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-slate-600">CID </dt>
              <dd className="inline">
                <a
                  href={`https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`}
                  className="text-teal-400 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {cid}
                </a>
              </dd>
            </div>
            {hit?.inchiKey ? (
              <div className="basis-full">
                <dt className="inline text-slate-600">InChIKey </dt>
                <dd className="inline break-all text-slate-300">{hit.inchiKey}</dd>
              </div>
            ) : null}
          </dl>

          {/* Overview as clean prose — like example dossiers */}
          <div id="overview" className="scroll-mt-24 max-w-3xl">
            {overview ? (
              <>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Overview
                  </span>
                  <ContentProvenance
                    title="Overview"
                    field="Overview"
                    pubchemCid={cid}
                    traces={pubchemTraces}
                    sourceRefs={dossier.sourceRefs}
                    ai={aiOverview}
                    showAi={Boolean(aiOverview)}
                    onRegenerate={onRegenerate}
                  />
                  {!overviewFromAi ? (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-500">
                      free-public text
                    </span>
                  ) : null}
                </div>
                <p className="leading-relaxed text-slate-300">{overview}</p>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-slate-500">
                Overview appears when PubChem description or Ollama synthesis is available.
                Process steps below use public literature, patents, and manufacturing text.
              </p>
            )}
          </div>

          {applications.length > 0 ? (
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Applications
                </span>
                <ContentProvenance
                  title="Applications"
                  field="Applications"
                  pubchemCid={cid}
                  traces={traces}
                  sourceRefs={dossier.sourceRefs}
                  ai={aiApplications}
                  showAi={Boolean(aiApplications)}
                  onRegenerate={onRegenerate}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {applications.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {tierAHref ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              <strong className="font-medium">Optional teaching baseline</strong>
              {" — "}
              a curated dual-view scaffold for{" "}
              <Link href={tierAHref} className="font-medium text-amber-200 hover:underline">
                {hubTwin?.name || name}
              </Link>{" "}
              (under{" "}
              <Link href={routes.info()} className="font-medium text-amber-200 hover:underline">
                Info
              </Link>
              ) is merged below as labeled education-only routes, next to live multi-API
              facts. Pure mock layout stays on the Info example page — not a search hit.
            </p>
          ) : null}

          <p className="rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2 text-xs text-teal-100/90">
            <strong className="font-medium">Live free-public build</strong>
            {" — "}
            plant sections below mirror curated example dossiers: recipe, control points,
            manufacturing summary, apparatus, environment, EHS, and properties when public
            evidence supports them
            {routesFromAi ? " (plus Ollama dual-view)" : " (evidence shell / fact-derived)"}
            . Not a GMP procedure.
          </p>

          {ai.rawError && !ai.parsed ? (
            <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
              <span>
                AI enhance incomplete: {ai.rawError}. Showing free-API evidence scaffold.
              </span>
              {aiAttempt ? (
                <AiProvenance
                  provenance={aiAttempt}
                  field="Failed AI attempt"
                  label="AI"
                  onRegenerate={onRegenerate}
                />
              ) : null}
            </p>
          ) : null}

          {chrome?.snapshots ? (
            <div className="print:hidden pt-1">{chrome.snapshots}</div>
          ) : null}
        </div>
      </div>

      {/* Main + sidebar — role-aware layout for actual workers */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <WorkerRoleBar onChange={setWorkerRole} />

          <ThinToUsefulBanner
            dossier={dossier}
            onScroll={scrollTo}
            onRegenerate={onRegenerate}
          />

          {show("readiness") ||
          show("framing") ||
          workerRole === "chemist" ||
          workerRole === "msat" ||
          workerRole === "manager" ? (
            <IdealPageParityPanel
              dossier={dossier}
              onScroll={scrollTo}
              onRegenerate={onRegenerate}
            />
          ) : null}

          {/* Frontier science engine — condition space, hypotheses, Q&A */}
          {workerRole === "chemist" ||
          workerRole === "msat" ||
          workerRole === "manager" ? (
            <div id="frontier-science" className="scroll-mt-24 space-y-4">
              <ConditionAtlasPanel
                dossier={dossier}
                onRegenerate={onRegenerate}
              />
              <RouteHypothesesPanel
                dossier={dossier}
                onRegenerate={onRegenerate}
              />
              <ReactionNetworkPanel
                dossier={dossier}
                onRegenerate={onRegenerate}
              />
              <EvidenceSciencePanel
                dossier={dossier}
                onForceRegather={onRegenerate}
              />
              <ScienceAgentPanel
                dossier={dossier}
                onForceRegather={onRegenerate}
              />
              <BatchDensifyPanel
                seedCids={
                  dossier.processKnowledge?.reactionNetwork?.campaignCids || [
                    dossier.cid,
                  ]
                }
                dossier={dossier}
                onRegenerate={onRegenerate}
              />
            </div>
          ) : null}

          {show("monday-pack") ? (
            <MondayMorningPack
              dossier={dossier}
              onPrint={() => window.print()}
              onScrollEnrich={() => scrollTo("local-text-enrich")}
              onScrollAid={() => scrollTo("operator-job-aid")}
              onScrollGaps={() => scrollTo("site-fill")}
              onRegenerate={onRegenerate}
            />
          ) : null}

          {show("work-pack") || workerRole === "operator" ? (
            <ShiftPackPanel dossier={dossier} onRegenerate={onRegenerate} />
          ) : null}

          {show("framing") ? (
            <ProcessFramingBanner
              dossier={dossier}
              onRegenerate={onRegenerate}
            />
          ) : null}
          {show("readiness") ? (
            <RecipeReadinessPanel dossier={dossier} onRegenerate={onRegenerate} />
          ) : null}

          {show("critical-params") ? (
            <CriticalParametersBoard
              routes={dossier.processRoutes}
              pubchemCid={cid}
              traces={traces}
              onRegenerate={onRegenerate}
              ai={aiCritical || (routesFromAi ? aiChip : null)}
            />
          ) : null}

          {show("parameters") ? (
            <section id="process-parameters" className="scroll-mt-24">
              <SectionTitle
                field="Educational parameters"
                pubchemCid={cid}
                traces={pubchemTraces}
                sourceRefs={dossier.sourceRefs}
                ai={aiChip}
                showAi={false}
                onRegenerate={onRegenerate}
              >
                Educational parameters
              </SectionTitle>
              <p className="mb-3 text-xs text-slate-500">
                {paramSet.parameters.length} {modalityMeta?.label || modality} teaching
                envelopes — literature-typical only, not site CQAs.
              </p>
              <BiologicParametersPanel
                parameterSet={paramSet}
                title={`${modalityMeta?.label || modality} parameters`}
                dossier={dossier}
                onRegenerate={onRegenerate}
              />
            </section>
          ) : null}

          {show("routes") ? (
            <section
              id="routes"
              className="scroll-mt-24"
              data-toc-empty={
                (dossier.processRoutes?.length ?? 0) > 0 ? "0" : "1"
              }
            >
              <SectionTitle
                ai={routesFromAi ? aiRoutesField || aiChip : undefined}
                field="Process recipe"
                pubchemCid={cid}
                traces={traces}
                sourceRefs={dossier.sourceRefs}
                onRegenerate={onRegenerate}
              >
                Process recipe
              </SectionTitle>
              <p className="mb-4 text-xs leading-relaxed text-slate-500">
                Ingredients, method steps, dual plant / chemistry view — same structure as
                curated examples. Numbers only when public facts support them
                {routesFromAi
                  ? " (Ollama structures evidence; uncited values stripped — open AI chip for prompts/data)."
                  : " (evidence / fact-derived leads — not Ollama dual-view)."}{" "}
                Not a GMP batch record.
                {dossier.processFraming === "evidence-lead-pack" ? (
                  <span className="text-amber-200/80">
                    {" "}
                    Framed as evidence-lead pack until process-fact density rises.
                  </span>
                ) : null}
              </p>
              <RoutePanel
                routes={dossier.processRoutes}
                aiProvenance={
                  routesFromAi ? aiRoutesField || aiChip : null
                }
                processFacts={dossier.processFacts?.facts}
                onRegenerate={onRegenerate}
                pubchemCid={cid}
                traces={traces}
              />
              {routesFromAi ? (
                <FieldRegenerateBar
                  field="Process routes"
                  onRegenerate={onRegenerate}
                  denseNote="re-structures dual-view from current evidence package"
                />
              ) : null}
            </section>
          ) : null}

          {show("route-compare") ? (
            <section
              id="route-compare"
              className="scroll-mt-24"
              data-toc-empty={
                (dossier.processRoutes?.length ?? 0) > 1 ? "0" : "1"
              }
            >
              <SectionTitle
                field="Route compare"
                pubchemCid={cid}
                traces={traces}
                sourceRefs={dossier.sourceRefs}
                ai={routesFromAi ? aiRoutesField || aiChip : undefined}
                showAi={routesFromAi}
                onRegenerate={onRegenerate}
              >
                Route compare
              </SectionTitle>
              <RouteCompare routes={dossier.processRoutes} />
            </section>
          ) : null}

          {show("related") &&
          dossier.relatedEntities &&
          dossier.relatedEntities.length > 0 ? (
            <section id="related-entities" className="scroll-mt-24">
              <SectionTitle
                ai={aiRelated || undefined}
                field="Related materials"
                pubchemCid={cid}
                traces={traces}
                sourceRefs={dossier.sourceRefs}
                onRegenerate={onRegenerate}
              >
                Related entities
              </SectionTitle>
              <EntityGraph
                centerName={name}
                centerCid={cid}
                entities={dossier.relatedEntities}
              />
              <ul className="mt-3 space-y-2">
                {dossier.relatedEntities.map((rel, i) => {
                  const href =
                    rel.href ||
                    (rel.pubchemCid
                      ? routes.pubchem(rel.pubchemCid)
                      : rel.cas
                        ? routes.search(rel.cas)
                        : null);
                  return (
                    <li
                      key={`${rel.name}-${i}`}
                      className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
                    >
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                        {rel.role}
                      </span>{" "}
                      {href ? (
                        <Link
                          href={href}
                          className="font-medium text-teal-300 hover:underline"
                        >
                          {rel.name}
                        </Link>
                      ) : (
                        <span className="text-slate-200">{rel.name}</span>
                      )}
                      {rel.cas ? (
                        <span className="ml-2 font-mono text-xs text-slate-500">
                          {rel.cas}
                        </span>
                      ) : null}
                      {rel.notes ? (
                        <p className="mt-1 text-xs text-slate-500">{rel.notes}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {show("unit-ops") &&
          dossier.unitOpFills &&
          dossier.unitOpFills.length > 0 ? (
            <section id="unit-op-fill" className="scroll-mt-24">
              <SectionTitle
                field="Modality unit ops"
                ai={aiUnitOps || undefined}
                pubchemCid={cid}
                traces={traces}
                onRegenerate={onRegenerate}
              >
                Modality unit ops
              </SectionTitle>
              <UnitOpFillPanel
                fills={dossier.unitOpFills}
                modalityLabel={modalityMeta?.label}
                dossier={dossier}
                onRegenerate={onRegenerate}
              />
            </section>
          ) : null}

          {/* Worker tools: briefs, enrich, site-fill — open by default when relevant */}
          <CollapsibleSection
            id="industry-briefs"
            title="Worker tools · briefs, enrich, site fill"
            summary="Job aid, manager brief, local paste, site blanks, checklist"
            badge="work"
            defaultOpen
            forceOpenWhen={
              workerRole === "operator" ||
              workerRole === "msat" ||
              workerRole === "manager" ||
              (dossier.processFacts?.facts?.length ?? 0) > 0
            }
          >
            <div className="space-y-6">
              {show("score-coverage") ? (
                <>
                  <EvidenceScoreExplainer
                    dossier={dossier}
                    onRegenerate={onRegenerate}
                  />
                  <SourceCoverageMap
                    dossier={dossier}
                    onRegenerate={onRegenerate}
                  />
                </>
              ) : null}
              {show("manager-brief") ? (
                <ManagerBriefPanel
                  dossier={dossier}
                  onRegenerate={onRegenerate}
                />
              ) : null}
              {show("operator-aid") ? (
                <OperatorJobAid
                  dossier={dossier}
                  onRegenerate={onRegenerate}
                />
              ) : null}
              {show("process-facts") ? (
                <ProcessFactsPanel
                  dossier={dossier}
                  onRegenerate={onRegenerate}
                />
              ) : null}
              {show("process-facts") ? (
                <ProblemUnitOpSearch
                  dossier={dossier}
                  onRegenerate={onRegenerate}
                />
              ) : null}
              {show("score-coverage") || workerRole === "chemist" || workerRole === "msat" ? (
                <EvidenceCritiquePanel
                  dossier={dossier}
                  onRegenerate={onRegenerate}
                  onScroll={scrollTo}
                  grounding={dossier.groundingReport}
                />
              ) : null}
              {workerRole !== "operator" ? (
                <WorkerPlaybookPanel
                  dossier={dossier}
                  onScroll={scrollTo}
                  onRegenerate={onRegenerate}
                />
              ) : null}
              <PdfWorkerPack dossier={dossier} onRegenerate={onRegenerate} />
              {show("local-enrich") ? (
                <>
                  <LocalTextEnrich
                    cid={cid}
                    moleculeLabel={name}
                    idealScoreBefore={dossier.idealParity?.score}
                    processFactCountBefore={
                      dossier.processFacts?.facts?.filter(
                        (f) => f.kind !== "open-gap"
                      ).length
                    }
                    emphasize={
                      dossier.productMode === "scout-dossier" ||
                      dossier.processFraming === "evidence-lead-pack"
                    }
                    onSaved={(info) => {
                      if (info) {
                        pendingPasteDelta.current = {
                          ideal: info.idealScoreBefore ?? 0,
                          facts: info.processFactCountBefore ?? 0,
                          chars: info.chars,
                        };
                      } else {
                        pendingPasteDelta.current = null;
                        setPasteDeltaMsg(null);
                      }
                      setEnrichTick((n) => n + 1);
                    }}
                  />
                  {pasteDeltaMsg ? (
                    <p
                      className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-[11px] text-teal-100/90"
                      role="status"
                    >
                      {pasteDeltaMsg}{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => scrollTo("ideal-page-parity")}
                      >
                        Ideal gaps
                      </button>
                      {" · "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => scrollTo("condition-atlas")}
                      >
                        Condition atlas
                      </button>
                    </p>
                  ) : null}
                </>
              ) : null}
              {workerRole !== "operator" ? (
                <>
                  <OrdBulkPanel
                    name={name}
                    smiles={hit?.smiles}
                    cid={cid}
                  />
                  <DensifySchedulePanel />
                </>
              ) : null}
              {show("site-fill") ? (
                <>
                  <SiteFillPanel cid={cid} name={name} modality={modality} />
                  <SiteGapsExport dossier={dossier} />
                </>
              ) : null}
              {show("checklist") ? (
                <ValidationChecklist
                  dossier={dossier}
                  onRegenerate={onRegenerate}
                />
              ) : null}
              {show("work-pack") ? (
                <WorkPackPanel cid={cid} label={name} />
              ) : null}
            </div>
          </CollapsibleSection>

          {show("multi-source") ? (
          <CollapsibleSection
            id="multi-source"
            title="Multi-source free APIs"
            summary={
              (dossier.annotations?.length ?? 0) > 0
                ? `${dossier.annotations.length} annotations beyond PubChem identity`
                : "No extra annotations in this capture"
            }
            badge={String(dossier.annotations?.length ?? 0)}
            defaultOpen={(dossier.annotations?.length ?? 0) > 0}
            forceOpenWhen={(dossier.annotations?.length ?? 0) > 0}
            hasContent={(dossier.annotations?.length ?? 0) > 0}
          >
            <div className="mb-3">
              <ApiProvenance
                pubchemCid={cid}
                traces={traces}
                sourceRefs={dossier.sourceRefs}
                title="Multi-source free APIs"
                label="API"
              />
            </div>
            {(dossier.annotations?.length ?? 0) > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {dossier.annotations.map((a, i) => (
                  <li
                    key={`${a.source}-${i}`}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-200 ring-1 ring-sky-500/25">
                        {a.source}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                        {a.kind}
                      </span>
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-teal-500/80 hover:underline"
                        >
                          source
                        </a>
                      ) : null}
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-slate-100">
                      {a.url ? (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-300 hover:underline"
                        >
                          {a.title}
                        </a>
                      ) : (
                        a.title
                      )}
                    </div>
                    {a.summary ? (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-500">
                        {a.summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No ChEMBL / openFDA / MyChem / related annotations were returned for this
                capture. Identity still comes from PubChem CID {cid}.
              </p>
            )}
          </CollapsibleSection>
          ) : null}

          {show("lit-patents-mfg") &&
          dossier.contradictions &&
          dossier.contradictions.length > 0 ? (
            <CollapsibleSection
              id="contradictions"
              title="Evidence tensions"
              summary="Public sources disagree — review both sides"
              badge={String(dossier.contradictions.length)}
              defaultOpen
              forceOpenWhen
            >
              <EvidenceContradictions items={dossier.contradictions} />
            </CollapsibleSection>
          ) : null}

          {show("lit-patents-mfg") ? (
          <>
          <CollapsibleSection
            id="pubchem-manufacturing"
            title="Public manufacturing & use text"
            summary={
              mfgTableRows.length
                ? `${mfgTableRows.length} rows · sort / filter / search`
                : "Awaiting PubChem / process-fact excerpts"
            }
            badge="API"
            defaultOpen={mfgTableRows.length > 0}
            forceOpenWhen={mfgTableRows.length > 0}
            hasContent={mfgTableRows.length > 0}
          >
            <div className="mb-3">
              <ApiProvenance
                pubchemCid={cid}
                traces={
                  mfgTraces.length
                    ? mfgTraces
                    : pugViewTraces.length
                      ? pugViewTraces
                      : pubchemTraces
                }
                sourceRefs={mfgSourceRefs}
                title="Use & manufacturing"
                label="API"
              />
            </div>
            <ManufacturingTextTable
              rows={mfgTableRows}
              emptyHref={pubchemMfgHref}
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="literature"
            title="Literature"
            summary={
              dossier.literature.length
                ? `${dossier.literature.length} hits · sort / filter / search`
                : "No hits"
            }
            badge="API"
            defaultOpen={dossier.literature.length > 0}
            forceOpenWhen={dossier.literature.length > 0}
            hasContent={dossier.literature.length > 0}
          >
            <div className="mb-3">
              <ApiProvenance
                traces={litTraces.length ? litTraces : traces}
                sourceRefs={litRefs}
                title="Europe PMC literature"
                label="API"
              />
            </div>
            <LiteratureTable
              hits={dossier.literature}
              cid={cid}
              onPasteAttached={(info) => {
                setPasteDeltaMsg(
                  `Literature densify paste · ${info.attached} paper(s) · ${info.chars.toLocaleString()} chars · re-extracting local facts… Not GMP.`
                );
                setEnrichTick((n) => n + 1);
              }}
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="patents"
            title="Patents & process IP"
            summary={
              dossier.patents.length
                ? `${dossier.patents.length} hits · sort / filter / search`
                : "No hits"
            }
            badge="API"
            defaultOpen={dossier.patents.length > 0}
            forceOpenWhen={dossier.patents.length > 0}
            hasContent={dossier.patents.length > 0}
          >
            <div className="mb-3">
              <ApiProvenance
                pubchemCid={cid}
                traces={
                  patentTraces.length
                    ? patentTraces
                    : litTraces.length
                      ? litTraces
                      : traces
                }
                sourceRefs={patentSourceRefs}
                title="Patents & process IP"
                label="API"
              />
            </div>
            <PatentsTable
              hits={dossier.patents}
              cid={cid}
              onPasteAttached={(info) => {
                setPasteDeltaMsg(
                  `Patent densify paste · ${info.attached} document(s) · ${info.chars.toLocaleString()} chars · re-extracting local facts… Not GMP.`
                );
                setEnrichTick((n) => n + 1);
              }}
            />
          </CollapsibleSection>
          </>
          ) : null}
        </div>

        {show("aside-full") ? (
          <LiveDossierAside
            dossier={dossier}
            name={name}
            cid={cid}
            manufacturingSummary={manufacturingSummary}
            mfgPanelLead={mfgPanelTexts[0]}
            mfgFromAi={mfgFromAi}
            environmentBaseline={environmentBaseline}
            envFromAi={envFromAi}
            apparatusCatalog={apparatusCatalog}
            apparatusFromAi={apparatusFromAi}
            ehs={ehs}
            ehsFromAi={ehsFromAi}
            plantProps={plantProps}
            aiChip={aiChip}
            aiMfg={aiMfg}
            aiEnv={aiEnv}
            aiApparatus={aiApparatus}
            aiEhs={aiEhs}
            aiAttempt={aiAttempt}
            pugViewTraces={pugViewTraces}
            pubchemTraces={pubchemTraces}
            allTraces={traces}
            onRegenerate={onRegenerate}
          />
        ) : (
          <aside className="space-y-4 print:hidden">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-teal-300">EHS highlights</h3>
                <ContentProvenance
                  title="EHS highlights"
                  field="EHS highlights"
                  pubchemCid={cid}
                  traces={pubchemTraces}
                  sourceRefs={dossier.hazards.sourceRefs}
                  ai={aiEhs}
                  showAi={Boolean(aiEhs)}
                  onRegenerate={onRegenerate}
                />
              </div>
              {ehs.length ? (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300">
                  {ehs.slice(0, 8).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-600">
                  No EHS highlights — check PubChem Safety before plant use.
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      <div className="mt-10 print:hidden">
        <DossierDiagnostics dossier={dossier} />
      </div>

      {dossier.buildAudit ? (
        <div
          id="build-audit"
          className="mt-6 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <h2 className="text-sm font-semibold text-slate-300">Build audit</h2>
          <p className="mt-1 text-xs text-slate-500">
            Reproducibility trail for QA review (not a GMP batch signature).
          </p>
          <dl className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-slate-600">Duration</dt>
              <dd className="text-slate-300">
                {dossier.buildAudit.durationMs != null
                  ? `${Math.round(dossier.buildAudit.durationMs / 1000)}s`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">Mode</dt>
              <dd className="text-slate-300">{dossier.buildAudit.buildMode || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Model</dt>
              <dd className="font-mono text-slate-300">
                {dossier.buildAudit.model || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">Evidence score</dt>
              <dd className="text-slate-300">
                {dossier.buildAudit.evidenceScore ?? "—"} ·{" "}
                {dossier.buildAudit.literatureCount ?? 0} lit ·{" "}
                {dossier.buildAudit.patentCount ?? 0} patents
              </dd>
            </div>
            {dossier.buildAudit.densifyQuality ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <dt className="text-slate-600">Densify quality</dt>
                <dd className="text-slate-300">
                  {dossier.buildAudit.densifyQuality.procedureExcerptCount} excerpts · ~
                  {dossier.buildAudit.densifyQuality.procedureChars.toLocaleString()} chars ·{" "}
                  {dossier.buildAudit.densifyQuality.oaLitWindows} OA lit ·{" "}
                  {dossier.buildAudit.densifyQuality.patentWindows} patent windows ·{" "}
                  {dossier.buildAudit.densifyQuality.processFactConditions} conditions ·{" "}
                  {dossier.buildAudit.densifyQuality.unitOpFacts} unit ops
                  {dossier.buildAudit.densifyQuality.conditionObservations != null
                    ? ` · atlas ${dossier.buildAudit.densifyQuality.conditionObservations} obs`
                    : ""}
                  {dossier.buildAudit.densifyQuality.knowledgeHypotheses != null
                    ? ` · ${dossier.buildAudit.densifyQuality.knowledgeHypotheses} hypotheses`
                    : ""}
                  {dossier.buildAudit.densifyQuality.literatureDepthScore !=
                  null
                    ? ` · lit depth ${dossier.buildAudit.densifyQuality.literatureDepthScore}/100`
                    : ""}
                  {dossier.buildAudit.densifyQuality.procedureRichWindows !=
                  null
                    ? ` · ${dossier.buildAudit.densifyQuality.procedureRichWindows} rich windows`
                    : ""}
                  {dossier.groundingReport
                    ? ` · grounding: ${dossier.groundingReport.summary}`
                    : ""}
                </dd>
                {dossier.buildAudit.densifyQuality.softFailHints?.length ? (
                  <ul className="mt-1 list-inside list-disc text-[11px] text-slate-600">
                    {dossier.buildAudit.densifyQuality.softFailHints.slice(0, 4).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div
        id="disclaimer"
        className="mt-10 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Disclaimer</h2>
          {ai.parsed && ai.disclaimer && (aiDisclaimer || aiChip) ? (
            <AiProvenance
              provenance={aiDisclaimer || aiChip!}
              field="Disclaimer"
              label="AI"
              onRegenerate={onRegenerate}
            />
          ) : null}
        </div>
        <RegulatoryDisclaimer className="mt-2" />
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{dossier.disclaimer}</p>
        <p className="mt-2 text-[11px] text-slate-700">
          Generated {new Date(dossier.generatedAt).toLocaleString()} · Tier {dossier.tier} ·
          live APIs
          {ai.parsed ? " + Ollama" : " · evidence scaffold"}
          {aiChip ? ` · AI ${aiChip.model} in ${aiChip.responseTimeMs} ms` : ""}
          {dossier.modality ? ` · ${dossier.modality}` : ""}
        </p>
        <div className="mt-4">
          <Link href={routes.search()} className="text-sm text-teal-400 hover:underline">
            ← Back to search
          </Link>
          <span className="mx-2 text-slate-700">·</span>
          <Link
            href={routes.info()}
            className="text-sm text-amber-300/80 hover:text-amber-200"
          >
            Info · demos &amp; mock packages
          </Link>
        </div>
      </div>
    </div>
  );
}
