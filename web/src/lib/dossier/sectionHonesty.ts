/**
 * Live-dossier section empty vs error vs timeout copy.
 * HTTP 200 + empty hits is not success when literature / patent / annotation
 * / GHS / properties / manufacturing / overview / process-facts / condition-atlas / route-compare families failed or timed out.
 */

import type { ApiFetchTrace } from "@/lib/api/trace";

export type SectionFamily =
  | "literature"
  | "patents"
  | "annotations"
  | "hazards"
  | "properties"
  | "manufacturing"
  | "overview";

export type SectionEmptyCopy = {
  kind: "empty" | "error";
  /** Short CollapsibleSection summary */
  summary: string;
  /** Table / body empty-state */
  message: string;
};

const LIT_ERROR_FAMILIES = [
  "europepmc",
  "europepmc-oa",
  "openalex",
  "crossref",
  "pubmed",
  "semanticscholar",
  "arxiv",
  "deep-literature",
] as const;

const PATENT_ERROR_FAMILIES = [
  "patentsview",
  "patent-literature",
  "europepmc-pat",
  "pubchem-patents",
  "patent-epmc-densify",
  "patent-uspto-densify",
] as const;

const ANNOTATION_ERROR_FAMILIES = [
  "chembl",
  "mychem",
  "openfda",
  "rxnorm",
  "kegg",
  "drugcentral",
  "comptox",
  "dailymed",
  "unichem",
  "chebi",
  "gsrs",
  "pubchem-class",
  "massbank",
  "rhea",
  "orgsyn",
  "reactome",
  "wikipathways",
  "pathway-commons",
  "clinicaltrials",
] as const;

const HAZARD_ERROR_FAMILIES = ["pubchem-view"] as const;

const PROPERTY_ERROR_FAMILIES = ["pubchem-view", "pubchem-identity"] as const;

const MFG_ERROR_FAMILIES = ["pubchem-view"] as const;

const OVERVIEW_ERROR_FAMILIES = ["pubchem-view"] as const;

const FAMILY_ERROR_LABELS: Record<SectionFamily, readonly string[]> = {
  literature: LIT_ERROR_FAMILIES,
  patents: PATENT_ERROR_FAMILIES,
  annotations: ANNOTATION_ERROR_FAMILIES,
  hazards: HAZARD_ERROR_FAMILIES,
  properties: PROPERTY_ERROR_FAMILIES,
  manufacturing: MFG_ERROR_FAMILIES,
  overview: OVERVIEW_ERROR_FAMILIES,
};

function syntheticFamily(url: string): string | undefined {
  const e = url.toLowerCase();
  const m = e.match(/^(?:soft-fail|densify-fail|api-fail):\/\/([a-z0-9-]+)/);
  return m?.[1];
}

function isPatentLiteratureUrl(e: string): boolean {
  return (
    e.includes("patentsview") ||
    e.includes("patentid") ||
    e.includes("/data/patent/") ||
    e.includes("heading=patents") ||
    ((e.includes("europepmc") || e.includes("ebi.ac.uk/europepmc")) &&
      /patent|uspto/.test(e))
  );
}

export function isLiteratureSectionTrace(endpointUrl: string): boolean {
  const syn = syntheticFamily(endpointUrl);
  if (syn) return (LIT_ERROR_FAMILIES as readonly string[]).includes(syn);
  const e = endpointUrl.toLowerCase();
  if (isPatentLiteratureUrl(e)) return false;
  return (
    e.includes("europepmc") ||
    e.includes("ebi.ac.uk/europepmc") ||
    e.includes("openalex") ||
    e.includes("api.crossref.org") ||
    e.includes("semanticscholar") ||
    e.includes("eutils.ncbi.nlm.nih.gov") ||
    e.includes("arxiv.org") ||
    e.includes("export.arxiv") ||
    (e.includes("pug_view") && e.includes("heading=literature"))
  );
}

export function isPatentSectionTrace(endpointUrl: string): boolean {
  const syn = syntheticFamily(endpointUrl);
  if (syn) return (PATENT_ERROR_FAMILIES as readonly string[]).includes(syn);
  return isPatentLiteratureUrl(endpointUrl.toLowerCase());
}

