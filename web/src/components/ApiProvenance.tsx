"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { ApiFetchTrace } from "@/lib/api/trace";
import { slimTraces } from "@/lib/api/trace";
import { fetchPubChemProvenance } from "@/lib/api/pubchem";
import {
  mergeProvenanceRows,
  provenanceFromPublicSourceRefs,
  provenanceFromTraces,
  type ProvenanceItem,
  type ProvenanceKind,
} from "@/lib/provenance";
import type { SourceRef } from "@/lib/types/process";
import { Tooltip } from "@/components/Tooltip";

const KIND_STYLE: Record<ProvenanceKind, string> = {
  api: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  literature: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
  patent: "bg-orange-500/15 text-orange-200 ring-orange-500/25",
  record: "bg-teal-500/15 text-teal-300 ring-teal-500/25",
};

function formatTime(iso?: string): { local: string; iso: string } | null {
  if (!iso) return null;
  try {
    return {
      local: new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }).format(new Date(iso)),
      iso,
    };
  } catch {
    return { local: iso, iso };
  }
}

function formatResponseBody(body?: string): string {
  if (!body) return "";
  const trimmed = body.trim();
  if (!trimmed) return "";
  try {
    const withoutEllipsis = trimmed.replace(/\n… \[truncated \d+ chars\]\s*$/, "");
    if (
      (withoutEllipsis.startsWith("{") && withoutEllipsis.endsWith("}")) ||
      (withoutEllipsis.startsWith("[") && withoutEllipsis.endsWith("]"))
    ) {
      return JSON.stringify(JSON.parse(withoutEllipsis), null, 2);
    }
  } catch {
    /* keep raw */
  }
  return body;
}

function ExternalLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const display = children ?? href;
  if (href.startsWith("/")) {
    return (
      <a href={href} className={`text-teal-400 hover:underline ${className}`}>
        {display}
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`text-teal-400 hover:underline ${className}`}
    >
      {display}
    </a>
  );
}

function WrapUrl({ href }: { href: string }) {
  return (
    <ExternalLink
      href={href}
      className="inline-block max-w-full break-all font-mono text-[12px] leading-relaxed [overflow-wrap:anywhere]"
    >
      {href}
    </ExternalLink>
  );
}

export interface ApiProvenanceProps {
  /** Pre-captured free public API traces (preferred) */
  traces?: ApiFetchTrace[];
  /** Live-fetch PubChem (NIH) when opening if traces empty */
  pubchemCid?: number;
  /** Public sourceRefs with free public HTTPS URLs only */
  sourceRefs?: SourceRef[];
  /** Pre-built rows (must already be real-data only) */
  sources?: ProvenanceItem[];
  label?: string;
  title?: string;
  className?: string;
  align?: "left" | "right";
  size?: "md" | "lg" | "xl";
}

/**
 * API provenance: free public APIs only (e.g. PubChem / NIH).
 * Opens a large modal. Hover tooltip on the control describes the action.
 * Never shows invented response bodies or mock endpoints.
 */
