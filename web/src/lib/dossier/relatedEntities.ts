/**
 * Related-entity extraction and linking (impurities, intermediates, reagents).
 * Prefer AI output; fall back to route BOM materials + evidence text heuristics.
 */

import type { CompoundEvidence } from "@/lib/dossier/types";
import type {
  EntityRole,
  ProcessRoute,
  RelatedEntity,
} from "@/lib/types/process";
import { routes } from "@/lib/routes";

const ROLE_MAP: Record<string, EntityRole> = {
  "starting-material": "starting-material",
  intermediate: "intermediate",
  impurity: "impurity",
  reagent: "reagent",
  solvent: "solvent",
  catalyst: "catalyst",
  product: "api",
  base: "reagent",
  acid: "reagent",
  quench: "reagent",
  antisolvent: "solvent",
  utility: "other",
};

export function parseRelatedEntity(raw: unknown): RelatedEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name || name.length < 2) return null;
  const roleRaw = typeof o.role === "string" ? o.role.trim().toLowerCase() : "other";
  const role = (ROLE_MAP[roleRaw] ||
    ([
      "api",
      "intermediate",
      "impurity",
      "excipient",
      "reagent",
      "solvent",
      "catalyst",
      "starting-material",
      "drug-product",
      "raw-material",
      "media-component",
      "reference-standard",
      "other",
    ].includes(roleRaw)
      ? roleRaw
      : "other")) as EntityRole;

  const cas =
    typeof o.cas === "string" && /^\d{2,7}-\d{2}-\d$/.test(o.cas.trim())
      ? o.cas.trim()
      : undefined;
  const pubchemCid =
    typeof o.pubchemCid === "number" && o.pubchemCid > 0
      ? o.pubchemCid
      : typeof o.cid === "number" && o.cid > 0
        ? o.cid
        : undefined;
  const notes = typeof o.notes === "string" ? o.notes.trim() : undefined;
  const unii =
    typeof o.unii === "string" && o.unii.trim().length >= 6
      ? o.unii.trim()
      : undefined;

  return {
    role,
    name,
    cas,
    unii,
    pubchemCid,
    href: pubchemCid ? routes.pubchem(pubchemCid) : undefined,
    notes,
  };
}

export function parseRelatedEntities(raw: unknown): RelatedEntity[] {
  if (!Array.isArray(raw)) return [];
  const out: RelatedEntity[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const e = parseRelatedEntity(item);
    if (!e) continue;
    const key = `${e.role}:${e.name.toLowerCase()}:${e.cas || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out.slice(0, 24);
}

/** Derive related entities from route BOM (non-product materials). */
export function relatedFromRoutes(processRoutes: ProcessRoute[]): RelatedEntity[] {
  const out: RelatedEntity[] = [];
  const seen = new Set<string>();
  for (const route of processRoutes) {
    for (const m of route.materials || []) {
      if (!m.name?.trim()) continue;
      if (m.role === "product") continue;
      const role = ROLE_MAP[m.role] || "other";
      const key = `${role}:${m.name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        role,
        name: m.name.trim(),
        cas: m.cas,
        notes: m.notes || `From route BOM: ${route.name}`,
      });
    }
  }
  return out.slice(0, 16);
}

/**
 * Lightweight heuristic links from manufacturing / literature text
 * (only when explicit CAS or well-known phrases appear — no invention).
 */
export function relatedFromEvidenceText(
  evidence: CompoundEvidence
): RelatedEntity[] {
  const texts = [
    ...(evidence.view?.manufacturingTexts || []),
    ...evidence.literature.slice(0, 8).map((h) => `${h.title} ${h.abstract || ""}`),
  ].join("\n");

  const out: RelatedEntity[] = [];
  const seen = new Set<string>();

  // CAS RN mentions near a role-ish word
  const casRe =
    /\b(\d{2,7}-\d{2}-\d)\b/g;
  let m: RegExpExecArray | null;
  while ((m = casRe.exec(texts)) !== null) {
    const cas = m[1];
    if (seen.has(cas)) continue;
    seen.add(cas);
    // Skip if same as main identity CAS when we add that later
    out.push({
      role: "other",
      name: `CAS ${cas}`,
      cas,
      notes: "CAS mentioned in public manufacturing or literature text",
    });
    if (out.length >= 8) break;
  }

  return out;
}

export function mergeRelatedEntities(
  ...lists: RelatedEntity[][]
): RelatedEntity[] {
  const seen = new Set<string>();
  const out: RelatedEntity[] = [];
  for (const list of lists) {
    for (const e of list) {
      const key = `${e.role}:${e.name.toLowerCase()}:${e.cas || e.pubchemCid || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Prefer entries with pubchemCid / href
      out.push({
        ...e,
        href: e.href || (e.pubchemCid ? routes.pubchem(e.pubchemCid) : undefined),
      });
    }
  }
  return out.slice(0, 24);
}

/** Ensure related entity links resolve when CID known. */
export function withEntityLinks(entities: RelatedEntity[]): RelatedEntity[] {
  return entities.map((e) => ({
    ...e,
    href:
      e.href ||
      (e.pubchemCid
        ? routes.pubchem(e.pubchemCid)
        : e.cas
          ? routes.search(e.cas)
          : undefined),
  }));
}