export function isAnnotationSectionTrace(endpointUrl: string): boolean {
  const syn = syntheticFamily(endpointUrl);
  if (syn) return (ANNOTATION_ERROR_FAMILIES as readonly string[]).includes(syn);
  const e = endpointUrl.toLowerCase();
  if (e.includes("massbank")) return true;
  if (e.includes("pubchem.ncbi.nlm.nih.gov") && e.includes("classification")) {
    return true;
  }
  if (e.includes("pubchem.ncbi.nlm.nih.gov")) return false;
  return (
    e.includes("chembl") ||
    e.includes("mychem.info") ||
    e.includes("api.fda.gov") ||
    e.includes("rxnav.nlm.nih.gov") ||
    e.includes("rxnorm") ||
    e.includes("rest.kegg.jp") ||
    e.includes("kegg.jp") ||
    e.includes("drugcentral") ||
    e.includes("comptox") ||
    e.includes("epa.gov/dashboard") ||
    e.includes("dailymed") ||
    e.includes("unichem") ||
    e.includes("chebi") ||
    e.includes("gsrs") ||
    e.includes("ginas") ||
    e.includes("rhea") ||
    e.includes("orgsyn") ||
    e.includes("reactome") ||
    e.includes("wikipathways") ||
    e.includes("pathwaycommons") ||
    e.includes("pathway-commons") ||
    e.includes("clinicaltrials.gov")
  );
}

/** Citation rows that belong on the Multi-source free APIs card. */
export function isAnnotationSourceRef(ref: {
  id?: string;
  type?: string;
}): boolean {
  if (ref.type === "literature" || ref.type === "patent") return false;
  const id = (ref.id || "").toLowerCase();
  return (ANNOTATION_ERROR_FAMILIES as readonly string[]).some(
    (p) => id === p || id.startsWith(`${p}:`)
  );
}

/**
 * Harvest HTTP that actually feeds public process facts
 * (literature, patents, PubChem manufacturing, GHS).
 * Leftover identity / properties / annotation HTTP is not process-fact provenance.
 * Plant environment / apparatus, process recipe / route / control-points,
 * related entities / unit-ops, evidence-gaps, process-framing, condition-atlas, operator-job-aid, Monday-pack, shift-pack, route-hypotheses, problem-unit-op-search, procedure-vault, PDF-pack, and playbook chips reuse this family —
 * they derive from process facts, not leftover PubChem identity HTTP.
 */
export function isProcessFactTrace(endpointUrl: string): boolean {
  return (
    isLiteratureSectionTrace(endpointUrl) ||
    isPatentSectionTrace(endpointUrl) ||
    isManufacturingSectionTrace(endpointUrl) ||
    isHazardsSectionTrace(endpointUrl)
  );
}

/** Citation rows that belong on the Public process facts card. */
export function isProcessFactSourceRef(ref: {
  id?: string;
  type?: string;
}): boolean {
  if (ref.type === "literature" || ref.type === "patent") return true;
  const id = (ref.id || "").toLowerCase();
  return (
    id === "pubchem-mfg" ||
    id.startsWith("pubchem-mfg:") ||
    id.startsWith("pubchem-mfg-page:") ||
    id === "pubchem-view-ghs" ||
    id.startsWith("pubchem-view-ghs:") ||
    id.startsWith("ghs:")
  );
}

const FACT_TRACE_PRED: Record<string, (url: string) => boolean> = {
  literature: isLiteratureSectionTrace,
  patent: isPatentSectionTrace,
  "pubchem-mfg": isManufacturingSectionTrace,
  ghs: isHazardsSectionTrace,
  annotation: isAnnotationSectionTrace,
};

/** Per-fact harvest HTTP. Local paste / editorial gaps have no harvest family. */
export function tracesForProcessFactProvenance<
  T extends { endpointUrl: string },
>(traces: T[] | undefined, provenance: string): T[] {
  const pred = FACT_TRACE_PRED[provenance];
  if (!pred) return [];
  return (traces || []).filter((t) => pred(t.endpointUrl));
}

/** Full-record PUG View fallback feeds GHS, manufacturing, and properties. */
function isFullRecordPugView(e: string): boolean {
  return (
    e.includes("pug_view") &&
    e.includes("/data/compound/") &&
    !e.includes("heading=") &&
    !e.includes("/data/patent/")
  );
}

