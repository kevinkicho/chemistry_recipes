/**
 * Ollama Cloud synthesis — streamed with progress heartbeats.
 * Key always from .env / serverEnv (never blocked on browser settings).
 * Falls back cleanly if the model is slow; UI already has evidence scaffold.
 */

import { getServerAiEnv } from "@/lib/ai/serverEnv";
import { OLLAMA_CLOUD_HOST } from "@/lib/ai/config";
import type { CompoundEvidence } from "@/lib/dossier/types";
import type {
  AiDataFeedSource,
  AiProvenanceRecord,
  AiSynthesis,
  SynthesizedRoute,
  SynthesizedStep,
} from "@/lib/dossier/types";
import type {
  ApparatusItem,
  EnvironmentSpec,
  Material,
  ProcessModality,
  ProcessRoute,
  ProcessStep,
  ScaleClass,
  ScaleUpNotes,
  SourceRef,
} from "@/lib/types/process";
import type { ProgressEmitter } from "@/lib/dossier/progress";
import { previewText } from "@/lib/dossier/progress";
import { parseRelatedEntities } from "@/lib/dossier/relatedEntities";
import { parseAiContradictions } from "@/lib/dossier/contradictions";

/** Keep cloud synthesis interactive but allow a full dual-view dossier */
const AI_TIMEOUT_MS = 90_000;
const MAX_EVIDENCE_CHARS = 14_000;

const SYSTEM = `You are a senior process chemist assembling ACCURACY-FIRST dual-view plant dossiers for Chemistry Recipes (educational public-evidence guides for MSAT / process teams — NOT GMP SOPs).

INPUT: free public evidence only, including structured processFacts[] (extracted atoms with source labels). PubChem, literature titles/abstracts, patent titles/abstracts, GHS, multi-API annotations.

OUTPUT: one JSON object (no markdown fences) with the schema below.

HARD RULES (accuracy):
1. NEVER invent numeric temperatures, pressures, times, yields, stoichiometry, or CAS. If not in evidence or processFacts, OMIT the field entirely (no "not specified", "N/A", "typical plant", "define IPC").
2. Every conditions.* value you emit MUST be copyable from processFacts or a quoted abstract/title snippet in the evidence package.
3. NEVER invent IPC methods, CQA targets, or hold points. Prefer empty controls over fiction. You may list criticalParameters ONLY as qualitative risks stated in evidence (e.g. "exotherm on charge" if text says so).
4. NEVER turn PubChem TOC boilerplate into process steps.
5. Prefer ONE strong route when processFacts.productionBriefEligible is false or condition atoms are few. Use two routes only when patents/lit clearly disagree on path class.
6. Steps: imperative plant English when sourced ("Charge SM under N2") — but only if evidence supports; otherwise describe the public lead without numbers.
7. apparatus = equipment CLASSES only when implied by evidence (glass-lined-reactor, hydrogenator, filter-dryer, crystallizer, scrubber, …). Omit if unknown.
8. gaps[] MUST list missing plant detail (validated CPPs, IPC methods, full patent examples not in abstract, cleaning, hold times).
9. relatedEntities[] only when named in evidence (CAS only if present). Roles: starting-material|intermediate|impurity|reagent|solvent|catalyst|drug-product|other.
10. contradictions[] when sources disagree — do NOT pick a winner.
11. modality when clear: small-molecule|peptide|oligonucleotide|mab|formulation|fermentation|other.
12. manufacturingSummary / overview: cite what public sources say; do not claim "commercial plant standard" without patent/paper support.

SCHEMA:
{
  "overview": string,
  "applications": string[],
  "manufacturingSummary": string,
  "modality": "small-molecule"|"peptide"|"oligonucleotide"|"mab"|"formulation"|"fermentation"|"other"|null,
  "relatedEntities": [{"role":string,"name":string,"cas":string|null,"notes":string|null}],
  "contradictions": [{"topic":string,"sideA":string,"sideB":string,"severity":"info"|"warning","sourceHint":string|null}],
  "routes": [{
    "id": string,
    "name": string,
    "type": "industrial"|"literature"|"biosynthetic"|"biocatalytic"|"fermentative"|"formulation"|"alternative",
    "scaleClass": "lab"|"kilo"|"pilot"|"commercial"|"continuous",
    "summary": string,
    "materials": [{"role":"starting-material|reagent|solvent|catalyst|base|acid|quench|product|intermediate","name":string,"cas":string|null,"stoich":string|null,"notes":string|null}],
    "steps": [{
      "order": number,
      "title": string,
      "description": string,
      "mechanismClass": string|null,
      "mechanismNotes": string|null,
      "conditions": {"temperatureC":string|null,"pressure":string|null,"time":string|null,"atmosphere":string|null,"other":string|null}|null,
      "apparatus": [{"equipmentClass":string,"materialOfConstruction":string|null,"notes":string|null}]|null,
      "environment": {"atmosphere":string|null,"containment":string|null,"utilities":string[]|null,"notes":string|null}|null,
      "controls": {"ipcMethods":string[]|null,"criticalParameters":string[]|null,"cqaTargets":string[]|null}|null,
      "workup": string|null,
      "scaleNotes": string|null
    }],
    "advantages": string[]|null,
    "disadvantages": string[]|null,
    "isolation": string|null,
    "scaleUp": {"labToKilo":string|null,"kiloToPilot":string|null,"safetyScaleUp":string|null,"wasteStreams":string[]|null}|null,
    "overallYieldNote": string|null
  }],
  "apparatusCatalog": [{"equipmentClass":string,"materialOfConstruction":string|null,"notes":string|null}],
  "environmentBaseline": {"atmosphere":string|null,"containment":string|null,"utilities":string[]|null,"notes":string|null},
  "ehsHighlights": string[],
  "gaps": string[],
  "confidence": "low"|"medium"|"high",
  "disclaimer": string
}`;

