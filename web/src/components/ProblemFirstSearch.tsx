"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PROBLEM_SEARCH_HINTS,
  searchProblemFirst,
} from "@/lib/search/problemFirst";
import { routes } from "@/lib/routes";

/**
 * Home / search entry: problem or unit-op first (not only molecule name).
 */
export function ProblemFirstSearch() {
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchProblemFirst(q, 12), [q]);

  return (
    <div
      id="problem-first-search"
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/90">
        Problem / unit-op search
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-50">
        Start from the process problem
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Rank training packages + hub molecules by unit op or problem language (e.g.
        crystallization, mAb capture). Molecule name search still works below.
      </p>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. hydrogenation · workup · gene therapy downstream"
        className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {PROBLEM_SEARCH_HINTS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setQ(h)}
            className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700 hover:text-sky-200"
          >
            {h}
          </button>
        ))}
      </div>
      {q.trim() ? (
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
          {hits.length === 0 ? (
            <li className="text-xs text-slate-600">
              No hub/package match — try{" "}
              <Link href={routes.search(q)} className="text-teal-400 hover:underline">
                live molecule search
              </Link>
              .
            </li>
          ) : (
            hits.map((h) => (
              <li key={h.id}>
                <Link
                  href={h.href}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 hover:border-sky-500/30"
                >
                  <span>
                    <span className="text-sm font-medium text-slate-100">{h.title}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {h.subtitle}
                    </span>
                  </span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                    {h.kind}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
