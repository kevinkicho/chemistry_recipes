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

  if (!hasApi && !showAiChip) return null;

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
    </span>
  );
}