function buildEvidenceObject(ev: CompoundEvidence) {
  // Prefer process-looking papers first for the model
  const litSorted = [...ev.literature].sort((a, b) => {
    const score = (t: string, ab?: string) =>
      /synthes|manufactur|process|ferment|preparat|industrial|scale/i.test(
        `${t} ${ab || ""}`
      )
        ? 1
        : 0;
    return score(b.title, b.abstract) - score(a.title, a.abstract);
  });

  const pf = ev.processFacts;

  return {
    processFacts: pf
      ? {
          summary: pf.summary,
          productionBriefEligible: pf.productionBriefEligible,
          sourcedConditionCount: pf.sourcedConditionCount,
          unitOpCount: pf.unitOpCount,
          openGaps: pf.openGaps.slice(0, 8),
          managerRisks: pf.managerRisks.slice(0, 8),
          // Feed atoms the model must ground conditions on
          atoms: pf.facts
            .filter((f) => f.kind !== "open-gap")
            .slice(0, 40)
            .map((f) => ({
              kind: f.kind,
              claim: f.claim,
              value: f.value,
              unit: f.unit,
              quote: f.quote,
              sourceLabel: f.sourceLabel,
              sourceId: f.sourceId,
              provenance: f.provenance,
            })),
        }
      : undefined,
    identity: ev.identity
      ? {
          name: ev.identity.name,
          formula: ev.identity.formula,
          mw: ev.identity.molecularWeight,
          iupac: ev.identity.iupacName,
          cid: ev.cid,
          smiles: ev.identity.smiles,
        }
      : { cid: ev.cid },
    // Already filtered at PUG View; still cap length
    manufacturingTexts: (ev.view?.manufacturingTexts ?? []).slice(0, 15),
    descriptionTexts: (ev.view?.descriptionTexts ?? []).slice(0, 8),
    propertyTexts: (ev.view?.propertyTexts ?? []).slice(0, 12),
    hazards: ev.view?.hazards
      ? {
          signalWord: ev.view.hazards.signalWord,
          hazardStatements: ev.view.hazards.hazardStatements.slice(0, 15),
          precautionaryStatements: ev.view.hazards.precautionaryStatements.slice(
            0,
            8
          ),
        }
      : null,
    literature: litSorted.slice(0, 8).map((h) => ({
      title: h.title,
      year: h.year,
      journal: h.journal,
      abstract: h.abstract?.slice(0, 500),
      url: h.url,
    })),
    patents: ev.patents.slice(0, 5).map((p) => ({
      title: p.title,
      number: p.patentNumber,
      abstract: p.abstract?.slice(0, 500),
      url: p.url,
    })),
    // Multi-source free public APIs beyond PubChem
    externalAnnotations: (ev.annotations ?? []).slice(0, 16).map((a) => ({
      source: a.source,
      kind: a.kind,
      title: a.title,
      summary: a.summary?.slice(0, 400),
      fields: a.fields,
      url: a.url,
    })),
    instruction:
      "Produce dual-view process routes suitable for a plant-ready educational dossier. Use all free-public sources (not only PubChem). Omit empty plant fields rather than writing placeholders.",
  };
}