export function isHazardsSectionTrace(endpointUrl: string): boolean {
  const syn = syntheticFamily(endpointUrl);
  if (syn) return (HAZARD_ERROR_FAMILIES as readonly string[]).includes(syn);
  const e = endpointUrl.toLowerCase();
  if (isFullRecordPugView(e)) return true;
  if (!e.includes("pug_view") || e.includes("/data/patent/")) return false;
  return /ghs|safety|hazards/i.test(e);
}

export function isManufacturingSectionTrace(endpointUrl: string): boolean {
  const syn = syntheticFamily(endpointUrl);
  if (syn) return (MFG_ERROR_FAMILIES as readonly string[]).includes(syn);
  const e = endpointUrl.toLowerCase();
  if (isFullRecordPugView(e)) return true;
  if (!e.includes("pug_view") || e.includes("/data/patent/")) return false;
  return /use\+and\+manufacturing|use%20and%20manufacturing|manufacturing/i.test(
    endpointUrl
  );
}

export function isPropertiesSectionTrace(endpointUrl: string): boolean {
  const syn = syntheticFamily(endpointUrl);
  if (syn) return (PROPERTY_ERROR_FAMILIES as readonly string[]).includes(syn);
  const e = endpointUrl.toLowerCase();
  if (e.includes("/property/")) return true;
  if (isFullRecordPugView(e)) return true;
  if (!e.includes("pug_view") || e.includes("/data/patent/")) return false;
  return /chemical\+and\+physical|chemical%20and%20physical|experimental\+properties|computed\+properties|physical\+description/i.test(
    endpointUrl
  );
}

/** PUG View headings that feed overview / identity description text. */
export function isOverviewSectionTrace(endpointUrl: string): boolean {
  const syn = syntheticFamily(endpointUrl);
  if (syn) return (OVERVIEW_ERROR_FAMILIES as readonly string[]).includes(syn);
  const e = endpointUrl.toLowerCase();
  if (isFullRecordPugView(e)) return true;
  if (!e.includes("pug_view") || e.includes("/data/patent/")) return false;
  return (
    (e.includes("names") && e.includes("identifiers")) ||
    e.includes("pharmacology") ||
    (e.includes("drug") && e.includes("medication")) ||
    (e.includes("associated") && e.includes("disorders"))
  );
}

const TRACE_PRED: Record<SectionFamily, (url: string) => boolean> = {
  literature: isLiteratureSectionTrace,
  patents: isPatentSectionTrace,
  annotations: isAnnotationSectionTrace,
  hazards: isHazardsSectionTrace,
  properties: isPropertiesSectionTrace,
  manufacturing: isManufacturingSectionTrace,
  overview: isOverviewSectionTrace,
};

function fetchErrorFamily(line: string): string | undefined {
  const m = line.match(/^(?:soft-fail|api-fail)\s*[·\-:]\s*([a-z0-9-]+):/i);
  return m?.[1]?.toLowerCase();
}

function isFailureTrace(t: Pick<ApiFetchTrace, "ok" | "notFound">): boolean {
  return !t.ok && !t.notFound;
}

function failureDetails(opts: {
  family: SectionFamily;
  traces: Array<Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">>;
  fetchErrors: string[];
}): string[] {
  const pred = TRACE_PRED[opts.family];
  const labels = FAMILY_ERROR_LABELS[opts.family];
  const details: string[] = [];
  for (const t of opts.traces) {
    if (!pred(t.endpointUrl) || !isFailureTrace(t)) continue;
    const d =
      (t.error || "").trim() ||
      (t.httpStatus != null ? `HTTP ${t.httpStatus}` : "");
    if (d) details.push(d);
  }
  for (const line of opts.fetchErrors) {
    const fam = fetchErrorFamily(line);
    if (!fam || !labels.includes(fam)) continue;
    const rest = line.replace(/^(?:soft-fail|api-fail)\s*[·\-:]\s*[a-z0-9-]+:\s*/i, "").trim();
    if (rest) details.push(rest);
  }
  return [...new Set(details)].slice(0, 3);
}

