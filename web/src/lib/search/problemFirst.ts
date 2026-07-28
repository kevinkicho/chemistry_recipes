/**
 * Problem-first / unit-op search over hub catalog + curated packages.
 * Free-text ranking only — no invented plant answers.
 */

import { HUB_INDEX } from "@/lib/data/hubIndex";
import { getAllCuratedPackages } from "@/lib/data/curatedPackages";
import { routes } from "@/lib/routes";

export type ProblemHitKind = "hub-live" | "hub-example" | "package";

export interface ProblemSearchHit {
  id: string;
  kind: ProblemHitKind;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  tags: string[];
}

const UNIT_OP_SYNONYMS: Record<string, string[]> = {
  crystalliz: ["crystallization", "recrystall", "crystal"],
  filtr: ["filtration", "filter", "nutsche"],
  distill: ["distillation", "distill"],
  extract: ["extraction", "extract", "liquid-liquid"],
  hydrogenat: ["hydrogenation", "h2", "hydrogen"],
  hydroly: ["hydrolysis", "hydrolyze"],
  coupling: ["coupling", "suzuki", "amide"],
  ferment: ["fermentation", "ferment", "upstream"],
  chromat: ["chromatography", "hplc", "column"],
  dry: ["drying", "lyophil", "tray dry"],
  workup: ["workup", "work-up", "quench"],
  isolation: ["isolation", "isolate", "precipitat"],
  mab: ["monoclonal", "mab", "antibody", "capture"],
  gene: ["aav", "lentiviral", "gene therapy"],
  cell: ["cell therapy", "car-t", "expansion"],
};

function expandQuery(q: string): string[] {
  const base = q.toLowerCase().trim();
  if (!base) return [];
  const tokens = base.split(/[\s,/+]+/).filter(Boolean);
  const out = new Set(tokens);
  out.add(base);
  for (const [key, syns] of Object.entries(UNIT_OP_SYNONYMS)) {
    if (base.includes(key) || tokens.some((t) => t.includes(key) || key.includes(t))) {
      for (const s of syns) out.add(s);
    }
    for (const s of syns) {
      if (base.includes(s) || tokens.some((t) => s.includes(t) || t.includes(s))) {
        out.add(key);
        for (const x of syns) out.add(x);
      }
    }
  }
  return [...out];
}

function scoreText(hay: string, needles: string[]): number {
  const h = hay.toLowerCase();
  let s = 0;
  for (const n of needles) {
    if (!n) continue;
    if (h.includes(n)) s += n.length >= 6 ? 8 : 4;
  }
  return s;
}

export function searchProblemFirst(query: string, limit = 16): ProblemSearchHit[] {
  const needles = expandQuery(query);
  if (!needles.length) return [];

  const hits: ProblemSearchHit[] = [];

  for (const e of HUB_INDEX) {
    const hay = `${e.name} ${e.cas || ""} ${e.exampleId || ""} ${e.kind}`;
    const sc = scoreText(hay, needles);
    if (sc < 4) continue;
    if (e.pubchemCid) {
      hits.push({
        id: `live-${e.pubchemCid}`,
        kind: "hub-live",
        title: e.name,
        subtitle: `Live CID ${e.pubchemCid}${e.cas ? ` · CAS ${e.cas}` : ""}`,
        href: routes.pubchem(e.pubchemCid),
        score: sc + (e.kind === "example" ? 2 : 0),
        tags: ["live", e.kind],
      });
    }
    if (e.kind === "example" && e.exampleId) {
      hits.push({
        id: `ex-${e.exampleId}`,
        kind: "hub-example",
        title: `${e.name} (training)`,
        subtitle: "Curated dual-view example · Info",
        href: routes.example(e.exampleId),
        score: sc + 1,
        tags: ["training", "tier-a"],
      });
    }
  }

  for (const p of getAllCuratedPackages()) {
    const hay = `${p.name} ${p.id} ${p.modality || ""} ${(p.tags || []).join(" ")} ${p.summary || ""}`;
    const sc = scoreText(hay, needles);
    if (sc < 4) continue;
    hits.push({
      id: `pkg-${p.id}`,
      kind: "package",
      title: p.name,
      subtitle: `${p.modality || "package"} · educational unit ops`,
      href: routes.package(p.id),
      score: sc + 3,
      tags: [p.modality || "package", "teaching"],
    });
  }

  hits.sort((a, b) => b.score - a.score);
  // de-dupe by href
  const seen = new Set<string>();
  const out: ProblemSearchHit[] = [];
  for (const h of hits) {
    if (seen.has(h.href)) continue;
    seen.add(h.href);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

export const PROBLEM_SEARCH_HINTS = [
  "crystallization",
  "hydrogenation",
  "mAb capture",
  "fermentation",
  "workup extraction",
  "gene therapy downstream",
  "filtration isolation",
];
