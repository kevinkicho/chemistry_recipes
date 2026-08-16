/**
 * Provenance from real free public API traces and allowed public record URLs only.
 * Never invent response bodies, endpoints, or timestamps.
 *
 * Citation sourceRefs (human deeplinks: DOI, report cards, landing pages) are NOT
 * re-fetched as HTML — that would be slow, fragile, and poor API etiquette.
 * When gather already captured a matching free-public JSON/API call, we hydrate
 * the citation row with that real trace (endpoint + body + time).
 */

import type { SourceRef } from "@/lib/types/process";
import type { ApiFetchTrace } from "@/lib/api/trace";
import { isFreePublicUrl } from "@/lib/api/publicSources";
import { pubchemDeepLink } from "@/lib/api/pubchem";

export type ProvenanceKind = "api" | "literature" | "patent" | "record";

export interface ProvenanceItem {
  id: string;
  datapoint: string;
  name: string;
  organization?: string;
  kind: ProvenanceKind;
  role: string;
  docsUrl?: string;
  deepLinkUrl?: string;
  endpointUrl?: string;
  /** Only set from a real HTTP response */
  responseBody?: string;
  /** Only set from a real HTTP completion time */
  fetchedAt?: string;
  httpStatus?: number;
  method?: string;
  contentType?: string;
  note?: string;
  recordUrl?: string;
  /** true when row is a human deeplink without a matching harvest API capture */
  citationOnly?: boolean;
}

const PUBCHEM = {
  name: "PubChem PUG REST",
  organization: "NCBI / NLM (NIH)",
  docsUrl: "https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest",
};

/**
 * Build provenance rows exclusively from real HTTP traces (e.g. PubChem).
 */
export function provenanceFromTraces(
  traces: ApiFetchTrace[],
  opts: { pubchemCid?: number; datapoint?: string } = {}
): ProvenanceItem[] {
  const deep =
    opts.pubchemCid != null && opts.pubchemCid > 0
      ? pubchemDeepLink(opts.pubchemCid)
      : undefined;

  return traces
    .filter((t) => isFreePublicUrl(t.endpointUrl))
    .map((t, i) => {
      const meta = classifyTrace(t.endpointUrl);
      const datapoint = opts.datapoint ?? meta.datapoint;

      return {
        id: `trace:${i}:${t.fetchedAt}:${t.endpointUrl}`,
        datapoint,
        name: meta.name,
        organization: meta.organization,
        kind: "api" as const,
        role: t.ok
          ? "Live free public API response captured for validation"
          : `Request failed${t.error ? `: ${t.error}` : ""}`,
        docsUrl: meta.docsUrl,
        deepLinkUrl: deep,
        recordUrl: deep,
        endpointUrl: t.endpointUrl,
        responseBody: t.responseBody || undefined,
        fetchedAt: t.fetchedAt,
        httpStatus: t.httpStatus,
        method: t.method,
        contentType: t.contentType,
        citationOnly: false,
      };
    });
}

