/** Canonical process model for Chemistry Recipes plant-ready dossiers. */

export type ContentTier = "A" | "B" | "C";
export type ScaleClass = "lab" | "kilo" | "pilot" | "commercial" | "continuous";

/** Production modality — small molecule through biotech unit ops */
export type ProcessModality =
  | "small-molecule"
  | "peptide"
  | "oligonucleotide"
  | "mab"
  | "adc"
  | "cell-therapy"
  | "gene-therapy"
  | "vaccine"
  | "formulation"
  | "sterile-compounding"
  | "media"
  | "fermentation"
  | "other";

/** Role of the entity in a manufacturing / clinical supply context */
export type EntityRole =
  | "api"
  | "intermediate"
  | "impurity"
  | "excipient"
  | "reagent"
  | "solvent"
  | "catalyst"
  | "starting-material"
  | "drug-product"
  | "raw-material"
  | "media-component"
  | "reference-standard"
  | "other";

export type RouteType =
  | "industrial"
  | "literature"
  | "biosynthetic"
  | "biocatalytic"
  | "fermentative"
  | "formulation"
  | "downstream"
  | "upstream"
  | "alternative";

export type SourceType =
  | "api"
  | "literature"
  | "patent"
  | "editorial"
  | "textbook"
  | "orgsyn"
  | "regulatory-pointer";

export interface SourceRef {
  type: SourceType;
  id: string;
  label?: string;
  url?: string;
  note?: string;
  /**
   * Free-public API that actually harvested this citation (not the human deeplink).
   * Used for provenance so DOIs are never shown as "unfetched APIs".
   */
  capturedEndpoint?: string;
  /** ISO time when harvest captured metadata/excerpt for this ref */
  capturedAt?: string;
  /** Abstract / procedure window / API snippet for provenance + AI densify */
  capturedSnippet?: string;
  /** process | clinical | identity — ranking hint for AI feed */
  relevanceTier?: "process" | "clinical" | "identity" | "other";
}

/** Linked related entity (impurity, intermediate, DP, parent API) */
export interface RelatedEntity {
  role: EntityRole;
  name: string;
  cas?: string;
  unii?: string;
  pubchemCid?: number;
  /** App path when known */
  href?: string;
  notes?: string;
}

export interface MoleculeIdentifiers {
  name: string;
  iupacName?: string;
  commonNames?: string[];
  cas?: string;
  inchiKey?: string;
  smiles?: string;
  pubchemCid?: number;
  chebiId?: string;
  unii?: string;
  formula?: string;
  /** Inn / USAN when known */
  inn?: string;
}

export interface PhysChemProps {
  molecularWeight?: number;
  meltingPointC?: number | string;
  boilingPointC?: number | string;
  logP?: number;
  appearance?: string;
  solubility?: string;
}

export interface HazardSummary {
  ghsPictograms?: string[];
  signalWord?: string;
  hazardStatements?: string[];
  precautionaryStatements?: string[];
  notes?: string;
  sourceRefs?: SourceRef[];
}

export interface Material {
  role:
    | "starting-material"
    | "reagent"
    | "solvent"
    | "catalyst"
    | "base"
    | "acid"
    | "quench"
    | "antisolvent"
    | "product"
    | "intermediate"
    | "utility";
  name: string;
  cas?: string;
  stoich?: string;
  puritySpec?: string;
  notes?: string;
}

export type EquipmentClass =
  | "glass-lined-reactor"
  | "hastelloy-reactor"
  | "ss316-reactor"
  | "hydrogenator"
  | "filter-dryer"
  | "nutsche-filter"
  | "centrifuge"
  | "distillation-column"
  | "thin-film-evaporator"
  | "crystallizer"
  | "scrubber"
  | "condenser"
  | "receiver"
  | "drying-oven"
  | "milling"
  | "nitrogen-blanket"
  | "vacuum-system"
  | "heat-exchanger"
  | "continuous-flow-reactor"
  | "packed-bed-reactor"
  | "other";