export function ApiProvenance({
  traces: tracesProp,
  pubchemCid,
  sourceRefs,
  sources: initialSources,
  label = "API",
  title,
  className = "",
}: ApiProvenanceProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Client-side live fetch only when parent did not pass real traces */
  const [clientTraces, setClientTraces] = useState<ApiFetchTrace[]>([]);
  const titleId = useId();

  // Prefer server/parent traces (real HTTP). Never sync via useEffect on array identity.
  // Always slim bodies so UI never holds oversized responses.
  const traces =
    tracesProp && tracesProp.length > 0
      ? slimTraces(tracesProp)
      : clientTraces;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset client fetch when CID changes so a new molecule can re-fetch
  useEffect(() => {
    setClientTraces([]);
    setError(null);
  }, [pubchemCid]);

  // Hydrate citation deeplinks with matching harvest API traces (no HTML scraping).
  const citationRows = provenanceFromPublicSourceRefs(
    sourceRefs,
    title ?? "Citation",
    traces
  );
  const staticRows = initialSources ?? [];
  const displayRows = mergeProvenanceRows(
    [...provenanceFromTraces(traces, { pubchemCid }), ...staticRows],
    citationRows
  );
  const fetchedCount = displayRows.filter((r) => r.fetchedAt).length;
  const citationOnlyCount = displayRows.filter((r) => r.citationOnly).length;

  const canOpen =
    displayRows.length > 0 ||
    (pubchemCid != null && pubchemCid > 0) ||
    Boolean(tracesProp && tracesProp.length > 0);

  const hasPropTraces = Boolean(tracesProp && tracesProp.length > 0);

  const loadIfNeeded = useCallback(async () => {
    // Already have real traces from parent or a prior client fetch
    if (hasPropTraces) return;
    if (clientTraces.length > 0) return;
    if (pubchemCid == null || pubchemCid <= 0) return;

    setLoading(true);
    setError(null);
    try {
      const { traces: live } = await fetchPubChemProvenance(pubchemCid);
      setClientTraces(slimTraces(live));
      if (!live.length) {
        setError("No free public API response returned for this CID.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch public API");
    } finally {
      setLoading(false);
    }
  }, [hasPropTraces, clientTraces.length, pubchemCid]);

  useEffect(() => {
    if (!open) return;
    void loadIfNeeded();
  }, [open, loadIfNeeded]);

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

  if (!canOpen) return null;

  const tooltip = [
    "API provenance (free public sources only)",
    pubchemCid ? `PubChem CID ${pubchemCid} · NCBI/NIH` : null,
    "Shows deep link, endpoint, live response, and fetch time",
    "No paid databases · no mock data",
  ]
    .filter(Boolean)
    .join("\n");

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
              className="relative z-[101] flex max-h-[min(92vh,56rem)] w-full max-w-[min(96vw,80rem)] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <h2
                    id={titleId}
                    className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base"
                  >
                    Provenance · free public APIs only
                  </h2>
                  {title && (
                    <p className="mt-0.5 break-words text-sm text-slate-400">{title}</p>
                  )}
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                    Government / research free sources (e.g. PubChem · NIH). Live rows show real
                    harvest HTTP captures. Citation deeplinks are not re-fetched as HTML (API
                    etiquette). No paid databases. No mock data.
                  </p>
                  {displayRows.length > 0 ? (
                    <p className="mt-1 text-[11px] tabular-nums text-slate-500">
                      {fetchedCount} live API capture
                      {fetchedCount === 1 ? "" : "s"}
                      {citationOnlyCount
                        ? ` · ${citationOnlyCount} citation deeplink${citationOnlyCount === 1 ? "" : "s"} (not HTML-scraped)`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] tabular-nums text-slate-400 ring-1 ring-slate-800">
                    {displayRows.length} row{displayRows.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-5 sm:py-4">
                {loading && (
                  <p className="mb-3 text-sm text-slate-400">
                    Fetching live PubChem (NIH) data…
                  </p>
                )}
                {error && (
                  <p className="mb-3 text-sm text-rose-400">{error}</p>
                )}
                {!loading && displayRows.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No free public API evidence available for this item yet.
                  </p>
                )}
                {displayRows.length > 0 && (
                  <ProvenanceTable sources={displayRows} variant="modal" />
                )}
              </div>

              <footer className="shrink-0 border-t border-slate-800 px-4 py-2.5 text-[11px] leading-relaxed text-slate-600 sm:px-5">
                Response bodies and timestamps appear only after a real HTTP request to a free
                public JSON/API endpoint during harvest (polite delays + retries on 429/5xx). We
                do not auto-scrape DOI landing pages, report-card HTML, or paywalled full text.
                Force re-densify to re-query missing free APIs.
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
            <span className="block font-semibold text-slate-100">API provenance</span>
            <span className="mt-0.5 block leading-snug text-slate-400">
              Free public sources only (e.g. PubChem / NIH). Deep link, endpoint, live response, and
              time — no mock data.
            </span>
            {pubchemCid ? (
              <span className="mt-0.5 block text-slate-500">PubChem CID {pubchemCid}</span>
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
          className={`rounded border border-sky-500/45 bg-sky-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-100 transition hover:border-sky-400/70 hover:bg-sky-900/50 focus:outline-none focus:ring-1 focus:ring-teal-500/50 ${
            open ? "border-teal-400/70 text-teal-100 ring-1 ring-teal-500/30" : ""
          }`}
        >
          {label}
          {(displayRows.length > 0 || pubchemCid) && (
            <span className="ml-1 font-normal tabular-nums opacity-80">
              {displayRows.length || "·"}
            </span>
          )}
        </button>
      </Tooltip>
      {modal}
    </div>
  );
}

export function ProvenanceTable({
  sources,
  variant = "inline",
}: {
  sources: ProvenanceItem[];
  variant?: "inline" | "modal";
}) {
  if (!sources.length) {
    return <p className="px-1 py-2 text-xs text-slate-500">No provenance rows.</p>;
  }

  if (variant === "modal") {
    return (
      <ol className="space-y-4">
        {sources.map((s, index) => (
          <ProvenanceCard key={s.id} item={s} index={index + 1} />
        ))}
      </ol>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-500">
          <tr>
            <th className="border-b border-slate-800 px-2 py-2 font-semibold">Datapoint</th>
            <th className="border-b border-slate-800 px-2 py-2 font-semibold">Source</th>
            <th className="border-b border-slate-800 px-2 py-2 font-semibold">Deep link</th>
            <th className="border-b border-slate-800 px-2 py-2 font-semibold">Endpoint</th>
            <th className="border-b border-slate-800 px-2 py-2 font-semibold">Response</th>
            <th className="border-b border-slate-800 px-2 py-2 font-semibold">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {sources.map((s) => {
            const deep = s.deepLinkUrl ?? s.recordUrl;
            const time = formatTime(s.fetchedAt);
            return (
              <tr key={s.id} className="align-top hover:bg-slate-900/40">
                <td className="px-2 py-2.5">
                  <div className="max-w-[10rem] break-words font-medium text-slate-200 [overflow-wrap:anywhere]">
                    {s.datapoint}
                  </div>
                  <KindBadge kind={s.kind} />
                </td>
                <td className="px-2 py-2.5">
                  <div className="max-w-[12rem] break-words text-slate-300 [overflow-wrap:anywhere]">
                    {s.name}
                  </div>
                  {s.organization && (
                    <div className="mt-0.5 break-words text-[10px] text-slate-600">
                      {s.organization}
                    </div>
                  )}
                </td>
                <td className="px-2 py-2.5 max-w-[14rem]">
                  {deep ? <WrapUrl href={deep} /> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2.5 max-w-[16rem]">
                  {s.endpointUrl ? (
                    <WrapUrl href={s.endpointUrl} />
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5 max-w-[18rem]">
                  <ResponseBlock body={s.responseBody} contentType={s.contentType} compact />
                </td>
                <td className="px-2 py-2.5">
                  <TimeBlock time={time} method={s.method} status={s.httpStatus} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KindBadge({ kind }: { kind: ProvenanceKind }) {
  return (
    <span
      className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset ${
        KIND_STYLE[kind] ?? KIND_STYLE.record
      }`}
    >
      {kind}
    </span>
  );
}

function TimeBlock({
  time,
  method,
  status,
}: {
  time: { local: string; iso: string } | null;
  method?: string;
  status?: number;
}) {
  if (!time && method == null && status == null) {
    return (
      <span className="text-slate-600">
        — (citation deeplink · not an HTTP API capture)
      </span>
    );
  }
  return (
    <div className="space-y-1 text-[11px] text-slate-400">
      {time && (
        <>
          <div className="break-words leading-snug text-slate-300">{time.local}</div>
          <div className="break-all font-mono text-[10px] leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
            {time.iso}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
        {method && (
          <span className="rounded bg-slate-900 px-1 py-0.5 font-mono ring-1 ring-slate-800">
            {method}
          </span>
        )}
        {status != null && (
          <span className="rounded bg-slate-900 px-1 py-0.5 font-mono ring-1 ring-slate-800">
            HTTP {status}
          </span>
        )}
      </div>
    </div>
  );
}

function ProvenanceCard({ item, index }: { item: ProvenanceItem; index: number }) {
  const deep = item.deepLinkUrl ?? item.recordUrl;
  const time = formatTime(item.fetchedAt);

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/40 shadow-sm">
      <div className="flex flex-wrap items-start gap-2 border-b border-slate-800/80 px-3 py-2.5 sm:px-4">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold tabular-nums text-slate-400">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-semibold leading-snug text-slate-100 [overflow-wrap:anywhere]">
            {item.datapoint}
          </div>
          <div className="mt-0.5 break-words text-xs leading-relaxed text-slate-400 [overflow-wrap:anywhere]">
            {item.name}
            {item.organization ? ` · ${item.organization}` : ""}
          </div>
        </div>
        <KindBadge kind={item.kind} />
      </div>

      {item.role && (
        <p className="border-b border-slate-800/60 px-3 py-2 text-xs leading-relaxed text-slate-400 sm:px-4 [overflow-wrap:anywhere]">
          {item.role}
          {item.note ? (
            <span className="mt-1 block text-[11px] leading-relaxed text-slate-600">{item.note}</span>
          ) : null}
        </p>
      )}

      <dl className="grid gap-0 sm:grid-cols-2">
        <Field label="Deep link">
          {deep ? <WrapUrl href={deep} /> : <span className="text-slate-600">—</span>}
        </Field>
        <Field label="API endpoint">
          {item.endpointUrl ? (
            <div className="space-y-1.5">
              <WrapUrl href={item.endpointUrl} />
              {item.docsUrl && (
                <div>
                  <ExternalLink
                    href={item.docsUrl}
                    className="text-[11px] text-slate-500 hover:text-teal-400 hover:underline"
                  >
                    API documentation →
                  </ExternalLink>
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-600">—</span>
          )}
        </Field>
        <Field label="Time / request" className="sm:col-span-2">
          <TimeBlock time={time} method={item.method} status={item.httpStatus} />
        </Field>
        <Field label="API response" className="sm:col-span-2">
          <ResponseBlock body={item.responseBody} contentType={item.contentType} />
        </Field>
      </dl>
    </li>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-slate-800/60 px-3 py-2.5 sm:px-4 ${className}`}>
      <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="min-w-0 text-xs text-slate-300">{children}</dd>
    </div>
  );
}

const API_PAGE_CHARS = 2800;

function ResponseBlock({
  body,
  contentType,
  compact = false,
}: {
  body?: string;
  contentType?: string;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const [page, setPage] = useState(1);
  if (!body) {
    return (
      <span className="text-slate-600">
        — (no harvest API body · open deep link for the public record; re-densify to re-query APIs)
      </span>
    );
  }

  const formatted = formatResponseBody(body);
  const isLong = formatted.length > 320;
  const pages = Math.max(1, Math.ceil(formatted.length / API_PAGE_CHARS));
  const safePage = Math.min(page, pages);
  const pageSlice = formatted.slice(
    (safePage - 1) * API_PAGE_CHARS,
    safePage * API_PAGE_CHARS
  );
  const show =
    !isLong || expanded
      ? pages > 1
        ? pageSlice
        : formatted
      : `${formatted.slice(0, 320)}…`;

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
        {contentType && (
          <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono ring-1 ring-slate-800">
            {contentType}
          </span>
        )}
        <span className="tabular-nums">{formatted.length.toLocaleString()} chars</span>
        {isLong && (
          <button
            type="button"
            onClick={() => {
              setExpanded((v) => !v);
              setPage(1);
            }}
            className="text-teal-500/90 hover:underline"
          >
            {expanded ? "Collapse" : "Expand full response"}
          </button>
        )}
        {expanded && pages > 1 ? (
          <span className="inline-flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 enabled:hover:text-teal-300 disabled:opacity-40"
            >
              Prev
            </button>
            <span className="font-mono tabular-nums">
              p.{safePage}/{pages}
            </span>
            <button
              type="button"
              disabled={safePage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-400 enabled:hover:text-teal-300 disabled:opacity-40"
            >
              Next
            </button>
          </span>
        ) : null}
      </div>
      <pre
        className={`overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
          compact && !expanded ? "max-h-28" : "max-h-[min(24rem,50vh)]"
        } overflow-y-auto`}
      >
        {show}
      </pre>
    </div>
  );
}

export function ProvenancePanel({
  traces,
  pubchemCid,
  sourceRefs,
  heading = "Provenance",
}: {
  traces?: ApiFetchTrace[];
  pubchemCid?: number;
  sourceRefs?: SourceRef[];
  heading?: string;
  sources?: ProvenanceItem[];
  defaultOpen?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-2">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {heading}
      </div>
      <ApiProvenance
        traces={traces}
        pubchemCid={pubchemCid}
        sourceRefs={sourceRefs}
        title={heading}
        label="API"
      />
    </div>
  );
}