function hasFamilyFailure(opts: {
  family: SectionFamily;
  traces: Array<Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound">>;
  fetchErrors: string[];
}): boolean {
  const pred = TRACE_PRED[opts.family];
  if (opts.traces.some((t) => pred(t.endpointUrl) && isFailureTrace(t))) {
    return true;
  }
  const labels = FAMILY_ERROR_LABELS[opts.family];
  return opts.fetchErrors.some((line) => {
    const fam = fetchErrorFamily(line);
    return Boolean(fam && labels.includes(fam));
  });
}

function hasFamilyOkTrace(
  family: SectionFamily,
  traces: Array<Pick<ApiFetchTrace, "endpointUrl" | "ok">>
): boolean {
  const pred = TRACE_PRED[family];
  return traces.some((t) => pred(t.endpointUrl) && t.ok);
}

const NOUN: Record<SectionFamily, { short: string; long: string; emptyBody: string }> = {
  literature: {
    short: "Literature sources",
    long: "literature",
    emptyBody: "No literature hits for this capture.",
  },
  patents: {
    short: "Patent sources",
    long: "patent",
    emptyBody: "No patent hits for this capture.",
  },
  annotations: {
    short: "Annotation sources",
    long: "annotation",
    emptyBody:
      "No ChEMBL / openFDA / MyChem / related annotations were returned for this capture.",
  },
  hazards: {
    short: "GHS / safety sources",
    long: "GHS",
    emptyBody: "No GHS text returned for this CID.",
  },
  properties: {
    short: "Property sources",
    long: "property",
    emptyBody: "No property excerpts in this capture.",
  },
  manufacturing: {
    short: "Manufacturing sources",
    long: "manufacturing",
    emptyBody: "No manufacturing excerpts in this capture.",
  },
  overview: {
    short: "Overview sources",
    long: "overview",
    emptyBody:
      "Overview appears when PubChem description or Ollama synthesis is available. Process steps below use public literature, patents, and manufacturing text.",
  },
};

/**
 * When a section has zero hits, distinguish clean miss from upstream failure.
 */
export function formatSectionEmptyCopy(opts: {
  family: SectionFamily;
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
}): SectionEmptyCopy {
  const traces = opts.traces || [];
  const fetchErrors = opts.fetchErrors || [];
  const noun = NOUN[opts.family];
  const failed = hasFamilyFailure({ family: opts.family, traces, fetchErrors });
  if (!failed) {
    return {
      kind: "empty",
      summary:
        opts.family === "annotations"
          ? "No extra annotations in this capture"
          : opts.family === "hazards"
            ? "No GHS text"
            : opts.family === "properties"
              ? "No property excerpts"
              : opts.family === "manufacturing"
                ? "No manufacturing excerpts"
                : opts.family === "overview"
                  ? "No overview text"
                  : "No hits",
      message: noun.emptyBody,
    };
  }
  const details = failureDetails({ family: opts.family, traces, fetchErrors });
  const detailBit = details.length ? ` (${details.join("; ")})` : "";
  if (!hasFamilyOkTrace(opts.family, traces)) {
    return {
      kind: "error",
      summary: "Sources failed — not empty",
      message: `${noun.short} failed${detailBit}. Not an empty result — retry densify.`,
    };
  }
  return {
    kind: "error",
    summary: "No hits; some sources failed",
    message: `No ${noun.long} hits; some free-public sources failed${detailBit}. Not a clean miss — retry densify.`,
  };
}

const PROCESS_FACT_EMPTY_FAMILIES = [
  "literature",
  "patents",
  "manufacturing",
] as const;

/**
 * Process-fact atoms come from literature, patents, and manufacturing text.
 * Harvest failure in those families is not "no atoms extracted yet".
 * Leftover identity / GHS / annotation HTTP is not a process-facts miss.
 * Condition-atlas, process-recipe (RoutePanel), route-compare, route-hypotheses, problem-unit-op-search, manager-brief, evidence-critique, evidence-science Q&A, literature-depth, reaction-network, process-sequence stub, ideal-page, validation-checklist, recipe-readiness, campaign-brief, shift-pack, and MSAT-compare empty copy reuse this helper —
 * no extracted conditions / no process recipe / no process routes / no public process hypothesis / no process facts yet / no route assembled / no procedure windows densified / no route hypotheses assembled / no procedure-scored windows yet / network is center-only / no extractable public process sequence yet / process route synthesis pending / no process steps yet / no GHS text for this CID / missing process overview / checklist Gap / Only 0 sourced condition atom(s) / Few condition observations / No reaction-network edges yet / Insufficient free-public evidence in the campaign package / Similar public density / 0 / 0 literature-patents is not a clean miss when
 * lit / patent / manufacturing harvest failed.
 */
