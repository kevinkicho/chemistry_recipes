/**
 * Tech-transfer pack builders: structured JSON for MES/LIMS handoff
 * and a printable summary model for browser PDF.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type {
  MoleculeDossier,
  ProcessRoute,
  RelatedEntity,
} from "@/lib/types/process";
import { DEFAULT_DOSSIER_DISCLAIMER } from "@/lib/dossier/types";

export const REGULATORY_DISCLAIMER =
  "NOT FOR REGULATORY DECISION SUPPORT. Not a GMP procedure, batch record, DMF, CTD module, " +
  "or substitute for site SOPs / quality systems. Validate every claim against primary sources " +
  "and your own QMS before any manufacturing or clinical use. AI-generated text is labeled and may err.";

export interface TechTransferPack {
  schema: "chemistry-recipes.tech-transfer.v1";
  exportedAt: string;
  disclaimer: string;
  regulatoryNotice: string;
  entity: {
    name: string;
    cas?: string;
    unii?: string;
    formula?: string;
    molecularWeight?: number;
    pubchemCid?: number;
    inchiKey?: string;
    smiles?: string;
    iupacName?: string;
  };
  confidence?: {
    level?: string;
    score?: number;
    reasons?: string[];
  };
  build?: {
    mode?: string;
    model?: string;
    generatedAt?: string;
    evidenceScore?: number;
  };
  overview?: string;
  manufacturingSummary?: string;
  applications?: string[];
  hazards?: {
    signalWord?: string;
    hazardStatements?: string[];
    precautionaryStatements?: string[];
    notes?: string;
  };
  ehsHighlights?: string[];
  environmentBaseline?: unknown;
  apparatusCatalog?: unknown[];
  routes: Array<{
    id: string;
    name: string;
    type: string;
    scaleClass: string;
    preference: number;
    summary: string;
    overallYieldTypical?: string;
    advantages?: string[];
    disadvantages?: string[];
    materials: Array<{
      role: string;
      name: string;
      cas?: string;
      stoich?: string;
      puritySpec?: string;
      notes?: string;
    }>;
    steps: Array<{
      order: number;
      title: string;
      description: string;
      mechanismClass?: string;
      conditions?: Record<string, string | undefined>;
      apparatus?: Array<{ equipmentClass: string; materialOfConstruction?: string; notes?: string }>;
      criticalParameters?: string[];
      ipcMethods?: string[];
      cqaTargets?: string[];
      holdPoints?: string[];
      workup?: string;
      scaleNotes?: string;
    }>;
    isolation?: string;
    scaleUp?: unknown;
  }>;
  relatedEntities?: RelatedEntity[];
  contradictions?: Array<{
    topic: string;
    sideA: string;
    sideB: string;
    severity: string;
    sourceHint?: string;
  }>;
  unitOpFills?: Array<{
    templateOpId: string;
    title: string;
    status: string;
    notes?: string;
  }>;
  modality?: string;
  literature?: Array<{ title: string; year?: string; url: string; doi?: string }>;
  patents?: Array<{ title: string; id?: string; url?: string }>;
  sources?: Array<{ type: string; id: string; label?: string; url?: string }>;
  gaps?: string[];
  buildAudit?: unknown;
}

function routesFromLive(dossier: LiveDossier): ProcessRoute[] {
  return dossier.processRoutes || [];
}

export function buildTechTransferFromLive(dossier: LiveDossier): TechTransferPack {
  const hit = dossier.identity;
  const routes = routesFromLive(dossier);
  return {
    schema: "chemistry-recipes.tech-transfer.v1",
    exportedAt: new Date().toISOString(),
    disclaimer: dossier.disclaimer || DEFAULT_DOSSIER_DISCLAIMER,
    regulatoryNotice: REGULATORY_DISCLAIMER,
    entity: {
      name: hit?.name || `CID ${dossier.cid}`,
      cas: hit?.cas,
      formula: hit?.formula,
      molecularWeight: hit?.molecularWeight,
      pubchemCid: dossier.cid,
      inchiKey: hit?.inchiKey,
      smiles: hit?.smiles,
      iupacName: hit?.iupacName,
    },
    confidence: {
      level: dossier.evidenceScore?.confidence || dossier.synthesis.confidence,
      score: dossier.evidenceScore?.score,
      reasons: dossier.evidenceScore?.reasons,
    },
    build: {
      mode: dossier.buildMode,
      model: dossier.synthesis.model,
      generatedAt: dossier.generatedAt,
      evidenceScore: dossier.evidenceScore?.score,
    },
    overview: dossier.synthesis.overview || dossier.descriptionTexts[0],
    manufacturingSummary:
      dossier.synthesis.manufacturingSummary ||
      dossier.manufacturingTexts.slice(0, 3).join(" "),
    applications: dossier.synthesis.applications,
    hazards: {
      signalWord: dossier.hazards.signalWord,
      hazardStatements: dossier.hazards.hazardStatements,
      precautionaryStatements: dossier.hazards.precautionaryStatements,
      notes: dossier.hazards.notes,
    },
    ehsHighlights: dossier.synthesis.ehsHighlights,
    environmentBaseline: dossier.synthesis.environmentBaseline,
    apparatusCatalog: dossier.synthesis.apparatusCatalog,
    routes: routes.map(mapRoute),
    relatedEntities: dossier.relatedEntities,
    contradictions: dossier.contradictions?.map((c) => ({
      topic: c.topic,
      sideA: c.sideA,
      sideB: c.sideB,
      severity: c.severity,
      sourceHint: c.sourceHint,
    })),
    unitOpFills: dossier.unitOpFills?.map((u) => ({
      templateOpId: u.templateOpId,
      title: u.title,
      status: u.status,
      notes: u.notes,
    })),
    modality: dossier.modality,
    literature: dossier.literature.slice(0, 25).map((h) => ({
      title: h.title,
      year: h.year,
      url: h.url,
      doi: h.doi,
    })),
    patents: dossier.patents.slice(0, 15).map((p) => ({
      title: p.title || p.patentNumber || "Patent",
      id: p.patentNumber || p.id,
      url: p.url,
    })),
    sources: dossier.sourceRefs.slice(0, 40).map((s) => ({
      type: s.type,
      id: s.id,
      label: s.label,
      url: s.url,
    })),
    gaps: dossier.synthesis.gaps,
    buildAudit: dossier.buildAudit,
  };
}

export function buildTechTransferFromExample(dossier: MoleculeDossier): TechTransferPack {
  return {
    schema: "chemistry-recipes.tech-transfer.v1",
    exportedAt: new Date().toISOString(),
    disclaimer: dossier.disclaimer || DEFAULT_DOSSIER_DISCLAIMER,
    regulatoryNotice: REGULATORY_DISCLAIMER,
    entity: {
      name: dossier.identifiers.name,
      cas: dossier.identifiers.cas,
      unii: dossier.identifiers.unii,
      formula: dossier.identifiers.formula,
      molecularWeight: dossier.properties?.molecularWeight,
      pubchemCid: dossier.identifiers.pubchemCid,
      inchiKey: dossier.identifiers.inchiKey,
      smiles: dossier.identifiers.smiles,
      iupacName: dossier.identifiers.iupacName,
    },
    overview: dossier.overview,
    manufacturingSummary: dossier.manufacturingSummary,
    applications: dossier.applications,
    hazards: dossier.hazards
      ? {
          signalWord: dossier.hazards.signalWord,
          hazardStatements: dossier.hazards.hazardStatements,
          precautionaryStatements: dossier.hazards.precautionaryStatements,
          notes: dossier.hazards.notes,
        }
      : undefined,
    ehsHighlights: dossier.ehsHighlights,
    environmentBaseline: dossier.environmentBaseline,
    apparatusCatalog: dossier.apparatusCatalog,
    routes: (dossier.routes || []).map(mapRoute),
    relatedEntities: dossier.relatedEntities,
    modality: dossier.modality,
    sources: dossier.sourceRefs?.map((s) => ({
      type: s.type,
      id: s.id,
      label: s.label,
      url: s.url,
    })),
  };
}

function mapRoute(r: ProcessRoute): TechTransferPack["routes"][0] {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    scaleClass: r.scaleClass,
    preference: r.preference,
    summary: r.summary,
    overallYieldTypical: r.overallYieldTypical,
    advantages: r.advantages,
    disadvantages: r.disadvantages,
    materials: (r.materials || []).map((m) => ({
      role: m.role,
      name: m.name,
      cas: m.cas,
      stoich: m.stoich,
      puritySpec: m.puritySpec,
      notes: m.notes,
    })),
    steps: (r.steps || []).map((s) => ({
      order: s.order,
      title: s.title,
      description: s.description,
      mechanismClass: s.mechanismClass,
      conditions: s.conditions as Record<string, string | undefined> | undefined,
      apparatus: s.apparatus?.map((a) => ({
        equipmentClass: String(a.equipmentClass),
        materialOfConstruction: a.materialOfConstruction,
        notes: a.notes,
      })),
      criticalParameters: s.controls?.criticalParameters,
      ipcMethods: s.controls?.ipcMethods,
      cqaTargets: s.controls?.cqaTargets,
      holdPoints: s.controls?.holdPoints,
      workup: s.workup,
      scaleNotes: s.scaleNotes,
    })),
    isolation: r.isolation,
    scaleUp: r.scaleUp,
  };
}

/** Flat MES/LIMS-friendly rows: one row per step material + step conditions. */
export interface MesLimsExport {
  schema: "chemistry-recipes.mes-lims.v1";
  exportedAt: string;
  regulatoryNotice: string;
  entityName: string;
  pubchemCid?: number;
  cas?: string;
  bom: Array<{
    routeId: string;
    routeName: string;
    role: string;
    materialName: string;
    cas?: string;
    stoich?: string;
    puritySpec?: string;
  }>;
  steps: Array<{
    routeId: string;
    routeName: string;
    stepOrder: number;
    stepTitle: string;
    description: string;
    temperatureC?: string;
    pressure?: string;
    time?: string;
    ph?: string;
    atmosphere?: string;
    equipmentClasses?: string;
    criticalParameters?: string;
    ipcMethods?: string;
    cqaTargets?: string;
  }>;
  equipment: Array<{
    routeId: string;
    equipmentClass: string;
    materialOfConstruction?: string;
    notes?: string;
  }>;
}