function buildEvidencePayload(ev: CompoundEvidence): string {
  const raw = JSON.stringify(buildEvidenceObject(ev));
  return raw.length > MAX_EVIDENCE_CHARS
    ? raw.slice(0, MAX_EVIDENCE_CHARS) + "…[truncated]"
    : raw;
}

/** Inventory of free-public feeds that compose the AI evidence package. */
export function buildAiDataFeedSources(ev: CompoundEvidence): AiDataFeedSource[] {
  const sources: AiDataFeedSource[] = [];
  const cid = ev.cid;

  if (ev.identity) {
    sources.push({
      id: `identity:${cid}`,
      name: "PubChem PUG REST · identity",
      organization: "NCBI / NIH",
      role: "Compound identity & properties",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      endpointUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/.../JSON`,
      content: JSON.stringify(
        {
          name: ev.identity.name,
          formula: ev.identity.formula,
          mw: ev.identity.molecularWeight,
          iupac: ev.identity.iupacName,
          smiles: ev.identity.smiles,
          inchiKey: ev.identity.inchiKey,
          cid,
        },
        null,
        0
      ).slice(0, 800),
    });
  }

  for (const a of (ev.annotations ?? []).slice(0, 12)) {
    sources.push({
      id: `ann:${a.source}:${a.title.slice(0, 40)}`,
      name: a.source,
      organization: a.organization,
      role: `${a.kind} annotation`,
      url: a.url,
      endpointUrl: a.endpointUrl,
      content: [a.title, a.summary, a.fields ? JSON.stringify(a.fields) : ""]
        .filter(Boolean)
        .join("\n")
        .slice(0, 700),
    });
  }

  const mfg = (ev.view?.manufacturingTexts ?? []).slice(0, 12);
  if (mfg.length) {
    sources.push({
      id: `mfg:${cid}`,
      name: "PubChem PUG View · Use and Manufacturing",
      organization: "NCBI / NIH",
      role: "Manufacturing / use annotations",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Use-and-Manufacturing`,
      endpointUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Use+and+Manufacturing`,
      content: mfg.join("\n---\n").slice(0, 1200),
    });
  }

  const desc = (ev.view?.descriptionTexts ?? []).slice(0, 6);
  if (desc.length) {
    sources.push({
      id: `desc:${cid}`,
      name: "PubChem PUG View · description",
      organization: "NCBI / NIH",
      role: "Description / pharmacology text",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
      endpointUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON`,
      content: desc.join("\n").slice(0, 800),
    });
  }

  const props = (ev.view?.propertyTexts ?? []).slice(0, 10);
  if (props.length) {
    sources.push({
      id: `props:${cid}`,
      name: "PubChem PUG View · properties",
      organization: "NCBI / NIH",
      role: "Chemical / physical properties",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Chemical-and-Physical-Properties`,
      endpointUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Chemical+and+Physical+Properties`,
      content: props.join("\n").slice(0, 800),
    });
  }

  if (ev.view?.hazards) {
    const h = ev.view.hazards;
    sources.push({
      id: `haz:${cid}`,
      name: "PubChem PUG View · GHS / hazards",
      organization: "NCBI / NIH",
      role: "Hazard statements for EHS synthesis",
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=Safety-and-Hazards`,
      endpointUrl: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=GHS+Classification`,
      content: JSON.stringify(
        {
          signalWord: h.signalWord,
          hazardStatements: h.hazardStatements.slice(0, 12),
        },
        null,
        0
      ).slice(0, 1000),
    });
  }

  for (const paper of ev.literature.slice(0, 6)) {
    sources.push({
      id: `lit:${paper.id}`,
      name: paper.title.slice(0, 100),
      organization: "Europe PMC / EMBL-EBI",
      role: "Literature (title/abstract fed to model)",
      url: paper.url,
      endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      content: [paper.title, paper.year, paper.journal, paper.abstract?.slice(0, 350)]
        .filter(Boolean)
        .join("\n")
        .slice(0, 700),
    });
  }

  for (const p of ev.patents.slice(0, 4)) {
    sources.push({
      id: `pat:${p.id}`,
      name: p.title.slice(0, 100),
      organization: "USPTO PatentsView / Europe PMC",
      role: "Patent / process IP (title/abstract fed to model)",
      url: p.url,
      content: [p.patentNumber, p.title, p.abstract?.slice(0, 350)]
        .filter(Boolean)
        .join("\n")
        .slice(0, 700),
    });
  }

  return sources;
}

