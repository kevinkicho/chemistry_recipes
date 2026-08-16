/**
 * Thorough free-public API health suite — full gather/densify catalog.
 *
 * Mirrors web/src/lib/diagnostics/publicApiProbes.ts (keep in sync).
 * Also optionally probes live app search/diagnostics endpoints.
 *
 * Usage:
 *   node scripts/test-api-health-full.mjs
 *   node scripts/test-api-health-full.mjs --strict
 *   node scripts/test-api-health-full.mjs --app
 *   node scripts/test-api-health-full.mjs --json
 *
 * Env:
 *   PROBE_TIMEOUT_MS=10000
 *   PROBE_CONCURRENCY=8
 *   APPHOSTING_URL=https://chemrecipe--chemistryrecipes.us-central1.hosted.app
 */

const STRICT =
  process.env.SMOKE_STRICT === "1" || process.argv.includes("--strict");
const AS_JSON = process.argv.includes("--json");
const INCLUDE_APP = process.argv.includes("--app");
const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 12000);
// Keep concurrency low — PubChem 503s under parallel load
const CONCURRENCY = Number(process.env.PROBE_CONCURRENCY || 3);
const APP_BASE =
  process.env.APPHOSTING_URL ||
  "https://chemrecipe--chemistryrecipes.us-central1.hosted.app";

const Q = "aspirin";
const CID = 2244;

