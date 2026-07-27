"use client";

import { useMemo, useState } from "react";
import {
  EvidenceDataTableChrome,
  evidenceFilterChipClass,
} from "@/components/EvidenceDataTable";

export type MfgTextKind =
  | "use"
  | "manufacturing"
  | "process-fact"
  | "literature"
  | "description"
  | "other";

export type MfgTextRow = {
  id: string;
  kind: MfgTextKind;
  source: string;
  text: string;
  /** External link when available (PubChem section, paper URL, etc.) */
  href?: string;
  chars: number;
};

const KIND_LABEL: Record<MfgTextKind, string> = {
  use: "Use",
  manufacturing: "Manufacturing",
  "process-fact": "Process fact",
  literature: "Literature",
  description: "Description",
  other: "Other",
};

const KIND_STYLE: Record<MfgTextKind, string> = {
  use: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  manufacturing: "bg-teal-500/15 text-teal-200 ring-teal-500/30",
  "process-fact": "bg-violet-500/15 text-violet-200 ring-violet-500/30",
  literature: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
  description: "bg-slate-700/40 text-slate-300 ring-slate-600",
  other: "bg-slate-800 text-slate-400 ring-slate-700",
};

type SortKey = "kind" | "source" | "chars" | "text";
type SortDir = "asc" | "desc";

function classifyPlainText(t: string): { kind: MfgTextKind; source: string; text: string } {
  const m = t.match(/^([^:]{2,40}):\s+([\s\S]+)$/);
  if (m) {
    const source = m[1].trim();
    const body = m[2].trim();
    const sl = source.toLowerCase();
    if (sl.includes("literature") || sl.includes("pmc") || sl.includes("pubmed")) {
      return { kind: "literature", source, text: body };
    }
    if (sl.includes("patent") || sl.includes("process") || sl.includes("fact")) {
      return { kind: "process-fact", source, text: body };
    }
    return { kind: "other", source, text: body };
  }
  if (/^use\b|application|indication|consumer|industrial use/i.test(t)) {
    return { kind: "use", source: "PubChem", text: t };
  }
  if (/manufactur|preparat|synthesis|production|process/i.test(t)) {
    return { kind: "manufacturing", source: "PubChem", text: t };
  }
  return { kind: "other", source: "Public", text: t };
}

export function rowsFromPlainTexts(
  texts: string[],
  opts?: { defaultHref?: string }
): MfgTextRow[] {
  return texts.map((t, i) => {
    const c = classifyPlainText(t);
    return {
      id: `mfg-${i}`,
      kind: c.kind,
      source: c.source,
      text: c.text,
      href: opts?.defaultHref,
      chars: c.text.length,
    };
  });
}

/**
 * Clickable table list for public manufacturing / use excerpts.
 * Sortable columns, text search, kind filter.
 */
export function ManufacturingTextTable({
  rows: inputRows,
  emptyHref,
}: {
  rows: MfgTextRow[];
  /** Fallback link when a row has no href (e.g. PubChem Use & Manufacturing) */
  emptyHref?: string;
}) {
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<MfgTextKind | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("kind");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kindCounts = useMemo(() => {
    const m = new Map<MfgTextKind | "all", number>();
    m.set("all", inputRows.length);
    for (const r of inputRows) {
      m.set(r.kind, (m.get(r.kind) || 0) + 1);
    }
    return m;
  }, [inputRows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = inputRows;
    if (kindFilter !== "all") {
      list = list.filter((r) => r.kind === kindFilter);
    }
    if (ql) {
      list = list.filter(
        (r) =>
          r.text.toLowerCase().includes(ql) ||
          r.source.toLowerCase().includes(ql) ||
          KIND_LABEL[r.kind].toLowerCase().includes(ql)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "chars") cmp = a.chars - b.chars;
      else if (sortKey === "kind") {
        cmp = KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind]);
      } else if (sortKey === "source") {
        cmp = a.source.localeCompare(b.source);
      } else {
        cmp = a.text.localeCompare(b.text);
      }
      return cmp * dir;
    });
  }, [inputRows, q, kindFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "chars" ? "desc" : "asc");
    }
  }

  function sortMark(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const selected = selectedId
    ? inputRows.find((r) => r.id === selectedId) || null
    : null;

  if (inputRows.length === 0) {
    return (
      <div className="space-y-2 text-sm text-slate-500">
        <p>No public manufacturing / use excerpts in this capture.</p>
        {emptyHref ? (
          <a
            href={emptyHref}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-teal-400 hover:underline"
          >
            Open PubChem Use &amp; Manufacturing →
          </a>
        ) : null}
      </div>
    );
  }

  const filterChips = (
    <>
      {(
        [
          "all",
          "use",
          "manufacturing",
          "process-fact",
          "literature",
          "description",
          "other",
        ] as const
      ).map((k) => {
        const n = kindCounts.get(k) || 0;
        if (k !== "all" && n === 0) return null;
        const active = kindFilter === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition ${evidenceFilterChipClass(active, "teal")}`}
          >
            {k === "all" ? "All" : KIND_LABEL[k]}
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
        searchPlaceholder="Search text, source…"
        filterChips={filterChips}
        countLabel={
          <>
            Showing{" "}
            <span className="font-medium text-slate-400">{filtered.length}</span> of{" "}
            {inputRows.length} · click a row to expand · open source when linked
          </>
        }
        accent="teal"
      >
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
            <tr className="border-b border-slate-800">
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("kind")}
                >
                  Type{sortMark("kind")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("source")}
                >
                  Source{sortMark("source")}
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("text")}
                >
                  Excerpt{sortMark("text")}
                </button>
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">
                <button
                  type="button"
                  className="hover:text-slate-300"
                  onClick={() => toggleSort("chars")}
                >
                  Chars{sortMark("chars")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.map((r) => {
              const isSel = selectedId === r.id;
              const href = r.href || emptyHref;
              return (
                <tr
                  key={r.id}
                  className={`cursor-pointer transition ${
                    isSel
                      ? "bg-teal-500/10"
                      : "bg-slate-950/40 hover:bg-slate-900/80"
                  }`}
                  onClick={() => setSelectedId(isSel ? null : r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(isSel ? null : r.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isSel}
                >
                  <td className="px-3 py-2.5 align-top">
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${KIND_STYLE[r.kind]}`}
                    >
                      {KIND_LABEL[r.kind]}
                    </span>
                  </td>
                  <td className="max-w-[8rem] truncate px-3 py-2.5 align-top text-xs text-slate-400">
                    {r.source}
                  </td>
                  <td className="px-3 py-2.5 align-top text-slate-300">
                    <span className={isSel ? "whitespace-pre-wrap" : "line-clamp-2"}>
                      {r.text}
                    </span>
                    {isSel && href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-teal-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open source →
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top font-mono text-xs tabular-nums text-slate-600">
                    {r.chars}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-sm text-slate-500"
                >
                  No rows match this search / filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </EvidenceDataTableChrome>

      {selected ? (
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3 text-sm text-slate-300">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span
              className={`rounded px-1.5 py-0.5 font-semibold ring-1 ring-inset ${KIND_STYLE[selected.kind]}`}
            >
              {KIND_LABEL[selected.kind]}
            </span>
            <span>{selected.source}</span>
            <span className="font-mono">{selected.chars} chars</span>
          </div>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">{selected.text}</p>
          {(selected.href || emptyHref) && (
            <a
              href={selected.href || emptyHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-medium text-teal-400 hover:underline"
            >
              Open source in new tab →
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}
