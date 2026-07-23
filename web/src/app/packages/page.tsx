import type { Metadata } from "next";
import Link from "next/link";
import {
  curatedPackageCount,
  filterCuratedPackages,
  PACKAGE_CATALOG_DISCLAIMER,
  packageHref,
} from "@/lib/data/curatedPackages";
import { MODALITY_OPTIONS, ROLE_OPTIONS } from "@/lib/data/hubCatalog";
import { TierBadge } from "@/components/TierBadge";
import { routes } from "@/lib/routes";
import { RegulatoryDisclaimer } from "@/components/RegulatoryDisclaimer";
import { listParameterSets } from "@/lib/modality/biologicParameters";

export const metadata: Metadata = {
  title: "Curated packages",
  description:
    "Educational process packages (~100) with modality parameter scaffolds — not GMP.",
};

type Props = {
  searchParams: Promise<{
    q?: string;
    modality?: string;
    role?: string;
    tier?: string;
    depth?: string;
  }>;
};

export default async function PackagesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const allCount = curatedPackageCount();
  const filtered = filterCuratedPackages({
    q: sp.q,
    modality: sp.modality,
    role: sp.role,
    tier: sp.tier,
    depth: sp.depth,
  });
  const paramSets = listParameterSets();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        Curated process packages
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
        <strong className="text-slate-300">{allCount} educational packages</strong> spanning
        small-molecule APIs, intermediates, solvents, formulation, and biologic modalities
        (mAb, ADC, peptide, oligo, cell/gene, vaccine). Each package links to live PubChem
        and/or a Tier-A dual-view dossier when available, plus a{" "}
        <strong className="text-slate-300">modality parameter scaffold</strong> with
        literature-typical teaching envelopes.
      </p>
      <div className="mt-4 space-y-2">
        <RegulatoryDisclaimer compact />
        <p className="text-[11px] leading-relaxed text-slate-600">
          {PACKAGE_CATALOG_DISCLAIMER} These are{" "}
          <strong className="text-slate-500">not</strong> 100 GMP-validated plant packages —
          they are structured professional scaffolds for scouting and tech-transfer prep.
        </p>
      </div>

      <form
        method="get"
        className="mt-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
      >
        <label className="block min-w-[10rem] flex-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">Search</span>
          <input
            name="q"
            defaultValue={sp.q || ""}
            placeholder="Name, CAS, tag…"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">Modality</span>
          <select
            name="modality"
            defaultValue={sp.modality || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
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
          <span className="font-semibold uppercase tracking-wider text-slate-500">Role</span>
          <select
            name="role"
            defaultValue={sp.role || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
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
          <span className="font-semibold uppercase tracking-wider text-slate-500">Tier</span>
          <select
            name="tier"
            defaultValue={sp.tier || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="A">A (deep dossier)</option>
            <option value="B">B (scaffold)</option>
            <option value="C">C (pointer)</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">Depth</span>
          <select
            name="depth"
            defaultValue={sp.depth || ""}
            className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="deep">Deep</option>
            <option value="standard">Standard</option>
            <option value="pointer">Pointer</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          Apply
        </button>
        <Link
          href="/packages"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400"
        >
          Clear
        </Link>
      </form>

      <p className="mt-4 text-xs text-slate-500">
        Showing {filtered.length} of {allCount} packages
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <li key={p.id}>
            <Link
              href={routes.package(p.id)}
              className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition hover:border-teal-500/40 hover:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-100">{p.name}</h2>
                <TierBadge tier={p.tier} />
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-500">
                {p.formula || "—"}
                {p.cas ? ` · ${p.cas}` : ""}
                {p.pubchemCid != null ? ` · CID ${p.pubchemCid}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {p.modality}
                </span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {p.entityRole}
                </span>
                <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-200">
                  {p.depth}
                </span>
              </div>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-500">{p.summary}</p>
              <span className="mt-3 text-[11px] text-teal-400/90">
                Open package →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">
          No packages match. Try{" "}
          <Link href={routes.search(sp.q)} className="text-teal-400 hover:underline">
            live search
          </Link>
          .
        </p>
      ) : null}

      <section className="mt-16 border-t border-slate-800 pt-10">
        <h2 className="text-xl font-semibold text-slate-100">
          Modality parameter frameworks
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Each package attaches one of these educational parameter sets. Literature-typical
          values are teaching envelopes — site validation required.
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
                {s.parameters.length} parameters · modality {s.modality}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-xs text-slate-600">
        Prefer faceted chemical catalog?{" "}
        <Link href={routes.catalog()} className="text-teal-400 hover:underline">
          Catalog
        </Link>
        {" · "}
        Live long-tail:{" "}
        <Link href={routes.search()} className="text-teal-400 hover:underline">
          Search
        </Link>
      </p>
    </div>
  );
}
