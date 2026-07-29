/**
 * Live dossier built from free public APIs + optional Ollama Cloud synthesis.
 * Never pretends to be a curated GMP process package. No static molecule content.
 */

import type { ApiFetchTrace } from "@/lib/api/trace";
import type { PubChemHit } from "@/lib/api/pubchem";
import type { PugViewResult } from "@/lib/api/pubchemView";
import type { LiteratureHit } from "@/lib/api/europePmc";
import type { PatentHit } from "@/lib/api/patentsView";
import type {
  ApparatusItem,
  EnvironmentSpec,
  HazardSummary,
  Material,
  ProcessRoute,
  ScaleUpNotes,
  SourceRef,
} from "@/lib/types/process";
import type { ProcessFactBundle } from "@/lib/dossier/processFacts";

export type DossierTier = "B" | "C";

export interface SynthesizedStep {
  order: number;
  title: string;
  description: string;
  mechanismClass?: string;
  mechanismNotes?: string;
  conditions?: {
    temperatureC?: string;
    pressure?: string;
    time?: string;
    ph?: string;
    atmosphere?: string;
    agitation?: string;
    other?: string;
  };
  materials?: Array<{ role?: string; name: string; cas?: string; stoich?: string; notes?: string }>;
  apparatus?: ApparatusItem[];
  environment?: EnvironmentSpec;
  controls?: {
    ipcMethods?: string[];
    criticalParameters?: string[];
    cqaTargets?: string[];
    holdPoints?: string[];
  };
  workup?: string;
  scaleNotes?: string;
  evidenceNote?: string;
}

export interface SynthesizedRoute {
  id: string;
  name: string;
  type:
    | "industrial"
    | "literature"
    | "biosynthetic"
    | "biocatalytic"
    | "fermentative"
    | "formulation"
    | "downstream"
    | "upstream"
    | "alternative";
  scaleClass?: "lab" | "kilo" | "pilot" | "commercial" | "continuous";
  summary: string;
  steps: SynthesizedStep[];
  materials?: Material[];
  advantages?: string[];
  disadvantages?: string[];
  isolation?: string;
  scaleUp?: ScaleUpNotes;
  overallYieldNote?: string;
  evidenceRefs?: string[];
}

/** One free-public data feed item that was sent into the AI prompt. */
export interface AiDataFeedSource {
  id: string;
  name: string;
  organization?: string;
  /** What role this feed plays (identity, manufacturing text, literature, …) */
  role: string;
  /** Free public deep link when available */
  url?: string;
  /** API endpoint that produced this feed (if known) */
  endpointUrl?: string;
  /** Truncated content excerpt actually fed to the model */
  content: string;
}

/**
 * Full provenance for one Ollama synthesis call.
 * Attached to AI-generated UI so every chip can open prompt/data/model/timing.
 */
export interface AiProvenanceRecord {
  provider: "ollama-cloud" | "ollama-local";
  host: string;
  model: string;
  /** ISO start time */
  startedAt: string;
  /** ISO end time */
  finishedAt: string;
  /** Wall-clock ms for the chat call */
  responseTimeMs: number;
  /** System message sent to the model */
  systemPrompt: string;
  /** User message (includes evidence package) */
  userPrompt: string;
  /** Raw evidence JSON string fed into the user prompt */
  dataFed: string;
  /** Structured inventory of sources + excerpts that made up dataFed */
  dataSources: AiDataFeedSource[];
  /** Truncated model response body */
  responsePreview?: string;
  /** Full response length in chars before truncate */
  responseChars?: number;
  parsed: boolean;
  error?: string;
  /** Which dossier fields this call produced when parsed */
  fieldsGenerated?: string[];
  endpointUrl: string;
  method: "POST";
  keySource?: string | null;
}

/** Evidence tension: lit vs patent (or routes) disagree — surface, don't resolve. */
export interface EvidenceContradiction {
  id: string;
  topic: string;
  sideA: string;
  sideB: string;
  severity: "info" | "warning";
  sourceHint?: string;
}

