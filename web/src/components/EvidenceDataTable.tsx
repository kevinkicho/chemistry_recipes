"use client";

import type { ReactNode } from "react";

/**
 * Shared chrome for evidence list tables (manufacturing, literature, patents).
 * Search + filter chips + sticky header table shell.
 */
export function EvidenceDataTableChrome({
  search,
  onSearch,
  searchPlaceholder,
  filterChips,
  countLabel,
  children,
  accent = "teal",
}: {
  search: string;
  onSearch: (q: string) => void;
  searchPlaceholder: string;
  filterChips: ReactNode;
  countLabel: ReactNode;
  children: ReactNode;
  accent?: "teal" | "orange";
}) {
  const focusRing =
    accent === "orange"
      ? "focus:border-orange-500/40 focus:ring-orange-500/30"
      : "focus:border-teal-500/50 focus:ring-teal-500/40";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative min-w-[12rem] flex-1">
          <span className="sr-only">Search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 ${focusRing}`}
          />
        </label>
        <div className="flex flex-wrap gap-1.5">{filterChips}</div>
      </div>
      <p className="text-[11px] text-slate-600">{countLabel}</p>
      <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-800">
        {children}
      </div>
    </div>
  );
}

export function evidenceFilterChipClass(
  active: boolean,
  accent: "teal" | "orange" = "teal"
): string {
  if (active) {
    return accent === "orange"
      ? "bg-orange-500/20 text-orange-100 ring-orange-400/40"
      : "bg-teal-500/20 text-teal-100 ring-teal-400/40";
  }
  return "bg-slate-900 text-slate-400 ring-slate-700 hover:text-slate-200";
}
