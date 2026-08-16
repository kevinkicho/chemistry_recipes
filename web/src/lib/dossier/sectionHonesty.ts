/**
 * Live-dossier section empty vs error vs timeout copy.
 * HTTP 200 + empty hits is not success when literature / patent / annotation
 * families failed or timed out.
 */

import type { ApiFetchTrace } from "@/lib/api/trace";

export type SectionFamily = "literature" | "patents" | "annotations";

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
] as const;

const FAMILY_ERROR_LABELS: Record<SectionFamily, readonly string[]> = {
  literature: LIT_ERROR_FAMILIES,
  patents: PATENT_ERROR_FAMILIES,
  annotations: ANNOTATION_ERROR_FAMILIES,
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
    e.includes("ginas")
  );
}

const TRACE_PRED: Record<SectionFamily, (url: string) => boolean> = {
  literature: isLiteratureSectionTrace,
  patents: isPatentSectionTrace,
  annotations: isAnnotationSectionTrace,
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
      summary: opts.family === "annotations" ? "No extra annotations in this capture" : "No hits",
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