function classifyTrace(url: string): {
  name: string;
  organization?: string;
  docsUrl?: string;
  datapoint: string;
} {
  const u = url.toLowerCase();
  if (u.includes("pug_view")) {
    return {
      name: "PubChem PUG View",
      organization: "NCBI / NLM (NIH)",
      docsUrl: "https://pubchem.ncbi.nlm.nih.gov/docs/pug-view",
      datapoint: u.includes("ghs")
        ? "GHS / hazards"
        : u.includes("manufacturing")
          ? "Use and manufacturing"
          : "PUG View section",
    };
  }
  if (u.includes("pubchem")) {
    const isProps = u.includes("/property/");
    const isCids = u.includes("/cids/json");
    return {
      name: PUBCHEM.name,
      organization: PUBCHEM.organization,
      docsUrl: PUBCHEM.docsUrl,
      datapoint: isProps
        ? "Compound properties"
        : isCids
          ? "Compound identifier resolution"
          : "PubChem PUG REST",
    };
  }
  if (u.includes("europepmc") || u.includes("ebi.ac.uk/europepmc")) {
    return {
      name: "Europe PMC",
      organization: "EMBL-EBI",
      docsUrl: "https://europepmc.org/RestfulWebService",
      datapoint: "Literature search",
    };
  }
  if (u.includes("patentsview")) {
    return {
      name: "PatentsView",
      organization: "USPTO / PatentsView",
      docsUrl: "https://patentsview.org/apis/api-query-language",
      datapoint: "Patent search",
    };
  }
  if (u.includes("chembl")) {
    return {
      name: "ChEMBL API",
      organization: "EMBL-EBI",
      docsUrl: "https://chembl.gitbook.io/chembl-interface-documentation/web-services",
      datapoint: "Molecule / mechanism",
    };
  }
  if (u.includes("mychem.info")) {
    return {
      name: "MyChem.info",
      organization: "BioThings",
      docsUrl: "https://mychem.info/api",
      datapoint: "Chemical annotation",
    };
  }
  if (u.includes("rxnav.nlm.nih.gov") || u.includes("rxnorm")) {
    return {
      name: "RxNorm / RxNav",
      organization: "NLM (NIH)",
      docsUrl: "https://lhncbc.nlm.nih.gov/RxNav/APIs/",
      datapoint: "Drug name normalization",
    };
  }
  if (u.includes("api.fda.gov") || u.includes("open.fda.gov")) {
    return {
      name: "openFDA",
      organization: "U.S. FDA",
      docsUrl: "https://open.fda.gov/apis/",
      datapoint: "Drug label / Drugs@FDA",
    };
  }
  if (u.includes("eutils.ncbi.nlm.nih.gov") || u.includes("pubmed")) {
    return {
      name: "PubMed E-utilities",
      organization: "NCBI / NLM (NIH)",
      docsUrl: "https://www.ncbi.nlm.nih.gov/books/NBK25501/",
      datapoint: "Literature search",
    };
  }
  if (u.includes("clinicaltrials.gov")) {
    return {
      name: "ClinicalTrials.gov",
      organization: "NLM (NIH)",
      docsUrl: "https://clinicaltrials.gov/data-api/about-api",
      datapoint: "Clinical studies",
    };
  }
  if (u.includes("comptox") || u.includes("epa.gov")) {
    return {
      name: "EPA CompTox",
      organization: "U.S. EPA",
      docsUrl: "https://www.epa.gov/comptox-tools/computational-toxicology-and-exposure-apis",
      datapoint: "Chemical identity / toxicity",
    };
  }
  if (u.includes("dailymed")) {
    return {
      name: "DailyMed",
      organization: "NLM (NIH)",
      docsUrl: "https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm",
      datapoint: "SPL labeling",
    };
  }
  if (u.includes("openalex")) {
    return {
      name: "OpenAlex",
      organization: "OurResearch",
      docsUrl: "https://docs.openalex.org/",
      datapoint: "Scholarly works",
    };
  }
  if (u.includes("api.crossref.org") || u.includes("crossref")) {
    return {
      name: "Crossref",
      organization: "Crossref",
      docsUrl: "https://api.crossref.org/",
      datapoint: "DOI metadata",
    };
  }
  if (u.includes("semanticscholar")) {
    return {
      name: "Semantic Scholar",
      organization: "Allen Institute",
      docsUrl: "https://api.semanticscholar.org/",
      datapoint: "Literature search",
    };
  }
  if (u.includes("chebi")) {
    return {
      name: "ChEBI",
      organization: "EMBL-EBI",
      docsUrl: "https://www.ebi.ac.uk/chebi/",
      datapoint: "Ontology identity",
    };
  }
  if (u.includes("gsrs") || u.includes("ginas")) {
    return {
      name: "GSRS / G-SRS",
      organization: "FDA / NCATS",
      docsUrl: "https://gsrs.ncats.nih.gov/",
      datapoint: "Substance registration",
    };
  }
  return {
    name: hostLabel(url),
    datapoint: "API response",
  };
}

