import type { Metadata } from "next";
import Link from "next/link";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { PubchemStructureImage } from "@/components/PubchemStructureImage";
import {
  curatedPackageCount,
  getAllCuratedPackages,
  packageHref,
  PACKAGE_CATALOG_DISCLAIMER,
} from "@/lib/data/curatedPackages";
import { CHEMISTRY_API_SOURCES } from "@/lib/sources/registry";
import { listParameterSets } from "@/lib/modality/biologicParameters";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Info · live pipeline & teaching pointer",
  description:
    "Product is live free-public densify + AI dual-view. One optional teaching package pointer (Aspirin → live CID).",
};

/**
 * Product info: live work pipeline first; single teaching pointer only.
 * No Tier-A mock dossiers or sample hub catalogs.
 */
export default function InfoPage() {
  const packages = getAllCuratedPackages();
  const packageCount = curatedPackageCount();
  const paramSets = listParameterSets();
  const registryCount = CHEMISTRY_API_SOURCES.length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/90">
        Info · live product
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
        Live densify pipeline &amp; teaching pointer
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
        Chemistry Recipes is a{" "}
        <strong className="font-medium text-teal-100/90">
          free-public multi-API densify + AI dual-view
        </strong>{" "}
        product. There are no mock plant dossiers or sample Tier-A catalogs. Open any PubChem CID
        from Search; AI structures manufacturing + mechanism views only from densified public
        evidence. Not GMP or regulatory decision support.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={routes.search()}
          className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500"
        >
          Open live search →
        </Link>
        <RegulatoryDisclaimer compact />
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
          <h2 className="text-sm font-semibold text-teal-100">Live work (primary)</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-400">
            <li>Search → PubChem CID → multi-API harvest</li>
            <li>Densify pass (procedure windows, patents, OA full text)</li>
            <li>Evidence shell (data dashboard) then AI dual-view</li>
            <li>Soft-fail gather; uncited plant numbers stripped</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-100">What was removed</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-400">
            <li>Tier-A mock molecule JSON dossiers</li>
            <li>Sample hub catalog entries</li>
            <li>Teaching merge that injected mock routes into live pages</li>
            <li>Example-only dual-view pages</li>
          </ul>
        </div>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Teaching packages",
            value: String(packageCount),
            href: routes.packages(),
          },
          {
            label: "Registry APIs",
            value: String(registryCount),
            href: routes.sources(),
          },
          {
            label: "Parameter frameworks",
            value: String(paramSets.length),
            href: "#modality-data",
          },
          {
            label: "Live search",
            value: "→",
            href: routes.search(),
          },
        ].map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 transition hover:border-teal-500/30"
          >
            <div className="text-2xl font-semibold text-slate-50">{s.value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{s.label}</div>
          </a>
        ))}
      </section>

      {/* Single teaching pointer */}
      <section id="teaching-pointer" className="mt-12 scroll-mt-24">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-300/90">
          Optional · one teaching pointer
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Aspirin → live densify
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          {PACKAGE_CATALOG_DISCLAIMER}
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <li
              key={p.id}
              className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm transition hover:border-teal-500/40"
            >
              <Link href={packageHref(p)} className="group flex min-h-0 flex-1 flex-col">
                <div className="flex gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1">
                    {p.pubchemCid ? (
                      <PubchemStructureImage
                        cid={p.pubchemCid}
                        size="small"
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-100 group-hover:text-teal-200">
                      {p.name}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {p.formula ?? "—"}
                      {p.cas ? ` · CAS ${p.cas}` : ""}
                      {p.pubchemCid != null ? ` · CID ${p.pubchemCid}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-400">{p.summary}</p>
                  </div>
                </div>
                <span className="mt-4 text-xs text-teal-300 group-hover:underline">
                  Open live densify →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Link
          href={routes.search()}
          className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-5 transition hover:border-teal-400/40"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-300/90">
            Primary
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Live search</h2>
          <p className="mt-2 text-sm text-slate-400">
            Any molecule name or CID → free-public densify + AI dual-view.
          </p>
          <span className="mt-3 inline-block text-xs text-teal-300">Search →</span>
        </Link>
        <Link
          href={routes.sources()}
          className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-5 transition hover:border-sky-400/40"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/90">
            Provenance
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">
            API sources ({registryCount})
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Registry of free-public chemistry APIs used by densify.
          </p>
          <span className="mt-3 inline-block text-xs text-sky-300">Sources →</span>
        </Link>
      </section>

      <section id="modality-data" className="mt-16 scroll-mt-24 border-t border-slate-800 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          Templates
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Modality parameter frameworks
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Educational scaffolds for MSAT language — not mock plant data.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paramSets.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <h3 className="text-sm font-semibold text-violet-200">{s.label}</h3>
              <p className="mt-1 text-xs text-slate-500">{s.summary}</p>
              <p className="mt-2 text-[11px] text-slate-600">
                {s.parameters.length} parameters · {s.modality}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
