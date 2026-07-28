"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { AiProvenanceRecord } from "@/lib/dossier/types";
import { formatMs } from "@/lib/dossier/progress";
import { Tooltip } from "@/components/Tooltip";

export interface AiProvenanceProps {
  provenance?: AiProvenanceRecord | null;
  /** Which AI field this chip sits next to (overview, routes, …) */
  field?: string;
  label?: string;
  className?: string;
  /**
   * Re-run free APIs + Ollama for this dossier (usually chrome.onRefresh).
   * Shown as “Regenerate” in the modal when provided.
   */
  onRegenerate?: () => void;
}

const PAGE_CHARS = 2800;

type TabId = "system" | "user" | "data" | "response" | "sources" | "meta";

function formatTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function pageCount(len: number): number {
  if (len <= 0) return 1;
  return Math.max(1, Math.ceil(len / PAGE_CHARS));
}

function slicePage(text: string, page: number): string {
  const start = (page - 1) * PAGE_CHARS;
  return text.slice(start, start + PAGE_CHARS);
}

/**
 * AI provenance chip — opacity 0.3 like API chips.
 * Modal: full prompts (paginated), data fed, sources, model, response time, regenerate.
 */
export function AiProvenance({
  provenance,
  field,
  label = "AI",
  className = "",
  onRegenerate,
}: AiProvenanceProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("user");
  const [page, setPage] = useState(1);
  const [copyFlash, setCopyFlash] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset pagination when switching tabs or reopening
  useEffect(() => {
    setPage(1);
  }, [tab, open, provenance?.finishedAt]);

  const copyText = useCallback(async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFlash(tag);
      window.setTimeout(() => setCopyFlash(null), 1600);
    } catch {
      setCopyFlash("copy-failed");
      window.setTimeout(() => setCopyFlash(null), 1600);
    }
  }, []);

  if (!provenance) return null;

  const responseText =
    provenance.responsePreview ||
    (provenance.error ? `Error: ${provenance.error}` : "");

  const tabBodies: Record<Exclude<TabId, "sources" | "meta">, string> = {
    system: provenance.systemPrompt || "",
    user: provenance.userPrompt || "",
    data: provenance.dataFed || "",
    response: responseText,
  };

  const activeBody =
    tab === "sources" || tab === "meta" ? "" : tabBodies[tab];
  const pages = pageCount(activeBody.length);
  const safePage = Math.min(page, pages);
  const pageBody =
    tab === "sources" || tab === "meta" ? "" : slicePage(activeBody, safePage);

  const tooltip = [
    "AI provenance (Ollama)",
    field ? `Field: ${field}` : null,
    `Model: ${provenance.model}`,
    `Response: ${formatMs(provenance.responseTimeMs)}`,
    "Full prompt · data fed · sources · regenerate · pagination",
  ]
    .filter(Boolean)
    .join("\n");

  const tabs: { id: TabId; label: string; chars?: number }[] = [
    { id: "user", label: "User prompt", chars: provenance.userPrompt?.length },
    { id: "system", label: "System", chars: provenance.systemPrompt?.length },
    { id: "data", label: "Data fed", chars: provenance.dataFed?.length },
    {
      id: "response",
      label: "Response",
      chars: provenance.responseChars ?? responseText.length,
    },
    { id: "sources", label: "Sources", chars: provenance.dataSources?.length },
    { id: "meta", label: "Model & timing" },
  ];

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-[101] flex max-h-[min(94vh,58rem)] w-full max-w-[min(96vw,56rem)] flex-col overflow-hidden rounded-xl border border-violet-500/30 bg-slate-950 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <h2
                    id={titleId}
                    className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base"
                  >
                    AI provenance · full prompt &amp; regenerate
                  </h2>
                  {field ? (
                    <p className="mt-0.5 text-sm text-violet-300/90">
                      Generated field: {field}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                    Full system + user prompts, evidence package, sources, model, and
                    response — paginated. Educational synthesis from free public APIs only.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {onRegenerate ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onRegenerate();
                      }}
                      className="rounded-lg border border-violet-500/40 bg-violet-950/60 px-2.5 py-1 text-sm font-medium text-violet-100 hover:bg-violet-900/50"
                    >
                      Regenerate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </header>

              {/* Tabs */}
              <nav
                className="flex shrink-0 flex-wrap gap-1 border-b border-slate-800 px-3 py-2 sm:px-4"
                aria-label="AI provenance sections"
              >
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      tab === t.id
                        ? "bg-violet-500/20 text-violet-100 ring-1 ring-violet-500/40"
                        : "text-slate-500 hover:bg-slate-900 hover:text-slate-300"
                    }`}
                  >
                    {t.label}
                    {t.chars != null ? (
                      <span className="ml-1 font-mono tabular-nums opacity-70">
                        {t.chars.toLocaleString()}
                      </span>
                    ) : null}
                  </button>
                ))}
              </nav>

              <div className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-5 sm:py-4">
                {tab === "meta" ? (
                  <section className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-2">
                    <Fact label="Model" mono>
                      {provenance.model}
                    </Fact>
                    <Fact label="Provider">{provenance.provider}</Fact>
                    <Fact label="Host" mono>
                      {provenance.host}
                    </Fact>
                    <Fact label="Endpoint" mono>
                      {provenance.method} {provenance.endpointUrl}
                    </Fact>
                    <Fact label="Response time">
                      <span className="font-mono text-violet-200">
                        {formatMs(provenance.responseTimeMs)}
                      </span>
                      <span className="ml-1 text-slate-500">
                        ({provenance.responseTimeMs.toLocaleString()} ms)
                      </span>
                    </Fact>
                    <Fact label="Key source">{provenance.keySource || "env"}</Fact>
                    <Fact label="Started">{formatTime(provenance.startedAt)}</Fact>
                    <Fact label="Finished">{formatTime(provenance.finishedAt)}</Fact>
                    <Fact label="Parse status">
                      {provenance.parsed ? (
                        <span className="text-emerald-300">JSON parsed OK</span>
                      ) : (
                        <span className="text-rose-300">Parse failed / incomplete</span>
                      )}
                    </Fact>
                    {provenance.fieldsGenerated?.length ? (
                      <Fact label="Fields generated">
                        {provenance.fieldsGenerated.join(" · ")}
                      </Fact>
                    ) : null}
                    {provenance.error ? (
                      <div className="sm:col-span-2">
                        <Fact label="Error">
                          <span className="text-rose-300">{provenance.error}</span>
                        </Fact>
                      </div>
                    ) : null}
                    {onRegenerate ? (
                      <div className="sm:col-span-2">
                        <p className="text-[11px] text-slate-500">
                          Regenerate clears the local cache and re-runs free public APIs +
                          Ollama for this compound. Site paste and vault notes stay local.
                        </p>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {tab === "sources" ? (
                  <ol className="space-y-3">
                    {(provenance.dataSources || []).length === 0 ? (
                      <li className="text-sm text-slate-500">
                        No structured data-feed sources recorded for this call.
                      </li>
                    ) : (
                      provenance.dataSources.map((s, i) => (
                        <li
                          key={s.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-400">
                              {i + 1}
                            </span>
                            <span className="text-sm font-medium text-slate-200">
                              {s.name}
                            </span>
                            {s.organization ? (
                              <span className="text-[10px] text-slate-600">
                                {s.organization}
                              </span>
                            ) : null}
                            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300 ring-1 ring-violet-500/20">
                              {s.role}
                            </span>
                          </div>
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block break-all font-mono text-[11px] text-teal-400 hover:underline"
                            >
                              {s.url}
                            </a>
                          ) : null}
                          {s.endpointUrl ? (
                            <p className="mt-0.5 break-all font-mono text-[10px] text-slate-600">
                              API: {s.endpointUrl}
                            </p>
                          ) : null}
                          <PaginatedPre
                            text={s.content || ""}
                            pageSize={PAGE_CHARS}
                            label={`source-${i}`}
                            onCopy={copyText}
                            copyFlash={copyFlash}
                          />
                        </li>
                      ))
                    )}
                  </ol>
                ) : null}

                {tab !== "meta" && tab !== "sources" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500">
                        Full text · {activeBody.length.toLocaleString()} characters
                        {pages > 1
                          ? ` · page ${safePage} of ${pages} (${PAGE_CHARS.toLocaleString()} chars/page)`
                          : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyText(activeBody, tab)}
                          className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-violet-500/40 hover:text-violet-200"
                        >
                          {copyFlash === tab ? "Copied" : "Copy full"}
                        </button>
                        {copyFlash === "copy-failed" ? (
                          <span className="text-[10px] text-rose-400">Copy failed</span>
                        ) : null}
                      </div>
                    </div>

                    {pages > 1 ? (
                      <PaginationBar
                        page={safePage}
                        pages={pages}
                        onPage={setPage}
                      />
                    ) : null}

                    <pre className="max-h-[min(28rem,52vh)] overflow-auto rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {pageBody || (
                        <span className="text-slate-600">(empty)</span>
                      )}
                    </pre>

                    {pages > 1 ? (
                      <PaginationBar
                        page={safePage}
                        pages={pages}
                        onPage={setPage}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <footer className="shrink-0 border-t border-slate-800 px-4 py-2.5 text-[11px] leading-relaxed text-slate-600 sm:px-5">
                AI text is synthesized from free public API evidence only. Validate against
                primary sources before any plant use.
                {onRegenerate
                  ? " Use Regenerate to re-fetch APIs and re-run the model with current evidence."
                  : ""}
              </footer>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`relative inline-flex ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Tooltip
        multiline
        content={
          <>
            <span className="block font-semibold text-violet-200">AI provenance</span>
            <span className="mt-0.5 block leading-snug text-slate-400">
              Full prompt · data fed · sources · {provenance.model} ·{" "}
              {formatMs(provenance.responseTimeMs)}
              {onRegenerate ? " · regenerate" : ""}
            </span>
            {field ? (
              <span className="mt-0.5 block text-slate-500">Field: {field}</span>
            ) : null}
          </>
        }
      >
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={tooltip}
          onClick={() => setOpen(true)}
          className={`rounded border border-violet-500/50 bg-violet-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-violet-500/50 ${
            open ? "opacity-100 border-violet-400/70" : "opacity-30 hover:opacity-100"
          }`}
        >
          {label}
          {field ? (
            <span className="sr-only"> provenance for {field}</span>
          ) : null}
        </button>
      </Tooltip>
      {modal}
    </div>
  );
}