/** Keep aligned with src/lib/diagnostics/publicApiProbes.ts */
const PROBES = [
  {
    id: "pubchem-pug",
    name: "PubChem PUG REST · identity",
    category: "identity",
    gather: "pubchem-identity",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${CID}/property/MolecularFormula,IUPACName,Title/JSON`,
    body: /PropertyTable|MolecularFormula/i,
  },
  {
    id: "pubchem-pug-view",
    name: "PubChem PUG View · manufacturing",
    category: "hazards",
    gather: "pubchem-view",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${CID}/JSON?heading=${encodeURIComponent("Use and Manufacturing")}`,
    body: /Record|Section/i,
  },
  {
    id: "pubchem-autocomplete",
    name: "PubChem autocomplete",
    category: "identity",
    gather: "search-suggest",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent("asp")}/json?limit=5`,
    body: /dictionary_terms|total/i,
  },
  {
    id: "pubchem-patents",
    name: "PubChem PatentID xrefs",
    category: "patents",
    gather: "pubchem-patents",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${CID}/xrefs/PatentID/JSON`,
    body: /PatentID|InformationList/i,
    timeoutMs: 45000,
    notes: "Large JSON (~3MB for aspirin) — needs long timeout",
  },
  {
    id: "pubchem-classification",
    name: "PubChem MeSH/PubMed xrefs (class densify path)",
    category: "identity",
    gather: "pubchem-class",
    // Full /classification/JSON for aspirin is ~120MB — probe PubMedID xrefs (gather densify path)
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${CID}/xrefs/PubMedID/JSON`,
    body: /InformationList|PubMedID/i,
    timeoutMs: 20000,
    notes: "Full classification tree is huge (~120MB); PubMedID xrefs are densify signal",
  },
  {
    id: "patent-uspto-densify",
    name: "PubChem PUG View patent densify (gather soft family)",
    category: "densify",
    gather: "patent-uspto-densify",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/patent/US-10029448-B2/JSON`,
    body: /Record|Abstract|Patent/i,
    timeoutMs: 20000,
    notes: "densifyUsPatentsWithPubchem — pug_view (PUG /patent/ domain retired)",
  },
  {
    id: "unichem-v1-sources",
    name: "UniChem API v1 sources",
    category: "identity",
    gather: "unichem",
    url: "https://www.ebi.ac.uk/unichem/api/v1/sources",
    body: /sources|response/i,
  },
  {
    id: "unichem-inchikey",
    name: "UniChem InChIKey map (gather path)",
    category: "identity",
    gather: "unichem",
    url: "https://www.ebi.ac.uk/unichem/rest/verbose_inchikey/BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
    body: /src_compound_id|name|source/i,
    notes: "Primary gather path after CID REST retirement",
  },
  {
    id: "chebi-ols",
    name: "ChEBI via OLS4 (gather path)",
    category: "identity",
    gather: "chebi",
    url: `https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(Q)}&ontology=chebi&rows=1`,
    body: /response|docs/i,
  },
  {
    id: "chebi-backend-by-id",
    name: "ChEBI backend by id (enrich path)",
    category: "identity",
    gather: "chebi",
    url: `https://www.ebi.ac.uk/chebi/backend/api/public/compounds?chebi_ids=15365`,
    body: /15365|CHEBI|primary/i,
  },
  {
    id: "mychem",
    name: "MyChem.info",
    category: "identity",
    gather: "mychem",
    url: `https://mychem.info/v1/query?q=${encodeURIComponent(Q)}&size=1`,
    body: /hits|total/i,
  },
  {
    id: "gsrs",
    name: "GSRS / Ginas substances",
    category: "identity",
    gather: "gsrs",
    url: `https://gsrs.ncats.nih.gov/ginas/app/api/v1/substances/search?q=${encodeURIComponent(Q)}&top=3`,
  },
  {
    id: "chembl",
    name: "ChEMBL molecule",
    category: "identity",
    gather: "chembl",
    url: "https://www.ebi.ac.uk/chembl/api/data/molecule/CHEMBL25.json",
    body: /molecule_chembl_id|CHEMBL/i,
  },
  {
    id: "rxnorm",
    name: "RxNorm rxcui",
    category: "identity",
    gather: "rxnorm",
    url: `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(Q)}`,
    body: /idGroup|rxnormId/i,
  },
  {
    id: "drugcentral-map",
    name: "DrugCentral via UniChem map (gather path)",
    category: "identity",
    gather: "drugcentral",
    url: "https://www.ebi.ac.uk/unichem/rest/verbose_inchikey/BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
    body: /drugcentral|src_compound_id/i,
    notes: "DrugCentral REST retired; gather maps via UniChem",
  },
  {
    id: "drugcentral-card",
    name: "DrugCentral drugcard page",
    category: "identity",
    gather: "drugcentral",
    url: "https://drugcentral.org/drugcard/74",
    accept: [200, 301, 302, 303, 307, 308],
  },
  {
    id: "comptox",
    name: "EPA CompTox search",
    category: "hazards",
    gather: "comptox",
    url: `https://comptox.epa.gov/dashboard-api/ccdapp1/search/chemical/equal/${encodeURIComponent(Q)}`,
  },
  {
    id: "openfda-label",
    name: "openFDA drug label",
    category: "regulatory",
    gather: "openfda",
    url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(Q)}&limit=1`,
    body: /results|meta/i,
  },
  {
    id: "openfda-drugsfda",
    name: "openFDA Drugs@FDA",
    category: "regulatory",
    gather: "openfda",
    url: `https://api.fda.gov/drug/drugsfda.json?search=openfda.generic_name:${encodeURIComponent(Q)}&limit=1`,
  },
  {
    id: "dailymed",
    name: "DailyMed SPL",
    category: "regulatory",
    gather: "dailymed",
    url: `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(Q)}&pagesize=1`,
    body: /data|metadata|setid/i,
  },
  {
    id: "clinicaltrials",
    name: "ClinicalTrials.gov",
    category: "regulatory",
    gather: "clinicaltrials",
    url: `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(Q)}&pageSize=1`,
    body: /studies|totalCount/i,
  },
  {
    id: "europepmc",
    name: "Europe PMC search",
    category: "literature",
    gather: "europepmc",
    url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(Q + " synthesis")}&pageSize=1&format=json`,
    body: /resultList|hitCount/i,
  },
  {
    id: "europepmc-oa",
    name: "Europe PMC OA fullTextXML",
    category: "densify",
    gather: "europepmc-oa",
    url: "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13289645/fullTextXML",
    body: /article|full-text|xml/i,
    timeoutMs: 20000,
    notes: "Known OA PMC with full text (aspirin-related)",
  },
  {
    id: "europepmc-patents",
    name: "Europe PMC SRC:PAT",
    category: "patents",
    gather: "europepmc-pat",
    url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`(SRC:PAT) ${Q}`)}&pageSize=1&format=json`,
    body: /resultList|hitCount/i,
  },
  {
    id: "patent-epmc-densify",
    name: "Patent EPMC densify (SRC:PAT enrich path)",
    category: "densify",
    gather: "patent-epmc-densify",
    url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`SRC:PAT AND ("${Q}") AND (synthesis OR preparation OR process)`)}&resultType=core&pageSize=1&format=json`,
    body: /resultList|hitCount/i,
    notes: "enrichPatentHitsWithEpmc / densifyPass patent EPMC path",
  },
  {
    id: "patent-literature",
    name: "Patent-adjacent literature (gather soft family)",
    category: "patents",
    gather: "patent-literature",
    url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`(TITLE_ABS:"${Q}") AND (patent OR USPTO OR "process for preparing" OR "method of manufacturing")`)}&resultType=core&pageSize=1&format=json`,
    body: /resultList|hitCount/i,
    notes: "searchPatentLiterature soft family",
  },
  {
    id: "pubmed",
    name: "PubMed E-utilities",
    category: "literature",
    gather: "pubmed",
    url: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(Q + "[Title] synthesis")}&retmax=1&retmode=json&tool=ChemistryRecipes&email=noreply%40chemistry-recipes.local`,
    body: /esearchresult|idlist/i,
  },
  {
    id: "openalex",
    name: "OpenAlex works",
    category: "literature",
    gather: "openalex",
    url: `https://api.openalex.org/works?search=${encodeURIComponent(Q + " process")}&per_page=1`,
    body: /results|meta/i,
  },
  {
    id: "crossref",
    name: "Crossref works",
    category: "literature",
    gather: "crossref",
    url: `https://api.crossref.org/works?query=${encodeURIComponent(Q + " synthesis")}&rows=1`,
    body: /message|items/i,
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    category: "literature",
    gather: "semanticscholar",
    url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(Q + " synthesis")}&limit=1&fields=title`,
    body: /data|total|paperId|title/i,
    // 429 is degraded (service up); optional S2 key raises limits
    notes: "Set SEMANTIC_SCHOLAR_API_KEY for higher free rate limits",
  },
  {
    id: "arxiv",
    name: "arXiv API",
    category: "literature",
    gather: "arxiv",
    url: `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(Q)}+AND+all:synthesis&start=0&max_results=1`,
    body: /feed|entry|arxiv/i,
  },
  {
    id: "patentsview-host",
    name: "PatentsView host (optional / ODP migration)",
    category: "patents",
    gather: "patentsview",
    url: `https://search.patentsview.org/api/v1/patent/?q=${encodeURIComponent(JSON.stringify({ patent_id: "10029448" }))}&f=${encodeURIComponent(JSON.stringify(["patent_id"]))}&o=${encodeURIComponent(JSON.stringify({ size: 1 }))}`,
    optionalKey: true,
    notes: "USPTO ODP migration may ENOTFOUND this host; gather free-falls to Europe PMC SRC:PAT",
  },
  {
    id: "patentsview-free-fallback",
    name: "Patent free fallback Europe PMC SRC:PAT",
    category: "patents",
    gather: "patentsview",
    url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`(SRC:PAT) ${Q}`)}&pageSize=1&format=json`,
    body: /resultList|hitCount/i,
    notes: "Always-on free patent path when PatentsView is offline",
  },
  {
    id: "kegg",
    name: "KEGG find compound",
    category: "pathways",
    gather: "kegg",
    url: `https://rest.kegg.jp/find/compound/${encodeURIComponent(Q)}`,
  },
  {
    id: "rhea",
    name: "Rhea TSV search (gather soft family)",
    category: "reactions",
    gather: "rhea",
    // TSV is smaller/faster than JSON for health; client uses JSON with 18s timeout
    url: `https://www.rhea-db.org/rhea/?query=${encodeURIComponent(Q)}&columns=rhea-id,equation&format=tsv&limit=3`,
    body: /RHEA:|equation|Reaction/i,
    timeoutMs: 25000,
  },
  {
    id: "reactome",
    name: "Reactome ContentService",
    category: "pathways",
    gather: "reactome",
    url: `https://reactome.org/ContentService/search/query?query=${encodeURIComponent(Q)}&types=Pathway,Reaction,ChemicalCompound&cluster=true`,
  },
  {
    id: "wikipathways-via-pc",
    name: "WikiPathways-class pathways via PC2 (gather path)",
    category: "pathways",
    gather: "wikipathways",
    url: `https://www.pathwaycommons.org/pc2/search?q=${encodeURIComponent(Q)}&type=Pathway&page=0`,
    body: /searchHit|numHits/i,
    notes: "Legacy WikiPathways webservice retired; gather uses PC2",
  },
  {
    id: "wikipathways-site",
    name: "WikiPathways site",
    category: "pathways",
    gather: "wikipathways",
    url: "https://www.wikipathways.org/",
    accept: [200, 301, 302, 303, 307, 308],
  },
  {
    id: "pathway-commons",
    name: "Pathway Commons search",
    category: "pathways",
    gather: "pathway-commons",
    url: `https://www.pathwaycommons.org/pc2/search?q=${encodeURIComponent(Q)}&type=Pathway&page=0`,
    body: /searchHit|numHits/i,
  },
  {
    id: "ord-site",
    name: "Open Reaction Database site",
    category: "reactions",
    gather: "ord",
    url: "https://open-reaction-database.org/",
    accept: [200, 301, 302, 303, 307, 308],
  },
  {
    id: "orgsyn",
    name: "Organic Syntheses search",
    category: "literature",
    gather: "orgsyn",
    url: `https://www.orgsyn.org/search.aspx?q=${encodeURIComponent(Q)}`,
    accept: [200, 301, 302, 303, 307, 308],
  },
  {
    id: "massbank-site",
    name: "MassBank EU site",
    category: "supporting",
    gather: "massbank",
    url: "https://massbank.eu/MassBank/Search",
    accept: [200, 301, 302, 303, 307, 308],
    notes: "MassBank REST retired — site probe only; gather does not claim PubChem identity as spectra",
  },
];

