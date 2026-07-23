/**
 * Network smoke tests for free-public API durability.
 * Soft by default: network failures are SKIP (exit 0) so offline CI still green.
 * Hard mode: SMOKE_STRICT=1 fails on any skip/fail.
 *
 * Run: node scripts/test-smoke-apis.mjs
 *      SMOKE_STRICT=1 node scripts/test-smoke-apis.mjs
 */

const STRICT =
  process.env.SMOKE_STRICT === "1" || process.argv.includes("--strict");
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000);

const probes = [
  {
    id: "pubchem",
    name: "PubChem PUG identity",
    url: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/2244/property/MolecularFormula,IUPACName/JSON",
    ok: (status, body) => status === 200 && /MolecularFormula|PropertyTable/i.test(body),
  },
  {
    id: "europepmc",
    name: "Europe PMC search",
    url: "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=aspirin+synthesis&pageSize=1&format=json",
    ok: (status, body) => status === 200 && /resultList|hitCount/i.test(body),
  },
  {
    id: "openalex",
    name: "OpenAlex works",
    url: "https://api.openalex.org/works?search=aspirin+process&per_page=1",
    ok: (status, body) => status === 200 && /results|meta/i.test(body),
  },
  {
    id: "chembl",
    name: "ChEMBL molecule",
    url: "https://www.ebi.ac.uk/chembl/api/data/molecule/CHEMBL25.json",
    ok: (status, body) => status === 200 && /molecule_chembl_id|CHEMBL/i.test(body),
  },
  {
    id: "rxnorm",
    name: "RxNorm rxcui",
    url: "https://rxnav.nlm.nih.gov/REST/rxcui.json?name=aspirin",
    ok: (status, body) => status === 200 && /idGroup|rxnormId/i.test(body),
  },
  {
    id: "crossref",
    name: "Crossref works",
    url: "https://api.crossref.org/works?query=aspirin+synthesis&rows=1",
    ok: (status, body) => status === 200 && /message|items/i.test(body),
  },
  {
    id: "dailymed",
    name: "DailyMed SPL search",
    url: "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=aspirin&pagesize=1",
    ok: (status, body) => status === 200 && /data|metadata|setid/i.test(body),
  },
];

async function runProbe(p) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(p.url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json, text/plain, */*" },
    });
    const body = await res.text();
    const latencyMs = Date.now() - t0;
    const ok = p.ok(res.status, body);
    return {
      id: p.id,
      name: p.name,
      status: ok ? (latencyMs > 4000 ? "degraded" : "ok") : "fail",
      httpStatus: res.status,
      latencyMs,
      detail: ok ? `${body.length} B` : body.slice(0, 100),
    };
  } catch (e) {
    return {
      id: p.id,
      name: p.name,
      status: "skip",
      latencyMs: Date.now() - t0,
      detail: e instanceof Error ? e.message : "request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(probes.map(runProbe));

let okN = 0;
let degradedN = 0;
let failN = 0;
let skipN = 0;

for (const r of results) {
  const tag =
    r.status === "ok"
      ? "ok  "
      : r.status === "degraded"
        ? "slow"
        : r.status === "fail"
          ? "FAIL"
          : "skip";
  const lat = r.latencyMs != null ? `${r.latencyMs}ms` : "";
  const http = r.httpStatus != null ? `HTTP ${r.httpStatus}` : "";
  console.log(`${tag}  ${r.name}  ${http}  ${lat}  ${r.detail || ""}`.trim());
  if (r.status === "ok") okN += 1;
  else if (r.status === "degraded") degradedN += 1;
  else if (r.status === "fail") failN += 1;
  else skipN += 1;
}

console.log(
  `\nSmoke summary: ${okN} ok · ${degradedN} degraded · ${failN} fail · ${skipN} skip (of ${results.length})`
);

// Integrity expectation: at least core identity (PubChem) when network works
const pubchem = results.find((r) => r.id === "pubchem");
const coreOk = pubchem && (pubchem.status === "ok" || pubchem.status === "degraded");

if (STRICT) {
  if (failN > 0 || skipN > 0 || !coreOk) {
    console.error("SMOKE_STRICT=1 — failing due to skip/fail or PubChem not ok");
    process.exit(1);
  }
  console.log("SMOKE_STRICT integrity: all probes healthy.");
  process.exit(0);
}

// Soft mode: fail only if PubChem hard-fails (not skip) — means broken client/parsing
if (pubchem?.status === "fail") {
  console.error("PubChem probe hard-failed (not network skip) — integrity issue");
  process.exit(1);
}

if (okN + degradedN === 0 && skipN === results.length) {
  console.log("All probes skipped (offline?) — soft pass.");
  process.exit(0);
}

if (coreOk) {
  console.log("Core PubChem path durable.");
}

process.exit(0);
