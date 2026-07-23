/**
 * Real-time progress events for multi-API dossier builds.
 * Streamed to the browser via SSE — freezes UI until complete.
 */

import type { LiveDossier } from "@/lib/dossier/types";

export type DossierProgressType =
  | "hello"
  | "step_start"
  | "step_done"
  | "step_error"
  | "log"
  | "partial"
  | "complete"
  | "error";

export interface DossierProgressEvent {
  type: DossierProgressType;
  /** Wall-clock ms since pipeline start */
  t: number;
  stepId?: string;
  label?: string;
  organization?: string;
  endpointUrl?: string;
  method?: string;
  httpStatus?: number;
  ok?: boolean;
  /** Duration of this step only */
  durationMs?: number;
  /** Truncated real response body / summary (never invented) */
  responsePreview?: string;
  detail?: string;
  hits?: number;
  /** Steps completed / total for progress bar */
  stepsDone?: number;
  stepsTotal?: number;
  /** Shell or final dossier (partial / complete) */
  dossier?: LiveDossier;
  error?: string;
  /** Evidence score 0–100 when known */
  evidenceScore?: number;
}

export type ProgressEmitter = (event: Omit<DossierProgressEvent, "t"> & { t?: number }) => void;

export function createProgressClock(): {
  emit: ProgressEmitter;
  events: DossierProgressEvent[];
  elapsed: () => number;
} {
  const t0 = Date.now();
  const events: DossierProgressEvent[] = [];

  function emit(partial: Omit<DossierProgressEvent, "t"> & { t?: number }): void {
    const event: DossierProgressEvent = {
      ...partial,
      t: partial.t ?? Date.now() - t0,
    };
    events.push(event);
  }

  return {
    emit,
    events,
    elapsed: () => Date.now() - t0,
  };
}

export function previewText(text: string | undefined, max = 280): string | undefined {
  if (!text) return undefined;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}