export function formatProcessFactsEmptyCopy(opts: {
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
}): SectionEmptyCopy {
  const traces = opts.traces || [];
  const fetchErrors = opts.fetchErrors || [];
  const copies = PROCESS_FACT_EMPTY_FAMILIES.map((family) =>
    formatSectionEmptyCopy({ family, traces, fetchErrors })
  );
  const errors = copies.filter((c) => c.kind === "error");
  if (!errors.length) {
    return {
      kind: "empty",
      summary: "No process-fact atoms",
      message:
        "No condition / unit-op atoms extracted from titles and abstracts yet.",
    };
  }
  const details: string[] = [];
  for (const e of errors) {
    const m = e.message.match(/\(([^)]+)\)/);
    if (m && m[1]) details.push(m[1]);
  }
  const unique = [...new Set(details)].slice(0, 3);
  const detailBit = unique.length ? " (" + unique.join("; ") + ")" : "";
  const allHardFail = copies.every(
    (c) => c.kind === "error" && c.summary === "Sources failed — not empty"
  );
  if (allHardFail) {
    return {
      kind: "error",
      summary: "Sources failed — not empty",
      message: "Process-fact sources failed" + detailBit + ". Not an empty result — retry densify.",
    };
  }
  return {
    kind: "error",
    summary: "No hits; some sources failed",
    message: "No condition / unit-op atoms; some free-public sources failed" + detailBit + ". Not a clean miss — retry densify.",
  };
}

/**
 * TOC / CollapsibleSection chrome: harvest failure is not a clean miss.
 * Leftover identity HTTP is not a TOC miss — callers pass the section family copy.
 */
export function tocHasSectionContent(opts: {
  hasHits: boolean;
  emptyCopy?: Pick<SectionEmptyCopy, "kind">;
}): boolean {
  return opts.hasHits || opts.emptyCopy?.kind === "error";
}

export function tocSectionFlags(opts: {
  hasHits: boolean;
  emptyCopy?: Pick<SectionEmptyCopy, "kind">;
}): { empty: "0" | "1"; error?: "1" } {
  if (opts.hasHits) return { empty: "0" };
  if (opts.emptyCopy?.kind === "error") return { empty: "0", error: "1" };
  return { empty: "1" };
}


const PROCESS_SEQUENCE_STUB_IDS = new Set(["await-facts-1", "await-ai-1"]);
const PROCESS_SEQUENCE_STUB_TITLES = [
  "No extractable public process sequence yet",
  "Process route synthesis pending",
];

/**
 * Scaffold / process-fact placeholder steps are not a real public sequence.
 * Harvest failure is not "No extractable public process sequence yet".
 * Leftover identity / annotation HTTP is not a process-sequence miss.
 */
export function isProcessSequenceStub(step?: {
  id?: string;
  title?: string;
  mechanismClass?: string;
}): boolean {
  if (!step) return false;
  if (step.id && PROCESS_SEQUENCE_STUB_IDS.has(step.id)) return true;
  const title = (step.title || "").trim();
  return PROCESS_SEQUENCE_STUB_TITLES.includes(title);
}

export function isStubOnlyProcessSequence(
  steps?: Array<{ id?: string; title?: string; mechanismClass?: string }>
): boolean {
  const list = steps || [];
  return list.length > 0 && list.every((st) => isProcessSequenceStub(st));
}

export function honestProcessSequenceStub(opts: {
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
  name: string;
  kind: "facts" | "scaffold";
}): { title: string; description: string } {
  const harvest = formatProcessFactsEmptyCopy({
    traces: opts.traces,
    fetchErrors: opts.fetchErrors,
  });
  if (harvest.kind === "error") {
    return { title: harvest.summary, description: harvest.message };
  }
  if (opts.kind === "facts") {
    return {
      title: "No extractable public process sequence yet",
      description:
        "Free-public titles/abstracts for " +
        opts.name +
        " did not yield condition or unit-op atoms. Do not invent a plant procedure — use literature/patent panels and site packages.",
    };
  }
  return {
    title: "Process route synthesis pending",
    description:
      "No process-oriented literature or patent abstracts were retrieved yet for " +
      opts.name +
      ". Ollama synthesis (when available) builds dual-view manufacturing routes from free public evidence. Open PubChem, literature, and patent panels below for raw sources.",
  };
}

