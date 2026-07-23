/**
 * Lightweight free-API health probes for diagnostics.
 * Never logs secrets. Timeouts stay short so the page stays snappy.
 */

export type ProbeStatus = "ok" | "degraded" | "fail" | "skip";

export interface ApiProbeResult {
  id: string;
  name: string;
  organization: string;
  endpointUrl: string;
  status: ProbeStatus;
  httpStatus?: number;
  latencyMs?: number;
  detail?: string;
  category: string;
}

const PROBE_TIMEOUT_MS = 4500;

async function probeGet(
  id: string,
  name: string,
  organization: string,
  url: string,
  category: string,
  okWhen: (status: number, body: string) => boolean = (s) => s >= 200 && s < 400
): Promise<ApiProbeResult> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      headers: { Accept: "application/json, text/plain, */*" },
      cache: "no-store",
    });
    const body = await res.text().catch(() => "");
    const latencyMs = Date.now() - t0;
    const ok = okWhen(res.status, body);
    return {
      id,
      name,
      organization,
      endpointUrl: url,
      status: ok ? (latencyMs > 2500 ? "degraded" : "ok") : "fail",
      httpStatus: res.status,
      latencyMs,
      detail: ok
        ? `HTTP ${res.status} · ${body.length} B`
        : `HTTP ${res.status}${body ? ` · ${body.slice(0, 80)}` : ""}`,
      category,
    };
  } catch (e) {
    return {
      id,
      name,
      organization,
      endpointUrl: url,
      status: "fail",
      latencyMs: Date.now() - t0,
      detail: e instanceof Error ? e.message : "request failed",
      category,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Concurrent free-API probes (no API keys required for these checks). */
export async function runPublicApiProbes(): Promise<ApiProbeResult[]> {
  const jobs = [
    probeGet(
      "pubchem",
      "PubChem PUG",
      "NCBI (NIH)",
      "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula/JSON",
      "identity"
    ),
    probeGet(
      "europepmc",
      "Europe PMC",
      "EMBL-EBI",
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=aspirin&pageSize=1&format=json",
      "literature"
    ),
    probeGet(
      "openalex",
      "OpenAlex",
      "OurResearch",
      "https://api.openalex.org/works?search=aspirin&per_page=1",
      "literature"
    ),
    probeGet(
      "crossref",
      "Crossref",
      "Crossref",
      "https://api.crossref.org/works?query=aspirin&rows=1",
      "literature"
    ),
    probeGet(
      "chembl",
      "ChEMBL",
      "EMBL-EBI",
      "https://www.ebi.ac.uk/chembl/api/data/molecule/CHEMBL25.json",
      "identity"
    ),
    probeGet(
      "mychem",
      "MyChem.info",
      "BioThings",
      "https://mychem.info/v1/query?q=aspirin&size=1",
      "identity"
    ),
    probeGet(
      "openfda",
      "openFDA label",
      "U.S. FDA",
      "https://api.fda.gov/drug/label.json?search=openfda.generic_name:aspirin&limit=1",
      "regulatory"
    ),
    probeGet(
      "rxnorm",
      "RxNorm",
      "NLM (NIH)",
      "https://rxnav.nlm.nih.gov/REST/rxcui.json?name=aspirin",
      "identity"
    ),
    probeGet(
      "kegg",
      "KEGG",
      "KEGG",
      "https://rest.kegg.jp/find/compound/aspirin",
      "pathways",
      (s, body) => s >= 200 && s < 400 && body.length > 0
    ),
    probeGet(
      "patentsview",
      "PatentsView",
      "USPTO",
      "https://search.patentsview.org/api/v1/patent/?q={\"patent_title\":\"aspirin\"}&f=[\"patent_id\"]&o={\"size\":1}",
      "patents",
      // May 401 without key — report as skip/degraded not hard fail
      (s) => s === 200 || s === 401 || s === 403
    ),
    probeGet(
      "comptox",
      "EPA CompTox",
      "EPA",
      "https://comptox.epa.gov/dashboard-api/ccdapp1/search/chemical/equal/aspirin",
      "hazards"
    ),
    probeGet(
      "dailymed",
      "DailyMed",
      "NLM (NIH)",
      "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=aspirin&pagesize=1",
      "regulatory"
    ),
    probeGet(
      "semantic-scholar",
      "Semantic Scholar",
      "AI2",
      "https://api.semanticscholar.org/graph/v1/paper/search?query=aspirin+synthesis&limit=1&fields=title",
      "literature"
    ),
    probeGet(
      "pubchem-patents",
      "PubChem Patent xrefs",
      "NCBI (NIH)",
      "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/xrefs/PatentID/JSON",
      "patents",
      (s, body) => s >= 200 && s < 400 && /PatentID/i.test(body)
    ),
    probeGet(
      "ord-site",
      "Open Reaction Database",
      "ORD community",
      "https://open-reaction-database.org/",
      "reactions",
      // Site is a SPA — any 2xx/3xx HTML is "reachable"
      (s) => s >= 200 && s < 500
    ),
  ];

  const results = await Promise.all(jobs);
  // Normalize patentsview: 401 means "needs key" not outage
  return results.map((r) => {
    if (r.id === "patentsview" && (r.httpStatus === 401 || r.httpStatus === 403)) {
      return {
        ...r,
        status: "skip" as const,
        detail: `HTTP ${r.httpStatus} · optional PATENTSVIEW_API_KEY may improve results`,
      };
    }
    return r;
  });
}

export function summarizeProbes(probes: ApiProbeResult[]): {
  ok: number;
  degraded: number;
  fail: number;
  skip: number;
  avgLatencyMs: number | null;
} {
  let ok = 0;
  let degraded = 0;
  let fail = 0;
  let skip = 0;
  let latSum = 0;
  let latN = 0;
  for (const p of probes) {
    if (p.status === "ok") ok += 1;
    else if (p.status === "degraded") degraded += 1;
    else if (p.status === "fail") fail += 1;
    else skip += 1;
    if (typeof p.latencyMs === "number") {
      latSum += p.latencyMs;
      latN += 1;
    }
  }
  return {
    ok,
    degraded,
    fail,
    skip,
    avgLatencyMs: latN ? Math.round(latSum / latN) : null,
  };
}