const APP_PROBES = [
  {
    id: "app-search-multi",
    name: "App /api/search/multi",
    category: "app",
    url: `${APP_BASE}/api/search/multi?q=${encodeURIComponent(Q)}&limit=6`,
    body: /multi-source-search|hits/i,
  },
  {
    id: "app-search-suggest",
    name: "App /api/search/suggest",
    category: "app",
    url: `${APP_BASE}/api/search/suggest?q=asp`,
    body: /suggest|suggestions/i,
  },
  {
    id: "app-search-pubchem",
    name: "App /api/search/pubchem",
    category: "app",
    url: `${APP_BASE}/api/search/pubchem?q=${encodeURIComponent(Q)}`,
    body: /hits|cid/i,
  },
  {
    id: "app-diagnostics",
    name: "App /api/diagnostics",
    category: "app",
    url: `${APP_BASE}/api/diagnostics?probe=0`,
    body: /registrySources|generatedAt/i,
  },
  {
    id: "app-diagnostics-probes",
    name: "App /api/diagnostics?probe=1",
    category: "app",
    url: `${APP_BASE}/api/diagnostics?probe=1`,
    body: /probeSummary|probes/i,
    long: true,
  },
];

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function runOne(p) {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const limit = p.timeoutMs || (p.long ? TIMEOUT_MS * 3 : TIMEOUT_MS);
  const timer = setTimeout(() => ctrl.abort(), limit);
  try {
    const res = await fetch(p.url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json, text/plain, text/xml, */*",
        "User-Agent":
          "ChemistryRecipes/1.0 (full free-public health suite; educational)",
      },
      redirect: "follow",
    });
    const body = await res.text();
    const ms = Date.now() - t0;
    const accept = p.accept || [200, 201, 202, 203, 204];
    const statusOk =
      accept.includes(res.status) || (res.status >= 200 && res.status < 300);

    if (p.optionalKey && (res.status === 401 || res.status === 403)) {
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        gather: p.gather,
        status: "skip",
        http: res.status,
        ms,
        detail: "optional API key not configured (expected)",
        url: p.url,
        notes: p.notes,
      };
    }

    // Rate limits / busy: degraded, not hard fail (service alive)
    if (res.status === 429 || res.status === 503) {
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        gather: p.gather,
        status: "degraded",
        http: res.status,
        ms,
        detail:
          res.status === 429
            ? "HTTP 429 rate limited — service up, slow down / key recommended"
            : "HTTP 503 server busy — service up, retry later",
        url: p.url,
        notes: p.notes,
      };
    }

    const contentOk = p.body ? p.body.test(body) : true;
    if (!statusOk || !contentOk) {
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        gather: p.gather,
        status: "fail",
        http: res.status,
        ms,
        detail: !statusOk
          ? `HTTP ${res.status} · ${body.slice(0, 120)}`
          : `body mismatch · ${body.slice(0, 80)}`,
        url: p.url,
        notes: p.notes,
      };
    }

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      gather: p.gather,
      status: ms > 3500 ? "degraded" : "ok",
      http: res.status,
      ms,
      detail: `${body.length} B`,
      url: p.url,
      notes: p.notes,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Optional-key hosts that fail at DNS/TLS still skip (not invent success)
    if (p.optionalKey) {
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        gather: p.gather,
        status: "skip",
        ms: Date.now() - t0,
        detail: `optional/unreachable: ${msg}`,
        url: p.url,
        notes: p.notes,
      };
    }
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      gather: p.gather,
      status: "fail",
      ms: Date.now() - t0,
      detail: msg,
      url: p.url,
      notes: p.notes,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Base soft() families from gather.ts — every one must have a gather= probe tag */
const REQUIRED_GATHER_SOFT = [
  "pubchem-identity",
  "pubchem-view",
  "europepmc",
  "openalex",
  "crossref",
  "semanticscholar",
  "pubmed",
  "arxiv",
  "patentsview",
  "patent-literature",
  "chembl",
  "mychem",
  "openfda",
  "rxnorm",
  "kegg",
  "comptox",
  "dailymed",
  "pubchem-patents",
  "europepmc-pat",
  "rhea",
  "unichem",
  "chebi",
  "gsrs",
  "orgsyn",
  "reactome",
  "wikipathways",
  "pathway-commons",
  "massbank",
  "drugcentral",
  "clinicaltrials",
  "pubchem-class",
  // densify / secondary soft paths
  "europepmc-oa",
  "patent-epmc-densify",
  "patent-uspto-densify",
  "ord",
];

const list = INCLUDE_APP ? [...PROBES, ...APP_PROBES] : PROBES;
const results = await mapPool(list, CONCURRENCY, runOne);

// Coverage gate: every gather soft family has at least one probe
const coveredGather = new Set(
  results.map((r) => r.gather).filter(Boolean)
);
const missingGather = REQUIRED_GATHER_SOFT.filter((g) => !coveredGather.has(g));

const counts = { ok: 0, degraded: 0, fail: 0, skip: 0 };
const byCat = {};
for (const r of results) {
  counts[r.status] = (counts[r.status] || 0) + 1;
  byCat[r.category] = byCat[r.category] || { ok: 0, degraded: 0, fail: 0, skip: 0 };
  byCat[r.category][r.status] += 1;
}

if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        catalogSize: PROBES.length,
        includeApp: INCLUDE_APP,
        counts,
        byCategory: byCat,
        gatherCoverage: {
          required: REQUIRED_GATHER_SOFT.length,
          covered: REQUIRED_GATHER_SOFT.length - missingGather.length,
          missing: missingGather,
        },
        results,
      },
      null,
      2
    )
  );
} else {
  console.log(
    `Chemistry Recipes free-public API health · ${results.length} probe(s) · concurrency ${CONCURRENCY}\n`
  );
  for (const r of results) {
    const tag =
      r.status === "ok"
        ? "ok  "
        : r.status === "degraded"
          ? "slow"
          : r.status === "skip"
            ? "skip"
            : "FAIL";
    const http = r.http != null ? `HTTP ${r.http}` : "";
    const ms = r.ms != null ? `${r.ms}ms` : "";
    console.log(
      `${tag}  [${r.category}] ${r.name}  ${http}  ${ms}  ${r.detail || ""}`.trim()
    );
  }
  console.log("\n── By category ──");
  for (const cat of Object.keys(byCat).sort()) {
    const c = byCat[cat];
    console.log(
      `  ${cat}: ${c.ok} ok · ${c.degraded} slow · ${c.fail} fail · ${c.skip} skip`
    );
  }
  console.log(
    `\nSummary: ${counts.ok} ok · ${counts.degraded} degraded · ${counts.fail} fail · ${counts.skip} skip (of ${results.length})`
  );
  if (counts.fail) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => x.status === "fail")) {
      console.log(`  · ${r.id}: ${r.detail}`);
      console.log(`    ${r.url}`);
    }
  }
  console.log(
    `\nGather soft coverage: ${REQUIRED_GATHER_SOFT.length - missingGather.length}/${REQUIRED_GATHER_SOFT.length} families tagged`
  );
  if (missingGather.length) {
    console.log("  MISSING gather= tags: " + missingGather.join(", "));
  } else {
    console.log("  All gather soft() families have at least one probe.");
  }
  console.log(
    `\nCatalog: ${PROBES.length} free-public probes · product registry should be unique (no duplicate ids).`
  );
}

const coverageFail = missingGather.length > 0;
const hardFail = counts.fail > 0 || coverageFail;
if (coverageFail && !AS_JSON) {
  console.error(
    "\nCoverage gate FAILED — add probes with gather= for: " +
      missingGather.join(", ")
  );
}
if (STRICT && hardFail) process.exit(1);
if (coverageFail) process.exit(2);
process.exit(0);