function fieldsFromSynthesis(s: AiSynthesis): string[] {
  const fields: string[] = [];
  if (s.overview) fields.push("overview");
  if (s.applications?.length) fields.push("applications");
  if (s.manufacturingSummary) fields.push("manufacturingSummary");
  if (s.routes?.length) fields.push("routes");
  if (s.apparatusCatalog?.length) fields.push("apparatusCatalog");
  if (s.environmentBaseline) fields.push("environmentBaseline");
  if (s.ehsHighlights?.length) fields.push("ehsHighlights");
  if (s.relatedEntities?.length) fields.push("relatedEntities");
  if (s.contradictions?.length) fields.push("contradictions");
  if (s.modality) fields.push("modality");
  if (s.gaps?.length) fields.push("gaps");
  if (s.disclaimer) fields.push("disclaimer");
  return fields;
}

const JUNK_STEP =
  /this section provides information|major uses of this chemical|public manufacturing \/ use note|not specified in public excerpt|define ipc\/cqas|extracted from pubchem pug view/i;

const INVENTED_PLANT =
  /\b(typical industrial|plant typical|site standard|validated ipc|cqa of|batch record|gmp release)\b/i;
const NUMERIC_COND =
  /\d+(?:\.\d+)?\s*(?:°\s*C|C\b|bar|atm|psi|%|h\b|hr|min|eq)/i;

/**
 * Stronger dual-view quality bar: drop boilerplate, thin steps, invented
 * plant language, and routes without process-relevant body.
 */
export function qualityGateSynthesis(s: AiSynthesis): AiSynthesis {
  if (!s.parsed || !s.routes?.length) return s;

  const routes = s.routes
    .map((r) => {
      const steps = r.steps
        .filter((step) => {
          const blob = `${step.title} ${step.description}`;
          if (JUNK_STEP.test(blob)) return false;
          if (INVENTED_PLANT.test(blob)) return false;
          if (/^process route synthesis pending/i.test(step.title)) return false;
          if (step.description.trim().length < 48) return false;
          if (/^(uses?|description|methods? of manufacturing|overview)$/i.test(step.title.trim())) {
            return false;
          }
          const opLike =
            /charge|react|quench|crystall|filter|dry|distill|extract|hydrog|ferment|isolat|work.?up|heat|cool|cataly|acylation|alkylat|hydrogen|purif|wash|centrifug|mill|blend|fill/i.test(
              blob
            );
          const hasPlant =
            Boolean(step.apparatus?.length) ||
            Boolean(step.controls?.criticalParameters?.length) ||
            Boolean(step.environment?.atmosphere || step.environment?.utilities?.length);
          const hasChem = Boolean(step.mechanismClass || step.mechanismNotes);
          if (!opLike && !hasPlant && !hasChem && step.description.length < 120) {
            return false;
          }
          return true;
        })
        .map((step) => {
          // Drop invented IPC/CQA/hold; scrub junk CPP lines
          const scrub = (arr?: string[]) =>
            arr?.filter(
              (x) =>
                x &&
                !/not specified|define ipc|n\/a|placeholder|validate on site|typical industrial/i.test(
                  x
                )
            );
          // Numeric condition fact-stripping runs post-AI in pipeline (processFacts)
          const controls = step.controls
            ? {
                criticalParameters: scrub(step.controls.criticalParameters)?.filter(
                  (x) => !NUMERIC_COND.test(x) || /exotherm|hazard|risk/i.test(x)
                ),
                // Never keep AI IPC/CQA/hold as plant truth
                ipcMethods: undefined as string[] | undefined,
                cqaTargets: undefined as string[] | undefined,
                holdPoints: undefined as string[] | undefined,
              }
            : undefined;
          const hasCpp = Boolean(controls?.criticalParameters?.length);
          return {
            ...step,
            conditions: step.conditions,
            controls: hasCpp ? controls : undefined,
          };
        });
      if (steps.length < 2) return null;
      if (r.summary.trim().length < 28) return null;
      if (INVENTED_PLANT.test(r.summary)) return null;
      return { ...r, steps };
    })
    .filter(Boolean) as typeof s.routes;

  // Prefer single route when only one survives or second is thin
  let finalRoutes = routes;
  if (routes.length > 1) {
    const rich = routes.filter((r) =>
      r.steps.some(
        (s) =>
          Boolean(s.conditions && Object.values(s.conditions).some(Boolean)) ||
          Boolean(s.apparatus?.length)
      )
    );
    if (rich.length === 1) finalRoutes = rich;
    else if (rich.length === 0) finalRoutes = routes.slice(0, 1);
    else finalRoutes = rich.slice(0, 2);
  }

  if (!finalRoutes.length) {
    return {
      ...s,
      parsed: false,
      routes: undefined,
      rawError:
        (s.rawError ? s.rawError + " · " : "") +
        "Quality gate rejected routes (thin, boilerplate, invented plant language, or non-process steps).",
      gaps: [
        ...(s.gaps || []),
        "AI routes failed accuracy quality gate — public process facts / literature leads only",
      ],
    };
  }

  return { ...s, routes: finalRoutes };
}