export type IdealEmptyFamily =
  | "hazards"
  | "overview"
  | "properties"
  | "manufacturing"
  | "process-facts";

/**
 * Ideal-page empty copy: harvest failure is not "No GHS text for this CID" /
 * "No process steps yet" / "Missing process overview" / manufacturing "Empty" /
 * properties "Sparse".
 * Leftover identity / annotation HTTP is not an ideal-page miss.
 */
export function honestIdealEmptyCopy(opts: {
  family: IdealEmptyFamily;
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
  cleanDetail: string;
  cleanHowToClose?: string;
}): { detail: string; howToClose?: string; harvestFail: boolean } {
  const harvest =
    opts.family === "process-facts"
      ? formatProcessFactsEmptyCopy({
          traces: opts.traces,
          fetchErrors: opts.fetchErrors,
        })
      : formatSectionEmptyCopy({
          family: opts.family,
          traces: opts.traces,
          fetchErrors: opts.fetchErrors,
        });
  if (harvest.kind === "error") {
    return {
      detail: harvest.message,
      howToClose: "Retry densify — not a clean miss.",
      harvestFail: true,
    };
  }
  return {
    detail: opts.cleanDetail,
    howToClose: opts.cleanHowToClose,
    harvestFail: false,
  };
}

export type ChecklistStatus = "ok" | "gap" | "review";

/**
 * Transfer-readiness checklist: harvest failure is not a clean Gap
 * ("No process facts" / "0 lit · 0 patents" / "0 step(s)" / missing EHS).
 * Leftover identity / annotation HTTP is not a checklist miss.
 * Filled items stay ok/review. Provenance chips still pass all traces (composite pack).
 */
export function honestChecklistGap(opts: {
  family: IdealEmptyFamily;
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
  /** True when the item already has real content (not a miss). */
  filled: boolean;
  cleanStatus: ChecklistStatus;
  cleanNote?: string;
}): { status: ChecklistStatus; note?: string; harvestFail: boolean } {
  if (opts.filled) {
    return {
      status: opts.cleanStatus,
      note: opts.cleanNote,
      harvestFail: false,
    };
  }
  const harvest =
    opts.family === "process-facts"
      ? formatProcessFactsEmptyCopy({
          traces: opts.traces,
          fetchErrors: opts.fetchErrors,
        })
      : formatSectionEmptyCopy({
          family: opts.family,
          traces: opts.traces,
          fetchErrors: opts.fetchErrors,
        });
  if (harvest.kind === "error") {
    return {
      status: "review",
      note: harvest.message,
      harvestFail: true,
    };
  }
  return {
    status: opts.cleanStatus,
    note: opts.cleanNote,
    harvestFail: false,
  };
}

/**
 * Campaign brief / agent empty copy: harvest failure is not
 * "Few condition observations" / "No reaction-network edges yet" /
 * "Empty campaign package" / "Insufficient free-public evidence in the campaign package".
 * Leftover identity / annotation HTTP is not a campaign miss.
 * cachedCount === 0 stays a local-cache gap (no harvest traces).
 */
export function formatCampaignHarvestEmptyCopy(opts: {
  dossiers?: Array<{
    traces?: Array<
      Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
    >;
    fetchErrors?: string[];
  }>;
}): SectionEmptyCopy {
  const traces = (opts.dossiers || []).flatMap((d) => d.traces || []);
  const fetchErrors = (opts.dossiers || []).flatMap((d) => d.fetchErrors || []);
  return formatProcessFactsEmptyCopy({ traces, fetchErrors });
}

const CLEAN_EMPTY_CAMPAIGN_PACKAGE =
  "Empty campaign package — densify CIDs before scientific brief has content.";
const CLEAN_FEW_OBS =
  "Few condition observations — paste public procedure text or densify patents/OA literature";
const CLEAN_NO_EDGES =
  "No reaction-network edges yet — densify related materials / route leads";

