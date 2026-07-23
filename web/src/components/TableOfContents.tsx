"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { matchExampleId, matchPubchemCid } from "@/lib/routes";

export interface TocLink {
  id: string;
  href: string;
  label: string;
}

/**
 * Canonical section anchors on live + example molecule pages.
 * Only links whose targets exist in the DOM are shown.
 */
const LIVE_SECTIONS: Omit<TocLink, "href">[] = [
  { id: "identity", label: "Identity" },
  { id: "structure", label: "Structure" },
  { id: "overview", label: "Overview" },
  { id: "critical-board", label: "Critical parameters" },
  { id: "process-parameters", label: "Process parameters" },
  { id: "routes", label: "Routes & steps" },
  { id: "route-compare", label: "Route compare" },
  { id: "contradictions", label: "Evidence tensions" },
  { id: "unit-op-fill", label: "Modality slots" },
  { id: "modality-template", label: "Modality template" },
  { id: "related-entities", label: "Related entities" },
  { id: "pubchem-manufacturing", label: "Use & manufacturing" },
  { id: "manufacturing", label: "Manufacturing summary" },
  { id: "environment", label: "Environment" },
  { id: "apparatus", label: "Apparatus" },
  { id: "ehs", label: "EHS" },
  { id: "hazards", label: "Hazards" },
  { id: "properties", label: "Properties" },
  { id: "literature", label: "Literature" },
  { id: "patents", label: "Patents" },
  { id: "build-audit", label: "Build audit" },
  { id: "sources", label: "Sources" },
  { id: "disclaimer", label: "Disclaimer" },
];

const EXAMPLE_SECTIONS: Omit<TocLink, "href">[] = [
  { id: "identity", label: "Identity" },
  { id: "structure", label: "Structure" },
  { id: "overview", label: "Overview" },
  { id: "critical-board", label: "Critical parameters" },
  { id: "process-parameters", label: "Process parameters" },
  { id: "routes", label: "Routes & steps" },
  { id: "route-compare", label: "Route compare" },
  { id: "related-entities", label: "Related entities" },
  { id: "manufacturing", label: "Manufacturing summary" },
  { id: "environment", label: "Environment" },
  { id: "apparatus", label: "Apparatus" },
  { id: "ehs", label: "EHS" },
  { id: "hazards", label: "Hazards" },
  { id: "properties", label: "Properties" },
  { id: "sources", label: "Sources" },
  { id: "disclaimer", label: "Disclaimer" },
];

function collectPresentSections(
  candidates: Omit<TocLink, "href">[]
): TocLink[] {
  if (typeof document === "undefined") return [];
  return candidates
    .filter((c) => document.getElementById(c.id) != null)
    .map((c) => ({ ...c, href: `#${c.id}` }));
}

function scrollToSection(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    window.history.replaceState(null, "", `#${id}`);
  } catch {
    /* ignore */
  }
  return true;
}

/**
 * Table of contents — only on molecule/compound and example views.
 * Discovers which section ids are actually in the page (client-loaded dossiers).
 */
function TocInner() {
  const pathname = usePathname() || "/";
  const cid = matchPubchemCid(pathname);
  const exampleId = matchExampleId(pathname);
  const [hash, setHash] = useState("");
  const [items, setItems] = useState<TocLink[]>([]);
  const onMoleculePage = Boolean(cid || exampleId);
  const candidates = exampleId ? EXAMPLE_SECTIONS : LIVE_SECTIONS;

  const refreshItems = useCallback(() => {
    if (!onMoleculePage) {
      setItems([]);
      return;
    }
    setItems(collectPresentSections(candidates));
  }, [onMoleculePage, candidates]);

  useEffect(() => {
    if (!onMoleculePage) {
      setItems([]);
      return;
    }

    const syncHash = () => setHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);

    // Dossier body mounts asynchronously (cache / SSE) — watch for section nodes
    refreshItems();
    const root = document.querySelector("main") ?? document.body;
    const mo = new MutationObserver(() => refreshItems());
    mo.observe(root, { childList: true, subtree: true });

    // Also re-check a few times after navigation (IndexedDB / stream)
    const t1 = window.setTimeout(refreshItems, 200);
    const t2 = window.setTimeout(refreshItems, 800);
    const t3 = window.setTimeout(refreshItems, 2000);

    // If URL already has a hash, scroll once sections exist
    const tryInitialHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h && document.getElementById(h)) {
        scrollToSection(h);
        setHash(`#${h}`);
      }
    };
    const tHash = window.setTimeout(tryInitialHash, 300);

    return () => {
      window.removeEventListener("hashchange", syncHash);
      mo.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(tHash);
    };
  }, [onMoleculePage, pathname, refreshItems]);

  if (!onMoleculePage) return null;

  return (
    <aside
      className="app-sticky-under-header sticky hidden w-52 shrink-0 flex-col border-r border-slate-800/60 bg-slate-950/80 lg:flex xl:w-56"
      aria-label="Table of contents"
    >
      <div className="px-3 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Contents
        </div>
        <div className="text-[10px] text-slate-600">
          {exampleId ? `Example · ${exampleId}` : `Live dossier · CID ${cid}`}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {items.length === 0 ? (
          <p className="px-2 text-[11px] leading-relaxed text-slate-600">
            Sections appear when the dossier body finishes loading…
          </p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const isActive =
                hash === item.href || (!hash && item.id === "identity");
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    onClick={(e) => {
                      e.preventDefault();
                      if (scrollToSection(item.id)) {
                        setHash(item.href);
                      } else {
                        // Retry shortly (section still mounting)
                        window.setTimeout(() => {
                          if (scrollToSection(item.id)) setHash(item.href);
                        }, 100);
                      }
                    }}
                    className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-teal-500/15 text-teal-200"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}

/**
 * Invisible spacer matching TOC width on the right of main.
 * Offsets the canvas so max-w content stays center-aligned in the viewer.
 */
function TocBalanceInner() {
  const pathname = usePathname() || "/";
  const show =
    Boolean(matchPubchemCid(pathname)) || Boolean(matchExampleId(pathname));
  if (!show) return null;

  return (
    <div
      className="hidden w-52 shrink-0 lg:block xl:w-56"
      aria-hidden
      data-toc-balance=""
    />
  );
}

export function TableOfContents() {
  return (
    <Suspense fallback={null}>
      <TocInner />
    </Suspense>
  );
}

export function TocBalanceSpacer() {
  return (
    <Suspense fallback={null}>
      <TocBalanceInner />
    </Suspense>
  );
}