function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length ? out : undefined;
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const MATERIAL_ROLES = new Set([
  "starting-material",
  "reagent",
  "solvent",
  "catalyst",
  "base",
  "acid",
  "quench",
  "antisolvent",
  "product",
  "intermediate",
  "utility",
]);

function parseMaterial(m: unknown): Material | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  const name = asStr(o.name);
  if (!name) return null;
  const roleRaw = asStr(o.role) || "reagent";
  const role = (MATERIAL_ROLES.has(roleRaw) ? roleRaw : "reagent") as Material["role"];
  return {
    role,
    name,
    cas: asStr(o.cas),
    stoich: asStr(o.stoich),
    notes: asStr(o.notes),
  };
}

function parseApparatus(a: unknown): ApparatusItem | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  const equipmentClass = asStr(o.equipmentClass);
  if (!equipmentClass) return null;
  return {
    equipmentClass,
    materialOfConstruction: asStr(o.materialOfConstruction),
    notes: asStr(o.notes),
    required: typeof o.required === "boolean" ? o.required : undefined,
  };
}

function parseEnvironment(e: unknown): EnvironmentSpec | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as Record<string, unknown>;
  const env: EnvironmentSpec = {
    atmosphere: asStr(o.atmosphere),
    containment: asStr(o.containment),
    atexZone: asStr(o.atexZone),
    utilities: asStringArray(o.utilities),
    notes: asStr(o.notes),
  };
  if (!env.atmosphere && !env.containment && !env.utilities?.length && !env.notes) {
    return undefined;
  }
  return env;
}

function parseScaleUp(s: unknown): ScaleUpNotes | undefined {
  if (!s || typeof s !== "object") return undefined;
  const o = s as Record<string, unknown>;
  const su: ScaleUpNotes = {
    labToKilo: asStr(o.labToKilo),
    kiloToPilot: asStr(o.kiloToPilot),
    pilotToCommercial: asStr(o.pilotToCommercial),
    safetyScaleUp: asStr(o.safetyScaleUp),
    wasteStreams: asStringArray(o.wasteStreams),
    greenChemistryNotes: asStr(o.greenChemistryNotes),
  };
  if (
    !su.labToKilo &&
    !su.kiloToPilot &&
    !su.pilotToCommercial &&
    !su.safetyScaleUp &&
    !su.wasteStreams?.length
  ) {
    return undefined;
  }
  return su;
}

function parseStep(s: unknown, j: number): SynthesizedStep | null {
  if (!s || typeof s !== "object") return null;
  const ss = s as Record<string, unknown>;
  const title = asStr(ss.title) || `Step ${j + 1}`;
  const description = asStr(ss.description) || "";
  if (!description && !title) return null;

  let conditions: SynthesizedStep["conditions"];
  if (ss.conditions && typeof ss.conditions === "object") {
    const c = ss.conditions as Record<string, unknown>;
    conditions = {
      temperatureC: asStr(c.temperatureC),
      pressure: asStr(c.pressure),
      time: asStr(c.time),
      ph: asStr(c.ph),
      atmosphere: asStr(c.atmosphere),
      agitation: asStr(c.agitation),
      other: asStr(c.other),
    };
  }

  const materials = Array.isArray(ss.materials)
    ? (ss.materials.map(parseMaterial).filter(Boolean) as Material[])
    : undefined;
  const apparatus = Array.isArray(ss.apparatus)
    ? (ss.apparatus.map(parseApparatus).filter(Boolean) as ApparatusItem[])
    : undefined;

  let controls: SynthesizedStep["controls"];
  if (ss.controls && typeof ss.controls === "object") {
    const c = ss.controls as Record<string, unknown>;
    const scrub = (arr?: string[]) =>
      arr?.filter(
        (s) =>
          s &&
          !/not specified|define ipc|n\/a|validate on site|placeholder/i.test(s)
      );
    const ipcMethods = scrub(asStringArray(c.ipcMethods));
    const criticalParameters = scrub(asStringArray(c.criticalParameters));
    const cqaTargets = scrub(asStringArray(c.cqaTargets));
    const holdPoints = scrub(asStringArray(c.holdPoints));
    if (ipcMethods?.length || criticalParameters?.length || cqaTargets?.length || holdPoints?.length) {
      controls = { ipcMethods, criticalParameters, cqaTargets, holdPoints };
    }
  }

  return {
    order: typeof ss.order === "number" ? ss.order : j + 1,
    title,
    description,
    mechanismClass: asStr(ss.mechanismClass),
    mechanismNotes: asStr(ss.mechanismNotes),
    conditions,
    materials,
    apparatus,
    environment: parseEnvironment(ss.environment),
    controls,
    workup: asStr(ss.workup),
    scaleNotes: asStr(ss.scaleNotes),
  };
}

