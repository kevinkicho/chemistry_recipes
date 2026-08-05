/**
 * Problem-first search expanded with free-public multi-source fan-out.
 * Multi-search + process literature only — no mock hub or teaching packages.
 */

import {
  searchProblemFirst,
  type ProblemSearchHit,
} from "@/lib/search/problemFirst";
import { multiSourceSearch, type MultiSourceHit } from "@/lib/search/multiSourceSearch";
import { searchEuropePmc, type LiteratureHit } from "@/lib/api/europePmc";
import { searchOpenAlexProcess } from "@/lib/api/openAlex";
import { searchSemanticScholarProcess } from "@/lib/api/semanticScholar";
import { searchPubMedProcess } from "@/lib/api/pubmed";
import { searchArxivProcess } from "@/lib/api/arxiv";
import { routes } from "@/lib/routes";

export const PROBLEM_MULTI_SCHEMA =
  "chemistry-recipes.problem-multi-search.v1" as const;

export interface ProblemMultiSearchResult {
  schema: typeof PROBLEM_MULTI_SCHEMA;
  q: string;
  /** Legacy local resolve hits (always empty in live product) */
  localHits: ProblemSearchHit[];
  /** Openable multi-source molecule hits */
  moleculeHits: MultiSourceHit[];
  /** Process-relevant literature (EPMC + OpenAlex + S2 + PubMed + arXiv) */
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
    kind: "literature",
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

  // Static mock problem hits retired — always empty
  const localHits = searchProblemFirst(q, limit);
  const sourceStatus: ProblemMultiSearchResult["sourceStatus"] = [];

  const [multi, epmc, oalex, s2, pubmed, arxiv] = await Promise.allSettled([
    multiSourceSearch(q, Math.min(8, limit)),
    searchEuropePmc(q, {
      limit: 5,
      extraTerms:
        "(synthesis OR manufacturing OR process OR crystalliz* OR hydrogenat* OR workup OR isolation OR unit operation OR fermentation)",
    }),
    searchOpenAlexProcess(q, { limit: 4 }),
    searchSemanticScholarProcess(q, { limit: 4 }),
    searchPubMedProcess(q, { limit: 4 }),
    searchArxivProcess(q, { limit: 3 }),
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
  function pushLit(
    source: string,
    res:
      | PromiseFulfilledResult<{ hits: LiteratureHit[] }>
      | PromiseRejectedResult
  ) {
    if (res.status === "fulfilled") {
      literatureHits.push(...res.value.hits);
      sourceStatus.push({
        source,
        ok: res.value.hits.length > 0,
        hitCount: res.value.hits.length,
      });
    } else {
      sourceStatus.push({ source, ok: false, hitCount: 0 });
    }
  }
  pushLit("europepmc", epmc);
  pushLit("openalex", oalex);
  pushLit("semanticscholar", s2);
  pushLit("pubmed", pubmed);
  pushLit("arxiv", arxiv);

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
