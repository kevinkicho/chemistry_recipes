/**
 * Strip PubChem TOC boilerplate and low-value strings so AI / UI never
 * present "This section provides information on…" as process steps.
 */

const BOILERPLATE_RE =
  /this section provides information|major uses of this chemical|including both consumer uses and industrial uses|see also the|click here|table of contents|record description|following information|data not available|not available|n\/a\b/i;

const PLACEHOLDER_RE =
  /not specified in public excerpt|define ipc\/cqas|validate on site|placeholder class|common finishing unit|not confirmed for this cid|public manufacturing \/ use note|extracted from pubchem pug view|not a validated plant step|process steps below are evidence scaffolds/i;

/** True if string is useful substance content (not a TOC blurb). */
export function isUsefulEvidenceText(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 24) return false;
  if (BOILERPLATE_RE.test(t)) return false;
  if (PLACEHOLDER_RE.test(t)) return false;
  // Pure section labels
  if (/^(uses|description|methods of manufacturing|industry uses)$/i.test(t)) return false;
  return true;
}

export function filterUsefulTexts(texts: string[]): string[] {
  return [...new Set(texts.map((t) => t.trim()).filter(isUsefulEvidenceText))];
}

/** Drop empty / placeholder process control lines. */
export function isRealControlLine(s: string): boolean {
  if (!s?.trim()) return false;
  if (PLACEHOLDER_RE.test(s)) return false;
  if (/^not specified/i.test(s.trim())) return false;
  return true;
}

/** Process-ish literature title/abstract. */
export function looksLikeProcessLiterature(title: string, abstract?: string): boolean {
  const hay = `${title} ${abstract || ""}`.toLowerCase();
  return (
    /synthes|preparat|manufactur|process|ferment|biocatal|enzymatic|industrial|scale.?up|production of|method of making|route to|catalys|hydrogenat|crystalliz|isolation of|acetylation|alkylation|amidat|esterif|hydrolysis|condensation/i.test(
      hay
    )
  );
}
