import Link from "next/link";
import { routes } from "@/lib/routes";

/**
 * Shared chrome for every mock / curated / teaching-only page.
 * Makes "for show" unmistakable vs live Search / PubChem builds.
 */
export function ForShowBanner({
  section,
}: {
  /** Short label for this surface, e.g. "Packages", "Catalog", "Example" */
  section?: string;
}) {
  return (
    <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 ring-1 ring-amber-500/35">
          For show
        </span>
        <span className="font-medium text-amber-50">
          Demo / teaching content{section ? ` · ${section}` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-amber-100/75">
        Not a live multi-API dossier and not a search hit. Real work:{" "}
        <Link href={routes.search()} className="font-medium text-teal-300 hover:underline">
          Search
        </Link>
        {" · "}
        All demos live under{" "}
        <Link href={routes.info()} className="font-medium text-amber-100 hover:underline">
          Info
        </Link>
        .
      </p>
    </div>
  );
}

/** Compact breadcrumb row: Info / Section / optional leaf */
export function ForShowBreadcrumb({
  section,
  sectionHref,
  leaf,
}: {
  section: string;
  sectionHref?: string;
  leaf?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
      <Link href={routes.info()} className="text-amber-300/90 hover:underline">
        Info
      </Link>
      <span className="text-slate-700">/</span>
      {sectionHref ? (
        <Link href={sectionHref} className="hover:text-amber-200">
          {section}
        </Link>
      ) : (
        <span className="text-slate-400">{section}</span>
      )}
      {leaf ? (
        <>
          <span className="text-slate-700">/</span>
          <span className="text-slate-400">{leaf}</span>
        </>
      ) : null}
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200 ring-1 ring-amber-500/30">
        For show
      </span>
    </div>
  );
}