export interface ApparatusItem {
  equipmentClass: EquipmentClass | string;
  materialOfConstruction?: string;
  capacityHint?: string;
  notes?: string;
  required?: boolean;
}

export interface EnvironmentSpec {
  atmosphere?: string;
  containment?: string;
  atexZone?: string;
  hvacNotes?: string;
  utilities?: string[];
  temperatureEnvelopeC?: string;
  pressureEnvelope?: string;
  notes?: string;
}

export interface ProcessControls {
  ipcMethods?: string[];
  criticalParameters?: string[];
  cqaTargets?: string[];
  holdPoints?: string[];
  typicalYieldPercent?: string;
  typicalPurityPercent?: string;
  notes?: string;
}

export interface StepConditions {
  temperatureC?: string;
  pressure?: string;
  time?: string;
  ph?: string;
  atmosphere?: string;
  agitation?: string;
  other?: string;
}

export interface ProcessStep {
  id: string;
  order: number;
  title: string;
  /** Organic / process chemistry narrative */
  description: string;
  /** Mechanism class for R&D view */
  mechanismClass?: string;
  mechanismNotes?: string;
  materials?: Material[];
  conditions?: StepConditions;
  /** Process-fact atom ids that support conditions/description (citation graph) */
  factIds?: string[];
  apparatus?: ApparatusItem[];
  environment?: EnvironmentSpec;
  controls?: ProcessControls;
  workup?: string;
  scaleNotes?: string;
  sourceRefs?: SourceRef[];
}

export interface ScaleUpNotes {
  labToKilo?: string;
  kiloToPilot?: string;
  pilotToCommercial?: string;
  heatMassTransfer?: string;
  safetyScaleUp?: string;
  wasteStreams?: string[];
  greenChemistryNotes?: string;
}

export interface ProcessRoute {
  id: string;
  name: string;
  type: RouteType;
  preference: number;
  scaleClass: ScaleClass;
  /** Optional modality override for this route (e.g. biocatalytic on a small-molecule entity) */
  modality?: ProcessModality;
  summary: string;
  advantages?: string[];
  disadvantages?: string[];
  materials: Material[];
  steps: ProcessStep[];
  isolation?: string;
  scaleUp?: ScaleUpNotes;
  overallYieldTypical?: string;
  sourceRefs?: SourceRef[];
}

/**
 * First-class Recipe — process intelligence object for the hub.
 * A molecule/entity can have multiple recipes (routes / methods).
 */
export interface Recipe {
  id: string;
  /** Display name of the recipe / route */
  name: string;
  modality: ProcessModality;
  scaleClass: ScaleClass;
  entityRole?: EntityRole;
  route: ProcessRoute;
  relatedEntities?: RelatedEntity[];
  confidence?: "low" | "medium" | "high";
  sourceRefs?: SourceRef[];
  disclaimer?: string;
}

export interface MoleculeDossier {
  id: string;
  tier: ContentTier;
  identifiers: MoleculeIdentifiers;
  modality?: ProcessModality;
  entityRole?: EntityRole;
  properties?: PhysChemProps;
  hazards?: HazardSummary;
  applications?: string[];
  overview: string;
  routes: ProcessRoute[];
  /** Related impurities / intermediates / DP links */
  relatedEntities?: RelatedEntity[];
  manufacturingSummary?: string;
  apparatusCatalog?: ApparatusItem[];
  environmentBaseline?: EnvironmentSpec;
  ehsHighlights?: string[];
  sourceRefs?: SourceRef[];
  lastReviewed?: string;
  disclaimer?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  cas?: string;
  unii?: string;
  formula?: string;
  tier: ContentTier;
  tags?: string[];
  summary: string;
  pubchemCid?: number;
  modality?: ProcessModality;
  entityRole?: EntityRole;
  scaleHints?: ScaleClass[];
  /** Live PubChem path (example/template retired with mock catalogs) */
  kind?: "example" | "live" | "template";
}
