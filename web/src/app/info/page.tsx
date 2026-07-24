import type { Metadata } from "next";
import Link from "next/link";
import { TierBadge } from "@/components/TierBadge";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { pubchemStructureUrl } from "@/lib/api/pubchem";
import { getExampleCatalog, getExampleDossiers } from "@/lib/data/examples";
import { curatedPackageCount } from "@/lib/data/curatedPackages";
import { HUB_INDEX } from "@/lib/data/hubIndex";
import { CHEMISTRY_API_SOURCES } from "@/lib/sources/registry";
import { listParameterSets } from "@/lib/modality/biologicParameters";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Info · demos, curated dossiers & mock data",
  description:
    "For-show content only: Tier-A example dossiers, mock plant pages, educational packages, and static teaching data. Not live PubChem search.",
};

/**
 * Info hub: ALL curated / mock / static teaching content.
 * Live PubChem search and multi-API builds stay on Search / compound pages.
 */
export default function InfoPage() {
  const examples = getExampleCatalog();
  const dossiers = getExampleDossiers();
  const packages = curatedPackageCount();
  const hubExamples = HUB_INDEX.filter((h) => h.kind === "example");
  const hubLive = HUB_INDEX.filter((h) => h.kind === "live");
  const paramSets = listParameterSets();
  const registryCount = CHEMISTRY_API_SOURCES.length;

  const dataFiles = dossiers.map((d) => ({
    id: d.id,
    name: d.identifiers.name,
    path: `web/src/data/molecules/${d.id}.json`,
    routes: d.routes?.length ?? 0,
    related: d.relatedEntities?.length ?? 0,
  }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
        Info · for show only
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
        Demos, curated dossiers &amp; mock data
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
        Everything here is <strong className="font-medium text-amber-100/90">educational /
        UI demo content</strong> — static scaffolds, Tier-A plant dossiers, and package
        playbooks. It is <strong className="font-medium text-slate-300">not</strong> what
        live Search returns. Use the teal tools (Search, Workspace, Compare) for real
        multi-API builds. Not GMP or regulatory decision support.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={routes.search()}
          className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500"
        >
          ← Back to live search
        </Link>
        <RegulatoryDisclaimer compact />
      </div>

      {/* Show vs real */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-amber-100">For show (this tab)</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-400">
            <li>Tier-A curated plant dossiers</li>
            <li>Educational process packages</li>
            <li>Teaching catalog / hub index</li>
            <li>Static JSON &amp; modality templates</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-100">Real (top bar)</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-400">
            <li>
              <Link href={routes.search()} className="text-teal-400 hover:underline">
                Search
              </Link>{" "}
              — live PubChem
            </li>
            <li>
              <Link href={routes.compare()} className="text-teal-400 hover:underline">
                Compare
              </Link>{" "}
              /{" "}
              <Link href={routes.workspace()} className="text-teal-400 hover:underline">
                Workspace
              </Link>
            </li>
            <li>
              <Link href={routes.diagnostics()} className="text-teal-400 hover:underline">
                Diagnostics
              </Link>{" "}
              /{" "}
              <Link href={routes.sources()} className="text-teal-400 hover:underline">
                API sources
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* Quick stats */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tier-A dossiers", value: String(examples.length), href: "#curated-dossiers" },
          { label: "Curated packages", value: String(packages), href: routes.packages() },
          { label: "Teaching catalog", value: String(HUB_INDEX.length), href: routes.catalog() },
          { label: "Parameter frameworks", value: String(paramSets.length), href: "#modality-data" },
        ].map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 transition hover:border-amber-500/30"
          >
            <div className="text-2xl font-semibold text-slate-50">{s.value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{s.label}</div>
          </a>
        ))}
      </section>

      <nav className="mt-6 flex flex-wrap gap-2 text-xs">
        {[
          { href: "#curated-dossiers", label: "Curated dossiers" },
          { href: routes.packages(), label: "Packages" },
          { href: routes.catalog(), label: "Catalog" },
          { href: "#mock-pages", label: "Mock page map" },
          { href: "#static-data", label: "Static data" },
          { href: "#hub-index", label: "Hub index" },
          { href: "#modality-data", label: "Modality templates" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-slate-400 hover:border-amber-500/40 hover:text-amber-100"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      {/* Curated Tier-A dossiers */}
      <section id="curated-dossiers" className="mt-12 scroll-mt-24">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/90">
              Tier-A · mock plant depth
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
              Curated process dossiers
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Hand-authored dual-view recipes (mechanism + manufacturing). UI gold standard.
              Not returned by live search.
            </p>
          </div>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((e) => (
            <li
              key={e.id}
              className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm transition hover:border-amber-500/40 hover:bg-slate-900"
            >
              <Link href={routes.example(e.id)} className="group flex min-h-0 flex-1 flex-col">
                <div className="flex gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1">
                    {e.pubchemCid ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pubchemStructureUrl(e.pubchemCid, "small")}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-100 transition-colors group-hover:text-amber-100">
                        {e.name}
                      </h3>
                      <TierBadge tier={e.tier} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {e.formula ?? "—"}
                      {e.cas ? ` · CAS ${e.cas}` : ""}
                      {e.pubchemCid != null ? ` · CID ${e.pubchemCid}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-400">{e.summary}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-500/25">
                    Curated example
                  </span>
                  {e.tags?.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-amber-300/90 group-hover:underline">
                    Open mock dossier →
                  </span>
                </div>
              </Link>
              {e.pubchemCid != null ? (
                <div className="mt-2 border-t border-slate-800/80 pt-2 text-[11px] text-slate-600">
                  Live twin:{" "}
                  <Link
                    href={routes.pubchem(e.pubchemCid)}
                    className="text-teal-500/80 hover:underline"
                  >
                    /compounds/pubchem/{e.pubchemCid}
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {/* Packages + catalog callouts */}
      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Link
          href={routes.packages()}
          className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-5 transition hover:border-violet-400/40"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
            For show
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">
            Educational packages (~{packages})
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Modality playbooks and unit-op scaffolds — teaching only, not site procedures.
          </p>
          <span className="mt-3 inline-block text-xs text-violet-300">Open packages →</span>
        </Link>
        <Link
          href={routes.catalog()}
          className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-5 transition hover:border-sky-400/40"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/90">
            For show
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">Teaching catalog</h2>
          <p className="mt-2 text-sm text-slate-400">
            Faceted index of curated examples plus labeled live PubChem pointers.
          </p>
          <span className="mt-3 inline-block text-xs text-sky-300">Open catalog →</span>
        </Link>
      </section>

      {/* Mock pages inventory */}
      <section id="mock-pages" className="mt-16 scroll-mt-24 border-t border-slate-800 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/90">
          Routes
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Mock &amp; curated page map
        </h2>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[36rem] text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Path</th>
                <th className="px-3 py-2.5">Content</th>
                <th className="px-3 py-2.5">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="px-3 py-2.5 font-mono text-xs text-amber-300/90">
                  <Link href={routes.info()} className="hover:underline">
                    /info
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-400">
                  This hub — all for-show content
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                    Hub
                  </span>
                </td>
              </tr>
              {examples.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2.5 font-mono text-xs text-teal-300/90">
                    <Link href={routes.example(e.id)} className="hover:underline">
                      /examples/{e.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400">
                    Full dual-view plant dossier · {e.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                      Tier-A mock
                    </span>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-2.5 font-mono text-xs text-teal-300/90">
                  <Link href={routes.packages()} className="hover:underline">
                    /packages
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-400">
                  ~{packages} educational process packages
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
                    Curated
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 font-mono text-xs text-teal-300/90">
                  <Link href={routes.catalog()} className="hover:underline">
                    /catalog
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-400">
                  Faceted teaching hub (examples + live pointers)
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
                    Teaching index
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Static data files */}
      <section id="static-data" className="mt-16 scroll-mt-24 border-t border-slate-800 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/90">
          Repository data
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Static data files
        </h2>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[40rem] text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Entity</th>
                <th className="px-3 py-2.5">File</th>
                <th className="px-3 py-2.5">Routes</th>
                <th className="px-3 py-2.5">Related</th>
                <th className="px-3 py-2.5">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {dataFiles.map((f) => (
                <tr key={f.id}>
                  <td className="px-3 py-2.5 font-medium text-slate-100">{f.name}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                    {f.path}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-400">{f.routes}</td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-400">{f.related}</td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={routes.example(f.id)}
                      className="text-xs text-teal-400 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hub index */}
      <section id="hub-index" className="mt-16 scroll-mt-24 border-t border-slate-800 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/90">
          Hub index
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Example vs live pointers
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          {hubExamples.length} curated example CIDs · {hubLive.length} live-only hub pointers ·{" "}
          {registryCount} registry API sources documented
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <h3 className="text-sm font-semibold text-amber-100">
              Example CIDs (mock + live twin)
            </h3>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-xs text-slate-400">
              {hubExamples.map((h) => (
                <li key={h.pubchemCid} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={routes.example(h.exampleId!)}
                    className="font-medium text-amber-100/90 hover:underline"
                  >
                    {h.name}
                  </Link>
                  <span className="font-mono text-slate-600">CID {h.pubchemCid}</span>
                  <Link
                    href={routes.pubchem(h.pubchemCid)}
                    className="text-teal-500/80 hover:underline"
                  >
                    live →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Live hub pointers (open real PubChem build)
            </h3>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-xs text-slate-400">
              {hubLive.map((h) => (
                <li key={h.pubchemCid} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={routes.pubchem(h.pubchemCid)}
                    className="font-medium text-slate-200 hover:text-teal-300 hover:underline"
                  >
                    {h.name}
                  </Link>
                  <span className="font-mono text-slate-600">CID {h.pubchemCid}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Modality data */}
      <section id="modality-data" className="mt-16 scroll-mt-24 border-t border-slate-800 pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/90">
          Templates
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
          Modality parameter frameworks
        </h2>
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
