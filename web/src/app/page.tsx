import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { TierBadge } from "@/components/TierBadge";
import { pubchemStructureUrl } from "@/lib/api/pubchem";
import { getExampleCatalog } from "@/lib/data/examples";
import { routes } from "@/lib/routes";

export default function HomePage() {
  const examples = getExampleCatalog();

  return (
    <div>
      <section className="relative border-b border-slate-800 bg-grid">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-500/5 via-transparent to-slate-950" />
        <div className="relative w-full p-3 sm:p-4 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/90">
            Professional process recipe hub · free public evidence
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
            Production intelligence for chemical, medicinal &amp; biotech teams
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-400">
            Evidence-first dual-view recipes (mechanism + manufacturing) from free public APIs and
            optional Ollama synthesis. Tech-transfer exports, route compare, modality templates,
            and a local workspace —{" "}
            <strong className="font-medium text-slate-300">not GMP or regulatory decision support</strong>.
          </p>
          <div className="mt-8 max-w-xl">
            <SearchForm />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={routes.packages()}
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
            >
              Process packages (140+)
            </Link>
            <Link
              href={routes.catalog()}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-900"
            >
              Browse catalog
            </Link>
            <Link
              href={routes.search()}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-900"
            >
              Live search
            </Link>
            <Link
              href={routes.workspace()}
              className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-900"
            >
              Workspace
            </Link>
            <a
              href="#examples"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/15"
            >
              Tier-A examples
            </a>
          </div>
        </div>
      </section>

      <section id="examples" className="scroll-mt-24 w-full border-b border-slate-800 p-3 sm:p-4 sm:py-12">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/90">
              Examples only
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
              Curated process dossiers
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              Static educational scaffolds for UI and plant-ready structure.{" "}
              <strong className="font-medium text-slate-300">Not wired to search</strong> — search
              results always open live PubChem pages. Not GMP procedures.
            </p>
          </div>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((e) => (
            <li key={e.id}>
              <Link
                href={routes.example(e.id)}
                className="group flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm transition hover:border-teal-500/40 hover:bg-slate-900"
              >
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
                      <h3 className="font-semibold text-slate-100 transition-colors group-hover:text-teal-200">
                        {e.name}
                      </h3>
                      <TierBadge tier={e.tier} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {e.formula ?? "—"}
                      {e.cas ? ` · CAS ${e.cas}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-slate-400">{e.summary}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-500/25">
                    Example
                  </span>
                  {e.tags?.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-teal-400/90 group-hover:underline">
                    Open dossier →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="capabilities" className="w-full p-3 sm:p-4 sm:py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Evidence-scored live dossiers",
              body: "PubChem + multi-query literature + OpenAlex + patents. AI runs when process evidence is rich enough; confidence is labeled.",
            },
            {
              title: "Example dossiers",
              body: "Five curated molecules with dual mechanism / manufacturing views — the layout gold standard.",
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
