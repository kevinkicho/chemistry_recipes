/**
 * Structured chemical query heuristics (no invention).
 * Shared by browser PubChem, server PubChem, and the search combobox.
 */

export type ChemicalQueryKind =
  | "cid"
  | "cas"
  | "inchikey"
  | "inchi"
  | "unii"
  | "smiles"
  | "name";

export function looksLikeCas(q: string): boolean {
  return /^\d{2,7}-\d{2}-\d$/.test(q.trim());
}

export function looksLikeInchiKey(q: string): boolean {
  return /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/i.test(q.trim());
}

/** Full InChI (not InChIKey). Must be classified before SMILES. */
export function looksLikeInchi(q: string): boolean {
  return /^InChI=1S?\//i.test(q.trim());
}

export function looksLikeUnii(q: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(q.trim()) && !/^\d+$/.test(q.trim());
}

/** Same structured-SMILES heuristic as historical searchPubChem — no invention. */
export function looksLikeSmiles(q: string): boolean {
  const s = q.trim();
  if (s.length < 2 || s.length > 500) return false;
  if (/\s/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (
    looksLikeCas(s) ||
    looksLikeInchiKey(s) ||
    looksLikeInchi(s) ||
    looksLikeUnii(s)
  ) {
    return false;
  }
  if (/^[A-Za-z]+$/.test(s)) return false;
  const hasSmilesSyntax = /[=#@()\[\]\\/%]/.test(s) || /[0-9]/.test(s);
  if (!hasSmilesSyntax) return false;
  return /[A-Za-z]/.test(s);
}

export function classifyChemicalQuery(q: string): ChemicalQueryKind {
  const t = q.trim();
  if (!t) return "name";
  if (/^\d+$/.test(t)) return "cid";
  if (looksLikeCas(t)) return "cas";
  if (looksLikeInchiKey(t)) return "inchikey";
  if (looksLikeInchi(t)) return "inchi";
  if (looksLikeUnii(t)) return "unii";
  if (looksLikeSmiles(t)) return "smiles";
  return "name";
}

export function isNameQuery(q: string): boolean {
  return classifyChemicalQuery(q) === "name";
}

export function isStructuredChemicalQuery(q: string): boolean {
  return classifyChemicalQuery(q) !== "name";
}

export function structuredQueryLabel(kind: ChemicalQueryKind): string | null {
  switch (kind) {
    case "cid":
      return "PubChem CID";
    case "cas":
      return "CAS RN";
    case "inchikey":
      return "InChIKey";
    case "inchi":
      return "InChI";
    case "unii":
      return "UNII";
    case "smiles":
      return "SMILES";
    default:
      return null;
  }
}

/**
 * Combobox Enter must not replace a structured identifier with a name suggestion.
 * CID may keep a highlighted compound-card href.
 */
export function resolveSearchSubmit(
  typed: string,
  highlighted?: { value: string; href?: string } | null
): { value: string; href?: string } {
  const q = typed.trim();
  const kind = classifyChemicalQuery(q);
  if (kind !== "name") {
    if (kind === "cid" && highlighted?.href) {
      return { value: highlighted.value, href: highlighted.href };
    }
    return { value: q };
  }
  if (highlighted?.value) {
    return { value: highlighted.value, href: highlighted.href };
  }
  return { value: q };
}
