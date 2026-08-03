import Link from "next/link";
import { routes } from "@/lib/routes";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800 bg-slate-950">
      <div className="w-full p-3 sm:p-4">
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
          <strong className="text-slate-300">Free public data only.</strong> Compound identity from
          sources such as PubChem (NIH). Not regulatory decision support.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <Link href={routes.search()} className="hover:text-teal-400">
            Live search
          </Link>
          <Link href={routes.sources()} className="hover:text-teal-400">
            Free API registry
          </Link>
          <Link href={routes.diagnostics()} className="hover:text-teal-400">
            Diagnostics
          </Link>
          <Link href={routes.aiSettings()} className="hover:text-teal-400">
            AI settings
          </Link>
        </div>
      </div>
    </footer>
  );
}
