/**
 * Cold-CID quality floors for live densify (no curated mocks).
 * Used by diagnostics UI + offline contract suite + optional live probes.
 */

export const COLD_CID_KPI_SCHEMA = "chemistry-recipes.cold-cid-kpi.v1" as const;

/** Business-facing CIDs for densify quality floors (not hub teaching mocks). */
export const GOLDEN_COLD_CIDS: ReadonlyArray<{
  name: string;
  cid: number;
  note?: string;
}> = [
  { name: "Aspirin", cid: 2244, note: "canonical process-lit molecule" },
  { name: "Sitagliptin", cid: 4369359, note: "API densify depth" },
  { name: "Penicillin G", cid: 5904, note: "classic fermentation/process" },
  { name: "Amoxicillin", cid: 33613, note: "beta-lactam process lit" },
  { name: "Ibuprofen", cid: 3672, note: "industrial route literature" },
  { name: "Metformin", cid: 4091, note: "simple API densify" },
  { name: "Baricitinib", cid: 44205240, note: "cold non-hub" },
  { name: "Filgotinib", cid: 49831257, note: "cold non-hub" },
  { name: "Larotrectinib", cid: 46188928, note: "cold non-hub" },
  { name: "Caffeine", cid: 2519, note: "fast smoke densify" },
];

/** Soft floors for “useful densify” (not GMP). */
export const COLD_CID_FLOORS = {
  /** Min free-public procedure characters after densify */
  procedureChars: 800,
  /** Min sourced process facts (non open-gap) */
  processFacts: 2,
  /** Min ideal-page parity score */
  idealParity: 35,
  /** Min evidence score */
  evidenceScore: 28,
} as const;

export type ColdCidKpiSnapshot = {
  cid: number;
  name: string;
  procedureChars: number;
  processFacts: number;
  idealParity: number;
  evidenceScore: number;
  framing?: string;
  productMode?: string;
  meetsFloor: boolean;
  gaps: string[];
};

export function evaluateColdCidFloors(input: {
  cid: number;
  name?: string;
  procedureChars?: number;
  processFacts?: number;
  idealParity?: number;
  evidenceScore?: number;
  framing?: string;
  productMode?: string;
}): ColdCidKpiSnapshot {
  const procedureChars = input.procedureChars ?? 0;
  const processFacts = input.processFacts ?? 0;
  const idealParity = input.idealParity ?? 0;
  const evidenceScore = input.evidenceScore ?? 0;
  const gaps: string[] = [];
  if (procedureChars < COLD_CID_FLOORS.procedureChars) {
    gaps.push(
      `procedure chars ${procedureChars} < ${COLD_CID_FLOORS.procedureChars}`
    );
  }
  if (processFacts < COLD_CID_FLOORS.processFacts) {
    gaps.push(`process facts ${processFacts} < ${COLD_CID_FLOORS.processFacts}`);
  }
  if (idealParity < COLD_CID_FLOORS.idealParity) {
    gaps.push(`ideal ${idealParity} < ${COLD_CID_FLOORS.idealParity}`);
  }
  if (evidenceScore < COLD_CID_FLOORS.evidenceScore) {
    gaps.push(
      `evidence ${evidenceScore} < ${COLD_CID_FLOORS.evidenceScore}`
    );
  }
  return {
    cid: input.cid,
    name: input.name || `CID ${input.cid}`,
    procedureChars,
    processFacts,
    idealParity,
    evidenceScore,
    framing: input.framing,
    productMode: input.productMode,
    meetsFloor: gaps.length === 0,
    gaps,
  };
}

export function coldCidKpiManifest() {
  return {
    schema: COLD_CID_KPI_SCHEMA,
    floors: COLD_CID_FLOORS,
    golden: GOLDEN_COLD_CIDS,
    note:
      "Quality floors for free-public densify demos/regression. Not GMP readiness. " +
      "Empty curated Tier-A catalogs are intentional — live densify is the product.",
  };
}
