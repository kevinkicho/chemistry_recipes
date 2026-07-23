/**
 * Canonical app routes.
 *
 * | Path | Purpose |
 * |------|---------|
 * | `/` | Home |
 * | `/search` | PubChem (NIH) free public search |
 * | `/catalog` | Faceted recipe hub (examples + live pointers) |
 * | `/workspace` | Local-first project library |
 * | `/sources` | Free public API registry |
 * | Header **AI** | Ollama Cloud config modal (`/?ai=1` deep link) |
 * | `/compounds/pubchem/[cid]` | Live PubChem + API dossier |
 * | `/examples/[id]` | Curated example dossiers |
 */

export const routes = {
  home: () => "/",
  catalog: () => "/catalog",
  packages: () => "/packages",
  package: (id: string) => `/packages/${encodeURIComponent(id)}`,
  workspace: () => "/workspace",
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
  /** Opens header AI settings modal via query flag */
  aiSettings: () => "/?ai=1",
  /** Free PubChem (NIH) live compound page */
  pubchem: (cid: number | string) => `/compounds/pubchem/${cid}`,
  /** Curated example dossier (demo only) */
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