/** How AI/evidence filled a modality unit-op slot (never invents empty fills). */
export interface UnitOpFill {
  templateOpId: string;
  title: string;
  /** Matched process step ids when filled from a route */
  filledFromStepIds?: string[];
  status: "filled" | "partial" | "empty";
  notes?: string;
}

export interface AiSynthesis {
  available: boolean;
  model?: string;
  overview?: string;
  applications?: string[];
  manufacturingSummary?: string;
  routes?: SynthesizedRoute[];
  apparatusCatalog?: ApparatusItem[];
  environmentBaseline?: EnvironmentSpec;
  ehsHighlights?: string[];
  gaps?: string[];
  /** Impurities / intermediates / reagents named from evidence */
  relatedEntities?: import("@/lib/types/process").RelatedEntity[];
  /** Explicit tensions between public sources */
  contradictions?: EvidenceContradiction[];
  /** Inferred modality when AI provides one */
  modality?: import("@/lib/types/process").ProcessModality;
  /** Mapping of modality template unit ops → evidence-backed steps */
  unitOpFills?: UnitOpFill[];
  confidence?: "low" | "medium" | "high";
  disclaimer?: string;
  rawError?: string;
  /** True when JSON was parsed from model output */
  parsed?: boolean;
  /** Ollama call provenance for AI chips on generated content */
  provenance?: AiProvenanceRecord;
}

/** Non-PubChem free-public annotations shown on the dossier + fed to AI. */
export interface ExternalAnnotation {
  source: string;
  organization?: string;
  kind:
    | "identity"
    | "regulatory"
    | "pathway"
    | "mechanism"
    | "literature"
    | "hazards"
    | "other";
  title: string;
  summary?: string;
  url?: string;
  endpointUrl?: string;
  fields?: Record<string, string>;
}

export interface CompoundEvidence {
  cid: number;
  identity: PubChemHit | null;
  view: PugViewResult | null;
  literature: LiteratureHit[];
  patents: PatentHit[];
  /** ChEMBL, openFDA, RxNorm, KEGG, MyChem, Crossref, … */
  annotations: ExternalAnnotation[];
  /**
   * Long procedure-bearing excerpts (OA full text, patent windows, ORD snippets).
   * Fed into processFacts + AI data package for denser recipe drafting.
   */
  procedureExcerpts?: ProcedureExcerpt[];
  literatureQuery?: string;
  patentsQuery?: string;
  patentsNote?: string;
  traces: ApiFetchTrace[];
  sourceRefs: SourceRef[];
  fetchErrors: string[];
  /** Extracted process fact atoms (accuracy layer) */
  processFacts?: ProcessFactBundle;
}

/** Free-public procedure / methods window for process-fact densification */
export interface ProcedureExcerpt {
  id: string;
  source:
    | "europepmc-oa"
    | "patent"
    | "ord"
    | "pubchem-mfg"
    | "kegg-reaction"
    | "rhea"
    | "orgsyn"
    | "arxiv"
    | "pubmed"
    | "user-supplement"
    | "other";
  label: string;
  text: string;
  url?: string;
  chars: number;
}

export interface EvidenceScoreSnapshot {
  score: number;
  confidence: "low" | "medium" | "high";
  shouldSynthesize: boolean;
  preferFastModel: boolean;
  reasons: string[];
  processLitCount: number;
  processPatentCount: number;
  /** Sourced condition atoms extracted from public text */
  processFactConditions?: number;
  unitOpFacts?: number;
  productionBriefEligible?: boolean;
  /** Short human lines for the score explainer UI */
  explainer?: string[];
  /** Whether AI was recommended */
  aiRecommendation?: string;
}

