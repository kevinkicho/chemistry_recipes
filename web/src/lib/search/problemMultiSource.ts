/**
 * Problem-first search expanded with free-public multi-source fan-out.
 * Local hub/packages first; then molecule multi-search + process literature.
 */

import {
  searchProblemFirst,
  type ProblemSearchHit,
} from "@/lib/search/problemFirst";
import { multiSourceSearch, type MultiSourceHit } from "@/lib/search/multiSourceSearch";
import { searchEuropePmc, type LiteratureHit } from "@/lib/api/europePmc";
import { searchOpenAlexProcess } from "@/lib/api/openAlex";
import { routes } from "@/lib/routes";

export const PROBLEM_MULTI_SCHEMA =
  "chemistry-recipes.problem-multi-search.v1" as const;

export interface ProblemMultiSearchResult {
  schema: typeof PROBLEM_MULTI_SCHEMA;
  q: string;
  /** Local hub + package + training hits */
  localHits: ProblemSearchHit[];
  /** Openable multi-source molecule hits */
  moleculeHits: MultiSourceHit[];
  /** Process-relevant literature (Europe PMC + OpenAlex) */
  literatureHits: LiteratureHit[];
  /** Unified ranked list for UI */
  unified: ProblemSearchHit[];
  sourceStatus: Array<{ source: string; ok: boolean; hitCount: number }>;
  durationMs: number;
  summary: string;
}

function litToProblemHit(h: LiteratureHit, score: number): ProblemSearchHit {
  return {
    id: `lit-${h.id}`,
    kind: "package", // closest existing kind for teaching/process lit
    title: h.title.slice(0, 120),
    subtitle: [
      h.source,
      h.year,
      h.isOpenAccess ? "OA" : null,
      h.journal,
    ]
      .filter(Boolean)
      .join(" · "),
    href: h.url,
    score,
    tags: ["literature", "process", h.source.toLowerCase()],
  };
}

function moleculeToProblemHit(h: MultiSourceHit): ProblemSearchHit | null {
  if (!h.cid || h.cid <= 0) return null;
  return {
    id: `ms-${h.cid}`,
    kind: "hub-live",
    title: h.name,
    subtitle: [
      `CID ${h.cid}`,
      h.sources.map((s) => s.label.split("·")[0]?.trim()).slice(0, 3).join(", "),
      h.processLiteratureCount
        ? `${h.processLiteratureCount} process papers`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    href: routes.pubchem(h.cid),
    score: 20 + Math.min(30, h.score / 3),
    tags: ["live", "multi-source", ...h.sources.map((s) => s.source)],
  };
}

/**
 * Full problem-first search with free-public multi-source enrichment.
 */
export async function searchProblemFirstMulti(
  query: string,
  limit = 16
): Promise<ProblemMultiSearchResult> {
  const q = query.trim();
  const t0 = Date.now();
  if (!q) {
    return {
      schema: PROBLEM_MULTI_SCHEMA,
      q,
      localHits: [],
      moleculeHits: [],
      literatureHits: [],
      unified: [],
      sourceStatus: [],
      durationMs: 0,
      summary: "Enter a unit-op or process problem",
    };
  }

  const localHits = searchProblemFirst(q, limit);
  const sourceStatus: ProblemMultiSearchResult["sourceStatus"] = [
    {
      source: "local",
      ok: localHits.length > 0,
      hitCount: localHits.length,
    },
  ];

  const [multi, epmc, oalex] = await Promise.allSettled([
    multiSourceSearch(q, Math.min(8, limit)),
    searchEuropePmc(q, {
      limit: 5,
      extraTerms:
        "(synthesis OR manufacturing OR process OR crystalliz* OR hydrogenat* OR workup OR isolation OR unit operation OR fermentation)",
    }),
    searchOpenAlexProcess(q, { limit: 4 }),
  ]);

  let moleculeHits: MultiSourceHit[] = [];
  if (multi.status === "fulfilled") {
    moleculeHits = multi.value.hits.filter((h) => h.openable && h.cid);
    sourceStatus.push({
      source: "multi-molecule",
      ok: moleculeHits.length > 0,
      hitCount: moleculeHits.length,
    });
    for (const s of multi.value.sourceStatus.filter((x) => x.ok)) {
      sourceStatus.push({
        source: s.source,
        ok: true,
        hitCount: s.hitCount,
      });
    }
  } else {
    sourceStatus.push({
      source: "multi-molecule",
      ok: false,
      hitCount: 0,
    });
  }

  const literatureHits: LiteratureHit[] = [];
  if (epmc.status === "fulfilled") {
    literatureHits.push(...epmc.value.hits);
    sourceStatus.push({
      source: "europepmc",
      ok: epmc.value.hits.length > 0,
      hitCount: epmc.value.hits.length,
    });
  } else {
    sourceStatus.push({ source: "europepmc", ok: false, hitCount: 0 });
  }
  if (oalex.status === "fulfilled") {
    literatureHits.push(...oalex.value.hits);
    sourceStatus.push({
      source: "openalex",
      ok: oalex.value.hits.length > 0,
      hitCount: oalex.value.hits.length,
    });
  } else {
    sourceStatus.push({ source: "openalex", ok: false, hitCount: 0 });
  }

  // Deduplicate literature by title
  const litSeen = new Set<string>();
  const litUnique = literatureHits.filter((h) => {
    const k = h.title.toLowerCase().slice(0, 80);
    if (litSeen.has(k)) return false;
    litSeen.add(k);
    return true;
  });

  const unified: ProblemSearchHit[] = [...localHits];
  const hrefSeen = new Set(localHits.map((h) => h.href));

  for (const m of moleculeHits) {
    const ph = moleculeToProblemHit(m);
    if (!ph || hrefSeen.has(ph.href)) continue;
    hrefSeen.add(ph.href);
    unified.push(ph);
  }

  let litScore = 18;
  for (const lit of litUnique.slice(0, 6)) {
    const ph = litToProblemHit(lit, litScore--);
    if (hrefSeen.has(ph.href)) continue;
    hrefSeen.add(ph.href);
    unified.push(ph);
  }

  unified.sort((a, b) => b.score - a.score);
  const trimmed = unified.slice(0, limit);

  const summary = [
    `${localHits.length} local`,
    `${moleculeHits.length} multi-source molecules`,
    `${litUnique.length} process papers`,
  ].join(" · ");

  return {
    schema: PROBLEM_MULTI_SCHEMA,
    q,
    localHits,
    moleculeHits,
    literatureHits: litUnique,
    unified: trimmed,
    sourceStatus,
    durationMs: Date.now() - t0,
    summary,
  };
}
