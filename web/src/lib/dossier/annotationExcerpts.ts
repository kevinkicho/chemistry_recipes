/**
 * Promote process-relevant free-public annotations into procedureExcerpts
 * so densify/AI packaging can use them (no invented plant numbers).
 */

import type {
  CompoundEvidence,
  ExternalAnnotation,
  ProcedureExcerpt,
} from "@/lib/dossier/types";
import { scoreProcedureWindow } from "@/lib/literature/procedureWindowScore";

const PROCESSY =
  /synthes|prepar|process|manufactur|procedure|example\s+\d+|°\s*C|equiv|crystal|hydrog|ferment|react|quench|isolat|work[- ]?up|distill|filtr|yield|scale|batch|reactor|catalyst|solvent|stoich/i;

const SKIP_KIND = new Set(["identity", "pathway"]);

/**
 * Convert process-relevant annotations into procedure-style windows.
 */
export function annotationsToProcedureExcerpts(
  annotations: ExternalAnnotation[] | undefined,
  cid: number
): ProcedureExcerpt[] {
  const out: ProcedureExcerpt[] = [];
  for (const a of annotations || []) {
    if (SKIP_KIND.has(a.kind)) continue;
    const fieldBlob = a.fields
      ? Object.entries(a.fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")
      : "";
    const text = [a.title, a.summary, fieldBlob].filter(Boolean).join("\n").trim();
    if (text.length < 80) continue;
    if (!PROCESSY.test(text) && scoreProcedureWindow(text) < 6) continue;
    // Avoid pure regulatory boilerplate without process signal
    if (
      a.kind === "regulatory" &&
      scoreProcedureWindow(text) < 8 &&
      !PROCESSY.test(text)
    ) {
      continue;
    }
    out.push({
      id: `ann-proc:${a.source}:${cid}:${out.length}`,
      source: "other",
      label: `${a.source} · ${a.title}`.slice(0, 100),
      text: text.slice(0, 2400),
      url: a.url,
      chars: Math.min(text.length, 2400),
    });
  }
  return out;
}

/**
 * Merge annotation-derived excerpts into evidence (upgrade by id when longer).
 */
export function promoteAnnotationsToProcedureExcerpts(
  evidence: CompoundEvidence
): CompoundEvidence {
  const promoted = annotationsToProcedureExcerpts(
    evidence.annotations,
    evidence.cid
  );
  if (!promoted.length) return evidence;

  const procedureExcerpts: ProcedureExcerpt[] = [
    ...(evidence.procedureExcerpts || []),
  ];
  const seen = new Set(procedureExcerpts.map((p) => p.id));
  for (const p of promoted) {
    if (seen.has(p.id)) {
      const i = procedureExcerpts.findIndex((x) => x.id === p.id);
      if (i >= 0 && p.text.length > procedureExcerpts[i]!.text.length) {
        procedureExcerpts[i] = p;
      }
      continue;
    }
    // Content-level dedupe: skip if another window already has same head
    const head = p.text.slice(0, 120);
    if (procedureExcerpts.some((x) => x.text.slice(0, 120) === head)) continue;
    seen.add(p.id);
    procedureExcerpts.push(p);
  }

  return {
    ...evidence,
    procedureExcerpts: procedureExcerpts.slice(0, 72),
  };
}
