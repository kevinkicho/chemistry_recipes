/**
 * Surface tensions between free public sources — never pick a winner.
 */

import type {
  CompoundEvidence,
  EvidenceContradiction,
} from "@/lib/dossier/types";
import type { ProcessRoute } from "@/lib/types/process";
import { looksLikeProcessLiterature } from "@/lib/dossier/evidenceFilter";

function clip(s: string, n = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * Heuristic: process literature titles vs patent titles that share a molecule
 * context but emphasize different unit ops (fermentation vs chemical, etc.).
 */
export function detectEvidenceContradictions(
  evidence: CompoundEvidence,
  processRoutes: ProcessRoute[] = []
): EvidenceContradiction[] {
  const out: EvidenceContradiction[] = [];
  const lit = evidence.literature.filter((h) =>
    looksLikeProcessLiterature(h.title, h.abstract)
  );
  const pats = evidence.patents;

  const fermLit = lit.filter((h) =>
    /ferment|biocatal|enzymatic|biosynth/i.test(`${h.title} ${h.abstract || ""}`)
  );
  const chemLit = lit.filter((h) =>
    /chemical synthes|total synthes|organic synthes|hydrogenat|alkylat|acylat/i.test(
      `${h.title} ${h.abstract || ""}`
    )
  );

  if (fermLit.length && chemLit.length) {
    out.push({
      id: "route-class-lit",
      topic: "Route class (biotech vs chemical)",
      sideA: clip(`Literature: ${fermLit[0].title}`),
      sideB: clip(`Literature: ${chemLit[0].title}`),
      severity: "info",
      sourceHint: "Public abstracts describe different production paradigms",
    });
  }

  if (pats.length && lit.length) {
    const patProcess = pats.filter((p) =>
      looksLikeProcessLiterature(p.title, p.abstract)
    );
    if (patProcess[0] && lit[0]) {
      const sameTheme =
        /synthes|prepar|manufact|process|product/i.test(patProcess[0].title) &&
        /synthes|prepar|manufact|process|product/i.test(lit[0].title);
      if (sameTheme) {
        out.push({
          id: "lit-vs-patent",
          topic: "Literature vs patent process emphasis",
          sideA: clip(`Lit: ${lit[0].title}`),
          sideB: clip(`Patent: ${patProcess[0].title}`),
          severity: "info",
          sourceHint:
            "Compare claims vs peer-reviewed methods; do not treat either as site SOP",
        });
      }
    }
  }

  // Multiple AI/evidence routes with different types
  if (processRoutes.length >= 2) {
    const types = new Set(processRoutes.map((r) => r.type));
    if (types.size >= 2) {
      const [a, b] = processRoutes;
      out.push({
        id: "multi-route-type",
        topic: "Multiple route types on dossier",
        sideA: clip(`${a.name} (${a.type})`),
        sideB: clip(`${b.name} (${b.type})`),
        severity: "info",
        sourceHint: "Use Route compare; site package selects the commercial path",
      });
    }
  }

  // PubChem mfg text mentions vs thin patent set
  const mfg = evidence.view?.manufacturingTexts || [];
  if (mfg.length >= 2) {
    const a = mfg[0];
    const b = mfg[1];
    if (
      a.length > 40 &&
      b.length > 40 &&
      !a.slice(0, 80).includes(b.slice(0, 40)) &&
      /manufact|produc|synthes|prepar/i.test(a) &&
      /manufact|produc|synthes|prepar/i.test(b)
    ) {
      out.push({
        id: "pubchem-mfg-variants",
        topic: "Multiple manufacturing narratives (PubChem)",
        sideA: clip(a),
        sideB: clip(b),
        severity: "warning",
        sourceHint: "PubChem annotations may mix historical and modern routes",
      });
    }
  }

  return out.slice(0, 8);
}

export function parseAiContradictions(raw: unknown): EvidenceContradiction[] {
  if (!Array.isArray(raw)) return [];
  const out: EvidenceContradiction[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const o = item as Record<string, unknown>;
    const topic = typeof o.topic === "string" ? o.topic.trim() : "";
    const sideA = typeof o.sideA === "string" ? o.sideA.trim() : "";
    const sideB = typeof o.sideB === "string" ? o.sideB.trim() : "";
    if (!topic || !sideA || !sideB) return;
    out.push({
      id: typeof o.id === "string" ? o.id : `ai-contra-${i + 1}`,
      topic,
      sideA: clip(sideA, 220),
      sideB: clip(sideB, 220),
      severity: o.severity === "warning" ? "warning" : "info",
      sourceHint:
        typeof o.sourceHint === "string" ? o.sourceHint.trim() : undefined,
    });
  });
  return out.slice(0, 8);
}

export function mergeContradictions(
  ...lists: EvidenceContradiction[][]
): EvidenceContradiction[] {
  const seen = new Set<string>();
  const out: EvidenceContradiction[] = [];
  for (const list of lists) {
    for (const c of list) {
      const key = `${c.topic}:${c.sideA.slice(0, 40)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out.slice(0, 10);
}
