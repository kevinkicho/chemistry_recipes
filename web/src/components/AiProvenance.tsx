"use client";

import { useEffect, useId, useState } from "react";
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
}

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

/**
 * AI provenance chip — opacity 0.3 like API chips.
 * Opens modal: prompt, data fed, sources, model, response time.
 */
export function AiProvenance({
  provenance,
  field,
  label = "AI",
  className = "",
}: AiProvenanceProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  if (!provenance) return null;

  const tooltip = [
    "AI provenance (Ollama Cloud)",
    field ? `Field: ${field}` : null,
    `Model: ${provenance.model}`,
    `Response: ${formatMs(provenance.responseTimeMs)}`,
    "Prompt · data fed · sources · timing",
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
              className="relative z-[101] flex max-h-[min(92vh,56rem)] w-full max-w-[min(96vw,52rem)] flex-col overflow-hidden rounded-xl border border-violet-500/30 bg-slate-950 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <h2
                    id={titleId}
                    className="text-sm font-semibold tracking-tight text-slate-100 sm:text-base"
                  >
                    AI provenance · Ollama Cloud
                  </h2>
                  {field ? (
                    <p className="mt-0.5 text-sm text-violet-300/90">Generated field: {field}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                    Prompt, data fed, free-public sources of that data, model, and response time.
                    Educational synthesis — not primary literature.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
                >
                  Close
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-3 sm:px-5 sm:py-4">
                {/* Model & timing */}
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
                </section>

                {/* System prompt */}
                <Section title="System prompt">
                  <Pre>{provenance.systemPrompt}</Pre>
                </Section>

                {/* User prompt */}
                <Section title="User prompt (full)">
                  <Pre>{provenance.userPrompt}</Pre>
                </Section>

                {/* Data fed */}
                <Section
                  title="Data fed (evidence package)"
                  hint={`${provenance.dataFed.length.toLocaleString()} characters`}
                >
                  <Pre>{provenance.dataFed}</Pre>
                </Section>

                {/* Sources of data fed */}
                <Section
                  title="Sources of data fed"
                  hint={`${provenance.dataSources.length} free-public feed(s)`}
                >
                  <ol className="space-y-3">
                    {provenance.dataSources.map((s, i) => (
                      <li
                        key={s.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                      >
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-400">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-200">{s.name}</span>
                          {s.organization ? (
                            <span className="text-[10px] text-slate-600">{s.organization}</span>
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
                        <pre className="mt-2 max-h-28 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[10px] leading-relaxed text-slate-500 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {s.content}
                        </pre>
                      </li>
                    ))}
                  </ol>
                </Section>

                {/* Model response */}
                {provenance.responsePreview ? (
                  <Section
                    title="Model response (preview)"
                    hint={
                      provenance.responseChars != null
                        ? `${provenance.responseChars.toLocaleString()} chars total`
                        : undefined
                    }
                  >
                    <Pre>{provenance.responsePreview}</Pre>
                  </Section>
                ) : null}
              </div>

              <footer className="shrink-0 border-t border-slate-800 px-4 py-2.5 text-[11px] leading-relaxed text-slate-600 sm:px-5">
                AI text is synthesized from free public API evidence only. Validate against primary
                sources before any plant use.
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
              Prompt, data fed, sources, model {provenance.model},{" "}
              {formatMs(provenance.responseTimeMs)}
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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">
          {title}
        </h3>
        {hint ? <span className="text-[10px] text-slate-600">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="max-h-56 overflow-auto rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {children}
    </pre>
  );
}
