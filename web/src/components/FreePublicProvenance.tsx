"use client";

/**
 * Standard API + AI provenance strip for free-public densify cards.
 * Use on every panel that presents dossier-derived process/evidence content.
 *
 * - API chip always when CID / traces / sourceRefs exist
 * - AI chip when this surface was Ollama-produced, or when dossier synthesis
 *   ran (field-or-parsed) so users can audit prompts for the densify package
 * - Explicit "no AI" marker when nothing was model-generated (honest, not a fake chip)
 */

import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import { slimTraces, type ApiFetchTrace } from "@/lib/api/trace";
import type { SourceRef } from "@/lib/types/process";
import {
  aiAttemptProvenance,
  aiProvenanceForField,
  aiProvenanceWhenParsed,
  type AiGeneratedField,
} from "@/lib/dossier/aiFieldProvenance";
import type { AiProvenanceRecord } from "@/lib/dossier/types";

export type FreePublicAiMode =
  /** Never show AI chip (API-only surface) */
  | "none"
  /** Only if aiField is in fieldsGenerated */
  | "field"
  /** Any successful Ollama parse on the dossier */
  | "when-parsed"
  /** Any attempt including failed parse */
  | "attempt"
  /** Prefer field, else dossier-level parse (default for process cards) */
  | "field-or-parsed";

function resolveAi(
  dossier: LiveDossier,
  aiField: AiGeneratedField | string | undefined,
  aiMode: FreePublicAiMode
): AiProvenanceRecord | null {
  const s = dossier.synthesis;
  if (aiMode === "none") return null;
  if (aiMode === "field") {
    return aiField ? aiProvenanceForField(s, aiField) : null;
  }
  if (aiMode === "when-parsed") {
    return aiProvenanceWhenParsed(s);
  }
  if (aiMode === "attempt") {
    return aiAttemptProvenance(s);
  }
  // field-or-parsed
  if (aiField) {
    const field = aiProvenanceForField(s, aiField);
    if (field) return field;
  }
  return aiProvenanceWhenParsed(s);
}

export function FreePublicProvenance({
  dossier,
  title,
  field,
  /** When set, prefer this synthesis field for the AI chip */
  aiField,
  /**
   * How to attach AI provenance.
   * Default: field-or-parsed when aiField set, else when-parsed — so compound
   * cards always expose AI audit when Ollama ran on this dossier.
   */
  aiMode,
  onRegenerate,
  className = "",
  /** Show explicit "no AI" when this surface is free-public only (default true) */
  showNotAi = true,
  traces: tracesProp,
  sourceRefs: sourceRefsProp,
  /** When false, do not live-fetch leftover PubChem identity HTTP */
  liveFetch = true,
}: {
  dossier: LiveDossier;
  title: string;
  field?: string;
  aiField?: AiGeneratedField | string;
  aiMode?: FreePublicAiMode;
  onRegenerate?: () => void;
  className?: string;
  showNotAi?: boolean;
  traces?: ApiFetchTrace[];
  sourceRefs?: SourceRef[];
  liveFetch?: boolean;
}) {
  const mode: FreePublicAiMode =
    aiMode ?? (aiField ? "field-or-parsed" : "when-parsed");
  const ai = resolveAi(dossier, aiField, mode);

  return (
    <ContentProvenance
      className={className}
      title={title}
      field={field || title}
      pubchemCid={liveFetch ? dossier.cid : undefined}
      traces={tracesProp ?? slimTraces(dossier.traces || [])}
      sourceRefs={sourceRefsProp ?? dossier.sourceRefs}
      ai={ai}
      showAi={Boolean(ai)}
      showNotAi={showNotAi && !ai}
      onRegenerate={onRegenerate}
    />
  );
}

/** Workspace / multi-CID free-public label when no single LiveDossier */
export function FreePublicBadge({
  note = "free-public densify · not GMP",
}: {
  note?: string;
}) {
  return (
    <span
      className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-medium text-slate-400 ring-1 ring-slate-700"
      data-content-provenance="free-public-badge"
    >
      {note}
    </span>
  );
}
