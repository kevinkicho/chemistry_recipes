/**
 * Canonical app routes.
 *
 * | Path | Purpose |
 * |------|---------|
 * | `/` | Home (live tools) |
 * | `/info` | **For show** — curated dossiers, mock pages, packages, teaching data |
 * | `/search` | PubChem (NIH) free public search — **live** |
 * | `/workspace` | Local-first project library — **live** |
 * | `/sources` | Free public API registry — **live** |
 * | `/compounds/pubchem/[cid]` | Live PubChem + API dossier |
 * | `/examples/[id]` | Curated example dossiers (Info hub) |
 * | `/packages` | Educational packages (Info hub) |
 */

export const routes = {
  home: () => "/",
  /**
   * Info hub: all curated / mock / teaching content.
   * Prefer this over scattered Catalog/Packages top-nav links.
   */
  info: () => "/info",
  /** @deprecated use routes.info() — kept for old links */
  about: () => "/info",
  catalog: () => "/catalog",
  packages: () => "/packages",
  package: (id: string) => `/packages/${encodeURIComponent(id)}`,
  /**
   * Workspace. Optional deep-links:
   * - campaign: select science campaign id
   * - agent: 1 → scroll to campaign agent and auto-run
   * - q: agent question
   */
  workspace: (opts?: {
    campaign?: string;
    agent?: boolean;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    if (opts?.campaign?.trim()) params.set("campaign", opts.campaign.trim());
    if (opts?.agent) params.set("agent", "1");
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    const qs = params.toString();
    return qs ? `/workspace?${qs}` : "/workspace";
  },
  compare: (a?: string, b?: string) => {
    const params = new URLSearchParams();
    if (a?.trim()) params.set("a", a.trim());
    if (b?.trim()) params.set("b", b.trim());
    const qs = params.toString();
    return qs ? `/compare?${qs}` : "/compare";
  },
  search: (q?: string) =>
    q != null && q.trim() !== ""
      ? `/search?q=${encodeURIComponent(q.trim())}`
      : "/search",
  sources: () => "/sources",
  /** Operator diagnostics: API probes, cache, evidence analytics */
  diagnostics: () => "/diagnostics",
  /** Opens header AI settings modal via query flag */
  aiSettings: () => "/?ai=1",
  /** Free PubChem (NIH) live compound page */
  pubchem: (cid: number | string) => `/compounds/pubchem/${cid}`,
  /** Curated example dossier (demo only — under Info) */
  example: (id: string) => `/examples/${id}`,
} as const;

/** Match PubChem card: `/compounds/pubchem/2244` */
export function matchPubchemCid(pathname: string): string | null {
  const m = pathname.match(/^\/compounds\/pubchem\/(\d+)$/);
  return m?.[1] ?? null;
}

/** Match example dossier: `/examples/aspirin` */
export function matchExampleId(pathname: string): string | null {
  const m = pathname.match(/^\/examples\/([a-z0-9-]+)$/i);
  return m?.[1] ?? null;
}

export function isSearchPath(pathname: string): boolean {
  return pathname === "/search";
}

export function isSourcesPath(pathname: string): boolean {
  return pathname === "/sources";
}

export function isCatalogPath(pathname: string): boolean {
  return pathname === "/catalog" || pathname.startsWith("/catalog?");
}

export function isWorkspacePath(pathname: string): boolean {
  return pathname === "/workspace";
}

export function isInfoPath(pathname: string): boolean {
  return (
    pathname === "/info" ||
    pathname.startsWith("/info#") ||
    pathname === "/about" ||
    pathname.startsWith("/about#")
  );
}

/** @deprecated use isInfoPath */
export function isAboutPath(pathname: string): boolean {
  return isInfoPath(pathname);
}
