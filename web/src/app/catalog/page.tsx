import type { Metadata } from "next";
import Link from "next/link";
import { TierBadge } from "@/components/TierBadge";
import { PubchemStructureImage } from "@/components/PubchemStructureImage";
import {
  filterHubCatalog,
  getHubCatalog,
  MODALITY_OPTIONS,
  ROLE_OPTIONS,
} from "@/lib/data/hubCatalog";
import { routes } from "@/lib/routes";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { ForShowBanner, ForShowBreadcrumb } from "@/components/ForShowBanner";
import { listModalities } from "@/lib/modality/templates";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Optional catalog shell — product work is live Search densify + AI dual-view (no sample entries).",
};

type Props = {
  searchParams: Promise<{
    q?: string;
    modality?: string;
    role?: string;
    tier?: string;
    kind?: string;
  }>;
};

export default async function CatalogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const all = getHubCatalog();
  const filtered = filterHubCatalog(all, {
    q: sp.q,
    modality: sp.modality,
    role: sp.role,
    tier: sp.tier,
    kind: sp.kind,
  });
  const templates = listModalities();
  // Teaching index only — not a top-nav live tool (see Info hub)

  function hrefWith(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const next = {
      q: sp.q,
      modality: sp.modality,
      role: sp.role,
      tier: sp.tier,
      kind: sp.kind,
      ...patch,
    };
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/catalog?${qs}` : "/catalog";
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <ForShowBreadcrumb section="Catalog" />
      <ForShowBanner section="Catalog" />
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Catalog (empty shell)
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Sample hub entries and Tier-A mock catalogs were removed. Day-to-day work starts at{" "}
        <Link href={routes.search()} className="text-teal-400 hover:underline">
          live Search
        </Link>{" "}
        → free-public densify + AI dual-view for any CID. Optional teaching pointer:{" "}
        <Link href={routes.pubchem(2244)} className="text-teal-400 hover:underline">
          Aspirin CID 2244
        </Link>
        .
      </p>
      <div className="mt-4">
        <RegulatoryDisclaimer compact />
      </div>

      <form
        className="mt-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        method="get"
      >
        <label className="block min-w-[10rem] flex-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Search
          </span>
          <input
            name="q"
            defaultValue={sp.q || ""}
            placeholder="Name, CAS, CID, tag…"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Modality
          </span>
          <select
            name="modality"
            defaultValue={sp.modality || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All</option>
            {MODALITY_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Role
          </span>
          <select
            name="role"
            defaultValue={sp.role || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Kind
          </span>
          <select
            name="kind"
            defaultValue={sp.kind || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All</option>
            <option value="live">Live PubChem</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Tier
          </span>
          <select
            name="tier"
            defaultValue={sp.tier || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          Apply
        </button>
        <Link
          href="/catalog"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-900"
        >
          Clear
        </Link>
      </form>

      <p className="mt-4 text-xs text-slate-500">
        Showing {filtered.length} of {all.length} hub entries
        {sp.modality ? (
          <>
            {" "}
            · modality{" "}
            <Link href={hrefWith({ modality: undefined })} className="text-teal-500">
              clear
            </Link>
          </>
        ) : null}
      </p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => {
          const href = e.pubchemCid
            ? routes.pubchem(e.pubchemCid)
            : routes.search(e.name);
          return (
            <li key={e.id}>
              <Link
                href={href}
                className="group flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition hover:border-teal-500/40 hover:bg-slate-900"
              >
                <div className="flex gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white p-1">
                    {e.pubchemCid ? (
                      <PubchemStructureImage
                        cid={e.pubchemCid}
                        size="small"
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <h2 className="font-semibold text-slate-100 group-hover:text-teal-200">
                        {e.name}
                      </h2>
                      <TierBadge tier={e.tier} />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                      {e.formula || "—"}
                      {e.cas ? ` · ${e.cas}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {e.modality}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {e.entityRole}
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        live
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-500">
                  {e.summary}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">
          No catalog hits. Try{" "}
          <Link href={routes.search(sp.q)} className="text-teal-400 hover:underline">
            live search
          </Link>
          .
        </p>
      ) : null}

      <section id="modality-templates" className="mt-16 scroll-mt-24 border-t border-slate-800 pt-10">
        <h2 className="text-xl font-semibold text-slate-100">
          Multi-modality process templates
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Structural unit-operation skeletons for biotech and formulation (no invented
          parameters). Live dossiers attach public evidence into these shapes when modality
          is inferred.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li
              key={t.modality}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <h3 className="text-sm font-semibold text-teal-200">{t.label}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.summary}</p>
              <ol className="mt-3 list-inside list-decimal space-y-0.5 text-[11px] text-slate-400">
                {t.unitOps.map((op) => (
                  <li key={op.id}>{op.title}</li>
                ))}
              </ol>
              <div className="mt-2 text-[10px] text-slate-600">
                CQA slots: {t.cqaPlaceholders.slice(0, 3).join(" · ")}
                {t.cqaPlaceholders.length > 3 ? "…" : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
