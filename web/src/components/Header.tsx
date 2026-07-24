import Link from "next/link";
import { Suspense } from "react";
import { HeaderHeightSync } from "@/components/HeaderHeightSync";
import { AiStatusBadge } from "@/components/AiStatusBadge";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { getServerAiEnv } from "@/lib/ai/serverEnv";
import { routes } from "@/lib/routes";

/** Live product tools only — mock/curated content is under Info. */
const liveLinks = [
  { href: routes.home(), label: "Home" },
  { href: routes.search(), label: "Search" },
  { href: routes.compare(), label: "Compare" },
  { href: routes.workspace(), label: "Workspace" },
  { href: routes.diagnostics(), label: "Diagnostics" },
  { href: routes.sources(), label: "API sources" },
];

export function Header() {
  const env = getServerAiEnv();
  const initialServerEnv = {
    envKeyConfigured: env.hasKey,
    envKeySource: env.hasKey
      ? env.keySource === "env-file"
        ? "OLLAMA_CLOUD_API_KEY (.env file)"
        : "OLLAMA_CLOUD_API_KEY"
      : null,
    model: env.model,
    host: env.host,
  };

  return (
    <header
      id="app-header"
      className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur"
    >
      <HeaderHeightSync />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={routes.home()} className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-500/15 text-sm font-bold text-teal-300 ring-1 ring-teal-400/40">
            CR
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-slate-100 transition-colors group-hover:text-teal-200">
              Chemistry Recipes
            </div>
            <div className="text-[11px] text-slate-500">
              Process recipe hub · free public evidence
            </div>
          </div>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {liveLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2.5 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-teal-200"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href={routes.info()}
            className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-500/20"
            title="Curated demos, mock dossiers, and teaching data — not live search results"
          >
            Info
          </Link>
          <GoogleSignInButton />
          <Suspense
            fallback={
              <span className="rounded-md px-2.5 py-1.5 text-sm text-slate-500">
                AI
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-600 align-middle" />
              </span>
            }
          >
            <AiStatusBadge initialServerEnv={initialServerEnv} />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
