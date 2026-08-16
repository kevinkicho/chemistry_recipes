/**
 * Canonical app routes — live densify only.
 * Mock/teaching paths (/info, /examples, /packages, /catalog) redirect to /search.
 */

export const routes = {
  home: () => "/",
  /** @deprecated mock hub retired — redirects to search */
  info: () => "/search",
  /** @deprecated */
  about: () => "/search",
  /** @deprecated mock catalog retired */
  catalog: () => "/search",
  /** @deprecated mock packages retired */
  packages: () => "/search",
  /** @deprecated */
  package: (id: string) => {
    void id;
    return "/search";
  },
  /**
   * Workspace. Optional deep-links:
   * - campaign: select science campaign id
   * - agent: 1 → scroll to campaign agent and auto-run
   * - brief: 1 → scroll to campaign scientific brief
   * - q: agent question
   */
  workspace: (opts?: {
    campaign?: string;
    agent?: boolean;
    brief?: boolean;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    if (opts?.campaign?.trim()) params.set("campaign", opts.campaign.trim());
    if (opts?.agent) params.set("agent", "1");
    if (opts?.brief) params.set("brief", "1");
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
  /** @deprecated mock examples retired — redirects to search */
  example: (id: string) => {
    void id;
    return "/search";
  },
} as const;

/** Match PubChem card: `/compounds/pubchem/2244` */
export function matchPubchemCid(pathname: string): string | null {
  const m = pathname.match(/^\/compounds\/pubchem\/(\d+)$/);
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
