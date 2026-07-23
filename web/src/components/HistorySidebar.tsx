"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  clearHistory,
  type HistoryEntry,
  readHistory,
  removeHistory,
  subscribeHistory,
} from "@/lib/search-history";
import { matchPubchemCid } from "@/lib/routes";
import {
  deleteCachedDossierAndNotify,
  getCachedDossier,
  formatCacheAge,
} from "@/lib/idb/dossierCache";
import { Tooltip } from "@/components/Tooltip";

function kindLabel(kind: HistoryEntry["kind"]): string {
  switch (kind) {
    case "search":
      return "Search";
    case "cid":
      return "PubChem";
    case "molecule":
      return "Legacy";
    default:
      return kind;
  }
}

function formatTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function HistoryList({
  entries,
  currentHref,
  pathname,
  cacheMeta,
  onNavigate,
  onRemove,
  onRefresh,
}: {
  entries: HistoryEntry[];
  currentHref: string;
  pathname: string;
  cacheMeta: Record<number, number>;
  onNavigate?: () => void;
  onRemove: (id: string) => void;
  onRefresh: (entry: HistoryEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="px-2 py-4 text-xs leading-relaxed text-slate-600">
        Your searches and PubChem compound views appear here. Dossiers are cached in IndexedDB on
        this device; use ↻ to refetch live APIs.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {entries.map((e) => {
        const active =
          currentHref === e.href ||
          pathname === e.href ||
          (e.href.startsWith("/search?") &&
            pathname === "/search" &&
            currentHref === e.href);

        const cidStr = e.kind === "cid" ? matchPubchemCid(e.href.split("?")[0] || e.href) : null;
        const cid = cidStr ? Number(cidStr) : null;
        const cachedAt = cid && cacheMeta[cid] ? cacheMeta[cid] : null;

        return (
          <li key={e.id} className="group relative">
            <Link
              href={e.href}
              onClick={onNavigate}
              className={`block rounded-md px-2 py-2 pr-14 transition-colors ${
                active
                  ? "bg-teal-500/15 text-teal-100"
                  : "text-slate-300 hover:bg-slate-900 hover:text-slate-100"
              }`}
            >
              <Tooltip content={e.label}>
                <div className="truncate text-sm font-medium">{e.label}</div>
              </Tooltip>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
                <span className="rounded bg-slate-900 px-1 py-px text-slate-500">
                  {kindLabel(e.kind)}
                </span>
                <span>{formatTime(e.ts)}</span>
                {cachedAt ? (
                  <Tooltip content="Cached in IndexedDB on this device">
                    <span className="rounded bg-sky-500/10 px-1 py-px text-sky-400/90">
                      cached {formatCacheAge(cachedAt)}
                    </span>
                  </Tooltip>
                ) : null}
              </div>
            </Link>

            <div className="absolute right-1 top-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Tooltip
                content={
                  e.kind === "cid"
                    ? "Refresh: clear cache and re-run free APIs + Ollama"
                    : "Open search again (live PubChem)"
                }
              >
                <button
                  type="button"
                  aria-label={`Refresh ${e.label}`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRefresh(e);
                    onNavigate?.();
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-teal-300"
                >
                  ↻
                </button>
              </Tooltip>
              <Tooltip content="Remove from history">
                <button
                  type="button"
                  aria-label={`Remove ${e.label} from history`}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onRemove(e.id);
                  }}
                  className="rounded px-1 text-xs text-slate-600 hover:bg-slate-800 hover:text-slate-300"
                >
                  ×
                </button>
              </Tooltip>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HistorySidebarInner() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryKey = searchParams.toString();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [cacheMeta, setCacheMeta] = useState<Record<number, number>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refreshList = useCallback(() => {
    setEntries(readHistory());
  }, []);

  const refreshCacheMeta = useCallback(async () => {
    const list = readHistory();
    const next: Record<number, number> = {};
    await Promise.all(
      list.map(async (e) => {
        if (e.kind !== "cid") return;
        const cidStr = matchPubchemCid(e.href.split("?")[0] || e.href);
        if (!cidStr) return;
        const cid = Number(cidStr);
        const cached = await getCachedDossier(cid);
        if (cached) next[cid] = cached.savedAt;
      })
    );
    setCacheMeta(next);
  }, []);

  useEffect(() => {
    setHydrated(true);
    try {
      if (localStorage.getItem("cr-sidebar-collapsed") === "1") {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
    refreshList();
    void refreshCacheMeta();
    const unsub = subscribeHistory(() => {
      refreshList();
      void refreshCacheMeta();
    });
    const onCache = () => void refreshCacheMeta();
    window.addEventListener("cr-dossier-cache-changed", onCache);
    return () => {
      unsub();
      window.removeEventListener("cr-dossier-cache-changed", onCache);
    };
  }, [refreshList, refreshCacheMeta]);

  useEffect(() => {
    if (!hydrated) return;
    refreshList();
    void refreshCacheMeta();
  }, [pathname, queryKey, hydrated, refreshList, refreshCacheMeta]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("cr-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function onRefreshEntry(entry: HistoryEntry) {
    if (entry.kind === "cid") {
      const cidStr = matchPubchemCid(entry.href.split("?")[0] || entry.href);
      if (cidStr) {
        const cid = Number(cidStr);
        await deleteCachedDossierAndNotify(cid);
        router.push(`/compounds/pubchem/${cid}?refresh=1`);
        return;
      }
    }
    // Search (or other): re-open live
    const href = entry.href.includes("?")
      ? `${entry.href}&refresh=1`
      : `${entry.href}?refresh=1`;
    router.push(href);
  }

  const currentHref = queryKey ? `${pathname}?${queryKey}` : pathname;

  return (
    <div className="relative flex shrink-0">
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 shadow-lg md:hidden"
      >
        History{entries.length ? ` (${entries.length})` : ""}
      </button>

      <aside
        className={`app-sticky-under-header sticky hidden flex-col border-r border-slate-800 bg-slate-950/95 md:flex ${
          collapsed ? "w-12" : "w-64"
        } transition-[width] duration-200`}
        aria-label="Search history"
      >
        <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-800 px-2 py-3">
          {!collapsed && (
            <div className="min-w-0 px-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                History
              </div>
              <div className="text-[10px] text-slate-600">
                {hydrated
                  ? entries.length
                    ? `${entries.length} item${entries.length === 1 ? "" : "s"} · ↻ refetches`
                    : "Prior searches & views"
                  : "…"}
              </div>
            </div>
          )}
          <Tooltip content={collapsed ? "Expand history" : "Collapse history"}>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              aria-label={collapsed ? "Expand history sidebar" : "Collapse history sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? "»" : "«"}
            </button>
          </Tooltip>
        </div>

        {!collapsed && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <HistoryList
                entries={entries}
                currentHref={currentHref}
                pathname={pathname}
                cacheMeta={cacheMeta}
                onRemove={(id) => {
                  removeHistory(id);
                  refreshList();
                }}
                onRefresh={(e) => void onRefreshEntry(e)}
              />
            </div>
            <div className="shrink-0 space-y-1 border-t border-slate-800 p-2">
              <a
                href="/workspace"
                className="block w-full rounded-md px-2 py-1.5 text-center text-xs text-teal-400/90 hover:bg-slate-900"
              >
                Open workspace
              </a>
              <a
                href="/compare"
                className="block w-full rounded-md px-2 py-1.5 text-center text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-300"
              >
                Compare recipes
              </a>
              {entries.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Clear all search history on this device?")) {
                      clearHistory();
                      refreshList();
                    }
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-300"
                >
                  Clear history
                </button>
              ) : null}
            </div>
          </>
        )}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close history"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(18rem,90vw)] flex-col bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
              <span className="text-sm font-semibold text-slate-200">History</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <HistoryList
                entries={entries}
                currentHref={currentHref}
                pathname={pathname}
                cacheMeta={cacheMeta}
                onNavigate={() => setMobileOpen(false)}
                onRemove={(id) => {
                  removeHistory(id);
                  refreshList();
                }}
                onRefresh={(e) => void onRefreshEntry(e)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HistorySidebar() {
  return (
    <Suspense
      fallback={
        <div className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-950 md:block" />
      }
    >
      <HistorySidebarInner />
    </Suspense>
  );
}
