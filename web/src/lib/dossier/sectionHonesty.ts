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
 * related entities / unit-ops, evidence-gaps, process-framing, condition-atlas, operator-job-aid, and Monday-pack chips reuse this family —
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
 * Condition-atlas, process-recipe (RoutePanel), and route-compare empty copy reuse this helper —
 * no extracted conditions / no process recipe / no process routes is not a clean miss when
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
