/**
 * After-gather completeness matrix: which free-API families produced payload.
 */

import type { ApiFetchTrace } from "@/lib/api/trace";
import type { CompoundEvidence } from "@/lib/dossier/types";
import type { LiveDossier } from "@/lib/dossier/types";
import { humanFamilyLabel } from "@/lib/dossier/softFailHuman";

export type SourceFamilyRow = {
  family: string;
  label: string;
  status: "ok" | "empty" | "fail" | "missing";
  okTraces: number;
  failTraces: number;
  payloadHint: string;
};

function hostFamily(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("soft-fail://")) return u.replace("soft-fail://", "").split("/")[0] || "soft";
  if (u.includes("densify-fail://")) return u.replace("densify-fail://", "").split("/")[0] || "densify";
  if (u.includes("pubchem")) return "pubchem";
  if (u.includes("europepmc") || u.includes("ebi.ac.uk/europepmc")) return "europepmc";
  if (u.includes("openalex")) return "openalex";
  if (u.includes("crossref")) return "crossref";
  if (u.includes("semanticscholar")) return "semanticscholar";
  if (u.includes("eutils") || u.includes("pubmed")) return "pubmed";
  if (u.includes("arxiv")) return "arxiv";
  if (u.includes("chembl")) return "chembl";
  if (u.includes("mychem")) return "mychem";
  if (u.includes("api.fda.gov")) return "openfda";
  if (u.includes("rxnav") || u.includes("rxnorm")) return "rxnorm";
  if (u.includes("kegg")) return "kegg";
  if (u.includes("comptox") || u.includes("epa.gov")) return "comptox";
  if (u.includes("dailymed")) return "dailymed";
  if (u.includes("patentsview")) return "patentsview";
  if (u.includes("clinicaltrials")) return "clinicaltrials";
  if (u.includes("chebi")) return "chebi";
  if (u.includes("gsrs") || u.includes("ginas")) return "gsrs";
  if (u.includes("unichem")) return "unichem";
  if (u.includes("rhea")) return "rhea";
  if (u.includes("orgsyn")) return "orgsyn";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
}

export function buildSourceFamilyReport(opts: {
  traces?: ApiFetchTrace[];
  literatureCount?: number;
  patentCount?: number;
  annotationSources?: string[];
  manufacturingCount?: number;
  fetchErrors?: string[];
}): SourceFamilyRow[] {
  const by = new Map<string, { ok: number; fail: number }>();
  for (const t of opts.traces || []) {
    const f = hostFamily(t.endpointUrl);
    const cur = by.get(f) || { ok: 0, fail: 0 };
    if (t.ok) cur.ok += 1;
    else cur.fail += 1;
    by.set(f, cur);
  }

  const payload: Record<string, string> = {
    pubchem: opts.manufacturingCount
      ? `${opts.manufacturingCount} mfg text(s)`
      : "identity / view",
    europepmc: `${opts.literatureCount ?? 0} lit hit(s)`,
    openalex: "scholarly works",
    crossref: "DOI metadata",
    pubmed: "PubMed hits",
    chembl: "molecule / mechanisms",
    openfda: "labels",
    patentsview: `${opts.patentCount ?? 0} patent(s)`,
  };

  const families = new Set([
    ...by.keys(),
    ...(opts.annotationSources || []).map((s) => s.toLowerCase().slice(0, 24)),
  ]);

  const rows: SourceFamilyRow[] = [];
  for (const family of [...families].sort()) {
    const stats = by.get(family) || { ok: 0, fail: 0 };
    let status: SourceFamilyRow["status"] = "missing";
    if (stats.ok > 0) status = "ok";
    else if (stats.fail > 0) status = "fail";
    else if ((opts.fetchErrors || []).some((e) => e.includes(` · ${family}`)))
      status = "fail";
    else status = "empty";

    rows.push({
      family,
      label: humanFamilyLabel(family),
      status,
      okTraces: stats.ok,
      failTraces: stats.fail,
      payloadHint: payload[family] || "see traces",
    });
  }

  return rows.sort((a, b) => {
    const order = { fail: 0, empty: 1, missing: 2, ok: 3 };
    return order[a.status] - order[b.status] || a.family.localeCompare(b.family);
  });
}

export function sourceFamilyReportFromDossier(d: LiveDossier): SourceFamilyRow[] {
  return buildSourceFamilyReport({
    traces: d.traces,
    literatureCount: d.literature?.length,
    patentCount: d.patents?.length,
    annotationSources: (d.annotations || []).map((a) => a.source),
    manufacturingCount: d.manufacturingTexts?.length,
    fetchErrors: d.fetchErrors,
  });
}

export function sourceFamilyReportFromEvidence(
  ev: CompoundEvidence
): SourceFamilyRow[] {
  return buildSourceFamilyReport({
    traces: ev.traces,
    literatureCount: ev.literature?.length,
    patentCount: ev.patents?.length,
    annotationSources: (ev.annotations || []).map((a) => a.source),
    manufacturingCount: ev.view?.manufacturingTexts?.length,
    fetchErrors: ev.fetchErrors,
  });
}