type EndpointPred = (endpointLower: string) => boolean;

/** Family → harvest endpoint matcher. Id prefix wins over URL heuristics. */
const SOURCE_FAMILY_PRED: Record<string, EndpointPred> = {
  pubchem: (e) =>
    e.includes("pubchem.ncbi.nlm.nih.gov") &&
    !e.includes("pug_view") &&
    !e.includes("patentid") &&
    !e.includes("/classification/"),
  "pubchem-mfg": (e) => e.includes("pug_view") && e.includes("manufacturing"),
  "pubchem-mfg-page": (e) => e.includes("pug_view") && e.includes("manufacturing"),
  "pubchem-patents": (e) =>
    e.includes("pubchem.ncbi.nlm.nih.gov") && e.includes("patentid"),
  "pubchem-class": (e) =>
    e.includes("pubchem.ncbi.nlm.nih.gov") && e.includes("classification"),
  patentsview: (e) => e.includes("patentsview"),
  "patentsview-api": (e) => e.includes("patentsview"),
  chembl: (e) => e.includes("chembl") && (e.includes("api") || e.includes("/data/")),
  mychem: (e) => e.includes("mychem.info"),
  rxnorm: (e) => e.includes("rxnav.nlm.nih.gov") || e.includes("rxnorm"),
  openfda: (e) => e.includes("api.fda.gov"),
  kegg: (e) => e.includes("rest.kegg.jp") || e.includes("kegg.jp"),
  chebi: (e) => e.includes("chebi"),
  gsrs: (e) => e.includes("gsrs") || e.includes("ginas"),
  pubmed: (e) => e.includes("eutils.ncbi.nlm.nih.gov"),
  clinicaltrials: (e) => e.includes("clinicaltrials.gov"),
  comptox: (e) => e.includes("comptox") || e.includes("epa.gov/dashboard"),
  dailymed: (e) => e.includes("dailymed"),
  "europepmc-pat": (e) =>
    (e.includes("europepmc") || e.includes("ebi.ac.uk/europepmc")) &&
    (e.includes("pat") || e.includes("src")),
  europepmc: (e) => e.includes("europepmc") || e.includes("ebi.ac.uk/europepmc"),
  openalex: (e) => e.includes("openalex.org"),
  crossref: (e) => e.includes("api.crossref.org") || e.includes("crossref.org"),
  semanticscholar: (e) => e.includes("semanticscholar"),
  arxiv: (e) => e.includes("arxiv.org") || e.includes("export.arxiv"),
  unichem: (e) => e.includes("unichem"),
  rhea: (e) => e.includes("rhea"),
  ord: (e) => e.includes("open-reaction-database") || e.includes("ord-"),
  reactome: (e) => e.includes("reactome"),
  wikipathways: (e) => e.includes("wikipathways"),
  "pathway-commons": (e) => e.includes("pathwaycommons") || e.includes("pathway-commons"),
  massbank: (e) => e.includes("massbank"),
  drugcentral: (e) => e.includes("drugcentral"),
  orgsyn: (e) => e.includes("orgsyn"),
};

function sourceFamilyFromRef(ref: SourceRef): string | undefined {
  const id = (ref.id || "").toLowerCase();
  // Longest multi-segment prefixes first
  const multi = [
    "pubchem-mfg-page",
    "pubchem-patents",
    "pubchem-class",
    "pubchem-mfg",
    "patentsview-api",
    "europepmc-pat",
    "pathway-commons",
    "semanticscholar",
    "clinicaltrials",
  ];
  for (const p of multi) {
    if (id.startsWith(p + ":") || id === p) return p;
  }
  const m = id.match(/^([a-z][a-z0-9-]*):/);
  if (m?.[1] && SOURCE_FAMILY_PRED[m[1]]) return m[1];
  return undefined;
}

