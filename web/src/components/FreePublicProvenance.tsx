"use client";

/**
 * Standard API (+ optional AI) provenance strip for free-public densify cards.
 * Use on every panel that presents dossier-derived process/evidence content.
 */

import { ContentProvenance } from "@/components/ContentProvenance";
import type { LiveDossier } from "@/lib/dossier/types";
import { slimTraces } from "@/lib/api/trace";
import {
  aiProvenanceForField,
  type AiGeneratedField,
} from "@/lib/dossier/aiFieldProvenance";

export function FreePublicProvenance({
  dossier,
  title,
  field,
  /** When set, show AI chip only if that synthesis field was Ollama-produced */
  aiField,
  onRegenerate,
  className = "",
}: {
  dossier: LiveDossier;
  title: string;
  field?: string;
  aiField?: AiGeneratedField | string;
  onRegenerate?: () => void;
  className?: string;
}) {
  const ai = aiField
    ? aiProvenanceForField(dossier.synthesis, aiField)
    : null;

  return (
    <ContentProvenance
      className={className}
      title={title}
      field={field || title}
      pubchemCid={dossier.cid}
      traces={slimTraces(dossier.traces || [])}
      sourceRefs={dossier.sourceRefs}
      ai={ai}
      showAi={Boolean(ai)}
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
