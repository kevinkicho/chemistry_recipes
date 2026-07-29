/**
 * Spend densify budget on highest process-score *thin* hits first.
 * Never invents content — only prioritizes free-public densify targets.
 */

import type { LiteratureHit } from "@/lib/api/europePmc";
import type { PatentHit } from "@/lib/api/patentsView";
import { scoreProcessRelevance } from "@/lib/literature/rank";
import { scoreProcedureWindow } from "@/lib/literature/procedureWindowScore";

export type DensifyTarget = {
  id: string;
  kind: "literature" | "patent";
  score: number;
  thin: boolean;
  hasBody: boolean;
  label: string;
};

function litBodyChars(h: LiteratureHit): number {
  return Math.max(
    h.fullTextExcerpt?.length || 0,
    h.abstract?.length || 0
  );
}

function patBodyChars(p: PatentHit): number {
  return Math.max(
    p.procedureExcerpt?.length || 0,
    p.abstract?.length || 0
  );
}

export function planLiteratureDensifyTargets(
  hits: LiteratureHit[],
  opts?: { max?: number; minScore?: number }
): LiteratureHit[] {
  const max = opts?.max ?? 16;
  const minScore = opts?.minScore ?? 10;
  const ranked = hits
    .map((h) => {
      const body = litBodyChars(h);
      const score =
        scoreProcessRelevance(h.title, h.fullTextExcerpt || h.abstract) +
        (h.pmcid || h.isOpenAccess ? 8 : 0) +
        (h.doi ? 3 : 0);
      const thin = body < 120;
      // Prefer thin high-score first, then improve mid-body
      const priority = score + (thin ? 40 : body < 400 ? 15 : 0);
      return { h, score, thin, priority };
    })
    .filter((x) => x.score >= minScore || x.thin)
    .sort((a, b) => b.priority - a.priority || b.score - a.score);
  return ranked.slice(0, max).map((x) => x.h);
}

export function planPatentDensifyTargets(
  hits: PatentHit[],
  opts?: { max?: number }
): PatentHit[] {
  const max = opts?.max ?? 12;
  const ranked = hits
    .map((p) => {
      const body = patBodyChars(p);
      const score =
        scoreProcessRelevance(p.title, p.procedureExcerpt || p.abstract) +
        (p.patentNumber ? 5 : 0);
      const thin = body < 200;
      const priority = score + (thin ? 45 : body < 500 ? 12 : 0);
      return { p, score, thin, priority };
    })
    .sort((a, b) => b.priority - a.priority);
  return ranked.slice(0, max).map((x) => x.p);
}

/** Inventory for densify-next / UI */
export function listThinHighValueTargets(
  literature: LiteratureHit[],
  patents: PatentHit[]
): DensifyTarget[] {
  const out: DensifyTarget[] = [];
  for (const h of literature) {
    const body = litBodyChars(h);
    const score = scoreProcessRelevance(h.title, h.abstract);
    if (score < 12 && body >= 120) continue;
    out.push({
      id: h.id,
      kind: "literature",
      score,
      thin: body < 120,
      hasBody: body >= 120,
      label: h.title.slice(0, 80),
    });
  }
  for (const p of patents) {
    const body = patBodyChars(p);
    const score = scoreProcessRelevance(p.title, p.abstract);
    out.push({
      id: p.id,
      kind: "patent",
      score,
      thin: body < 200,
      hasBody: body >= 200,
      label: (p.patentNumber || p.title).slice(0, 80),
    });
  }
  return out
    .filter((t) => t.thin && t.score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

export function rankProcedureTextsForPack(
  windows: Array<{ id: string; text: string; label?: string; chars?: number }>
): typeof windows {
  return [...windows].sort((a, b) => {
    const sa = scoreProcedureWindow(a.text) + Math.min(20, (a.chars || a.text.length) / 100);
    const sb = scoreProcedureWindow(b.text) + Math.min(20, (b.chars || b.text.length) / 100);
    return sb - sa;
  });
}
