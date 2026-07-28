/**
 * Frontier process-knowledge types.
 * Free-public evidence only — every numeric claim carries quote + source.
 * Not GMP; not invented plant limits.
 */

export type ConditionKind =
  | "temperature"
  | "time"
  | "pressure"
  | "ph"
  | "equiv"
  | "yield"
  | "concentration"
  | "molar-ratio"
  | "atmosphere"
  | "solvent"
  | "catalyst"
  | "other";

export type EvidenceSourceKind =
  | "literature"
  | "patent"
  | "pubchem-mfg"
  | "procedure-excerpt"
  | "process-fact"
  | "annotation"
  | "user-supplement"
  | "other";

/** One grounded condition mention from free-public text */
export interface ConditionObservation {
  id: string;
  kind: ConditionKind;
  /** Normalized display, e.g. "80 °C" or "60–90 °C" */
  raw: string;
  /** Parsed numeric low (when available) — original unit */
  valueLow?: number;
  valueHigh?: number;
  unit?: string;
  /** Values in base units (°C, h, bar, …) for fair comparison */
  baseLow?: number;
  baseHigh?: number;
  baseUnit?: string;
  quote: string;
  sourceKind: EvidenceSourceKind;
  sourceId: string;
  sourceLabel: string;
  sourceUrl?: string;
  /** Document title or patent number */
  documentTitle?: string;
}

/** Aggregated public condition space for one kind */
export interface ConditionDistribution {
  kind: ConditionKind;
  n: number;
  /** Unique raw strings */
  variants: string[];
  /** Numeric summary when ≥1 parseable values (base units) */
  numeric?: {
    min: number;
    max: number;
    median: number;
    unit?: string;
  };
  /** Do reported ranges fail to overlap (base units)? */
  conflict: boolean;
  conflictNote?: string;
  observations: ConditionObservation[];
  summary: string;
}

export interface ConditionAtlas {
  cid: number;
  moleculeName?: string;
  generatedAt: string;
  /** Total observations */
  observationCount: number;
  distributions: ConditionDistribution[];
  /** Free-text solvents / catalysts seen */
  solvents: Array<{ name: string; n: number; quotes: string[] }>;
  catalysts: Array<{ name: string; n: number; quotes: string[] }>;
  summary: string;
  disclaimer: string;
}

export type RouteHypothesisStatus =
  | "evidence-backed"
  | "partial"
  | "thin-lead"
  | "teaching-baseline";

export interface RouteHypothesisStep {
  order: number;
  title: string;
  summary: string;
  unitOp?: string;
  /** Supporting quote ids / source labels */
  support: string[];
  missing: string[];
}

export interface RouteHypothesis {
  id: string;
  name: string;
  status: RouteHypothesisStatus;
  /** 0–100 evidence support (not plant readiness) */
  evidenceScore: number;
  summary: string;
  steps: RouteHypothesisStep[];
  supportingSources: Array<{
    label: string;
    url?: string;
    kind: EvidenceSourceKind;
  }>;
  /** What would falsify / kill this hypothesis as a research path */
  killCriteria: string[];
  /** Why we cannot prefer this over alternatives */
  openQuestions: string[];
  /** Link to process route id when mapped */
  processRouteId?: string;
  isTeaching?: boolean;
}

export interface ScientificConflict {
  id: string;
  topic: string;
  kind: "condition" | "route" | "mechanism" | "hazard" | "other";
  sideA: string;
  sideB: string;
  severity: "info" | "warning";
  /** Experiment that could resolve (not a plant setpoint) */
  resolvingExperiment?: string;
  sourceHint?: string;
}

export interface NextExperiment {
  id: string;
  question: string;
  rationale: string;
  /** What public evidence is missing */
  gap: string;
  priority: "high" | "medium" | "low";
  relatedHypothesisIds?: string[];
  relatedConflictIds?: string[];
}

export interface EvidenceAnswer {
  id: string;
  question: string;
  answer: string;
  /** true only if grounded in package text */
  grounded: boolean;
  citations: Array<{ label: string; url?: string; quote?: string }>;
  insufficientEvidence: boolean;
}

export interface ProcessKnowledgePackage {
  schema: "chemistry-recipes.process-knowledge.v1";
  cid: number;
  moleculeName?: string;
  generatedAt: string;
  /** Internal rebuild fingerprint (client); not for external consumers */
  _fp?: string;
  disclaimer: string;
  conditionAtlas: ConditionAtlas;
  routeHypotheses: RouteHypothesis[];
  conflicts: ScientificConflict[];
  nextExperiments: NextExperiment[];
  /** Seed Q&A over the package (not a live chat session) */
  seedAnswers: EvidenceAnswer[];
  /** Multi-CID process network (related entities + route materials) */
  reactionNetwork?: import("@/lib/frontier/reactionNetwork").ReactionNetwork;
  metrics: {
    observationCount: number;
    hypothesisCount: number;
    conflictCount: number;
    experimentCount: number;
    procedureChars: number;
    processFactConditions: number;
    networkNodes?: number;
    networkEdges?: number;
  };
}
