"use client";

import { useMemo, useState } from "react";
import type { ApiSource, SourcePriority } from "@/lib/sources/registry";

/** IDs currently used in live dossier gather / search / AI feeds */
const WIRED_SOURCE_IDS = new Set([
  "pubchem-pug",
  "pubchem-pug-view",
  "chembl",
  "mychem",
  "openfda",
  "rxnorm",
  "europepmc",
  "europepmc-oa",
  "openalex",
  "crossref",
  "patentsview",
  "europepmc-patents",
  "kegg",
  "rhea",
  "comptox",
  "dailymed",
  "semantic-scholar",
  "ord",
  "pubchem-patents",
  "unichem",
  "chebi",
  "gsrs",
  "pubmed",
  "arxiv",
  "orgsyn",
  "uspto-pubchem-patent",
  "reactome",
  "wikipathways",
  "pathway-commons",
  "massbank",
  "drugcentral",
  "clinicaltrials",
  "pubchem-classification",
]);

/** Sources that materially feed manufacturing recipe density (not just identity). */
const RECIPE_FOCUS_IDS = new Set([
  "pubchem-pug-view",
  "europepmc",
  "europepmc-oa",
  "europepmc-patents",
  "patentsview",
  "pubchem-patents",
  "uspto-pubchem-patent",
  "ord",
  "kegg",
  "rhea",
  "reactome",
  "wikipathways",
  "pathway-commons",
  "openalex",
  "crossref",
  "semantic-scholar",
  "pubmed",
  "arxiv",
  "orgsyn",
  "comptox",
  "massbank",
  "unichem",
  "chebi",
  "gsrs",
  "drugcentral",
  "openfda",
  "dailymed",
  "pubchem-classification",
]);

const PRIORITY_BLURB: Record<SourcePriority, string> = {
  P0: "Core identity & hazards",
  P1: "Reactions, pathways, literature, patents",
  P2: "Regulatory & supporting context",
};

const CATEGORY_LABEL: Record<ApiSource["category"], string> = {
  identity: "Identity",
  hazards: "Hazards",
  reactions: "Reactions",
  pathways: "Pathways",
  literature: "Literature",
  patents: "Patents",
  regulatory: "Regulatory",
  supporting: "Supporting",
};

/**
 * Expandable, column-aligned registry tables for free public API sources.
 */
