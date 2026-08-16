"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { matchPubchemCid } from "@/lib/routes";
import {
  assessTocSection,
  navigateToSection,
} from "@/lib/tocNavigate";

export interface TocLink {
  id: string;
  href: string;
  label: string;
  /** Section node exists in the DOM */
  present: boolean;
  /** Section has real content (not empty placeholder) */
  hasContent: boolean;
  /** Clickable — present and has content */
  enabled: boolean;
}

// Re-export for callers that imported from this module
export { navigateToSection, assessTocSection, TOC_NAVIGATE_EVENT } from "@/lib/tocNavigate";

/**
 * Canonical section anchors on live compound pages.
 * Always listed; empty/missing targets are dimmed and disabled.
 */
const LIVE_SECTIONS: Omit<TocLink, "href" | "present" | "hasContent" | "enabled">[] = [
  { id: "identity", label: "Identity" },
  { id: "structure", label: "Structure" },
  { id: "overview", label: "Overview" },
  { id: "process-framing", label: "Framing" },
  { id: "critical-board", label: "Control points" },
  { id: "process-parameters", label: "Parameters" },
  { id: "routes", label: "Process recipe" },
  { id: "route-compare", label: "Route compare" },
  { id: "related-entities", label: "Related entities" },
  { id: "unit-op-fill", label: "Modality slots" },
  { id: "industry-briefs", label: "Industry briefs" },
  { id: "frontier-science", label: "Frontier science" },
  { id: "multi-source", label: "Multi-source APIs" },
  { id: "contradictions", label: "Evidence tensions" },
  { id: "pubchem-manufacturing", label: "Manufacturing text" },
  { id: "literature", label: "Literature" },
  { id: "patents", label: "Patents" },
  { id: "manufacturing", label: "Manufacturing summary" },
  { id: "environment", label: "Environment" },
  { id: "apparatus", label: "Apparatus" },
  { id: "ehs", label: "EHS" },
  { id: "hazards", label: "Hazards" },
  { id: "properties", label: "Properties" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "build-audit", label: "Build audit" },
  { id: "sources", label: "Sources" },
  { id: "disclaimer", label: "Disclaimer" },
];

function collectSections(
  candidates: Omit<TocLink, "href" | "present" | "hasContent" | "enabled">[]
): TocLink[] {
  return candidates.map((c) => {
    const { present, hasContent } = assessTocSection(c.id);
    return {
      ...c,
      href: `#${c.id}`,
      present,
      hasContent,
      enabled: present && hasContent,
    };
  });
}

/**
 * Table of contents — only on live PubChem compound views.
 * Lists all canonical sections; missing/empty ones are dimmed and non-interactive.
 */
function TocInner() {
  const pathname = usePathname() || "/";
  const cid = matchPubchemCid(pathname);
  const [hash, setHash] = useState("");
  const [items, setItems] = useState<TocLink[]>([]);
  const onMoleculePage = Boolean(cid);
  const candidates = LIVE_SECTIONS;

  const refreshItems = useCallback(() => {
    if (!onMoleculePage) {
      setItems([]);
      return;
    }
    setItems(collectSections(candidates));
  }, [onMoleculePage, candidates]);

  useEffect(() => {
    if (!onMoleculePage) {
      setItems([]);
      return;
    }

    const syncHash = () => setHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);

    refreshItems();
    const root = document.querySelector("main") ?? document.body;
    const mo = new MutationObserver(() => {
      window.requestAnimationFrame(refreshItems);
    });
    mo.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-toc-empty", "id", "hidden"],
    });

    const t1 = window.setTimeout(refreshItems, 200);
    const t2 = window.setTimeout(refreshItems, 800);
    const t3 = window.setTimeout(refreshItems, 2000);
    const t4 = window.setTimeout(refreshItems, 5000);

    const tryInitialHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (!h) return;
      if (document.getElementById(h)) {
        navigateToSection(h);
        setHash(`#${h}`);
      }
    };
    const tHash = window.setTimeout(tryInitialHash, 400);

    return () => {
      window.removeEventListener("hashchange", syncHash);
      mo.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(tHash);
    };
  }, [onMoleculePage, pathname, refreshItems]);

  if (!onMoleculePage) return null;

  const enabledCount = items.filter((i) => i.enabled).length;

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
          {`Live dossier · CID ${cid}`}
        </div>
        {items.length > 0 ? (
          <div className="mt-1 text-[10px] tabular-nums text-slate-600">
            {enabledCount}/{items.length} with content
          </div>
        ) : null}
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
                item.enabled &&
                (hash === item.href || (!hash && item.id === "identity"));
              const title = !item.present
                ? "Section not on this page (role view or still loading)"
                : !item.hasContent
                  ? "No content for this section yet"
                  : item.label;

              return (
                <li key={item.id}>
                  {item.enabled ? (
                    <a
                      href={item.href}
                      title={title}
                      onClick={(e) => {
                        e.preventDefault();
                        if (navigateToSection(item.id)) {
                          setHash(item.href);
                        } else {
                          window.setTimeout(() => {
                            if (navigateToSection(item.id)) {
                              setHash(item.href);
                            }
                          }, 120);
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
                  ) : (
                    <span
                      title={title}
                      aria-disabled="true"
                      className="block cursor-not-allowed select-none rounded-md px-2 py-1.5 text-sm text-slate-500 opacity-30"
                    >
                      {item.label}
                    </span>
                  )}
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
    Boolean(matchPubchemCid(pathname));
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
