/** Best-effort property snippets from free-text PubChem property lines. */

export function extractMp(texts: string[]): string | undefined {
  for (const t of texts) {
    const m = t.match(
      /melting\s*(?:point|range)?[:\s]+([0-9.]+\s*(?:–|-|to)\s*[0-9.]+|[0-9.]+)\s*°?\s*C/i
    );
    if (m) return m[1];
  }
  return undefined;
}

export function extractAppearance(texts: string[]): string | undefined {
  for (const t of texts) {
    if (
      /white|crystal|solid|powder|liquid|colorless|colourless/i.test(t) &&
      t.length < 160
    ) {
      return t.replace(/^[^:]+:\s*/, "").slice(0, 120);
    }
  }
  return undefined;
}

export function extractSolubility(texts: string[]): string | undefined {
  for (const t of texts) {
    if (/solubl/i.test(t) && t.length < 200) {
      return t.replace(/^[^:]+:\s*/, "").slice(0, 160);
    }
  }
  return undefined;
}