export function SourcesRegistry({ sources }: { sources: ApiSource[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState("");
  const [wiredOnly, setWiredOnly] = useState(false);
  const [recipeFocus, setRecipeFocus] = useState(false);

  const priorities = ["P0", "P1", "P2"] as const;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return sources.filter((s) => {
      if (wiredOnly && !WIRED_SOURCE_IDS.has(s.id)) return false;
      if (recipeFocus && !RECIPE_FOCUS_IDS.has(s.id)) return false;
      if (!q) return true;
      const hay = [
        s.name,
        s.organization,
        s.role,
        s.category,
        s.endpointUrl,
        s.docsUrl,
        s.notes || "",
        s.id,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sources, filter, wiredOnly, recipeFocus]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAllIn(list: ApiSource[]) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      for (const s of list) next.add(s.id);
      return next;
    });
  }

  function collapseAllIn(list: ApiSource[]) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      for (const s of list) next.delete(s.id);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <label className="min-w-[12rem] flex-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">
            Filter
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Name, org, category, endpoint…"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={recipeFocus}
            onChange={(e) => setRecipeFocus(e.target.checked)}
            className="rounded border-slate-600"
          />
          Recipe-density sources
        </label>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={wiredOnly}
            onChange={(e) => setWiredOnly(e.target.checked)}
            className="rounded border-slate-600 bg-slate-900 text-teal-600"
          />
          Live dossier wired only
        </label>
        <p className="w-full text-[11px] text-slate-600 sm:w-auto sm:pb-2">
          Showing {filtered.length} of {sources.length} · click a row to expand
        </p>
      </div>

      {priorities.map((priority) => {
        const rows = filtered.filter((s) => s.priority === priority);
        if (!rows.length) return null;
        return (
          <section key={priority} id={`priority-${priority.toLowerCase()}`}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-100">
                Priority {priority}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  · {PRIORITY_BLURB[priority]}
                </span>
                <span className="ml-2 text-sm font-normal text-slate-600">
                  ({rows.length})
                </span>
              </h2>
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => expandAllIn(rows)}
                  className="text-slate-500 hover:text-teal-300"
                >
                  Expand all
                </button>
                <span className="text-slate-700">·</span>
                <button
                  type="button"
                  onClick={() => collapseAllIn(rows)}
                  className="text-slate-500 hover:text-teal-300"
                >
                  Collapse all
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-[34%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="bg-slate-900 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-2.5 text-center" scope="col">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="px-3 py-2.5" scope="col">
                      API
                    </th>
                    <th className="px-3 py-2.5" scope="col">
                      Organization
                    </th>
                    <th className="px-3 py-2.5" scope="col">
                      Role
                    </th>
                    <th className="px-3 py-2.5" scope="col">
                      Category
                    </th>
                    <th className="px-3 py-2.5" scope="col">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((s) => {
                    const open = openIds.has(s.id);
                    const wired = WIRED_SOURCE_IDS.has(s.id);
                    return (
                      <SourceRow
                        key={s.id}
                        source={s}
                        open={open}
                        wired={wired}
                        onToggle={() => toggle(s.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No sources match this filter.</p>
      ) : null}
    </div>
  );
}

function SourceRow({
  source: s,
  open,
  wired,
  onToggle,
}: {
  source: ApiSource;
  open: boolean;
  wired: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`cursor-pointer align-middle transition-colors ${
          open ? "bg-slate-900/80" : "bg-slate-950/40 hover:bg-slate-900/50"
        }`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <td className="px-2 py-3 text-center text-slate-500">
          <span className="inline-block w-4 text-xs" aria-hidden>
            {open ? "▾" : "▸"}
          </span>
        </td>
        <td className="truncate px-3 py-3 font-medium text-slate-100" title={s.name}>
          {s.name}
        </td>
        <td
          className="truncate px-3 py-3 text-slate-500"
          title={s.organization}
        >
          {s.organization}
        </td>
        <td className="truncate px-3 py-3 text-slate-400" title={s.role}>
          {s.role}
        </td>
        <td className="px-3 py-3">
          <span className="inline-flex rounded bg-slate-800 px-2 py-0.5 text-[11px] text-teal-300/90">
            {CATEGORY_LABEL[s.category] || s.category}
          </span>
        </td>
        <td className="px-3 py-3">
          {wired ? (
            <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-500/25">
              Live
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-700">
              Registry
            </span>
          )}
        </td>
      </tr>
      {open ? (
        <tr className="bg-slate-900/60">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Source id" mono>
                {s.id}
              </Detail>
              <Detail label="Priority">{s.priority}</Detail>
              <Detail label="Category">
                {CATEGORY_LABEL[s.category]} ({s.category})
              </Detail>
              <Detail label="Organization">{s.organization}</Detail>
              <Detail label="Live dossier">
                {wired
                  ? "Wired into gather / evidence score / AI package"
                  : "Listed for product roadmap — not called in current pipeline"}
              </Detail>
              <Detail label="Full role">
                <span className="whitespace-normal text-slate-300">{s.role}</span>
              </Detail>
              {s.notes ? (
                <Detail label="Notes">
                  <span className="whitespace-normal text-slate-400">{s.notes}</span>
                </Detail>
              ) : null}
              <Detail label="Endpoint URL" className="sm:col-span-2 lg:col-span-3">
                <a
                  href={s.endpointUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-[11px] text-sky-400/90 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.endpointUrl}
                </a>
              </Detail>
              <Detail label="Documentation" className="sm:col-span-2 lg:col-span-3">
                <a
                  href={s.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-mono text-[11px] text-teal-400 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {s.docsUrl}
                </a>
              </Detail>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                <a
                  href={s.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-500/15"
                >
                  Open docs
                </a>
                <a
                  href={s.endpointUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Open endpoint
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void navigator.clipboard?.writeText(s.endpointUrl);
                  }}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  Copy endpoint
                </button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Detail({
  label,
  children,
  mono,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xs text-slate-300 ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
