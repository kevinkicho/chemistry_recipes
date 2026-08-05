/**
 * Live-only product: no local mock molecule hub.
 * Helpers remain for call-site compatibility and always return empty.
 */

export type HubIndexEntry = {
  pubchemCid: number;
  name: string;
  cas?: string;
  kind: string;
};

/** Always empty — product is free-public densify, not a teaching hub. */
export const HUB_INDEX: HubIndexEntry[] = [];

export function findHubByCid(cid: number): HubIndexEntry | undefined {
  void cid;
  return undefined;
}

export type HubSearchHit = {
  cid: number;
  name: string;
  cas?: string;
};

/** No local offline index — multi-source APIs resolve names. */
export function resolveLocalHubCids(
  query: string,
  limit = 12
): HubSearchHit[] {
  void query;
  void limit;
  return [];
}