/**
 * Campaign scientific brief gaps/summary: harvest failure is not a clean miss.
 * Leftover identity / annotation HTTP is not a campaign-brief miss.
 */
export function honestCampaignBriefEmpty(opts: {
  dossiers?: Array<{
    traces?: Array<
      Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
    >;
    fetchErrors?: string[];
  }>;
  cachedCount: number;
  totalObservations: number;
  networkEdgeCount: number;
  thinCidCount: number;
  thinThresh?: number;
}): { summaryOverlay?: string; openGaps: string[]; harvestFail: boolean } {
  if (opts.cachedCount === 0) {
    return {
      summaryOverlay: CLEAN_EMPTY_CAMPAIGN_PACKAGE,
      openGaps: [],
      harvestFail: false,
    };
  }
  const harvest = formatCampaignHarvestEmptyCopy({ dossiers: opts.dossiers });
  if (harvest.kind === "error") {
    return {
      summaryOverlay: harvest.message,
      openGaps: [harvest.message],
      harvestFail: true,
    };
  }
  const openGaps: string[] = [];
  if (opts.thinCidCount > 0) {
    openGaps.push(
      opts.thinCidCount +
        " campaign CID(s) missing densify or thin atlas (<" +
        (opts.thinThresh ?? 2) +
        " obs)"
    );
  }
  if (opts.totalObservations < 3) {
    openGaps.push(CLEAN_FEW_OBS);
  }
  if (!opts.networkEdgeCount) {
    openGaps.push(CLEAN_NO_EDGES);
  }
  return { openGaps, harvestFail: false };
}

/**
 * Campaign agent retrieval miss: harvest failure is not
 * "Insufficient free-public evidence in the campaign package".
 * Leftover identity / annotation HTTP is not a campaign-agent miss.
 * cachedCount === 0 stays a local-cache gap (caller keeps that path).
 */
export function honestCampaignAgentEmpty(opts: {
  dossiers?: Array<{
    traces?: Array<
      Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
    >;
    fetchErrors?: string[];
  }>;
  cleanEmpty: string;
}): string {
  const harvest = formatCampaignHarvestEmptyCopy({ dossiers: opts.dossiers });
  return harvest.kind === "error" ? harvest.message : opts.cleanEmpty;
}

/**
 * Build-diagnostics Multi-source APIs stat: harvest failure is not "none yet".
 * Leftover identity / literature / patent / GHS HTTP is not an annotation miss.
 */
export function honestDiagnosticsAnnotationStat(opts: {
  annotationCount: number;
  annotationSources?: string[];
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
}): { value: string; harvestFail: boolean } {
  if (opts.annotationCount > 0) {
    const src = (opts.annotationSources || []).slice(0, 3).join(", ");
    return {
      value: src
        ? opts.annotationCount + " · " + src
        : String(opts.annotationCount),
      harvestFail: false,
    };
  }
  const harvest = formatSectionEmptyCopy({
    family: "annotations",
    traces: opts.traces,
    fetchErrors: opts.fetchErrors,
  });
  if (harvest.kind === "error") {
    return { value: harvest.summary, harvestFail: true };
  }
  return { value: "none yet", harvestFail: false };
}

/**
 * Build-diagnostics Literature / patents stat: harvest failure is not a muted 0 · 0 miss.
 * Leftover identity / annotation HTTP is not a literature/patent miss.
 */
export function honestDiagnosticsLitPatentStat(opts: {
  literatureCount: number;
  patentCount: number;
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
}): { value: string; harvestFail: boolean } {
  if (opts.literatureCount + opts.patentCount > 0) {
    return {
      value: opts.literatureCount + " · " + opts.patentCount,
      harvestFail: false,
    };
  }
  const lit = formatSectionEmptyCopy({
    family: "literature",
    traces: opts.traces,
    fetchErrors: opts.fetchErrors,
  });
  const patents = formatSectionEmptyCopy({
    family: "patents",
    traces: opts.traces,
    fetchErrors: opts.fetchErrors,
  });
  if (lit.kind === "error" || patents.kind === "error") {
    const err = lit.kind === "error" ? lit : patents;
    return { value: err.summary, harvestFail: true };
  }
  return {
    value: opts.literatureCount + " · " + opts.patentCount,
    harvestFail: false,
  };
}

