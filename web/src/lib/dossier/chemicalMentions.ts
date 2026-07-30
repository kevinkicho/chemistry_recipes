/**
 * Extract named process chemicals + roles from free-public text (no invention).
 * Used for BOM / related-entity fill when AI is unavailable.
 */

import type { EntityRole, Material } from "@/lib/types/process";
import type { RelatedEntity } from "@/lib/types/process";
import { routes } from "@/lib/routes";

/** Well-known process chemicals (public teaching set) — only match if text contains the name. */
const KNOWN: Array<{
  names: string[];
  role: EntityRole;
  cas?: string;
  pubchemCid?: number;
}> = [
  { names: ["salicylic acid"], role: "starting-material", cas: "69-72-7", pubchemCid: 338 },
  { names: ["acetic anhydride"], role: "reagent", cas: "108-24-7", pubchemCid: 7918 },
  { names: ["acetic acid"], role: "solvent", cas: "64-19-7", pubchemCid: 176 },
  { names: ["sulfuric acid", "h2so4"], role: "catalyst", cas: "7664-93-9", pubchemCid: 1118 },
  { names: ["phosphoric acid"], role: "catalyst", cas: "7664-38-2", pubchemCid: 1004 },
  { names: ["4-aminophenol", "p-aminophenol", "para-aminophenol"], role: "intermediate", cas: "123-30-8", pubchemCid: 403 },
  { names: ["acetic anhydride"], role: "reagent", cas: "108-24-7", pubchemCid: 7918 },
  { names: ["methanol"], role: "solvent", cas: "67-56-1", pubchemCid: 887 },
  { names: ["ethanol", "ethyl alcohol"], role: "solvent", cas: "64-17-5", pubchemCid: 702 },
  { names: ["isopropanol", "ipa", "2-propanol", "isopropyl alcohol"], role: "solvent", cas: "67-63-0", pubchemCid: 3776 },
  { names: ["toluene"], role: "solvent", cas: "108-88-3", pubchemCid: 1140 },
  { names: ["dichloromethane", "methylene chloride", "dcm"], role: "solvent", cas: "75-09-2", pubchemCid: 6344 },
  { names: ["ethyl acetate", "etoac"], role: "solvent", cas: "141-78-6", pubchemCid: 8857 },
  { names: ["acetone"], role: "solvent", cas: "67-64-1", pubchemCid: 180 },
  { names: ["tetrahydrofuran", "thf"], role: "solvent", cas: "109-99-9", pubchemCid: 8028 },
  { names: ["dimethylformamide", "dmf"], role: "solvent", cas: "68-12-2", pubchemCid: 6228 },
  { names: ["dimethyl sulfoxide", "dmso"], role: "solvent", cas: "67-68-5", pubchemCid: 679 },
  { names: ["hydrogen", "h2 gas"], role: "reagent", cas: "1333-74-0", pubchemCid: 783 },
  { names: ["palladium", "pd/c", "palladium on carbon"], role: "catalyst", pubchemCid: 23938 },
  { names: ["platinum", "pt/c"], role: "catalyst" },
  { names: ["raney nickel"], role: "catalyst" },
  { names: ["sodium hydroxide", "naoh"], role: "reagent", cas: "1310-73-2", pubchemCid: 14798 },
  { names: ["hydrochloric acid", "hcl"], role: "reagent", cas: "7647-01-0", pubchemCid: 313 },
  { names: ["sodium bicarbonate", "nahco3"], role: "reagent", cas: "144-55-8", pubchemCid: 516892 },
  { names: ["triethylamine", "tea", "et3n"], role: "reagent", cas: "121-44-8", pubchemCid: 8471 },
  { names: ["sodium borohydride", "nabh4"], role: "reagent", cas: "16940-66-2", pubchemCid: 4311764 },
  { names: ["lithium aluminum hydride", "lialh4", "lah"], role: "reagent", cas: "16853-85-3" },
  { names: ["6-apa", "6-aminopenicillanic acid"], role: "intermediate", cas: "551-16-6", pubchemCid: 8745 },
  { names: ["penicillin g", "benzylpenicillin"], role: "api", cas: "61-33-6", pubchemCid: 5904 },
  { names: ["glucose", "dextrose"], role: "raw-material", cas: "50-99-7", pubchemCid: 5793 },
  { names: ["lactose"], role: "excipient", cas: "63-42-3", pubchemCid: 440995 },
  { names: ["ibuprofen"], role: "api", cas: "15687-27-1", pubchemCid: 3672 },
  { names: ["paracetamol", "acetaminophen"], role: "api", cas: "103-90-2", pubchemCid: 1983 },
  { names: ["aspirin", "acetylsalicylic acid"], role: "api", cas: "50-78-2", pubchemCid: 2244 },
];

const ROLE_NEAR =
  /\b(starting\s*material|substrate|reagent|solvent|catalyst|impurity|intermediate|base|acid|quench|antisolvent)\b/i;

