"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TOC_NAVIGATE_EVENT } from "@/lib/tocNavigate";

/**
 * Secondary dossier sections. Prefer defaultOpen when the section has
 * real data so deployed pages do not look "empty" when collapsed.
 * TOC uses data-toc-empty to dim anchors with no content.
 */
export function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
  badge,
  /** When true, section starts open (also re-syncs if defaultOpen flips true after load). */
  forceOpenWhen = false,
  /**
   * Whether this section has real content for TOC enablement.
   * Defaults to forceOpenWhen || defaultOpen when omitted.
   */
  hasContent,
}: {
  id?: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: string;
  forceOpenWhen?: boolean;
  hasContent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || forceOpenWhen);
  const [userToggled, setUserToggled] = useState(false);

  // If data arrives after mount and user hasn't toggled, open to show content
  const effectiveOpen = open || (!userToggled && forceOpenWhen);
  const contentful = hasContent ?? Boolean(forceOpenWhen || defaultOpen);

  // Expand when TOC (or in-page jump) targets this section
  useEffect(() => {
    if (!id) return;
    const onNav = (ev: Event) => {
      const detail = (ev as CustomEvent<{ id?: string }>).detail;
      if (detail?.id !== id) return;
      setUserToggled(true);
      setOpen(true);
    };
    window.addEventListener(TOC_NAVIGATE_EVENT, onNav);
    return () => window.removeEventListener(TOC_NAVIGATE_EVENT, onNav);
  }, [id]);

  return (
    <section
      id={id}
      className="scroll-mt-24"
      data-toc-section={id || undefined}
      data-toc-empty={contentful ? "0" : "1"}
    >
      <button
        type="button"
        onClick={() => {
          setUserToggled(true);
          setOpen(!effectiveOpen);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left transition hover:border-slate-700"
        aria-expanded={effectiveOpen}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{title}</span>
            {badge ? (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                {badge}
              </span>
            ) : null}
            {!contentful ? (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-800">
                empty
              </span>
            ) : null}
          </div>
          {summary && !effectiveOpen ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">{summary}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-slate-500" aria-hidden>
          {effectiveOpen ? "▴" : "▾"}
        </span>
      </button>
      {effectiveOpen ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
