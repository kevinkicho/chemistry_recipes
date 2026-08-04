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

export type ColdCidKpiReport = {
  schema: typeof COLD_CID_KPI_SCHEMA;
  generatedAt: string;
  baseUrl?: string;
  floors: typeof COLD_CID_FLOORS;
  summary: {
    total: number;
    metFloor: number;
    failedFloor: number;
    errors: number;
  };
  rows: Array<
    ColdCidKpiSnapshot & {
      ok: boolean;
      error?: string;
      durationMs?: number;
    }
  >;
};

/** Build a markdown report for CI / ops from KPI rows. */
export function formatColdCidKpiReportMarkdown(report: ColdCidKpiReport): string {
  const lines = [
    `# Cold-CID densify KPI report`,
    ``,
    `- Generated: ${report.generatedAt}`,
    report.baseUrl ? `- Base: ${report.baseUrl}` : null,
    `- Floor met: **${report.summary.metFloor}/${report.summary.total}** · errors ${report.summary.errors}`,
    `- Floors: proc≥${report.floors.procedureChars} · facts≥${report.floors.processFacts} · ideal≥${report.floors.idealParity} · evidence≥${report.floors.evidenceScore}`,
    ``,
    `| CID | Name | Floor | Proc | Facts | Ideal | Evidence | Notes |`,
    `|-----|------|-------|------|-------|-------|----------|-------|`,
  ].filter(Boolean) as string[];

  for (const r of report.rows) {
    const floor = !r.ok
      ? "error"
      : r.meetsFloor
        ? "ok"
        : "below";
    lines.push(
      `| ${r.cid} | ${r.name} | ${floor} | ${r.procedureChars} | ${r.processFacts} | ${r.idealParity} | ${r.evidenceScore} | ${(r.error || r.gaps.join("; ") || "—").slice(0, 80)} |`
    );
  }
  lines.push(``);
  lines.push(`Not GMP. Free-public densify quality only.`);
  lines.push(``);
  return lines.join("\n");
}

/**
 * Snapshot metrics from a live dossier-shaped object (API summary or full dossier).
 */
export function snapshotFromDossierLike(
  cid: number,
  name: string,
  d: {
    procedureExcerpts?: Array<{ chars?: number; text?: string }>;
    literature?: Array<{ fullTextExcerpt?: string }>;
    processFacts?: { facts?: Array<{ kind?: string }> };
    idealParity?: { score?: number } | number;
    evidenceScore?: { score?: number } | number;
    processFraming?: string;
    productMode?: string;
  }
): ColdCidKpiSnapshot {
  const procChars =
    (d.procedureExcerpts || []).reduce(
      (n, p) => n + (p.chars || (p.text || "").length),
      0
    ) ||
    (d.literature || []).reduce(
      (n, h) => n + (h.fullTextExcerpt?.length || 0),
      0
    );
  const facts =
    d.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ?? 0;
  const ideal =
    typeof d.idealParity === "number"
      ? d.idealParity
      : d.idealParity?.score ?? 0;
  const evidence =
    typeof d.evidenceScore === "number"
      ? d.evidenceScore
      : d.evidenceScore?.score ?? 0;
  return evaluateColdCidFloors({
    cid,
    name,
    procedureChars: procChars,
    processFacts: facts,
    idealParity: ideal,
    evidenceScore: evidence,
    framing: d.processFraming,
    productMode: d.productMode,
  });
}

export function buildColdCidKpiReport(
  rows: ColdCidKpiReport["rows"],
  opts?: { baseUrl?: string }
): ColdCidKpiReport {
  return {
    schema: COLD_CID_KPI_SCHEMA,
    generatedAt: new Date().toISOString(),
    baseUrl: opts?.baseUrl,
    floors: COLD_CID_FLOORS,
    summary: {
      total: rows.length,
      metFloor: rows.filter((r) => r.ok && r.meetsFloor).length,
      failedFloor: rows.filter((r) => r.ok && !r.meetsFloor).length,
      errors: rows.filter((r) => !r.ok).length,
    },
    rows,
  };
}