export type ShiftPackStepIn = {
  id?: string;
  title?: string;
  order?: number;
  description?: string;
  mechanismNotes?: string;
};

/**
 * Shift-pack snapshot: harvest failure is not a clean N-step pack /
 * "Lit/patents: 0/0" miss. Stub-only await-ai / await-facts steps are not
 * a public sequence. Leftover identity / annotation HTTP is not a shift-pack miss.
 * "No saved shift packs for this CID yet" stays a local-cache gap.
 */
export function honestShiftPackContent(opts: {
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
  steps?: ShiftPackStepIn[];
  gaps?: string[];
  litCount: number;
  patentCount: number;
}): {
  steps: Array<{ order: number; title: string; body: string }>;
  gaps: string[];
  harvestFail: boolean;
  litPatentLabel: string;
  saveDetail: string;
} {
  const harvest = formatProcessFactsEmptyCopy({
    traces: opts.traces,
    fetchErrors: opts.fetchErrors,
  });
  const raw = opts.steps || [];
  const stubOnly = isStubOnlyProcessSequence(raw);
  const harvestFail = harvest.kind === "error";
  const usable = raw.length > 0 && !stubOnly;
  const steps = usable
    ? raw.slice(0, 12).map((s, i) => ({
        order: s.order ?? i + 1,
        title: (s.title || "Step " + (i + 1)).trim() || "Step " + (i + 1),
        body: (s.description || s.mechanismNotes || "").slice(0, 400),
      }))
    : [];
  const gaps = [...(opts.gaps || [])];
  if (harvestFail && !gaps.includes(harvest.message)) {
    gaps.unshift(harvest.message);
  }
  const litPatentLabel =
    opts.litCount + opts.patentCount > 0
      ? opts.litCount + "/" + opts.patentCount
      : harvestFail
        ? harvest.summary
        : opts.litCount + "/" + opts.patentCount;
  const saveDetail =
    harvestFail && !usable ? harvest.message : steps.length + " steps";
  return {
    steps,
    gaps: gaps.slice(0, 10),
    harvestFail,
    litPatentLabel,
    saveDetail,
  };
}

export type MsatCompareSideIn = {
  score: number | null;
  conditions: number;
  harvestFail: boolean;
  name: string;
};

/**
 * MSAT compare board: harvest failure is not "Similar public density" /
 * "0 / 0" literature-patents. Leftover identity / annotation HTTP is not
 * an MSAT-compare miss.
 */
export function honestMsatCompareLitPatent(opts: {
  literatureCount: number;
  patentCount: number;
  traces?: Array<
    Pick<ApiFetchTrace, "endpointUrl" | "ok" | "notFound" | "error" | "httpStatus">
  >;
  fetchErrors?: string[];
}): { value: string; harvestFail: boolean } {
  const stat = honestDiagnosticsLitPatentStat(opts);
  if (stat.harvestFail) {
    return { value: "harvest failed — not 0/0", harvestFail: true };
  }
  return {
    value: opts.literatureCount + " / " + opts.patentCount,
    harvestFail: false,
  };
}

export function honestMsatCompareHint(opts: {
  a: MsatCompareSideIn | null;
  b: MsatCompareSideIn | null;
}): string {
  if (!opts.a || !opts.b) return "Warm both live CIDs to compare route pick metrics.";
  const failed: string[] = [];
  if (opts.a.harvestFail) failed.push("A");
  if (opts.b.harvestFail) failed.push("B");
  if (failed.length) {
    return (
      "Harvest failed on " +
      failed.join(" and ") +
      " — not similar public density. Retry densify before preferring either."
    );
  }
  const as = opts.a.score ?? 0;
  const bs = opts.b.score ?? 0;
  if (as === bs && opts.a.conditions === opts.b.conditions) {
    return "Similar public density — open patents/lit on both and check EHS before preferring either.";
  }
  const better = as >= bs ? opts.a : opts.b;
  const weaker = as >= bs ? opts.b : opts.a;
  return (
    "Public evidence leans " +
    better.name +
    " (score " +
    (better.score ?? "—") +
    " vs " +
    (weaker.score ?? "—") +
    ", " +
    better.conditions +
    " vs " +
    weaker.conditions +
    " conditions). Still scouting only — not a site selection decision."
  );
}
