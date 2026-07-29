/**
 * Full curated dossier presentation (original plant-ready layout).
 * Used only for curated Tier-A examples (Info hub) — not for live PubChem search hits.
 */

import Link from "next/link";
import { RoutePanel } from "@/components/RoutePanel";
import { RouteCompare } from "@/components/RouteCompare";
import { TierBadge } from "@/components/TierBadge";
import { PubchemStructureImage } from "@/components/PubchemStructureImage";
import type { MoleculeDossier } from "@/lib/types/process";
import { routes } from "@/lib/routes";
import { TechTransferExport } from "@/components/TechTransferExport";
import { AddToProject } from "@/components/AddToProject";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { CriticalParametersBoard } from "@/components/CriticalParametersBoard";
import { EntityGraph } from "@/components/EntityGraph";
import { BiologicParametersPanel } from "@/components/BiologicParametersPanel";
import { getParameterSetForModality } from "@/lib/modality/biologicParameters";
import { ForShowBanner, ForShowBreadcrumb } from "@/components/ForShowBanner";

export function ExampleDossierView({ d }: { d: MoleculeDossier }) {
  const cid = d.identifiers.pubchemCid;
  const name = d.identifiers.name;
  const paramSet = getParameterSetForModality(d.modality || "small-molecule");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <ForShowBreadcrumb section="Examples" sectionHref={routes.info()} leaf={name} />
      <ForShowBanner section="Tier-A mock dossier" />
      <div className="mb-6">
        <RegulatoryDisclaimer compact />
      </div>

      <div
        id="identity"
        className="scroll-mt-24 flex flex-col gap-6 lg:flex-row lg:items-start"
      >
        <div
          id="structure"
          className="scroll-mt-24 flex h-40 w-40 shrink-0 flex-col items-center justify-center rounded-xl bg-white p-3 shadow-lg shadow-black/30"
        >
          {cid ? (
            <PubchemStructureImage
              cid={cid}
              size="large"
              alt={`2D structure of ${name} (PubChem CID ${cid})`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-sm text-slate-400">No structure</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{name}</h1>
            <TierBadge tier={d.tier} />
            <span className="print:hidden inline-flex flex-wrap items-center gap-1.5">
              <TechTransferExport source={{ kind: "example", dossier: d }} compact />
              <AddToProject
                kind="example"
                refId={d.id}
                label={name}
                href={routes.example(d.id)}
                cas={d.identifiers.cas}
                modality={d.modality || "small-molecule"}
              />
            </span>
          </div>
          {d.identifiers.iupacName ? (
            <p className="text-sm text-slate-400">{d.identifiers.iupacName}</p>
          ) : null}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-slate-400">
            {d.identifiers.formula ? (
              <div>
                <dt className="inline text-slate-600">Formula </dt>
                <dd className="inline text-slate-300">{d.identifiers.formula}</dd>
              </div>
            ) : null}
            {d.identifiers.cas ? (
              <div>
                <dt className="inline text-slate-600">CAS </dt>
                <dd className="inline text-slate-300">{d.identifiers.cas}</dd>
              </div>
            ) : null}
            {cid ? (
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
            ) : null}
            {d.identifiers.inchiKey ? (
              <div className="basis-full">
                <dt className="inline text-slate-600">InChIKey </dt>
                <dd className="inline break-all text-slate-300">{d.identifiers.inchiKey}</dd>
              </div>
            ) : null}
          </dl>
          <p id="overview" className="scroll-mt-24 max-w-3xl leading-relaxed text-slate-300">
            {d.overview}
          </p>
          {d.applications && d.applications.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {d.applications.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400"
                >
                  {a}
                </span>
              ))}
            </div>
          ) : null}
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
            This is a <strong className="font-medium">curated example</strong> for UI demonstration.
            It is not loaded from live search and is not a GMP procedure. Live PubChem search remains
            API-only.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <CriticalParametersBoard routes={d.routes} />

          <BiologicParametersPanel parameterSet={paramSet} />

          <section id="routes" className="scroll-mt-24">
            <h2 className="mb-1 text-lg font-semibold text-slate-100">Process recipe</h2>
            <p className="mb-4 text-xs text-slate-500">
              Ingredients, method steps, dual plant / chemistry view. Not a GMP batch record.
            </p>
            <RoutePanel routes={d.routes} />
          </section>

          <section id="route-compare" className="scroll-mt-24">
            <h2 className="mb-3 text-lg font-semibold text-slate-100">Route compare</h2>
            <RouteCompare routes={d.routes} />
          </section>

          {d.relatedEntities && d.relatedEntities.length > 0 ? (
            <section id="related-entities" className="scroll-mt-24">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Related entities</h2>
              <EntityGraph centerName={name} entities={d.relatedEntities} />
              <ul className="mt-3 space-y-2">
                {d.relatedEntities.map((rel, i) => (
                  <li
                    key={`${rel.name}-${i}`}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
                  >
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                      {rel.role}
                    </span>{" "}
                    {rel.pubchemCid ? (
                      <Link
                        href={routes.pubchem(rel.pubchemCid)}
                        className="font-medium text-teal-300 hover:underline"
                      >
                        {rel.name}
                      </Link>
                    ) : (
                      <span className="text-slate-200">{rel.name}</span>
                    )}
                    {rel.cas ? (
                      <span className="ml-2 font-mono text-xs text-slate-500">{rel.cas}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          {d.manufacturingSummary ? (
            <div
              id="manufacturing"
              className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <h3 className="text-sm font-semibold text-teal-300">Manufacturing summary</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {d.manufacturingSummary}
              </p>
            </div>
          ) : null}

          {d.environmentBaseline ? (
            <div
              id="environment"
              className="scroll-mt-24 space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <h3 className="text-sm font-semibold text-teal-300">Plant environment baseline</h3>
              {d.environmentBaseline.atmosphere ? (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Atmosphere: </span>
                  {d.environmentBaseline.atmosphere}
                </p>
              ) : null}
              {d.environmentBaseline.containment ? (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Containment: </span>
                  {d.environmentBaseline.containment}
                </p>
              ) : null}
              {d.environmentBaseline.atexZone ? (
                <p className="text-sm text-slate-300">
                  <span className="text-slate-500">Zoning: </span>
                  {d.environmentBaseline.atexZone}
                </p>
              ) : null}
              {d.environmentBaseline.utilities ? (
                <p className="text-sm text-slate-400">
                  Utilities: {d.environmentBaseline.utilities.join(" · ")}
                </p>
              ) : null}
              {d.environmentBaseline.notes ? (
                <p className="text-xs text-slate-500">{d.environmentBaseline.notes}</p>
              ) : null}
            </div>
          ) : null}

          {d.apparatusCatalog && d.apparatusCatalog.length > 0 ? (
            <div
              id="apparatus"
              className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <h3 className="mb-2 text-sm font-semibold text-teal-300">Apparatus catalog</h3>
              <ul className="space-y-2 text-sm">
                {d.apparatusCatalog.map((a, i) => (
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

          {d.ehsHighlights && d.ehsHighlights.length > 0 ? (
            <div
              id="ehs"
              className="scroll-mt-24 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"
            >
              <h3 className="mb-2 text-sm font-semibold text-rose-300">EHS highlights</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                {d.ehsHighlights.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {d.hazards ? (
            <div
              id="hazards"
              className="scroll-mt-24 space-y-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-200">Hazards (summary)</h3>
              {d.hazards.signalWord ? (
                <p className="text-sm text-amber-200/90">Signal: {d.hazards.signalWord}</p>
              ) : null}
              {d.hazards.hazardStatements ? (
                <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-400">
                  {d.hazards.hazardStatements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {d.hazards.notes ? (
                <p className="text-xs text-slate-500">{d.hazards.notes}</p>
              ) : null}
            </div>
          ) : null}

          {d.properties ? (
            <div
              id="properties"
              className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <h3 className="mb-2 text-sm font-semibold text-slate-200">Properties</h3>
              <dl className="space-y-1 text-sm text-slate-400">
                {d.properties.molecularWeight != null ? (
                  <div>
                    <span className="text-slate-600">MW </span>
                    {d.properties.molecularWeight}
                  </div>
                ) : null}
                {d.properties.meltingPointC != null ? (
                  <div>
                    <span className="text-slate-600">mp </span>
                    {d.properties.meltingPointC} °C
                  </div>
                ) : null}
                {d.properties.appearance ? (
                  <div>
                    <span className="text-slate-600">Appearance </span>
                    {d.properties.appearance}
                  </div>
                ) : null}
                {d.properties.solubility ? (
                  <div>
                    <span className="text-slate-600">Solubility </span>
                    {d.properties.solubility}
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          <div
            id="sources"
            className="scroll-mt-24 rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Sources</h3>
            <ul className="space-y-1 text-xs text-slate-500">
              {(d.sourceRefs ?? []).map((r, i) => (
                <li key={`${r.id}-${i}`}>
                  <span className="uppercase text-slate-600">{r.type}</span>
                  {" · "}
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-teal-400/90 hover:underline"
                    >
                      {r.label || r.id}
                    </a>
                  ) : (
                    r.label || r.id
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div
        id="disclaimer"
        className="mt-10 scroll-mt-24 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
      >
        <h2 className="text-sm font-semibold text-slate-300">Disclaimer</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {d.disclaimer ||
            "Educational example dossier. Not a validated GMP procedure or batch record."}
        </p>
        {d.lastReviewed ? (
          <p className="mt-2 text-[11px] text-slate-700">Last reviewed {d.lastReviewed}</p>
        ) : null}
        <div className="mt-4">
          <Link
            href={routes.info()}
            className="text-sm text-amber-300/90 hover:underline"
          >
            ← Back to Info (curated dossiers)
          </Link>
          {cid ? (
            <>
              <span className="mx-2 text-slate-700">·</span>
              <Link
                href={routes.pubchem(cid)}
                className="text-sm text-slate-400 hover:text-teal-300"
              >
                Open live PubChem build for CID {cid} →
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
