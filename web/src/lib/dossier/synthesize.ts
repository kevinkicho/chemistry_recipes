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

const SYSTEM = `You are a senior process chemist writing educational dual-view plant dossiers for Chemistry Recipes.

INPUT: free public evidence only (PubChem facts/uses, literature titles/abstracts, patent titles/abstracts, GHS).

OUTPUT: one JSON object (no markdown fences) with the schema below.

HARD RULES:
1. NEVER invent specific numeric yields, exact temperatures, pressures, or CAS numbers that are not supported by the evidence. If unknown, OMIT the field entirely (do not write "not specified", "N/A", or "define IPC before scale-up").
2. NEVER turn PubChem TOC boilerplate ("This section provides information…", "Major uses of this chemical…") into process steps.
3. Build 1–2 routes when evidence supports alternatives (e.g. industrial + literature, or biocatalytic + chemical). Each route: 3–6 REAL process steps. Prefer two routes when patents/lit disagree on path so users can compare. Steps should read like plant-ready educational scaffolds:
   - title (e.g. "Fermentation / biocatalytic formation", "Isolation and crystallization")
   - description: what is done (charge, reaction, workup) in plain process language
   - mechanismClass + mechanismNotes when chemistry is clear
   - apparatus as equipment CLASSES only (glass-lined-reactor, crystallizer, centrifuge, filter-dryer, scrubber, hydrogenator, distillation-column, packed-bed-reactor, …) when reasonably implied
   - environment / controls ONLY when you can state something informative (utilities, containment class, typical IPC categories). Prefer informative ranges labeled "typical industrial / literature" over silence when chemistry is standard — still never invent precise numbers.
4. If the molecule is made by well-known industrial chemistry (e.g. amino-acid fermentation, classical acetylation) and evidence supports use/manufacture context, you MAY describe that standard route in educational language and list the gap that site packages must validate.
5. applications, manufacturingSummary, overview, ehsHighlights must be informative prose drawn from evidence.
6. gaps[] lists what primary sources still lack.
7. relatedEntities[] names intermediates, impurities, reagents, solvents ONLY when supported by evidence or standard industrial knowledge clearly implied by evidence (include CAS only if in evidence). Roles: starting-material|intermediate|impurity|reagent|solvent|catalyst|drug-product|other.
8. contradictions[] when literature vs patents (or two manufacturing narratives) disagree on route class or conditions — list both sides, do NOT pick a winner.
9. modality when clear: small-molecule|peptide|oligonucleotide|mab|formulation|fermentation|other.

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

  return {
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
    instruction:
      "Produce dual-view process routes suitable for a plant-ready educational dossier. Omit empty plant fields rather than writing placeholders.",
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

/** Drop TOC-boilerplate steps and empty routes after model parse. */
export function qualityGateSynthesis(s: AiSynthesis): AiSynthesis {
  if (!s.parsed || !s.routes?.length) return s;

  const routes = s.routes
    .map((r) => {
      const steps = r.steps.filter((step) => {
        const blob = `${step.title} ${step.description}`;
        if (JUNK_STEP.test(blob)) return false;
        if (step.description.trim().length < 40 && !step.mechanismNotes) return false;
        if (/^process route synthesis pending/i.test(step.title)) return false;
        return true;
      });
      return { ...r, steps };
    })
    .filter((r) => r.steps.length >= 1 && r.summary.trim().length > 20);

  if (!routes.length) {
    return {
      ...s,
      parsed: false,
      routes: undefined,
      rawError:
        (s.rawError ? s.rawError + " · " : "") +
        "Quality gate rejected routes (boilerplate or empty steps).",
      gaps: [
        ...(s.gaps || []),
        "AI routes failed quality gate — showing evidence shell / literature leads",
      ],
    };
  }

  return { ...s, routes };
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
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  onProgress?: ProgressEmitter
): Promise<{
  ok: boolean;
  content?: string;
  error?: string;
  status?: number;
  durationMs: number;
}> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
      let err = `Ollama Cloud HTTP ${res.status}`;
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
          label: "Ollama Cloud generating…",
          organization: "Ollama Cloud",
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
 * Call Ollama Cloud with evidence-only prompt. Uses .env key via getServerAiEnv.
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
  if (!env.hasKey) {
    return {
      available: false,
      rawError:
        "Ollama Cloud not configured. Set OLLAMA_CLOUD_API_KEY in .env or Settings → AI.",
    };
  }

  const host = (env.host || OLLAMA_CLOUD_HOST).replace(/\/$/, "");
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
    organization: "Ollama Cloud",
    endpointUrl,
    method: "POST",
    detail: `Model ${model} · evidence ${evidenceBlock.length} chars · ${dataSources.length} feed source(s) · stream+JSON · timeout ${AI_TIMEOUT_MS / 1000}s · key from ${env.keySource || "env"}`,
  });

  const first = await ollamaChatStream(
    host,
    env.apiKey,
    model,
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
    onProgress
  );

  const finishedAt = new Date().toISOString();
  const baseProvenance: AiProvenanceRecord = {
    provider: "ollama-cloud",
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

    let materials = r.materials ?? [];
    if (materials.length === 0) {
      const seen = new Set<string>();
      for (const s of steps) {
        for (const m of s.materials ?? []) {
          const key = `${m.role}:${m.name}`;
          if (!seen.has(key)) {
            seen.add(key);
            materials.push(m);
          }
        }
      }
    }

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
