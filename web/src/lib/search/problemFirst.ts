/**
 * Problem-first / unit-op search helpers.
 * Local static mock hits retired — live multi-source API fills ProblemFirstSearch.
 */

export type ProblemHitKind = "hub-live" | "literature" | "multi-source";

export interface ProblemSearchHit {
  id: string;
  kind: ProblemHitKind;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  tags: string[];
}

/**
 * Local static problem hits — always empty (no mock hub catalog).
 * UI uses multi-source `/api/search/problem` for live CIDs + literature.
 */
export function searchProblemFirst(
  query: string,
  limit = 16
): ProblemSearchHit[] {
  void query;
  void limit;
  return [];
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
