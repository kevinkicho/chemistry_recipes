"use client";

import { useMemo, useState } from "react";
import type { PatentHit } from "@/lib/api/patentsView";
import {
  EvidenceDataTableChrome,
  evidenceFilterChipClass,
} from "@/components/EvidenceDataTable";
import {
  attachLiteratureHitsToCid,
  attachOneLiteratureHitToCid,
  patentHitToLiterature,
  rematerializeCachesWithLocalPastes,
} from "@/lib/frontier/literatureToPaste";

type SortKey = "date" | "number" | "title" | "assignee" | "process";
type SortDir = "asc" | "desc";
type TagFilter = "all" | "process" | "other";

const PROCESS_RE =
  /synthes|manufactur|process|preparat|method of|composition|formulation|crystal|isolation|production|biocatal|ferment|industrial|scale/i;

function isProcessy(p: PatentHit): boolean {
  return PROCESS_RE.test(`${p.title} ${p.abstract || ""}`);
}

function dateKey(d?: string): number {
  if (!d) return 0;
  const t = Date.parse(d);
  if (Number.isFinite(t)) return t;
  const y = parseInt(d.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
}

/**
 * Clickable patents table: search, sort, filter (process vs other).
 * Optional CID enables densify paste from public procedure windows.
 */
export function PatentsTable({
  hits,
  cid,
  onPasteAttached,
}: {
  hits: PatentHit[];
  cid?: number;
  onPasteAttached?: (info: {
    attached: number;
    chars: number;
    single?: boolean;
  }) => void;
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<TagFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("process");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);

  const counts = useMemo(() => {
    let process = 0;
    let other = 0;
    for (const h of hits) {
      if (isProcessy(h)) process++;
      else other++;
    }
    return { all: hits.length, process, other };
  }, [hits]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = hits;
    if (tag === "process") list = list.filter(isProcessy);
    else if (tag === "other") list = list.filter((h) => !isProcessy(h));

    if (ql) {
      list = list.filter((h) => {
        const hay = [
          h.title,
          h.abstract,
          h.patentNumber,
          h.date,
          ...(h.assignees || []),
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
      if (sortKey === "date") cmp = dateKey(a.date) - dateKey(b.date);
      else if (sortKey === "number") {
        cmp = (a.patentNumber || "").localeCompare(b.patentNumber || "", undefined, {
          numeric: true,
        });
      } else if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "assignee") {
        cmp = (a.assignees?.[0] || "").localeCompare(b.assignees?.[0] || "");
      } else {
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
      setSortDir(key === "date" || key === "process" ? "desc" : "asc");
    }
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const selected = selectedId
    ? hits.find((h) => h.id === selectedId) || null
    : null;

  async function pasteOne(p: PatentHit) {
    if (!cid || cid <= 0) return;
    setPasteBusy(true);
    setPasteMsg(null);
    try {
      const res = await attachOneLiteratureHitToCid(
        cid,
        patentHitToLiterature(p)
      );
      setPasteMsg(
        res.attached
          ? `Pasted ${p.patentNumber || "patent"} · ${res.totalChars.toLocaleString()} chars` +
              (res.rematerialized ? " · cache rematerialized" : "")
          : "Could not paste (need procedure/abstract text)"
      );
      if (res.attached) {
        onPasteAttached?.({
          attached: res.attached,
          chars: res.totalChars,
          single: true,
        });
      }
    } catch (e) {
      setPasteMsg(e instanceof Error ? e.message : "Paste failed");
    } finally {
      setPasteBusy(false);
    }
  }

  async function pasteProcessBatch() {
    if (!cid || cid <= 0) return;
    setPasteBusy(true);
    setPasteMsg(null);
    try {
      const processHits = hits.filter(isProcessy);
      const lit = (processHits.length ? processHits : hits).map(
        patentHitToLiterature
      );
      const res = attachLiteratureHitsToCid(cid, lit, {
        max: 5,
        minChars: 60,
        minScore: 2,
      });
      if (res.attached > 0) {
        await rematerializeCachesWithLocalPastes([cid]);
      }
      setPasteMsg(
        res.attached
          ? `Attached ${res.attached} process patent(s) · ${res.totalChars.toLocaleString()} chars`
          : "No procedure-rich patent text to attach"
      );
      if (res.attached) {
        onPasteAttached?.({
          attached: res.attached,
          chars: res.totalChars,
          single: false,
        });
      }
    } catch (e) {
      setPasteMsg(e instanceof Error ? e.message : "Batch paste failed");
    } finally {
      setPasteBusy(false);
    }
  }

  if (hits.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No patent hits for this capture.
      </p>
    );
  }

  const filterChips = (
    <>
      {(
        [
          ["all", "All"],
          ["process", "Process"],
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
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition ${evidenceFilterChipClass(active, "orange")}`}
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
      {cid ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pasteBusy}
            onClick={() => void pasteProcessBatch()}
            className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-100 hover:bg-orange-500/20 disabled:opacity-40"
          >
            {pasteBusy ? "Attaching…" : "Paste process patents → densify"}
          </button>
          <span className="text-[10px] text-slate-600">
            Public procedure windows / abstracts only · not GMP
          </span>
        </div>
      ) : null}
      {pasteMsg ? (
        <p className="text-[11px] text-orange-100/90" role="status">
          {pasteMsg}
        </p>
      ) : null}
      <EvidenceDataTableChrome
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search title, number, assignee, abstract…"
        filterChips={filterChips}
        countLabel={
          <>
            Showing{" "}
            <span className="font-medium text-slate-400">{filtered.length}</span> of{" "}
            {hits.length} · click row to expand · open patent when linked
          </>
        }
        accent="orange"
      >
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
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
                  onClick={() => toggleSort("number")}
                >
                  Number{sortMark("number")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("date")}
                >
                  Date{sortMark("date")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("assignee")}
                >
                  Assignee{sortMark("assignee")}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.map((p) => {
              const isSel = selectedId === p.id;
              const processy = isProcessy(p);
              return (
                <tr
                  key={p.id}
                  className={`cursor-pointer transition ${
                    isSel
                      ? "bg-orange-500/10"
                      : "bg-slate-950/40 hover:bg-slate-900/80"
                  }`}
                  onClick={() => setSelectedId(isSel ? null : p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(isSel ? null : p.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isSel}
                >
                  <td className="px-3 py-2.5 align-top">
                    {processy ? (
                      <span className="inline-flex rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-100 ring-1 ring-inset ring-orange-500/30">
                        process
                      </span>
                    ) : (
                      <span className="inline-flex rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-inset ring-slate-700">
                        other
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono text-xs text-orange-200/80">
                    {p.patentNumber || "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono text-xs tabular-nums text-slate-500">
                    {p.date || "—"}
                  </td>
                  <td className="max-w-[8rem] truncate px-3 py-2.5 align-top text-xs text-slate-500">
                    {p.assignees?.length ? p.assignees.join("; ") : "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top text-slate-200">
                    <span className={isSel ? "" : "line-clamp-2"}>{p.title}</span>
                    {isSel && p.abstract ? (
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        {p.abstract}
                      </p>
                    ) : null}
                    {isSel ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-orange-300 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open patent →
                      </a>
                    ) : null}
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
                  No patents match this search / filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </EvidenceDataTableChrome>

      {selected ? (
        <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3 text-sm text-slate-300">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {isProcessy(selected) ? (
              <span className="rounded bg-orange-500/15 px-1.5 py-0.5 font-semibold text-orange-100 ring-1 ring-inset ring-orange-500/30">
                process
              </span>
            ) : null}
            <span className="font-mono text-orange-200/80">
              {selected.patentNumber}
            </span>
            <span>{selected.date || "—"}</span>
            {selected.assignees?.length ? (
              <span className="truncate max-w-[16rem]">
                {selected.assignees.join("; ")}
              </span>
            ) : null}
          </div>
          <h3 className="mt-2 font-medium text-slate-100">{selected.title}</h3>
          {selected.abstract ? (
            <p className="mt-2 leading-relaxed text-slate-400">{selected.abstract}</p>
          ) : (
            <p className="mt-2 text-xs text-slate-600">No abstract in this capture.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {cid ? (
              <button
                type="button"
                disabled={pasteBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  void pasteOne(selected);
                }}
                className="rounded-lg bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-500 disabled:opacity-40"
              >
                Paste this patent → densify
              </button>
            ) : null}
            <a
              href={selected.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs font-medium text-orange-300 hover:underline"
            >
              Open patent in new tab →
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
