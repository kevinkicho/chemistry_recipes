import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { routes } from "@/lib/routes";

export default function HomePage() {
  return (
    <div>
      <section className="relative border-b border-slate-800 bg-grid">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-500/5 via-transparent to-slate-950" />
        <div className="relative w-full p-3 sm:p-4 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/90">
            Worker-first process scouting · free public evidence
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Monday-morning packs for plant, MSAT &amp; process teams
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
            EHS callouts, sourced steps, honest site gaps, and print-ready job aids from free public
            APIs — plus paste public patent text when density is thin. Role views for operator,
            chemist, MSAT, and manager.{" "}
            <strong className="font-medium text-slate-300">Not GMP or regulatory decision support</strong>.
          </p>
          <div className="mt-8 max-w-xl">
            <SearchForm />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={routes.search()}
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
            >
              Live evidence scout
            </Link>
            <Link
              href={routes.info()}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/15"
            >
              Training packs (Info)
            </Link>
            <Link
              href={routes.workspace()}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-900"
            >
              Local workspace
            </Link>
            <Link
              href={routes.compare()}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-900"
            >
              Compare (tech transfer)
            </Link>
          </div>
        </div>
      </section>

      <section className="w-full border-b border-slate-800 p-3 sm:p-4 sm:py-10">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300">
              1 · Live scout
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Search a name/CID → Monday pack (EHS, steps, site must-fill) in under two minutes.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              2 · Densify
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Paste public patent Example text when free APIs are thin — densifies job aid &amp; facts.
            </p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200">
              3 · Site fill
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Leave blanks for your QMS (temp, IPC, equipment tag). Export open-gaps for meetings.
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal-400/90">
              Real · live APIs · worker roles
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">
              What you use day-to-day
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-400">
              <li>
                <Link href={routes.search()} className="text-teal-400 hover:underline">
                  Search
                </Link>{" "}
                — PubChem name / CAS / CID / SMILES → multi-API dossiers
              </li>
              <li>
                <Link href={routes.compare()} className="text-teal-400 hover:underline">
                  Compare
                </Link>{" "}
                — side-by-side live or pinned routes
              </li>
              <li>
                <Link href={routes.workspace()} className="text-teal-400 hover:underline">
                  Workspace
                </Link>{" "}
                — local projects (browser only)
              </li>
              <li>
                <Link href={routes.diagnostics()} className="text-teal-400 hover:underline">
                  Diagnostics
                </Link>{" "}
                ·{" "}
                <Link href={routes.sources()} className="text-teal-400 hover:underline">
                  API sources
                </Link>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/90">
              For show · teaching only
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">
              All mock &amp; curated content is under Info
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Tier-A plant dossiers, educational packages, static JSON, and hub demos are{" "}
              <strong className="font-medium text-amber-100/90">not search results</strong> and never
              replace live PubChem builds. Open the amber{" "}
              <Link href={routes.info()} className="font-medium text-amber-100 hover:underline">
                Info
              </Link>{" "}
              tab in the top bar.
            </p>
            <Link
              href={routes.info()}
              className="mt-4 inline-flex rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20"
            >
              Open Info hub →
            </Link>
          </div>
        </div>
      </section>

      <section id="capabilities" className="w-full p-3 sm:p-4 sm:py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Evidence-scored live dossiers",
              body: "PubChem + multi-query literature + OpenAlex + patents. AI runs when process evidence is rich enough; confidence is labeled.",
            },
            {
              title: "Info hub (demos only)",
              body: "All mock dossiers, packages, and teaching catalogs live under the amber Info tab — never mixed into Search.",
            },
            {
              title: "Provenance & export",
              body: "API and AI chips on every block. IndexedDB cache, refresh control, print/PDF plant summary.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <h2 className="font-semibold text-slate-100">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
