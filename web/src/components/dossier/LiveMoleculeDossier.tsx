/**
 * Live PubChem dossier — plant-ready layout aligned with curated ExampleDossierView.
 * Content from free APIs + optional Ollama; AI blocks keep provenance chips.
 */

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AiProvenance } from "@/components/AiProvenance";
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
import { DossierDiagnostics } from "@/components/DossierDiagnostics";
import { SourceCoverageMap } from "@/components/SourceCoverageMap";
import { EvidenceScoreExplainer } from "@/components/EvidenceScoreExplainer";
import { ValidationChecklist } from "@/components/ValidationChecklist";
import { ProcessFactsPanel } from "@/components/ProcessFactsPanel";
import { ManagerBriefPanel } from "@/components/ManagerBriefPanel";
import { OperatorJobAid } from "@/components/OperatorJobAid";
import { LocalTextEnrich } from "@/components/LocalTextEnrich";
import { ProcessFramingBanner } from "@/components/ProcessFramingBanner";
import { ManufacturingTextTable } from "@/components/ManufacturingTextTable";
import { LiteratureTable } from "@/components/LiteratureTable";
import { PatentsTable } from "@/components/PatentsTable";
import { applyLocalFactEnrichment } from "@/lib/dossier/enrichClientFacts";
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
  const dossier = useMemo(() => {
    void enrichTick;
    return applyLocalFactEnrichment(dossierIn);
  }, [dossierIn, enrichTick]);

  const hit = dossier.identity;
  const cid = dossier.cid;
  const name = hit?.name || `CID ${cid}`;
  const traces = slimTraces(dossier.traces);
  const ai = dossier.synthesis;
  const prov = ai.provenance;
  const aiChip = ai.parsed && prov ? prov : null;
  const aiAttempt = prov ?? null;

  const overviewFromAi = Boolean(ai.parsed && ai.overview);
  const overview =
    ai.overview || dossier.descriptionTexts[0] || null;

  const mfgFromAi = Boolean(ai.parsed && ai.manufacturingSummary);
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
  const appsFromAi = Boolean(ai.parsed && applications.length > 0);

  const apparatusCatalog = ai.apparatusCatalog ?? [];
  const apparatusFromAi = Boolean(
    ai.parsed && ai.provenance?.fieldsGenerated?.includes("apparatusCatalog")
  );

  const environmentBaseline = ai.environmentBaseline;
  const envFromAi = Boolean(
    ai.parsed && ai.provenance?.fieldsGenerated?.includes("environmentBaseline")
  );

  const ehsFromAi = Boolean(ai.parsed && ai.ehsHighlights && ai.ehsHighlights.length > 0);
  const ehs =
    ai.ehsHighlights && ai.ehsHighlights.length > 0
      ? ai.ehsHighlights
      : dossier.hazards.hazardStatements?.slice(0, 8) ?? [];

  const routesFromAi = Boolean(ai.parsed && ai.routes && ai.routes.length > 0);

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
              <p className="leading-relaxed text-slate-300">
                {overviewFromAi && aiChip ? (
                  <span className="mr-2 inline-flex align-middle">
                    <AiProvenance provenance={aiChip} field="Overview" label="AI" />
                  </span>
                ) : null}
                {overview}
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-slate-500">
                Overview appears when PubChem description or Ollama synthesis is available.
                Process steps below use public literature, patents, and manufacturing text.
              </p>
            )}
          </div>

          {applications.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {appsFromAi && aiChip ? (
                <AiProvenance provenance={aiChip} field="Applications" label="AI" />
              ) : null}
              {applications.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400"
                >
                  {a}
                </span>
              ))}
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
                <AiProvenance provenance={aiAttempt} field="Failed AI attempt" label="AI" />
              ) : null}
            </p>
          ) : null}

          {chrome?.snapshots ? (
            <div className="print:hidden pt-1">{chrome.snapshots}</div>
          ) : null}
        </div>
      </div>

      {/* Main + sidebar — same information architecture as curated ExampleDossierView */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <ProcessFramingBanner dossier={dossier} />

          {/* Primary plant content (match mock/example order) */}
          <CriticalParametersBoard routes={dossier.processRoutes} />

          <section id="process-parameters" className="scroll-mt-24">
            <SectionTitle>Educational parameters</SectionTitle>
            <p className="mb-3 text-xs text-slate-500">
              {paramSet.parameters.length} {modalityMeta?.label || modality} teaching
              envelopes — literature-typical only, not site CQAs.
            </p>
            <BiologicParametersPanel
              parameterSet={paramSet}
              title={`${modalityMeta?.label || modality} parameters`}
            />
          </section>

          <section id="routes" className="scroll-mt-24">
            <SectionTitle
              ai={routesFromAi && aiChip ? aiChip : undefined}
              field="Process recipe"
            >
              Process recipe
            </SectionTitle>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              Ingredients, method steps, dual plant / chemistry view — same structure as
              curated examples. Numbers only when public facts support them
              {routesFromAi
                ? " (Ollama structures evidence; uncited values stripped)."
                : " (evidence / fact-derived leads)."}{" "}
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
              aiProvenance={routesFromAi ? aiChip : null}
              processFacts={dossier.processFacts?.facts}
            />
          </section>

          <section id="route-compare" className="scroll-mt-24">
            <SectionTitle>Route compare</SectionTitle>
            <RouteCompare routes={dossier.processRoutes} />
          </section>

          {dossier.relatedEntities && dossier.relatedEntities.length > 0 ? (
            <section id="related-entities" className="scroll-mt-24">
              <SectionTitle
                ai={
                  aiChip &&
                  ai.provenance?.fieldsGenerated?.includes("relatedEntities")
                    ? aiChip
                    : undefined
                }
                field="Related materials"
              >
                Related entities
              </SectionTitle>
              <EntityGraph centerName={name} entities={dossier.relatedEntities} />
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

          {dossier.unitOpFills && dossier.unitOpFills.length > 0 ? (
            <section id="unit-op-fill" className="scroll-mt-24">
              <SectionTitle>Modality unit ops</SectionTitle>
              <UnitOpFillPanel
                fills={dossier.unitOpFills}
                modalityLabel={modalityMeta?.label}
              />
            </section>
          ) : null}

          {/* Secondary: trust / industry tooling — open when process evidence exists */}
          <CollapsibleSection
            id="industry-briefs"
            title="Industry briefs & accuracy tools"
            summary="Manager brief, operator job aid, process facts, local enrich"
            badge="extra"
            defaultOpen
            forceOpenWhen={(dossier.processFacts?.facts?.length ?? 0) > 0}
          >
            <div className="space-y-6">
              <EvidenceScoreExplainer dossier={dossier} />
              <SourceCoverageMap dossier={dossier} />
              <ManagerBriefPanel dossier={dossier} />
              <OperatorJobAid dossier={dossier} />
              <ProcessFactsPanel dossier={dossier} />
              <LocalTextEnrich
                cid={cid}
                onSaved={() => setEnrichTick((n) => n + 1)}
              />
              <ValidationChecklist dossier={dossier} />
            </div>
          </CollapsibleSection>

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
          >
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

          {dossier.contradictions && dossier.contradictions.length > 0 ? (
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
          >
            <div className="mb-3">
              <ApiProvenance
                traces={litTraces.length ? litTraces : traces}
                sourceRefs={litRefs}
                title="Europe PMC literature"
                label="API"
              />
            </div>
            <LiteratureTable hits={dossier.literature} />
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
            <PatentsTable hits={dossier.patents} />
          </CollapsibleSection>
        </div>

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
          aiAttempt={aiAttempt}
          pugViewTraces={pugViewTraces}
          pubchemTraces={pubchemTraces}
          allTraces={traces}
        />
      </div>

      <div className="mt-10">
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
          </dl>
        </div>
      ) : null}

      <div
        id="disclaimer"
        className="mt-10 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Disclaimer</h2>
          {ai.parsed && ai.disclaimer && aiChip ? (
            <AiProvenance provenance={aiChip} field="Disclaimer" label="AI" />
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