function parseSynthesis(raw: unknown, model: string): AiSynthesis {
  if (!raw || typeof raw !== "object") {
    return {
      available: true,
      model,
      parsed: false,
      rawError: "Model returned non-object JSON",
      confidence: "low",
    };
  }
  const o = raw as Record<string, unknown>;
  const routesIn = Array.isArray(o.routes) ? o.routes : [];
  const routes: SynthesizedRoute[] = routesIn
    .map((r, i) => {
      if (!r || typeof r !== "object") return null;
      const rr = r as Record<string, unknown>;
      const steps = (Array.isArray(rr.steps) ? rr.steps : [])
        .map((s, j) => parseStep(s, j))
        .filter(Boolean) as SynthesizedStep[];

      const typeRaw = asStr(rr.type) || "literature";
      const typeOk = [
        "industrial",
        "literature",
        "biosynthetic",
        "biocatalytic",
        "fermentative",
        "formulation",
        "downstream",
        "upstream",
        "alternative",
      ] as const;
      const type = typeOk.includes(typeRaw as (typeof typeOk)[number])
        ? (typeRaw as SynthesizedRoute["type"])
        : "literature";

      const scaleRaw = asStr(rr.scaleClass) || "lab";
      const scaleOk = ["lab", "kilo", "pilot", "commercial", "continuous"] as const;
      const scaleClass = scaleOk.includes(scaleRaw as (typeof scaleOk)[number])
        ? (scaleRaw as ScaleClass)
        : "lab";

      const materials = Array.isArray(rr.materials)
        ? (rr.materials.map(parseMaterial).filter(Boolean) as Material[])
        : undefined;

      return {
        id: asStr(rr.id) || `route-${i + 1}`,
        name: asStr(rr.name) || `Route ${i + 1}`,
        type,
        scaleClass,
        summary: asStr(rr.summary) || "",
        steps,
        materials,
        advantages: asStringArray(rr.advantages),
        disadvantages: asStringArray(rr.disadvantages),
        isolation: asStr(rr.isolation),
        scaleUp: parseScaleUp(rr.scaleUp),
        overallYieldNote: asStr(rr.overallYieldNote),
      } satisfies SynthesizedRoute;
    })
    .filter(Boolean) as SynthesizedRoute[];

  let apparatusCatalog: ApparatusItem[] | undefined;
  if (Array.isArray(o.apparatusCatalog)) {
    apparatusCatalog = o.apparatusCatalog.map(parseApparatus).filter(Boolean) as ApparatusItem[];
  }

  const conf = o.confidence;
  const confidence =
    conf === "low" || conf === "medium" || conf === "high" ? conf : "low";

  const modalityRaw = asStr(o.modality);
  const modalityOk = [
    "small-molecule",
    "peptide",
    "oligonucleotide",
    "mab",
    "adc",
    "cell-therapy",
    "gene-therapy",
    "vaccine",
    "formulation",
    "sterile-compounding",
    "media",
    "fermentation",
    "other",
  ] as const;
  const modality = modalityOk.includes(modalityRaw as ProcessModality)
    ? (modalityRaw as ProcessModality)
    : undefined;

  return {
    available: true,
    model,
    parsed: true,
    overview: asStr(o.overview),
    applications: asStringArray(o.applications),
    manufacturingSummary: asStr(o.manufacturingSummary),
    relatedEntities: parseRelatedEntities(o.relatedEntities),
    contradictions: parseAiContradictions(o.contradictions),
    modality,
    routes,
    apparatusCatalog,
    environmentBaseline: parseEnvironment(o.environmentBaseline),
    ehsHighlights: asStringArray(o.ehsHighlights),
    gaps: asStringArray(o.gaps),
    confidence,
    disclaimer: asStr(o.disclaimer),
  };
}