/** Process / manufacturing language near a mention */
const PROCESS_CTX =
  /\b(synthesis|synthesi[sz]|preparation|preparing|manufactur|reaction|reacted|solvent|reagent|catalyst|hydrogenat|crystalliz|equiv|eq\.|°\s*C|mmol|mol\b|work[\s-]?up|quench|starting material|intermediate|reflux|distill|extract|charge|batch|process chemistry|example\s+\d)\b/i;

/**
 * Common words that appear in clinical/biology prose without process meaning.
 * Require process context window before accepting.
 */
const REQUIRE_PROCESS_CTX = new Set([
  "glucose",
  "dextrose",
  "ethanol",
  "ethyl alcohol",
  "methanol",
  "acetone",
  "platinum",
  "pt/c",
  "hydrogen",
  "h2 gas",
  "lactose",
]);

function hasProcessContextNear(
  hay: string,
  matchIndex: number,
  matchLen: number
): boolean {
  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(hay.length, matchIndex + matchLen + 100);
  return PROCESS_CTX.test(hay.slice(start, end));
}

export function extractChemicalMentions(
  text: string,
  opts?: { excludeName?: string; requireProcessContext?: boolean }
): RelatedEntity[] {
  if (!text || text.length < 12) return [];
  const hay = text.toLowerCase();
  const exclude = (opts?.excludeName || "").toLowerCase().trim();
  const strict = opts?.requireProcessContext !== false;
  const out: RelatedEntity[] = [];
  const seen = new Set<string>();

  for (const k of KNOWN) {
    let hitName: string | null = null;
    let matchIndex = -1;
    let matchLen = 0;
    for (const n of k.names) {
      if (exclude && (n === exclude || exclude.includes(n))) continue;
      // word-boundary-ish match
      const re = new RegExp(
        `(?:^|[^a-z0-9])(${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?:[^a-z0-9]|$)`,
        "i"
      );
      const m = re.exec(hay);
      if (m) {
        hitName = k.names[0];
        matchIndex = m.index + (m[0].length - (m[1]?.length || n.length));
        matchLen = (m[1] || n).length;
        break;
      }
    }
    if (!hitName || matchIndex < 0) continue;

    // Noisy commons (glucose, ethanol, platinum…) need process context
    const needsCtx =
      strict &&
      k.names.some((n) => REQUIRE_PROCESS_CTX.has(n.toLowerCase()));
    if (needsCtx && !hasProcessContextNear(hay, matchIndex, matchLen)) {
      continue;
    }

    const key = `${k.role}:${hitName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      role: k.role,
      name: hitName.replace(/\b\w/g, (c) => c.toUpperCase()),
      cas: k.cas,
      pubchemCid: k.pubchemCid,
      href: k.pubchemCid ? routes.pubchem(k.pubchemCid) : undefined,
      notes: "Named in free-public process/literature text",
    });
  }

  // Role + CAS nearby (e.g. "solvent methanol" already covered; CAS alone handled elsewhere)
  if (ROLE_NEAR.test(hay) && out.length === 0) {
    /* known table is primary — no free invention of unknown names */
  }

  return out.slice(0, 20);
}

export function materialsFromMentions(entities: RelatedEntity[]): Material[] {
  const roleMap: Record<string, Material["role"]> = {
    "starting-material": "starting-material",
    intermediate: "intermediate",
    impurity: "product", // rare as BOM
    reagent: "reagent",
    solvent: "solvent",
    catalyst: "catalyst",
    api: "product",
    base: "base",
    acid: "acid",
  };
  return entities
    .filter((e) => e.role !== "api" && e.role !== "impurity" && e.role !== "drug-product")
    .map((e) => ({
      role: roleMap[e.role] || "reagent",
      name: e.name,
      cas: e.cas,
      notes: e.notes,
    }))
    .slice(0, 16);
}

/** Pull free-public blobs for mention scan (prefer process-dense sources). */
export function evidenceTextBlob(parts: {
  manufacturingTexts?: string[];
  literature?: Array<{ title: string; abstract?: string }>;
  patents?: Array<{ title?: string; abstract?: string }>;
  processFactQuotes?: string[];
  procedureExcerpts?: Array<{ text?: string } | string>;
}): string {
  const excerpts = (parts.procedureExcerpts || []).map((e) =>
    typeof e === "string" ? e : e.text || ""
  );
  return [
    ...(parts.manufacturingTexts || []),
    ...excerpts.slice(0, 16),
    ...(parts.processFactQuotes || []).slice(0, 24),
    // Patents first (structured process IP), then literature
    ...(parts.patents || [])
      .slice(0, 10)
      .map((p) => `${p.title || ""} ${p.abstract || ""}`),
    ...(parts.literature || [])
      .slice(0, 8)
      .map((h) => `${h.title} ${h.abstract || ""}`),
  ].join("\n");
}
