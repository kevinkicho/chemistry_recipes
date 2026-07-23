/**
 * Curated dossier layout (original Chemistry Recipes molecule page).
 * Content only from live APIs + optional Ollama — no static seed molecules.
 * Every AI-generated block carries an opacity-0.3 AI provenance chip.
 */

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

function SectionTitle({
  children,
  ai,
  field,
}: {
  children: React.ReactNode;
  ai?: LiveDossier["synthesis"]["provenance"];
  field?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-semibold text-slate-100">{children}</h2>
      {ai ? <AiProvenance provenance={ai} field={field} label="AI" /> : null}
    </div>
  );
}

function SideTitle({
  children,
  ai,
  field,
  className = "text-sm font-semibold text-teal-300",
}: {
  children: React.ReactNode;
  ai?: LiveDossier["synthesis"]["provenance"];
  field?: string;
  className?: string;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <h3 className={className}>{children}</h3>
      {ai ? <AiProvenance provenance={ai} field={field} label="AI" /> : null}
    </div>
  );
}

export function LiveMoleculeDossier({ dossier }: { dossier: LiveDossier }) {
  const hit = dossier.identity;
  const cid = dossier.cid;
  const name = hit?.name || `CID ${cid}`;
  const traces = slimTraces(dossier.traces);
  const ai = dossier.synthesis;
  const prov = ai.provenance;
  /** Only chip content that actually came from a successful AI parse */
  const aiChip = ai.parsed && prov ? prov : null;
  /** Failed AI call still shows provenance on a banner if we have a record */
  const aiAttempt = prov ?? null;

  const overviewFromAi = Boolean(ai.parsed && ai.overview);
  const overview =
    ai.overview ||
    dossier.descriptionTexts[0] ||
    null;

  const mfgFromAi = Boolean(ai.parsed && ai.manufacturingSummary);
  const manufacturingSummary =
    ai.manufacturingSummary ||
    (dossier.manufacturingTexts.length
      ? dossier.manufacturingTexts.slice(0, 3).join(" ")
      : null);

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
  /** Prefer PUG View “Use and Manufacturing” captures for that section’s API chip */
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
    {
      type: "api" as const,
      id: `epmc-patent-lit:${cid}`,
      label: "Europe PMC patent-adjacent literature",
      url: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      note: "Free public process/IP literature search (EMBL-EBI)",
    },
    {
      type: "api" as const,
      id: `patentsview-docs:${cid}`,
      label: "PatentsView API docs",
      url: "https://patentsview.org/apis/api-query-language",
      note: "Documentation for free public patent queries",
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
    {
      type: "api" as const,
      id: `pubchem-mfg-api:${cid}`,
      label: "PUG View API · Use and Manufacturing",
      url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Use+and+Manufacturing`,
      note: "Free public API endpoint used for manufacturing text",
    },
  ];

  const modality = dossier.modality || "small-molecule";
  const modalityMeta = MODALITY_TEMPLATES[modality];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-4 text-sm text-slate-500">
        <Link href={routes.search()} className="hover:text-teal-400">
          Search
        </Link>
        <span className="mx-2">/</span>
        <Link href={routes.catalog()} className="hover:text-teal-400">
          Catalog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-400">{name}</span>
      </div>
      <div className="mb-6 print:block">
        <RegulatoryDisclaimer compact />
      </div>

      <div
        id="identity"
        className="scroll-mt-24 flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <div
          id="structure"
          className="scroll-mt-24 flex h-40 w-40 shrink-0 items-center justify-center rounded-xl bg-white p-3 shadow-lg shadow-black/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pubchemStructureUrl(cid, "large")}
            alt={`Structure of ${name}`}
            className="max-h-full max-w-full object-contain"
          />
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
            {ai.parsed ? (
              <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-medium text-violet-300 ring-1 ring-inset ring-violet-500/30">
                Ollama · {ai.model || "cloud"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-500/15 px-2.5 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/30">
                {dossier.buildMode === "ai-skipped-thin-evidence"
                  ? "Evidence shell · AI skipped"
                  : "Evidence shell"}
              </span>
            )}
            {dossier.modality ? (
              <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-200 ring-1 ring-inset ring-sky-500/25">
                {modalityMeta?.label || dossier.modality}
              </span>
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
            </span>
            <ApiProvenance
              pubchemCid={cid}
              traces={traces}
              title={name}
              label="API"
              sourceRefs={dossier.sourceRefs}
            />
            {/* AI provenance chip (opacity 0.3) — full call: prompt, data fed, sources, model, timing */}
            {aiAttempt ? (
              <AiProvenance
                provenance={aiAttempt}
                field="Full dossier synthesis call"
                label="AI"
              />
            ) : ai.parsed ? (
              <Tooltip content="AI ran but provenance was not stored (old cache). Use Refresh live data.">
                <span className="rounded border border-violet-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400/50">
                  AI
                </span>
              </Tooltip>
            ) : null}
          </div>
          {hit?.iupacName ? <p className="text-sm text-slate-400">{hit.iupacName}</p> : null}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-slate-400">
            {hit?.formula ? (
              <div>
                <dt className="inline text-slate-600">Formula </dt>
                <dd className="inline text-slate-300">{hit.formula}</dd>
              </div>
            ) : null}
            {hit?.molecularWeight ? (
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
            {hit?.smiles ? (
              <div className="basis-full">
                <dt className="inline text-slate-600">SMILES </dt>
                <dd className="inline break-all text-xs text-slate-500">{hit.smiles}</dd>
              </div>
            ) : null}
          </dl>

          <div id="overview" className="scroll-mt-24 max-w-3xl">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Overview
              </span>
              {overviewFromAi && aiChip ? (
                <AiProvenance provenance={aiChip} field="Overview" label="AI" />
              ) : null}
            </div>
            {overview ? (
              <p className="leading-relaxed text-slate-300">{overview}</p>
            ) : (
              <p className="text-sm text-slate-500">
                Overview appears when PubChem description or Ollama synthesis is available.
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

          {ai.rawError && !ai.parsed ? (
            <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
              <span>
                AI enhance skipped or incomplete: {ai.rawError}. Showing free-API evidence scaffold.
              </span>
              {aiAttempt ? (
                <AiProvenance provenance={aiAttempt} field="Failed AI attempt" label="AI" />
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <CriticalParametersBoard routes={dossier.processRoutes} />

          <BiologicParametersPanel
            parameterSet={annotateParametersForDossier(
              getParameterSetForModality(modality),
              {
                hasAiRoutes: routesFromAi,
                evidenceScore: dossier.evidenceScore?.score,
              }
            )}
            title={`${modalityMeta?.label || modality} — educational parameters`}
          />

          <section id="routes" className="scroll-mt-24">
            <SectionTitle
              ai={routesFromAi && aiChip ? aiChip : undefined}
              field="Routes & process steps"
            >
              Routes &amp; process steps
            </SectionTitle>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              Dual audience view (mechanism / manufacturing). Content from free public evidence
              {routesFromAi ? " + Ollama synthesis" : " scaffold"}
              — not a validated batch record. Hover/click{" "}
              <span className="text-violet-300/80">AI</span> chips for prompt, data fed, model, and
              timing.
            </p>
            <RoutePanel
              routes={dossier.processRoutes}
              aiProvenance={routesFromAi ? aiChip : null}
            />
          </section>

          <section id="route-compare" className="scroll-mt-24">
            <SectionTitle>Route compare</SectionTitle>
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              Side-by-side scouting for tech transfer: BOM sample, scale class, equipment, and
              critical parameters. Differences highlight in the table.
            </p>
            <RouteCompare routes={dossier.processRoutes} />
          </section>

          {dossier.contradictions && dossier.contradictions.length > 0 ? (
            <EvidenceContradictions items={dossier.contradictions} />
          ) : null}

          {dossier.unitOpFills && dossier.unitOpFills.length > 0 ? (
            <UnitOpFillPanel
              fills={dossier.unitOpFills}
              modalityLabel={modalityMeta?.label}
            />
          ) : modalityMeta ? (
            <section id="modality-template" className="scroll-mt-24">
              <SectionTitle>Modality unit ops</SectionTitle>
              <p className="mb-3 text-xs text-slate-500">
                Structural template for{" "}
                <strong className="font-medium text-slate-400">{modalityMeta.label}</strong> —
                parameters must come from evidence or site validation, not this skeleton.
              </p>
              <ol className="list-inside list-decimal space-y-1 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
                {modalityMeta.unitOps.map((op) => (
                  <li key={op.id}>
                    <span className="text-slate-200">{op.title}</span>
                    <span className="text-slate-600"> — {op.description}</span>
                  </li>
                ))}
              </ol>
              {modalityMeta.cqaPlaceholders.length ? (
                <p className="mt-2 text-[11px] text-slate-600">
                  CQA slots: {modalityMeta.cqaPlaceholders.join(" · ")}
                </p>
              ) : null}
            </section>
          ) : null}

          {dossier.relatedEntities && dossier.relatedEntities.length > 0 ? (
            <section id="related-entities" className="scroll-mt-24">
              <SectionTitle
                ai={
                  aiChip && ai.provenance?.fieldsGenerated?.includes("relatedEntities")
                    ? aiChip
                    : undefined
                }
                field="Related entities"
              >
                Related entities (API · intermediates · impurities)
              </SectionTitle>
              <p className="mb-3 text-xs text-slate-500">
                Linked materials for tech-transfer graphs. Open live CIDs for child dossiers;
                CAS search when only registry numbers are known.
              </p>
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
                      {rel.pubchemCid ? (
                        <span className="ml-2 text-[11px] text-slate-600">
                          CID {rel.pubchemCid}
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

          <section id="pubchem-manufacturing" className="scroll-mt-24">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-100">
                Use &amp; manufacturing
              </h2>
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
            {dossier.manufacturingTexts.length > 0 ? (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {dossier.manufacturingTexts.map((t, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm leading-relaxed text-slate-400"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No use/manufacturing excerpts in the free public capture. Open{" "}
                <strong className="font-medium text-slate-400">API</strong> for the live PUG View
                endpoint and PubChem section.
              </p>
            )}
          </section>

          <section id="literature" className="scroll-mt-24">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-100">Literature</h2>
              <ApiProvenance
                traces={litTraces.length ? litTraces : traces}
                sourceRefs={litRefs}
                title="Europe PMC literature"
                label="API"
              />
            </div>
            {dossier.literature.length === 0 ? (
              <p className="text-sm text-slate-500">No literature hits for this query.</p>
            ) : (
              <ul className="space-y-3">
                {dossier.literature.map((h) => {
                  // Inline process-relevance badge (0–100 style band)
                  const hay = `${h.title} ${h.abstract || ""}`;
                  const processy =
                    /synthes|manufactur|process|ferment|preparat|industrial|scale|product|biocatal/i.test(
                      hay
                    );
                  return (
                  <li
                    key={h.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-teal-300 hover:underline"
                    >
                      {h.title}
                    </a>
                    {processy ? (
                      <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-300/90 ring-1 ring-teal-500/25">
                        process-ish
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
                        general
                      </span>
                    )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {[h.authors?.split(",")[0], h.journal, h.year].filter(Boolean).join(" · ")}
                    </div>
                    {h.abstract ? (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-500">
                        {h.abstract}
                      </p>
                    ) : null}
                  </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="patents" className="scroll-mt-24">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-100">Patents &amp; process IP</h2>
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
            {dossier.patents.length > 0 ? (
              <ul className="space-y-3">
                {dossier.patents.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2"
                  >
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-orange-200/90 hover:underline"
                    >
                      {p.title}
                    </a>
                    <div className="mt-0.5 font-mono text-xs text-slate-600">
                      {p.patentNumber}
                      {p.date ? ` · ${p.date}` : ""}
                    </div>
                    {p.abstract ? (
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-500">
                        {p.abstract}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No patent hits in the free public capture. Open{" "}
                <strong className="font-medium text-slate-400">API</strong> for PatentsView / Europe
                PMC endpoints and any live responses.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div
            id="manufacturing"
            className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-teal-300">Manufacturing summary</h3>
              {mfgFromAi && aiChip ? (
                <AiProvenance provenance={aiChip} field="Manufacturing summary" label="AI" />
              ) : (
                <ApiProvenance
                  pubchemCid={cid}
                  traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
                  title="Manufacturing summary"
                  label="API"
                />
              )}
            </div>
            {manufacturingSummary ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{manufacturingSummary}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No manufacturing summary in free evidence.</p>
            )}
          </div>

          {environmentBaseline ? (
            <div
              id="environment"
              className="scroll-mt-24 space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <SideTitle
                ai={envFromAi && aiChip ? aiChip : undefined}
                field="Plant environment baseline"
              >
                Plant environment baseline
              </SideTitle>
              {environmentBaseline.atmosphere ? (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Atmosphere: </span>
                  {environmentBaseline.atmosphere}
                </p>
              ) : null}
              {environmentBaseline.containment ? (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Containment: </span>
                  {environmentBaseline.containment}
                </p>
              ) : null}
              {environmentBaseline.atexZone ? (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Zoning: </span>
                  {environmentBaseline.atexZone}
                </p>
              ) : null}
              {environmentBaseline.utilities?.length ? (
                <p className="text-sm text-slate-400">
                  Utilities: {environmentBaseline.utilities.join(" · ")}
                </p>
              ) : null}
              {environmentBaseline.notes ? (
                <p className="text-xs text-slate-500">{environmentBaseline.notes}</p>
              ) : null}
            </div>
          ) : null}

          {apparatusCatalog.length > 0 ? (
            <div
              id="apparatus"
              className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <SideTitle
                ai={
                  aiChip && (apparatusFromAi || ai.parsed) ? aiChip : undefined
                }
                field="Apparatus catalog"
              >
                Apparatus catalog
              </SideTitle>
              <ul className="space-y-2 text-sm">
                {apparatusCatalog.map((a, i) => (
                  <li key={i} className="border-b border-slate-800/80 pb-2 last:border-0">
                    <code className="text-xs text-teal-200/90">{a.equipmentClass}</code>
                    {a.materialOfConstruction ? (
                      <div className="text-xs text-slate-500">{a.materialOfConstruction}</div>
                    ) : null}
                    {a.notes ? <div className="text-xs text-slate-400">{a.notes}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {ehs.length > 0 ? (
            <div
              id="ehs"
              className="scroll-mt-24 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-rose-300">EHS highlights</h3>
                {ehsFromAi && aiChip ? (
                  <AiProvenance provenance={aiChip} field="EHS highlights" label="AI" />
                ) : (
                  <ApiProvenance
                    pubchemCid={cid}
                    traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
                    sourceRefs={dossier.hazards.sourceRefs}
                    title="EHS / GHS"
                    label="API"
                  />
                )}
              </div>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                {ehs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            id="hazards"
            className="scroll-mt-24 space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-200">Hazards (summary)</h3>
              <ApiProvenance
                pubchemCid={cid}
                traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
                sourceRefs={dossier.hazards.sourceRefs}
                title="PubChem PUG View · GHS / hazards"
                label="API"
              />
            </div>
            {dossier.hazards.signalWord ? (
              <p className="text-sm text-amber-200/90">Signal: {dossier.hazards.signalWord}</p>
            ) : null}
            {dossier.hazards.ghsPictograms && dossier.hazards.ghsPictograms.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {dossier.hazards.ghsPictograms.slice(0, 8).map((p) => (
                  <span
                    key={p}
                    className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400"
                  >
                    {p}
                  </span>
                ))}
              </div>
            ) : null}
            {dossier.hazards.hazardStatements && dossier.hazards.hazardStatements.length > 0 ? (
              <ul className="max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-slate-400">
                {dossier.hazards.hazardStatements.slice(0, 12).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">
                {dossier.hazards.notes || "No GHS text returned for this CID."}
              </p>
            )}
          </div>

          {dossier.propertyTexts.length > 0 ? (
            <div
              id="properties"
              className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200">Properties</h3>
                <ApiProvenance
                  pubchemCid={cid}
                  traces={pugViewTraces.length ? pugViewTraces : pubchemTraces}
                  title="PubChem properties"
                  label="API"
                />
              </div>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs text-slate-500">
                {dossier.propertyTexts.slice(0, 15).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            id="sources"
            className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Sources &amp; provenance</h3>
            <p className="mb-2 text-xs text-slate-500">
              {traces.length} live HTTP capture{traces.length === 1 ? "" : "s"}. API chips = free
              public HTTP. AI chips = Ollama prompt + data fed.
            </p>
            <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto text-[11px] text-slate-500">
              {dossier.sourceRefs.slice(0, 12).map((r) => (
                <li key={`${r.type}:${r.id}`}>
                  <span className="uppercase text-slate-600">{r.type}</span>
                  {" · "}
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-400/90 hover:underline"
                    >
                      {(r.label || r.id).slice(0, 60)}
                    </a>
                  ) : (
                    (r.label || r.id).slice(0, 60)
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <ApiProvenance
                pubchemCid={cid}
                traces={traces}
                title={name}
                label="Open provenance"
                sourceRefs={dossier.sourceRefs}
              />
              {aiAttempt ? (
                <AiProvenance
                  provenance={aiAttempt}
                  field="Full synthesis provenance"
                  label="AI"
                />
              ) : null}
            </div>
          </div>

          {ai.gaps && ai.gaps.length > 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <SideTitle
                className="text-sm font-semibold text-slate-400"
                ai={aiChip && ai.parsed ? aiChip : undefined}
                field="Evidence gaps"
              >
                Evidence gaps
              </SideTitle>
              <ul className="list-inside list-disc space-y-1 text-xs text-slate-600">
                {ai.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {dossier.buildAudit ? (
        <div
          id="build-audit"
          className="mt-10 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
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
                {dossier.buildAudit.patentCount ?? 0} patents ·{" "}
                {dossier.buildAudit.apiTraceCount ?? 0} HTTP
              </dd>
            </div>
          </dl>
          {dossier.buildAudit.steps.length > 0 ? (
            <ol className="mt-3 list-inside list-decimal space-y-1 text-[11px] text-slate-500">
              {dossier.buildAudit.steps.map((s, i) => (
                <li key={`${s.id}-${i}`}>
                  <span className={s.ok === false ? "text-rose-400" : "text-slate-400"}>
                    {s.label}
                  </span>
                  {s.durationMs != null ? ` · ${s.durationMs} ms` : ""}
                  {s.detail ? (
                    <span className="text-slate-600"> — {s.detail.slice(0, 120)}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
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
          Generated {new Date(dossier.generatedAt).toLocaleString()} · Tier {dossier.tier} · live
          APIs
          {ai.parsed ? " + Ollama" : " · evidence scaffold"}
          {aiChip
            ? ` · AI ${aiChip.model} in ${aiChip.responseTimeMs} ms`
            : ""}
          {dossier.modality ? ` · ${dossier.modality}` : ""}
        </p>
      </div>
    </div>
  );
}
