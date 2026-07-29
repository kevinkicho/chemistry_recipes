/**
 * Decide which dossier surfaces were produced by the Ollama synthesis call
 * so every AI card can show an AI provenance chip (dissemination / audit).
 *
 * Free-public shell content must NOT claim AI provenance.
 */

import type {
  AiProvenanceRecord,
  AiSynthesis,
  LiveDossier,
} from "@/lib/dossier/types";

/** Canonical field keys stored on AiProvenanceRecord.fieldsGenerated */
export type AiGeneratedField =
  | "overview"
  | "applications"
  | "manufacturingSummary"
  | "routes"
  | "apparatusCatalog"
  | "environmentBaseline"
  | "ehsHighlights"
  | "relatedEntities"
  | "contradictions"
  | "modality"
  | "gaps"
  | "disclaimer"
  | "unitOpFills"
  | "criticalParameters";

/**
 * True when synthesis successfully produced content for this field.
 * Falls back to presence checks when older caches lack fieldsGenerated.
 */
export function synthesisHasAiField(
  s: AiSynthesis | null | undefined,
  field: AiGeneratedField | string
): boolean {
  if (!s?.parsed || !s.provenance) return false;
  const listed = s.provenance.fieldsGenerated;
  if (listed?.length && listed.includes(field)) return true;
  // Legacy / incomplete fieldsGenerated — infer from payload
  switch (field) {
    case "overview":
      return Boolean(s.overview?.trim());
    case "applications":
      return Boolean(s.applications?.length);
    case "manufacturingSummary":
      return Boolean(s.manufacturingSummary?.trim());
    case "routes":
      return Boolean(s.routes?.length);
    case "apparatusCatalog":
      return Boolean(s.apparatusCatalog?.length);
    case "environmentBaseline":
      return Boolean(s.environmentBaseline);
    case "ehsHighlights":
      return Boolean(s.ehsHighlights?.length);
    case "relatedEntities":
      return Boolean(s.relatedEntities?.length);
    case "contradictions":
      return Boolean(s.contradictions?.length);
    case "modality":
      return Boolean(s.modality);
    case "gaps":
      return Boolean(s.gaps?.length);
    case "disclaimer":
      return Boolean(s.disclaimer?.trim());
    case "unitOpFills":
      return Boolean(s.unitOpFills?.length);
    case "criticalParameters":
      // Critical params board is derived from AI routes when routes exist
      return Boolean(s.routes?.length);
    default:
      return Boolean(listed?.includes(field));
  }
}

/** Provenance record for a specific AI field, or null if not AI-generated. */
export function aiProvenanceForField(
  s: AiSynthesis | null | undefined,
  field: AiGeneratedField | string
): AiProvenanceRecord | null {
  if (!synthesisHasAiField(s, field)) return null;
  return s?.provenance ?? null;
}

/**
 * Chip for any successful parse (dossier-level regenerate).
 * Prefer field-specific chips on content cards.
 */
export function aiProvenanceWhenParsed(
  s: AiSynthesis | null | undefined
): AiProvenanceRecord | null {
  if (!s?.parsed || !s.provenance) return null;
  return s.provenance;
}

/** Attempt record even when parse failed (show error provenance). */
export function aiAttemptProvenance(
  s: AiSynthesis | null | undefined
): AiProvenanceRecord | null {
  return s?.provenance ?? null;
}

/**
 * Process routes currently on the dossier came from Ollama synthesis
 * (or still carry ollama editorial source refs after merge).
 */
export function processRoutesFromAi(dossier: LiveDossier): boolean {
  const s = dossier.synthesis;
  if (s?.parsed && (s.routes?.length || synthesisHasAiField(s, "routes"))) {
    return true;
  }
  return (dossier.processRoutes || []).some((r) =>
    (r.sourceRefs || []).some(
      (ref) =>
        /ollama|ai synthesis|editorial.*synthesis/i.test(
          `${ref.id} ${ref.label || ""} ${ref.note || ""}`
        )
    )
  );
}

/**
 * Label for UI honesty when content is structured free-public (not Ollama).
 */
export function structureSourceLabel(dossier: LiveDossier): string {
  if (processRoutesFromAi(dossier)) return "Ollama dual-view";
  if (dossier.buildMode === "ai-skipped-thin-evidence") {
    return "Evidence shell · AI skipped";
  }
  if (dossier.processFacts?.facts?.some((f) => f.kind !== "open-gap")) {
    return "Free-public process facts";
  }
  return "Evidence shell";
}
