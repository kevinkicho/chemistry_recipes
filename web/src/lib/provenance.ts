/**
 * Provenance from real free public API traces and allowed public record URLs only.
 * Never invent response bodies, endpoints, or timestamps.
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
  return {
    name: hostLabel(url),
    datapoint: "API response",
  };
}

/**
 * Citation rows only when SourceRef has an allowed free public HTTPS URL.
 * No fabricated response body.
 */
export function provenanceFromPublicSourceRefs(
  refs: SourceRef[] | undefined,
  datapoint: string
): ProvenanceItem[] {
  if (!refs?.length) return [];

  return refs
    .filter((r) => isFreePublicUrl(r.url))
    .map((r, i) => {
      const url = r.url!;
      const kind: ProvenanceKind =
        r.type === "patent" ? "patent" : r.type === "literature" ? "literature" : "record";

      return {
        id: `ref:${r.type}:${r.id}:${i}`,
        datapoint,
        name: r.label ?? r.id,
        kind,
        role: r.note ?? `Public ${r.type} record (deeplink only; response not auto-fetched)`,
        deepLinkUrl: url,
        recordUrl: url,
        endpointUrl: url,
        // Intentionally no responseBody / fetchedAt — we did not call this URL
        note: "Open deep link / endpoint to retrieve the live public record.",
      };
    });
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "Public API";
  }
}


