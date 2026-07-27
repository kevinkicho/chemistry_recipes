"use client";

import { useMemo, useState } from "react";
import type { LiteratureHit } from "@/lib/api/europePmc";
import {
  EvidenceDataTableChrome,
  evidenceFilterChipClass,
} from "@/components/EvidenceDataTable";

type SortKey = "year" | "journal" | "title" | "process" | "source";
type SortDir = "asc" | "desc";
type TagFilter = "all" | "process" | "open-access" | "other";

const PROCESS_RE =
  /synthes|manufactur|process|ferment|preparat|industrial|scale|product|biocatal|route|catalys|crystal|isolation|plant|production/i;

function isProcessy(h: LiteratureHit): boolean {
  return PROCESS_RE.test(`${h.title} ${h.abstract || ""}`);
}

function yearNum(y?: string): number {
  if (!y) return 0;
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Clickable literature table: search, sort, filter (process / OA).
 */
export function LiteratureTable({ hits }: { hits: LiteratureHit[] }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<TagFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("process");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let process = 0;
    let oa = 0;
    let other = 0;
    for (const h of hits) {
      const p = isProcessy(h);
      if (p) process++;
      else other++;
      if (h.isOpenAccess) oa++;
    }
    return { all: hits.length, process, "open-access": oa, other };
  }, [hits]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = hits;
    if (tag === "process") list = list.filter(isProcessy);
    else if (tag === "open-access") list = list.filter((h) => h.isOpenAccess);
    else if (tag === "other") list = list.filter((h) => !isProcessy(h));

    if (ql) {
      list = list.filter((h) => {
        const hay = [
          h.title,
          h.abstract,
          h.authors,
          h.journal,
          h.year,
          h.doi,
          h.pmid,
          h.source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(ql);
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "year") cmp = yearNum(a.year) - yearNum(b.year);
      else if (sortKey === "journal") {
        cmp = (a.journal || "").localeCompare(b.journal || "");
      } else if (sortKey === "title") {
        cmp = a.title.localeCompare(b.title);
      } else if (sortKey === "source") {
        cmp = (a.source || "").localeCompare(b.source || "");
      } else {
        // process first when desc
        cmp = Number(isProcessy(a)) - Number(isProcessy(b));
      }
      if (cmp === 0) cmp = a.title.localeCompare(b.title);
      return cmp * dir;
    });
  }, [hits, q, tag, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "year" || key === "process" ? "desc" : "asc");
    }
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const selected = selectedId
    ? hits.find((h) => h.id === selectedId) || null
    : null;

  if (hits.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No literature hits for this capture.
      </p>
    );
  }

  const filterChips = (
    <>
      {(
        [
          ["all", "All"],
          ["process", "Process"],
          ["open-access", "Open access"],
          ["other", "Other"],
        ] as const
      ).map(([k, label]) => {
        const n = counts[k];
        if (k !== "all" && n === 0) return null;
        const active = tag === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => setTag(k)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition ${evidenceFilterChipClass(active, "teal")}`}
          >
            {label}
            <span className="ml-1 tabular-nums text-slate-500">{n}</span>
          </button>
        );
      })}
    </>
  );

  return (
    <div className="space-y-3">
      <EvidenceDataTableChrome
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search title, abstract, journal, authors…"
        filterChips={filterChips}
        countLabel={
          <>
            Showing{" "}
            <span className="font-medium text-slate-400">{filtered.length}</span> of{" "}
            {hits.length} · click row to expand · open paper when linked
          </>
        }
        accent="teal"
      >
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-800">
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("process")}
                >
                  Tag{sortMark("process")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("year")}
                >
                  Year{sortMark("year")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("journal")}
                >
                  Journal{sortMark("journal")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("title")}
                >
                  Title{sortMark("title")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("source")}
                >
                  Src{sortMark("source")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.map((h) => {
              const isSel = selectedId === h.id;
              const processy = isProcessy(h);
              return (
                <tr
                  key={h.id}
                  className={`cursor-pointer transition ${
                    isSel
                      ? "bg-teal-500/10"
                      : "bg-slate-950/40 hover:bg-slate-900/80"
                  }`}
                  onClick={() => setSelectedId(isSel ? null : h.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(isSel ? null : h.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isSel}
                >
                  <td className="px-3 py-2.5 align-top">
                    <div className="flex flex-col gap-1">
                      {processy ? (
                        <span className="inline-flex w-fit rounded bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal-200 ring-1 ring-inset ring-teal-500/30">
                          process
                        </span>
                      ) : (
                        <span className="inline-flex w-fit rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-inset ring-slate-700">
                          other
                        </span>
                      )}
                      {h.isOpenAccess ? (
                        <span className="inline-flex w-fit rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200/90 ring-1 ring-inset ring-emerald-500/25">
                          OA
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono text-xs tabular-nums text-slate-400">
                    {h.year || "—"}
                  </td>
                  <td className="max-w-[9rem] truncate px-3 py-2.5 align-top text-xs text-slate-500">
                    {h.journal || "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top text-slate-200">
                    <span className={isSel ? "" : "line-clamp-2"}>{h.title}</span>
                    {isSel && h.authors ? (
                      <p className="mt-1 text-xs text-slate-500">{h.authors}</p>
                    ) : null}
                    {isSel && h.abstract ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        {h.abstract}
                      </p>
                    ) : null}
                    {isSel ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-teal-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open paper →
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top text-[10px] uppercase text-slate-600">
                    {h.source || "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  No papers match this search / filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </EvidenceDataTableChrome>

      {selected ? (
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3 text-sm text-slate-300">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {isProcessy(selected) ? (
              <span className="rounded bg-teal-500/15 px-1.5 py-0.5 font-semibold text-teal-200 ring-1 ring-inset ring-teal-500/30">
                process
              </span>
            ) : null}
            {selected.isOpenAccess ? (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200 ring-1 ring-inset ring-emerald-500/25">
                open access
              </span>
            ) : null}
            <span>{selected.year || "—"}</span>
            <span>{selected.journal || "—"}</span>
            {selected.pmid ? (
              <span className="font-mono">PMID {selected.pmid}</span>
            ) : null}
            {selected.doi ? (
              <span className="font-mono truncate max-w-[14rem]">
                DOI {selected.doi}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-medium text-slate-100">{selected.title}</h3>
          {selected.authors ? (
            <p className="mt-1 text-xs text-slate-500">{selected.authors}</p>
          ) : null}
          {selected.abstract ? (
            <p className="mt-2 leading-relaxed text-slate-400">{selected.abstract}</p>
          ) : (
            <p className="mt-2 text-xs text-slate-600">No abstract in this capture.</p>
          )}
          <a
            href={selected.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-medium text-teal-400 hover:underline"
          >
            Open paper in new tab →
          </a>
        </div>
      ) : null}
    </div>
  );
}
