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

/**
 * Strip copy-paste wrappers so advertised identifiers resolve as written.
 * PubChem/Wikipedia often prefix InChIKey=, CID / Compound CID, CAS RN / CAS Number[n], UNII,
 * Canonical/Isomeric SMILES, and InChI labels. Equals-sign forms (CID=2244, CAS=50-78-2)
 * must not be classified as SMILES. PubChem /compound/ slugs, #query=, and Wikipedia /wiki/
 * titles extract the identifier or name.
 */
export function normalizeChemicalQuery(q: string): string {
  let s = q.trim();
  if (!s) return s;

  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1).trim();
  }

  const urlCompound = s.match(
    /(?:https?:\/\/)?(?:www\.)?pubchem\.ncbi\.nlm\.nih\.gov\/compound\/([^/?#]+)/i
  );
  if (urlCompound) {
    let slug = urlCompound[1];
    try {
      slug = decodeURIComponent(slug.replace(/\+/g, " ")).trim();
    } catch {
      slug = slug.replace(/\+/g, " ").trim();
    }
    if (slug) return slug;
  }

  const urlQuery = s.match(
    /(?:https?:\/\/)?(?:www\.)?pubchem\.ncbi\.nlm\.nih\.gov\/?(?:index\.html)?#query=([^&#]+)/i
  );
  if (urlQuery) {
    let qv = urlQuery[1];
    try {
      qv = decodeURIComponent(qv.replace(/\+/g, " ")).trim();
    } catch {
      qv = qv.replace(/\+/g, " ").trim();
    }
    if (qv) return normalizeChemicalQuery(qv);
  }

  const wiki = s.match(
    /(?:https?:\/\/)?(?:[\w-]+\.)*wikipedia\.org\/wiki\/([^/?#]+)/i
  );
  if (wiki) {
    let title = wiki[1];
    try {
      title = decodeURIComponent(title.replace(/\+/g, " ")).trim();
    } catch {
      title = title.replace(/\+/g, " ").trim();
    }
    title = title.replace(/_/g, " ");
    if (title) return title;
  }

  const cid = s.match(
    /^(?:pubchem\s+)?(?:compound\s+)?cid\s*[=:#]?\s*(\d+)$/i
  );
  if (cid) return cid[1];

  const ik = s.match(
    /^(?:inchi\s*key|inchikey)\s*[=:]?\s*([A-Za-z]{14}-[A-Za-z]{10}-[A-Za-z])$/i
  );
  if (ik) return ik[1];

  const cas = s.match(
    /^(?:cas(?:\s*(?:rn|no\.?|numbers?|id|reg(?:istry)?(?:\s*(?:no\.?|numbers?)?)?)|-rn)?)(?:\s*\[\d+\])?\s*[=:#]?\s*(\d{2,7}-\d{2}-\d)$/i
  );
  if (cas) return cas[1];

  const casCite = s.match(/^(\d{2,7}-\d{2}-\d)\s*\[\d+\]$/);
  if (casCite) return casCite[1];

  const unii = s.match(/^(?:unii)\s*[=:#]?\s*([A-Za-z0-9]{10})$/i);
  if (unii) return unii[1];

  // PubChem/Wikipedia labels: "Canonical SMILES: CC(=O)..." / "SMILES=CCO"
  // Require [=:] so a name query containing the word "smiles" is left alone.
  const smilesLabeled = s.match(
    /^(?:(?:canonical|isomeric)\s+)?smiles\s*[=:]\s*(\S+)$/i
  );
  if (smilesLabeled) return smilesLabeled[1];

  // "InChI: InChI=1S/..." — do not strip the InChI=1S/ body itself.
  const inchiLabeled = s.match(/^(?:inchi)\s*[=:]\s*(InChI=1S?\/.+)$/i);
  if (inchiLabeled) return inchiLabeled[1];

  const compact = s.replace(/\s+/g, "");
  if (/^InChI=1S?\//i.test(compact) && compact !== s) {
    return compact;
  }

  return s;
}

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

/** Numbered organic names: "2-propanol", "1,3-butadiene", "4-aminophenol". */
export function looksLikeNumberedChemicalName(q: string): boolean {
  const s = q.trim();
  if (/[=#@()\[\]\\/%]/.test(s)) return false;
  return /^\d+(,\d+)*-/.test(s) && /[A-Za-z]{2,}/.test(s);
}

/**
 * Hill-like molecular formula (C9H8O4), not SMILES.
 * Repeated counts (C1CCCCC1) look like ring closures and are left to SMILES.
 */
export function looksLikeMolecularFormula(q: string): boolean {
  const s = q.trim();
  if (!s || /[=#@()\[\]\\/%+\-]/.test(s)) return false;
  if (!/^[A-Z]/.test(s)) return false;
  if (!/^(?:[A-Z][a-z]?\d*){2,}$/.test(s)) return false;
  if (!/\d/.test(s)) return false;
  const digits = s.match(/\d+/g) || [];
  const seen = new Set<string>();
  for (const d of digits) {
    if (seen.has(d)) return false;
    seen.add(d);
  }
  return true;
}

/** Structured SMILES — not numbered names, formulas, or other identifier kinds. */
export function looksLikeSmiles(q: string): boolean {
  const s = q.trim();
  if (s.length < 2 || s.length > 500) return false;
  if (/\s/.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (
    looksLikeCas(s) ||
    looksLikeInchiKey(s) ||
    looksLikeInchi(s) ||
    looksLikeUnii(s) ||
    looksLikeNumberedChemicalName(s) ||
    looksLikeMolecularFormula(s)
  ) {
    return false;
  }
  if (/^[A-Za-z]+$/.test(s)) return false;
  const hasSmilesSyntax = /[=#@()\[\]\\/%]/.test(s) || /[A-Za-z][0-9]/.test(s);
  if (!hasSmilesSyntax) return false;
  return /[A-Za-z]/.test(s);
}

export function classifyChemicalQuery(q: string): ChemicalQueryKind {
  const t = normalizeChemicalQuery(q);
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

/** Numeric PubChem CID after prefix/URL normalize. */
export function parsePubchemCidQuery(raw: string): number | null {
  const t = normalizeChemicalQuery(raw);
  if (!/^\d+$/.test(t)) return null;
  const cid = Number(t);
  return Number.isFinite(cid) && cid > 0 ? cid : null;
}

export function isStructuredChemicalQuery(q: string): boolean {
  return classifyChemicalQuery(q) !== "name";
}

/** Name APIs must not be queried with these — empty chips look like missing coverage. */
export function isStructureOnlyQuery(kind: ChemicalQueryKind): boolean {
  return (
    kind === "smiles" ||
    kind === "inchi" ||
    kind === "inchikey" ||
    kind === "cid"
  );
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
 * Prefixed pastes submit the identifier as written (prefix stripped).
 */
export function resolveSearchSubmit(
  typed: string,
  highlighted?: { value: string; href?: string } | null
): { value: string; href?: string } {
  const q = normalizeChemicalQuery(typed);
  const kind = classifyChemicalQuery(q);
  if (kind !== "name") {
    if (kind === "cid" && highlighted?.href) {
      return { value: q, href: highlighted.href };
    }
    return { value: q };
  }
  if (highlighted?.value) {
    return { value: highlighted.value, href: highlighted.href };
  }
  return { value: q };
}
