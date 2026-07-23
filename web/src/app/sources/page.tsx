import type { Metadata } from "next";
import { CHEMISTRY_API_SOURCES } from "@/lib/sources/registry";
import { SourcesRegistry } from "@/components/SourcesRegistry";
import Link from "next/link";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "API sources",
  description:
    "Free public chemistry APIs ranked for synthesis and manufacturing intelligence.",
};

export default function SourcesPage() {
  // Serialize plain data for the client expand/collapse table
  const sources = CHEMISTRY_API_SOURCES.map((s) => ({ ...s }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
        API sources
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Product-ranked free public sources for identity, hazards, reactions, pathways,
        patents, and literature. Click any row to expand full endpoint URLs, notes, and
        whether the source is wired into live dossier builds.
      </p>
      <p className="mt-3 text-sm text-slate-500">
        Free public APIs only. Evidence-first; not regulatory decision support. Check{" "}
        <Link href={routes.diagnostics()} className="text-teal-400 hover:underline">
          Diagnostics
        </Link>{" "}
        for live probe health.
      </p>

      <div className="mt-8">
        <SourcesRegistry sources={sources} />
      </div>

      <p className="mt-10 text-sm text-slate-500">
        Broader inventory:{" "}
        <code className="text-xs text-slate-400">docs/api-sources-manifest.md</code>
        {" · "}
        notes in{" "}
        <code className="text-xs text-slate-400">docs/chemistry-api-sources.md</code>.
      </p>
    </div>
  );
}
