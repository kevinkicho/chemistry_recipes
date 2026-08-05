/**
 * Client-side offline name→CID index (retired with mock hub/packages).
 * Always empty — live multi-source search is the product path.
 */

export type LocalSearchHit = {
  cid: number;
  name: string;
  cas?: string;
  formula?: string;
};

/** No local mock catalog. Callers fall through to free-public APIs. */
export function resolveLocalSearchHits(
  query: string,
  limit = 12
): LocalSearchHit[] {
  void query;
  void limit;
  return [];
}