export function buildMesLimsFromTechTransfer(pack: TechTransferPack): MesLimsExport {
  const bom: MesLimsExport["bom"] = [];
  const steps: MesLimsExport["steps"] = [];
  const equipment: MesLimsExport["equipment"] = [];

  for (const r of pack.routes) {
    for (const m of r.materials) {
      bom.push({
        routeId: r.id,
        routeName: r.name,
        role: m.role,
        materialName: m.name,
        cas: m.cas,
        stoich: m.stoich,
        puritySpec: m.puritySpec,
      });
    }
    for (const s of r.steps) {
      steps.push({
        routeId: r.id,
        routeName: r.name,
        stepOrder: s.order,
        stepTitle: s.title,
        description: s.description,
        temperatureC: s.conditions?.temperatureC,
        pressure: s.conditions?.pressure,
        time: s.conditions?.time,
        ph: s.conditions?.ph,
        atmosphere: s.conditions?.atmosphere,
        equipmentClasses: s.apparatus?.map((a) => a.equipmentClass).join("; "),
        criticalParameters: s.criticalParameters?.join("; "),
        ipcMethods: s.ipcMethods?.join("; "),
        cqaTargets: s.cqaTargets?.join("; "),
      });
      for (const a of s.apparatus || []) {
        equipment.push({
          routeId: r.id,
          equipmentClass: a.equipmentClass,
          materialOfConstruction: a.materialOfConstruction,
          notes: a.notes,
        });
      }
    }
  }

  return {
    schema: "chemistry-recipes.mes-lims.v1",
    exportedAt: pack.exportedAt,
    regulatoryNotice: REGULATORY_DISCLAIMER,
    entityName: pack.entity.name,
    pubchemCid: pack.entity.pubchemCid,
    cas: pack.entity.cas,
    bom,
    steps,
    equipment,
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "entity"
  );
}
