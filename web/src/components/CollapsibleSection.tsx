"use client";

import { useState, type ReactNode } from "react";

/**
 * Secondary dossier sections (params, unit-ops, evidence feeds) —
 * collapsed by default so the recipe stays primary.
 */
export function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
  badge,
}: {
  id?: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="scroll-mt-24">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left transition hover:border-slate-700"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">{title}</span>
            {badge ? (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                {badge}
              </span>
            ) : null}
          </div>
          {summary && !open ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">{summary}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-slate-500" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