/** Audit trail of how a live dossier was assembled (for tech-transfer + QA). */
export interface DossierBuildAudit {
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  cid: number;
  steps: Array<{
    id: string;
    label: string;
    ok?: boolean;
    durationMs?: number;
    detail?: string;
  }>;
  model?: string;
  fastModelPreferred?: boolean;
  apiTraceCount?: number;
  literatureCount?: number;
  patentCount?: number;
  evidenceScore?: number;
  buildMode?: LiveDossier["buildMode"];
  /** Densify / procedure quality for support & observability */
  densifyQuality?: {
    procedureExcerptCount: number;
    procedureChars: number;
    oaLitWindows: number;
    patentWindows: number;
    processFactConditions: number;
    unitOpFacts: number;
    softFailHints?: string[];
    /** From process-knowledge package when attached */
    conditionObservations?: number;
    knowledgeHypotheses?: number;
    /** Procedure-rich OA/patent window depth 0–100 */
    literatureDepthScore?: number;
    procedureRichWindows?: number;
  };
}

export interface LiveDossier {
  tier: DossierTier;
  cid: number;
  identity: PubChemHit | null;
  hazards: HazardSummary;
  manufacturingTexts: string[];
  propertyTexts: string[];
  descriptionTexts: string[];
  literature: LiteratureHit[];
  patents: PatentHit[];
  /** Multi-source free public annotations (ChEMBL, openFDA, KEGG, …) */
  annotations: ExternalAnnotation[];
  synthesis: AiSynthesis;
  traces: ApiFetchTrace[];
  sourceRefs: SourceRef[];
  processRoutes: ProcessRoute[];
  disclaimer: string;
  generatedAt: string;
  /** Free-public evidence richness (drives AI + confidence UX) */
  evidenceScore?: EvidenceScoreSnapshot;
  /** Structured process facts extracted from free-public text */
  processFacts?: ProcessFactBundle;
  /**
   * Harvested procedure windows (OA, patent, OrgSyn, ORD, …) for AI ingest.
   * Not a UI full-text preview — durable multi-source densify payload.
   */
  procedureExcerpts?: ProcedureExcerpt[];
  /** process-recipe vs evidence-lead-pack framing for UI */
  processFraming?: import("@/lib/dossier/processFacts").ProcessFraming;
  /** Scout vs recipe-draft vs teaching-package product mode */
  productMode?: import("@/lib/dossier/recipeReadiness").ProductMode;
  /** Gaps that block a credible manufacturing recipe draft */
  recipeReadiness?: import("@/lib/dossier/recipeReadiness").RecipeReadiness;
  /** How this dossier was produced */
  buildMode?: "ai" | "evidence-shell" | "ai-skipped-thin-evidence";
  /** Inferred production modality (small-molecule default) */
  modality?: import("@/lib/types/process").ProcessModality;
  /** Related impurities / intermediates when known from evidence or AI */
  relatedEntities?: import("@/lib/types/process").RelatedEntity[];
  /** Lit/patent/route tensions for professional review */
  contradictions?: EvidenceContradiction[];
  /** Modality unit-op fill status (template slots × evidence) */
  unitOpFills?: UnitOpFill[];
  /** Build audit for exports and QA review */
  buildAudit?: DossierBuildAudit;
  /** Second-pass quote-grounding of AI route conditions */
  groundingReport?: import("@/lib/dossier/quoteGrounding").GroundingReport;
  /**
   * Progress toward curated Tier-A ideal page depth
   * (ExampleDossierView inventory is the product north star).
   */
  idealParity?: import("@/lib/dossier/idealPage").IdealPageParity;
  /**
   * Frontier process-knowledge package: condition atlas, route hypotheses,
   * conflicts, next experiments, seed Q&A (free-public only).
   */
  processKnowledge?: import("@/lib/frontier/types").ProcessKnowledgePackage;
  /** Snapshot identity when restored from version history */
  snapshotId?: string;
  snapshotSavedAt?: string;
}

export const DEFAULT_DOSSIER_DISCLAIMER =
  "Educational scaffold from free public APIs and optional AI synthesis. " +
  "Not a GMP procedure, batch record, or regulatory filing. " +
  "Validate every claim against primary public sources before any plant use. " +
  "AI text is labeled and may omit or mis-summarize evidence — open provenance and source links.";
