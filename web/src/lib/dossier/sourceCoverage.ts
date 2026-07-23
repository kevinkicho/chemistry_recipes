/**
 * Source coverage map: which free APIs contributed / failed for a dossier.
 */

import type { ApiFetchTrace } from "@/lib/api/trace";
import type { ExternalAnnotation, LiveDossier } from "@/lib/dossier/types";

export type SourceSlotStatus = "ok" | "empty" | "fail" | "partial";

export interface SourceCoverageSlot {
  id: string;
  label: string;
  organization: string;
  status: SourceSlotStatus;
  hits?: number;
  detail?: string;
  hosts: string[];
}

export interface SourceCoverageReport {
  total: number;
  ok: number;
  empty: number;
  fail: number;
  partial: number;
  summary: string;
  slots: SourceCoverageSlot[];
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function tracesForHost(traces: ApiFetchTrace[], hosts: string[]): ApiFetchTrace[] {
  return traces.filter((t) => {
    const h = hostOf(t.endpointUrl);
    return hosts.some((x) => h.includes(x));
  });
}

function slotFromTraces(
  id: string,
  label: string,
  organization: string,
  traces: ApiFetchTrace[],
  hosts: string[],
  hitCount?: number
): SourceCoverageSlot {
  const ts = tracesForHost(traces, hosts);
  const ok = ts.filter((t) => t.ok).length;
  const fail = ts.filter((t) => !t.ok).length;
  let status: SourceSlotStatus = "empty";
  if (ts.length === 0) status = "empty";
  else if (fail > 0 && ok === 0) status = "fail";
  else if (fail > 0 && ok > 0) status = "partial";
  else if (ok > 0 && (hitCount === 0 || hitCount === undefined)) {
    // success but may be empty body
    status = hitCount === 0 ? "empty" : "ok";
  } else status = "ok";

  if (ok > 0 && (hitCount == null || hitCount > 0)) status = fail > 0 ? "partial" : "ok";
  if (ok > 0 && hitCount === 0 && fail === 0) status = "empty";

  return {
    id,
    label,
    organization,
    status,
    hits: hitCount,
    detail:
      ts.length === 0
        ? "Not called in this build"
        : `${ok} ok · ${fail} fail${hitCount != null ? ` · ${hitCount} hit(s)` : ""}`,
    hosts,
  };
}

/**
 * Build coverage for known free APIs used in the live pipeline.
 */
export function buildSourceCoverage(dossier: LiveDossier): SourceCoverageReport {
  const traces = dossier.traces || [];
  const ann = dossier.annotations || [];
  const bySource = (name: string) =>
    ann.filter((a) => a.source.toLowerCase().includes(name.toLowerCase()));

  const slots: SourceCoverageSlot[] = [
    slotFromTraces(
      "pubchem",
      "PubChem",
      "NCBI (NIH)",
      traces,
      ["pubchem.ncbi.nlm.nih.gov"],
      dossier.identity ? 1 : 0
    ),
    (() => {
      const s = slotFromTraces(
        "chembl",
        "ChEMBL",
        "EMBL-EBI",
        traces,
        ["ebi.ac.uk"],
        bySource("ChEMBL").length
      );
      // ebi.ac.uk also europepmc — refine by path
      const chemblTraces = traces.filter((t) =>
        t.endpointUrl.includes("chembl")
      );
      if (chemblTraces.length) {
        const ok = chemblTraces.filter((t) => t.ok).length;
        const fail = chemblTraces.length - ok;
        const hits = bySource("ChEMBL").length;
        s.status =
          fail && !ok ? "fail" : hits ? "ok" : ok ? "empty" : "empty";
        s.detail = `${ok} ok · ${fail} fail · ${hits} hit(s)`;
        s.hosts = ["www.ebi.ac.uk/chembl"];
      }
      return s;
    })(),
    slotFromTraces(
      "mychem",
      "MyChem.info",
      "BioThings",
      traces,
      ["mychem.info"],
      bySource("MyChem").length
    ),
    slotFromTraces(
      "openfda",
      "openFDA",
      "U.S. FDA",
      traces,
      ["api.fda.gov"],
      bySource("openFDA").length + bySource("openfda").length
    ),
    slotFromTraces(
      "rxnorm",
      "RxNorm",
      "NLM (NIH)",
      traces,
      ["rxnav.nlm.nih.gov"],
      bySource("RxNorm").length
    ),
    slotFromTraces(
      "kegg",
      "KEGG",
      "KEGG",
      traces,
      ["rest.kegg.jp"],
      bySource("KEGG").length
    ),
    slotFromTraces(
      "europepmc",
      "Europe PMC",
      "EMBL-EBI",
      traces,
      ["europepmc.org", "ebi.ac.uk/europepmc"],
      dossier.literature.filter((h) =>
        /europe|epmc|pmc/i.test(h.source)
      ).length || undefined
    ),
    slotFromTraces(
      "openalex",
      "OpenAlex",
      "OurResearch",
      traces,
      ["openalex.org"],
      dossier.literature.filter((h) => /openalex/i.test(h.source)).length
    ),
    slotFromTraces(
      "crossref",
      "Crossref",
      "Crossref",
      traces,
      ["crossref.org"],
      dossier.literature.filter((h) => /crossref/i.test(h.source)).length
    ),
    slotFromTraces(
      "patentsview",
      "PatentsView",
      "USPTO",
      traces,
      ["patentsview.org"],
      dossier.patents.length
    ),
    slotFromTraces(
      "comptox",
      "EPA CompTox",
      "EPA",
      traces,
      ["comptox.epa.gov"],
      bySource("CompTox").length
    ),
    slotFromTraces(
      "dailymed",
      "DailyMed",
      "NLM (NIH)",
      traces,
      ["dailymed.nlm.nih.gov"],
      bySource("DailyMed").length
    ),
    slotFromTraces(
      "semanticscholar",
      "Semantic Scholar",
      "AI2",
      traces,
      ["semanticscholar.org", "api.semanticscholar.org"],
      dossier.literature.filter((h) => /semantic/i.test(h.source)).length
    ),
  ];

  // Fix Europe PMC hit count more accurately
  const epmc = slots.find((s) => s.id === "europepmc");
  if (epmc) {
    const epmcLit = dossier.literature.filter(
      (h) => !/openalex|crossref|semantic/i.test(h.source)
    );
    epmc.hits = epmcLit.length;
    const ts = traces.filter(
      (t) =>
        t.endpointUrl.includes("europepmc") ||
        t.endpointUrl.includes("ebi.ac.uk/europepmc")
    );
    if (ts.length) {
      const ok = ts.filter((t) => t.ok).length;
      const fail = ts.length - ok;
      epmc.status =
        fail && !ok ? "fail" : epmcLit.length ? "ok" : ok ? "empty" : "empty";
      epmc.detail = `${ok} ok · ${fail} fail · ${epmcLit.length} hit(s)`;
    }
  }

  const ok = slots.filter((s) => s.status === "ok").length;
  const empty = slots.filter((s) => s.status === "empty").length;
  const fail = slots.filter((s) => s.status === "fail").length;
  const partial = slots.filter((s) => s.status === "partial").length;
  const total = slots.length;

  return {
    total,
    ok,
    empty,
    fail,
    partial,
    summary: `${total} free APIs · ${ok} ok · ${empty} empty · ${fail} fail${
      partial ? ` · ${partial} partial` : ""
    }`,
    slots,
  };
}

export function annotationSources(annotations: ExternalAnnotation[]): string[] {
  return [...new Set(annotations.map((a) => a.source))];
}