/**
 * Stream Ollama Cloud chat; emit progress logs so the overlay is not frozen on "AI".
 */
async function ollamaChatStream(
  host: string,
  apiKey: string | null,
  model: string,
  messages: Array<{ role: string; content: string }>,
  onProgress?: ProgressEmitter,
  orgLabel = "Ollama"
): Promise<{
  ok: boolean;
  content?: string;
  error?: string;
  status?: number;
  durationMs: number;
}> {
  const t0 = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: true,
        format: "json",
        messages,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text();
      let err = `${orgLabel} HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j.error) err = j.error;
      } catch {
        if (text) err = text.slice(0, 200);
      }
      return { ok: false, status: res.status, error: err, durationMs: Date.now() - t0 };
    }

    if (!res.body) {
      return {
        ok: false,
        status: res.status,
        error: "Empty stream body from Ollama",
        durationMs: Date.now() - t0,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let lastLog = 0;
    let chunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
            error?: string;
          };
          if (obj.error) {
            return {
              ok: false,
              error: obj.error,
              status: res.status,
              durationMs: Date.now() - t0,
            };
          }
          if (obj.message?.content) {
            content += obj.message.content;
            chunks += 1;
          }
        } catch {
          /* ignore partial JSON lines */
        }
      }

      const now = Date.now();
      if (onProgress && now - lastLog > 2500) {
        lastLog = now;
        onProgress({
          type: "log",
          stepId: "ollama",
          label: `${orgLabel} generating…`,
          organization: orgLabel,
          endpointUrl: `${host}/api/chat`,
          method: "POST",
          // Do not send stepsDone:0 — overlay merges progress from prior step events
          detail: `Streaming tokens · ${content.length.toLocaleString()} chars · ${(
            (now - t0) /
            1000
          ).toFixed(1)}s · model ${model}`,
          responsePreview: previewText(content, 200),
        });
      }
    }

    // flush remainder
    if (buffer.trim()) {
      try {
        const obj = JSON.parse(buffer.trim()) as { message?: { content?: string } };
        if (obj.message?.content) content += obj.message.content;
      } catch {
        /* ignore */
      }
    }

    const durationMs = Date.now() - t0;

    if (!content) {
      return {
        ok: false,
        status: res.status,
        error: `Empty content after stream (${chunks} chunks, ${durationMs}ms)`,
        durationMs,
      };
    }

    onProgress?.({
      type: "log",
      stepId: "ollama",
      label: "Ollama stream finished",
      detail: `${content.length.toLocaleString()} chars in ${durationMs}ms · parsing JSON…`,
      responsePreview: previewText(content, 240),
    });

    return { ok: true, content, status: res.status, durationMs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ollama synthesis failed";
    const timedOut = /timeout|aborted|AbortError/i.test(msg);
    return {
      ok: false,
      durationMs: Date.now() - t0,
      error: timedOut
        ? `Ollama timed out after ${AI_TIMEOUT_MS / 1000}s — using evidence scaffold. (${msg})`
        : msg,
    };
  }
}

/**
 * Call Ollama (Cloud or local) with evidence-only prompt.
 * Cloud uses .env key; local loopback needs no key.
 * Always attaches AiProvenanceRecord when a call is attempted (for AI chips).
 */
export async function synthesizeDossierFromEvidence(
  evidence: CompoundEvidence,
  onProgress?: ProgressEmitter,
  opts: {
    preferFastModel?: boolean;
    /** Browser-selected model (from AI settings); overrides env when set */
    model?: string;
    fastModel?: string;
  } = {}
): Promise<AiSynthesis> {
  const env = getServerAiEnv();
  if (!env.canCall) {
    return {
      available: false,
      rawError:
        "Ollama not configured. Set OLLAMA_CLOUD_API_KEY for Cloud, or OLLAMA_HOST=http://127.0.0.1:11434 for local Ollama.",
    };
  }

  const host = (env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
  const orgLabel = env.provider === "ollama-local" ? "Ollama local" : "Ollama Cloud";
  const primary = (opts.model || env.model).trim() || env.model;
  const fast = (opts.fastModel || env.fastModel || primary).trim() || primary;
  const model = opts.preferFastModel ? fast : primary;
  const evidenceBlock = buildEvidencePayload(evidence);
  const dataSources = buildAiDataFeedSources(evidence);
  const userContent =
    `Synthesize the dossier JSON from this public evidence only:\n${evidenceBlock}`;
  const startedAt = new Date().toISOString();
  const endpointUrl = `${host}/api/chat`;

  onProgress?.({
    type: "log",
    stepId: "ollama",
    label: "Ollama request prepared",
    organization: orgLabel,
    endpointUrl,
    method: "POST",
    detail: `Model ${model} · evidence ${evidenceBlock.length} chars · ${dataSources.length} feed source(s) · stream+JSON · timeout ${AI_TIMEOUT_MS / 1000}s · ${
      env.provider === "ollama-local"
        ? "local host (no key)"
        : `key from ${env.keySource || "env"}`
    }`,
  });

  const first = await ollamaChatStream(
    host,
    env.apiKey || null,
    model,
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
    onProgress,
    orgLabel
  );

  const finishedAt = new Date().toISOString();
  const baseProvenance: AiProvenanceRecord = {
    provider: env.provider,
    host,
    model,
    startedAt,
    finishedAt,
    responseTimeMs: first.durationMs,
    systemPrompt: SYSTEM,
    userPrompt: userContent,
    dataFed: evidenceBlock,
    dataSources,
    responsePreview: first.content
      ? first.content.length > 4000
        ? first.content.slice(0, 4000) + "\n…[truncated]"
        : first.content
      : undefined,
    responseChars: first.content?.length,
    parsed: false,
    error: first.error,
    endpointUrl,
    method: "POST",
    keySource: env.keySource,
  };

  if (!first.ok || !first.content) {
    return {
      available: true,
      model,
      parsed: false,
      rawError: first.error || "Ollama request failed",
      provenance: baseProvenance,
    };
  }

  const parsed = extractJson(first.content);
  if (!parsed) {
    return {
      available: true,
      model,
      parsed: false,
      overview: first.content.slice(0, 1500),
      rawError: "Could not parse JSON from Ollama stream; evidence scaffold remains.",
      confidence: "low",
      provenance: {
        ...baseProvenance,
        error: "Could not parse JSON from model response",
      },
    };
  }

  const synthesis = qualityGateSynthesis(parseSynthesis(parsed, model));
  return {
    ...synthesis,
    provenance: {
      ...baseProvenance,
      model,
      parsed: Boolean(synthesis.parsed),
      error: synthesis.parsed
        ? undefined
        : synthesis.rawError || baseProvenance.error,
      fieldsGenerated: fieldsFromSynthesis(synthesis),
    },
  };
}

/** Map AI routes into ProcessRoute shape for RoutePanel dual views. */
export function aiRoutesToProcessRoutes(
  routes: SynthesizedRoute[] | undefined,
  sourceRefs: SourceRef[]
): ProcessRoute[] {
  if (!routes?.length) return [];
  return routes.map((r, i) => {
    const steps: ProcessStep[] = r.steps.map((s) => ({
      id: `${r.id}-s${s.order}`,
      order: s.order,
      title: s.title,
      description: s.description,
      mechanismClass: s.mechanismClass,
      mechanismNotes: s.mechanismNotes || s.evidenceNote,
      materials: s.materials?.map((m) => ({
        role: (m.role as Material["role"]) || "reagent",
        name: m.name,
        cas: m.cas,
        stoich: m.stoich,
        notes: m.notes,
      })),
      conditions: s.conditions,
      apparatus: s.apparatus,
      environment: s.environment,
      controls: s.controls
        ? {
            ipcMethods: s.controls.ipcMethods,
            criticalParameters: s.controls.criticalParameters,
            cqaTargets: s.controls.cqaTargets,
            holdPoints: s.controls.holdPoints,
          }
        : undefined,
      workup: s.workup,
      scaleNotes: s.scaleNotes,
      sourceRefs,
    }));

    const materials =
      r.materials && r.materials.length > 0
        ? r.materials
        : (() => {
            const acc: Material[] = [];
            const seen = new Set<string>();
            for (const s of steps) {
              for (const m of s.materials ?? []) {
                const key = `${m.role}:${m.name}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  acc.push(m);
                }
              }
            }
            return acc;
          })();

    return {
      id: r.id || `ai-route-${i + 1}`,
      name: r.name,
      type: r.type,
      preference: i + 1,
      scaleClass: r.scaleClass || "lab",
      summary: r.summary,
      advantages: r.advantages,
      disadvantages: r.disadvantages,
      materials,
      steps,
      isolation: r.isolation,
      scaleUp: r.scaleUp,
      overallYieldTypical: r.overallYieldNote,
      sourceRefs,
    };
  });
}
