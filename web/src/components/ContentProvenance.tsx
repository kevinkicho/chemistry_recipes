"use client";

/**
 * Universal content provenance strip — API + AI chips for every dossier block.
 * Prefer this over hand-wiring chips so regenerate / traces stay consistent.
 */

import { AiProvenance } from "@/components/AiProvenance";
import { ApiProvenance } from "@/components/ApiProvenance";
import type { AiProvenanceRecord } from "@/lib/dossier/types";
import type { ApiFetchTrace } from "@/lib/api/trace";
import type { SourceRef } from "@/lib/types/process";

export type ContentProvenanceProps = {
  /** Section title for API modal context */
  title?: string;
  field?: string;
  pubchemCid?: number;
  traces?: ApiFetchTrace[];
  sourceRefs?: SourceRef[];
  /** Show AI chip when synthesis produced this field (or always when forceAi) */
  ai?: AiProvenanceRecord | null;
  /** When true, show AI chip even if caller already gated on field generation */
  showAi?: boolean;
  /**
   * When true and no AI record, show an explicit "no AI" marker so free-public
   * surfaces still disclose that the content was not model-generated.
   */
  showNotAi?: boolean;
  onRegenerate?: () => void;
  className?: string;
  apiLabel?: string;
  aiLabel?: string;
};

/**
 * Inline provenance controls for any content surface.
 * Always tries API when cid/traces/refs present; AI only when `ai` + `showAi !== false`.
 */
export function ContentProvenance({
  title,
  field,
  pubchemCid,
  traces,
  sourceRefs,
  ai,
  showAi = true,
  showNotAi = false,
  onRegenerate,
  className = "",
  apiLabel = "API",
  aiLabel = "AI",
}: ContentProvenanceProps) {
  const hasApi =
    (pubchemCid != null && pubchemCid > 0) ||
    Boolean(traces && traces.length > 0) ||
    Boolean(sourceRefs && sourceRefs.some((r) => r.url));

  const showAiChip = Boolean(ai && showAi);
  const showNotAiMark = Boolean(showNotAi && !showAiChip);

  if (!hasApi && !showAiChip && !showNotAiMark) return null;

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1 print:hidden ${className}`}
      data-content-provenance={field || title || "block"}
    >
      {hasApi ? (
        <ApiProvenance
          pubchemCid={pubchemCid}
          traces={traces}
          sourceRefs={sourceRefs}
          title={title || field}
          label={apiLabel}
        />
      ) : null}
      {showAiChip && ai ? (
        <AiProvenance
          provenance={ai}
          field={field || title}
          label={aiLabel}
          onRegenerate={onRegenerate}
        />
      ) : null}
      {showNotAiMark ? (
        <span
          title="This block is free-public / rule-derived — not Ollama-generated. API chip lists harvest sources."
          className="rounded border border-slate-600/70 bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
          data-content-provenance-not-ai=""
        >
          no AI
        </span>
      ) : null}
    </span>
  );
}
