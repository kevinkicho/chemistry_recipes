/**
 * Literature / patent densify depth — rank free-public windows by
 * procedure richness before atlas and AI packaging.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import {
  pickBestProcedureText,
  scoreProcedureWindow,
} from "@/lib/literature/procedureWindowScore";

export interface LiteratureDepthWindow {
  kind: "literature" | "patent" | "mfg" | "other";
  label: string;
  score: number;
  chars: number;
  url?: string;
  /** Best procedure-ish text source field */
  sourceField: string;
}

export interface LiteratureDepthReport {
  schema: "chemistry-recipes.literature-depth.v1";
  cid: number;
  totalWindows: number;
  procedureRichWindows: number;
  maxScore: number;
  medianScore: number;
  topWindows: LiteratureDepthWindow[];
  /** Weighted procedure depth 0–100 for densify quality */
  depthScore: number;
  summary: string;
}

const RICH_THRESHOLD = 8;

/**
 * Score and rank densified literature/patent/mfg windows for one dossier.
 */
export function buildLiteratureDepthReport(
  dossier: LiveDossier
): LiteratureDepthReport {
  const windows: LiteratureDepthWindow[] = [];

  for (const t of dossier.manufacturingTexts || []) {
    if (t.length < 20) continue;
    windows.push({
      kind: "mfg",
      label: "PubChem manufacturing",
      score: scoreProcedureWindow(t),
      chars: t.length,
      sourceField: "manufacturingTexts",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${dossier.cid}#section=Use-and-Manufacturing`,
    });
  }

  // Durable densify harvest (preferred over re-slicing lit/patents alone)
  for (const pe of dossier.procedureExcerpts || []) {
    if (!pe.text || pe.text.length < 40) continue;
    windows.push({
      kind: pe.source === "patent" ? "patent" : pe.source === "pubchem-mfg" ? "mfg" : "other",
      label: pe.label.slice(0, 80),
      score: scoreProcedureWindow(`${pe.label}\n${pe.text}`),
      chars: pe.chars || pe.text.length,
      url: pe.url,
      sourceField: `procedureExcerpts:${pe.source}`,
    });
  }

  for (const h of dossier.literature || []) {
    const best = pickBestProcedureText({
      fullTextExcerpt: h.fullTextExcerpt,
      abstract: h.abstract,
      title: h.title,
    });
    if (best.score < 0 || best.text.length < 20) continue;
    windows.push({
      kind: "literature",
      label: (h.title || "Literature").slice(0, 80),
      score: best.score,
      chars: best.text.length,
      url: h.url,
      sourceField: best.source,
    });
  }

  for (const p of dossier.patents || []) {
    const best = pickBestProcedureText({
      procedureExcerpt: p.procedureExcerpt,
      abstract: p.abstract,
      title: p.title,
    });
    if (best.score < 0 || best.text.length < 20) continue;
    windows.push({
      kind: "patent",
      label: (p.patentNumber || p.title || "Patent").slice(0, 80),
      score: best.score,
      chars: best.text.length,
      url: p.url,
      sourceField: best.source,
    });
  }

  windows.sort((a, b) => b.score - a.score || b.chars - a.chars);

  const scores = windows.map((w) => w.score);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const medianScore = scores.length
    ? scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]!
    : 0;
  const rich = windows.filter((w) => w.score >= RICH_THRESHOLD).length;

  // Depth: rich windows + max procedure score + OA/patent volume
  const depthScore = Math.min(
    100,
    Math.round(
      Math.min(40, rich * 8) +
        Math.min(30, maxScore * 1.2) +
        Math.min(20, windows.filter((w) => w.kind !== "mfg").length * 3) +
        Math.min(10, Math.floor((windows[0]?.chars || 0) / 800))
    )
  );

  const summary =
    windows.length === 0
      ? "No procedure-scored free-public windows yet"
      : `Literature depth ${depthScore}/100 · ${rich}/${windows.length} procedure-rich · max score ${maxScore} · top: ${windows[0]?.label.slice(0, 40) || "—"}`;

  return {
    schema: "chemistry-recipes.literature-depth.v1",
    cid: dossier.cid,
    totalWindows: windows.length,
    procedureRichWindows: rich,
    maxScore,
    medianScore,
    topWindows: windows.slice(0, 12),
    depthScore,
    summary,
  };
}

/**
 * Prefer procedure-rich literature/patent excerpts when building text windows.
 * Returns ordered list of { text, score, meta } for atlas extraction.
 */
export function rankDossierTextWindows(
  dossier: LiveDossier
): Array<{
  text: string;
  score: number;
  kind: LiteratureDepthWindow["kind"];
  label: string;
  sourceId: string;
  url?: string;
}> {
  const out: Array<{
    text: string;
    score: number;
    kind: LiteratureDepthWindow["kind"];
    label: string;
    sourceId: string;
    url?: string;
  }> = [];

  for (const pe of dossier.procedureExcerpts || []) {
    if (!pe.text || pe.text.length < 40) continue;
    out.push({
      text: pe.text,
      score: scoreProcedureWindow(`${pe.label}\n${pe.text}`),
      kind: pe.source === "patent" ? "patent" : pe.source === "pubchem-mfg" ? "mfg" : "other",
      label: pe.label.slice(0, 80),
      sourceId: pe.id,
      url: pe.url,
    });
  }
  for (const t of dossier.manufacturingTexts || []) {
    if (t.length < 20) continue;
    out.push({
      text: t,
      score: scoreProcedureWindow(t),
      kind: "mfg",
      label: "PubChem manufacturing",
      sourceId: `pubchem-mfg:${dossier.cid}`,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${dossier.cid}#section=Use-and-Manufacturing`,
    });
  }
  for (const h of dossier.literature || []) {
    const best = pickBestProcedureText({
      fullTextExcerpt: h.fullTextExcerpt,
      abstract: h.abstract,
      title: h.title,
    });
    if (best.text.length < 20) continue;
    out.push({
      text: best.text,
      score: best.score,
      kind: "literature",
      label: (h.title || "Literature").slice(0, 80),
      sourceId: h.id || h.doi || h.pmid || h.title,
      url: h.url,
    });
  }
  for (const p of dossier.patents || []) {
    const best = pickBestProcedureText({
      procedureExcerpt: p.procedureExcerpt,
      abstract: p.abstract,
      title: p.title,
    });
    if (best.text.length < 20) continue;
    out.push({
      text: best.text,
      score: best.score,
      kind: "patent",
      label: (p.patentNumber || p.title || "Patent").slice(0, 80),
      sourceId: p.id || p.patentNumber || p.title,
      url: p.url,
    });
  }

  return out.sort((a, b) => b.score - a.score || b.text.length - a.text.length);
}
