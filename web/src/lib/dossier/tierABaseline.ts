/**
 * Tier-A mock teaching merge retired.
 * Live dossiers use free-public densify + AI dual-view only.
 */

import type { LiveDossier } from "@/lib/dossier/types";

/** No-op: never inject mock Tier-A routes into live pages. */
export function applyTierABaseline(dossier: LiveDossier): LiveDossier {
  return dossier;
}