function pickBestTrace(
  traces: ApiFetchTrace[],
  pred: EndpointPred
): ApiFetchTrace | undefined {
  const hits = traces.filter((t) => pred(t.endpointUrl.toLowerCase()));
  if (!hits.length) return undefined;
  const ok = hits.find((t) => t.ok && t.responseBody);
  if (ok) return ok;
  const anyBody = hits.find((t) => t.responseBody);
  return anyBody || hits[0];
}

/**
 * Map a citation SourceRef to the harvest HTTP trace that actually populated it.
 * Prefer id prefixes from gather.ts (never trust a wrong deeplink host alone).
 * Never invents a match.
 */
export function matchTraceForSourceRef(
  ref: SourceRef,
  traces: ApiFetchTrace[]
): ApiFetchTrace | undefined {
  if (!traces.length) return undefined;

  // Literature / patent article rows: search traces already appear via provenanceFromTraces
  if (ref.type === "literature" || ref.type === "patent") return undefined;

  const family = sourceFamilyFromRef(ref);
  if (family && SOURCE_FAMILY_PRED[family]) {
    return pickBestTrace(traces, SOURCE_FAMILY_PRED[family]!);
  }

  // Fallback: label / host heuristics only when id has no known family
  const label = (ref.label || "").toLowerCase();
  const url = (ref.url || "").toLowerCase();
  const fallbacks: Array<{ test: boolean; pred: EndpointPred }> = [
    { test: label.includes("mychem"), pred: SOURCE_FAMILY_PRED.mychem! },
    { test: label.includes("chembl") || url.includes("/chembl/"), pred: SOURCE_FAMILY_PRED.chembl! },
    { test: label.includes("openfda") || label.includes("drugs@fda"), pred: SOURCE_FAMILY_PRED.openfda! },
    { test: label.includes("rxnorm"), pred: SOURCE_FAMILY_PRED.rxnorm! },
    { test: label.includes("europe pmc") || label.includes("europepmc"), pred: SOURCE_FAMILY_PRED.europepmc! },
    { test: label.includes("openalex"), pred: SOURCE_FAMILY_PRED.openalex! },
    { test: label.includes("crossref"), pred: SOURCE_FAMILY_PRED.crossref! },
    { test: label.includes("pubmed"), pred: SOURCE_FAMILY_PRED.pubmed! },
    { test: label.includes("comptox"), pred: SOURCE_FAMILY_PRED.comptox! },
    { test: label.includes("dailymed"), pred: SOURCE_FAMILY_PRED.dailymed! },
    { test: label.includes("clinicaltrials"), pred: SOURCE_FAMILY_PRED.clinicaltrials! },
    {
      test: label.includes("pubchem") || url.includes("pubchem.ncbi.nlm.nih.gov"),
      pred: SOURCE_FAMILY_PRED.pubchem!,
    },
  ];
  for (const rule of fallbacks) {
    if (!rule.test) continue;
    const hit = pickBestTrace(traces, rule.pred);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Citation rows from SourceRef free public HTTPS URLs.
 * When `traces` are provided, hydrate rows that match a real harvest API call.
 * Never fabricates response bodies; never pretends a DOI/HTML page was polled.
 */
export function provenanceFromPublicSourceRefs(
  refs: SourceRef[] | undefined,
  datapoint: string,
  traces: ApiFetchTrace[] = []
): ProvenanceItem[] {
  if (!refs?.length) return [];

  return refs
    .filter((r) => isFreePublicUrl(r.url))
    .map((r, i) => {
      const url = r.url!;
      const kind: ProvenanceKind =
        r.type === "patent"
          ? "patent"
          : r.type === "literature"
            ? "literature"
            : r.type === "api"
              ? "api"
              : "record";

      const matched = matchTraceForSourceRef(r, traces);
      if (matched) {
        const meta = classifyTrace(matched.endpointUrl);
        return {
          id: `ref-hydrated:${r.type}:${r.id}:${i}`,
          datapoint,
          name: r.label ?? r.id,
          organization: meta.organization,
          kind: "api" as const,
          role: matched.ok
            ? "Harvested free-public API response (matched to this citation)"
            : `Harvest API call failed${matched.error ? `: ${matched.error}` : ""}`,
          docsUrl: meta.docsUrl,
          deepLinkUrl: url,
          recordUrl: url,
          endpointUrl: matched.endpointUrl,
          responseBody: matched.responseBody || undefined,
          fetchedAt: matched.fetchedAt,
          httpStatus: matched.httpStatus,
          method: matched.method,
          contentType: matched.contentType,
          note:
            "Human-facing deep link kept separate from the JSON/API URL used during harvest. We do not re-fetch HTML report cards or DOI landing pages.",
          citationOnly: false,
        };
      }

      // Harvested paper/patent window from free APIs (EPMC/Crossref densify) — real capture
      if (r.capturedSnippet && r.capturedSnippet.length >= 40) {
        return {
          id: `ref-capture:${r.type}:${r.id}:${i}`,
          datapoint,
          name: r.label ?? r.id,
          kind,
          role:
            r.note ||
            `Harvested free-public ${r.type} densify window` +
              (r.relevanceTier ? ` · ${r.relevanceTier}` : ""),
          deepLinkUrl: url,
          recordUrl: url,
          endpointUrl: r.capturedEndpoint || undefined,
          responseBody: r.capturedSnippet.slice(0, 1500),
          fetchedAt: r.capturedAt,
          method: "GET",
          note:
            "Snippet from free-public densify (Europe PMC / Crossref / patent APIs) — not HTML scraping of the deep link.",
          citationOnly: false,
        };
      }

      const isArticle = r.type === "literature" || r.type === "patent";
      return {
        id: `ref:${r.type}:${r.id}:${i}`,
        datapoint,
        name: r.label ?? r.id,
        kind,
        role:
          r.note ??
          (isArticle
            ? `Public ${r.type} citation — densify still pending for free-API body`
            : `Public ${r.type} record (deeplink only; no matching harvest API capture in traces)`),
        deepLinkUrl: url,
        recordUrl: url,
        endpointUrl: undefined,
        citationOnly: true,
        note: isArticle
          ? "No free-public abstract/OA window captured yet. Force densify retries Europe PMC / Crossref — paywalled HTML is not scraped."
          : "Citation / landing-page deeplink only. Matching free-public JSON API was not found in harvest traces. Use Retry failed families or force densify — we do not scrape HTML pages.",
      };
    });
}

/**
 * Merge trace rows + citation rows without double-counting the same harvest URL.
 * Hydrated citations that share an endpoint with a pure-trace row keep the
 * citation's human label but drop the duplicate pure-trace entry.
 */
export function mergeProvenanceRows(
  traceRows: ProvenanceItem[],
  citationRows: ProvenanceItem[]
): ProvenanceItem[] {
  const usedEndpoints = new Set<string>();
  const out: ProvenanceItem[] = [];

  // Prefer hydrated citations first (richer labels + deep links)
  for (const row of citationRows) {
    if (row.endpointUrl && !row.citationOnly) {
      const key = row.endpointUrl.toLowerCase();
      if (usedEndpoints.has(key)) continue;
      usedEndpoints.add(key);
    }
    out.push(row);
  }

  for (const row of traceRows) {
    if (row.endpointUrl) {
      const key = row.endpointUrl.toLowerCase();
      if (usedEndpoints.has(key)) continue;
      usedEndpoints.add(key);
    }
    out.push(row);
  }

  // Fetched rows first, then citation-only
  out.sort((a, b) => {
    const af = a.fetchedAt ? 0 : 1;
    const bf = b.fetchedAt ? 0 : 1;
    if (af !== bf) return af - bf;
    return 0;
  });

  return out;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "Public API";
  }
}
