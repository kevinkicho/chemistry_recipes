import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCuratedPackageById,
  PACKAGE_CATALOG_DISCLAIMER,
  packageHref,
} from "@/lib/data/curatedPackages";
import { getParameterSetForModality } from "@/lib/modality/biologicParameters";
import { BiologicParametersPanel } from "@/components/BiologicParametersPanel";
import { TierBadge } from "@/components/TierBadge";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { MODALITY_TEMPLATES } from "@/lib/modality/templates";
import { routes } from "@/lib/routes";
import { pubchemStructureUrl } from "@/lib/api/pubchem";
import { getExampleById } from "@/lib/data/examples";
import { ForShowBanner, ForShowBreadcrumb } from "@/components/ForShowBanner";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = getCuratedPackageById(id);
  return {
    title: p ? `${p.name} package` : "Package",
    description: p?.summary,
  };
}

export default async function PackageDetailPage({ params }: Props) {
  const { id } = await params;
  const pkg = getCuratedPackageById(id);
  if (!pkg) notFound();

  const paramSet = getParameterSetForModality(pkg.parameterSetId || pkg.modality);
  const modalityMeta = MODALITY_TEMPLATES[pkg.modality] || MODALITY_TEMPLATES.other;
  const deep = pkg.exampleId ? getExampleById(pkg.exampleId) : undefined;
  const openHref = packageHref(pkg);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <ForShowBreadcrumb
        section="Packages"
        sectionHref={routes.packages()}
        leaf={pkg.name}
      />
      <ForShowBanner section="Package detail" />
      <RegulatoryDisclaimer compact className="mb-6" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {pkg.pubchemCid ? (
          <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pubchemStructureUrl(pkg.pubchemCid, "large")}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
              {pkg.name}
            </h1>
            <TierBadge tier={pkg.tier} />
            <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs text-violet-200 ring-1 ring-violet-500/30">
              {pkg.depth} package
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            {pkg.summary}
          </p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm text-slate-500">
            {pkg.cas ? (
              <div>
                <dt className="inline text-slate-600">CAS </dt>
                <dd className="inline text-slate-300">{pkg.cas}</dd>
              </div>
            ) : null}
            {pkg.formula ? (
              <div>
                <dt className="inline text-slate-600">Formula </dt>
                <dd className="inline text-slate-300">{pkg.formula}</dd>
              </div>
            ) : null}
            {pkg.pubchemCid != null ? (
              <div>
                <dt className="inline text-slate-600">CID </dt>
                <dd className="inline text-slate-300">{pkg.pubchemCid}</dd>
              </div>
            ) : null}
            <div>
              <dt className="inline text-slate-600">Modality </dt>
              <dd className="inline text-slate-300">{pkg.modality}</dd>
            </div>
            <div>
              <dt className="inline text-slate-600">Role </dt>
              <dd className="inline text-slate-300">{pkg.entityRole}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={openHref}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
            >
              {deep
                ? "Open Tier-A dual-view dossier"
                : pkg.pubchemCid
                  ? "Build live PubChem dossier"
                  : "Browse catalog"}
            </Link>
            <Link
              href={routes.packages()}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              All packages
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-slate-600">
        {PACKAGE_CATALOG_DISCLAIMER}
      </p>

      <div className="mt-10 space-y-8">
        <BiologicParametersPanel parameterSet={paramSet} />

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-lg font-semibold text-slate-100">
            Unit operations ({modalityMeta.label})
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Structural skeleton only — parameters above are educational envelopes, not filled
            plant setpoints.
          </p>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-400">
            {modalityMeta.unitOps.map((op) => (
              <li key={op.id}>
                <span className="font-medium text-slate-200">{op.title}</span>
                <span className="text-slate-600"> — {op.description}</span>
              </li>
            ))}
          </ol>
          {modalityMeta.cqaPlaceholders.length ? (
            <p className="mt-3 text-[11px] text-slate-600">
              CQA slots: {modalityMeta.cqaPlaceholders.join(" · ")}
            </p>
          ) : null}
          {modalityMeta.ehsNotes.length ? (
            <ul className="mt-2 list-inside list-disc text-[11px] text-slate-500">
              {modalityMeta.ehsNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {pkg.related && pkg.related.length > 0 ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-lg font-semibold text-slate-100">Related entities</h2>
            <ul className="mt-3 space-y-2">
              {pkg.related.map((r, i) => (
                <li key={`${r.name}-${i}`} className="text-sm text-slate-400">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                    {r.role}
                  </span>{" "}
                  {r.pubchemCid ? (
                    <Link
                      href={routes.pubchem(r.pubchemCid)}
                      className="text-teal-300 hover:underline"
                    >
                      {r.name}
                    </Link>
                  ) : (
                    <span className="text-slate-200">{r.name}</span>
                  )}
                  {r.cas ? (
                    <span className="ml-2 font-mono text-xs text-slate-600">{r.cas}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {pkg.tags.map((t) => (
            <span key={t} className="rounded-full bg-slate-800 px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