function PaginationBar({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 enabled:hover:border-violet-500/40 disabled:opacity-40"
      >
        Prev
      </button>
      <span className="font-mono tabular-nums text-slate-500">
        {page} / {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 enabled:hover:border-violet-500/40 disabled:opacity-40"
      >
        Next
      </button>
      {pages > 3 ? <JumpPage pages={pages} onPage={onPage} /> : null}
    </div>
  );
}

function JumpPage({
  pages,
  onPage,
}: {
  pages: number;
  onPage: (p: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-slate-500">
      Go
      <input
        type="number"
        min={1}
        max={pages}
        className="w-14 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 font-mono text-slate-300"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = Number((e.target as HTMLInputElement).value);
            if (Number.isFinite(v)) onPage(Math.min(pages, Math.max(1, Math.floor(v))));
          }
        }}
        aria-label="Jump to page"
      />
    </label>
  );
}

function PaginatedPre({
  text,
  pageSize,
  label,
  onCopy,
  copyFlash,
}: {
  text: string;
  pageSize: number;
  label: string;
  onCopy: (t: string, tag: string) => void;
  copyFlash: string | null;
}) {
  const [page, setPage] = useState(1);
  const pages = useMemo(
    () => Math.max(1, Math.ceil((text.length || 1) / pageSize)),
    [text.length, pageSize]
  );
  const safe = Math.min(page, pages);
  const body = text.slice((safe - 1) * pageSize, safe * pageSize);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
        <span>
          {text.length.toLocaleString()} chars
          {pages > 1 ? ` · p.${safe}/${pages}` : ""}
        </span>
        <button
          type="button"
          onClick={() => onCopy(text, label)}
          className="text-teal-500/90 hover:underline"
        >
          {copyFlash === label ? "Copied" : "Copy"}
        </button>
      </div>
      {pages > 1 ? (
        <PaginationBar page={safe} pages={pages} onPage={setPage} />
      ) : null}
      <pre className="max-h-36 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] leading-relaxed text-slate-500 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {body}
      </pre>
    </div>
  );
}

function Fact({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xs text-slate-300 break-words [overflow-wrap:anywhere] ${
          mono ? "font-mono" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
