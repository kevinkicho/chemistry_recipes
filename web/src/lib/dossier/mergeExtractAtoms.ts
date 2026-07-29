/**
 * Merge two-pass AI extract atoms into processFacts only when the quote
 * is grounded in free-public evidence text (no invented numbers).
 */

import type { ProcessFact, ProcessFactBundle } from "@/lib/dossier/processFacts";
import type { CompoundEvidence } from "@/lib/dossier/types";

export type ExtractAtom = {
  kind?: string;
  claim?: string;
  value?: string | null;
  unit?: string | null;
  quote?: string;
  sourceHint?: string;
};

const ALLOWED_KINDS = new Set([
  "condition",
  "yield",
  "purity",
  "unit-op",
  "material",
  "workup",
  "isolation",
  "scale-note",
  "hazard-process",
]);

function evidenceBlob(ev: CompoundEvidence): string {
  const parts: string[] = [];
  for (const p of ev.procedureExcerpts || []) parts.push(p.text);
  for (const f of ev.processFacts?.facts || []) {
    parts.push(f.claim, f.quote || "", f.value || "");
  }
  for (const h of ev.literature || []) {
    parts.push(h.title, h.abstract || "", h.fullTextExcerpt || "");
  }
  for (const p of ev.patents || []) {
    parts.push(p.title, p.abstract || "", p.procedureExcerpt || "");
  }
  for (const t of ev.view?.manufacturingTexts || []) parts.push(t);
  return parts.join("\n").toLowerCase();
}

function quoteGrounded(quote: string, blob: string): boolean {
  const q = quote.trim().toLowerCase();
  if (q.length < 12) return false;
  // Prefer substantial substring match
  const core = q.slice(0, Math.min(80, q.length));
  if (blob.includes(core)) return true;
  // Token overlap fallback for minor whitespace differences
  const tokens = core.split(/\s+/).filter((t) => t.length > 3);
  if (tokens.length < 3) return false;
  const hits = tokens.filter((t) => blob.includes(t)).length;
  return hits / tokens.length >= 0.75;
}

function mapKind(k: string | undefined): ProcessFact["kind"] {
  const raw = (k || "condition").toLowerCase();
  if (raw === "stoichiometry" || raw === "other") return "condition";
  if (ALLOWED_KINDS.has(raw)) return raw as ProcessFact["kind"];
  return "condition";
}

/**
 * Append quote-grounded extract atoms onto the process-fact bundle.
 */
export function mergeExtractAtomsIntoFacts(
  bundle: ProcessFactBundle | undefined,
  extract: unknown,
  evidence: CompoundEvidence
): { bundle: ProcessFactBundle | undefined; added: number } {
  if (!bundle || !extract || typeof extract !== "object") {
    return { bundle, added: 0 };
  }
  const atoms = (extract as { extractedAtoms?: ExtractAtom[] }).extractedAtoms;
  if (!Array.isArray(atoms) || !atoms.length) {
    return { bundle, added: 0 };
  }

  const blob = evidenceBlob(evidence);
  const existing = new Set(
    (bundle.facts || []).map(
      (f) => `${f.kind}|${(f.claim || "").toLowerCase()}|${(f.value || "").toLowerCase()}`
    )
  );
  const addedFacts: ProcessFact[] = [];
  let i = 0;
  for (const a of atoms) {
    const quote = (a.quote || "").trim();
    const claim = (a.claim || "").trim();
    if (!claim || !quote) continue;
    if (!quoteGrounded(quote, blob)) continue;
    const kind = mapKind(a.kind);
    const key = `${kind}|${claim.toLowerCase()}|${(a.value || "").toLowerCase()}`;
    if (existing.has(key)) continue;
    existing.add(key);
    i += 1;
    addedFacts.push({
      id: `extract-pass1:${evidence.cid}:${i}`,
      kind,
      claim: claim.slice(0, 200),
      value: a.value || undefined,
      unit: a.unit || undefined,
      quote: quote.slice(0, 280),
      sourceLabel: a.sourceHint?.slice(0, 80) || "AI extract (quote-bound)",
      sourceId: `extract-pass1:${i}`,
      provenance: "literature",
    });
  }

  if (!addedFacts.length) return { bundle, added: 0 };

  const facts = [...(bundle.facts || []), ...addedFacts];
  const condN =
    facts.filter((f) => f.kind === "condition" || f.kind === "yield").length;
  const unitN = facts.filter((f) => f.kind === "unit-op").length;

  return {
    bundle: {
      ...bundle,
      facts,
      sourcedConditionCount: Math.max(bundle.sourcedConditionCount, condN),
      unitOpCount: Math.max(bundle.unitOpCount, unitN),
      summary: `${bundle.summary} · +${addedFacts.length} quote-bound extract atom(s)`,
    },
    added: addedFacts.length,
  };
}
