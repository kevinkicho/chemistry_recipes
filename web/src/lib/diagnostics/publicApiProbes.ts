/**
 * Full free-public API probe catalog for Chemistry Recipes.
 *
 * Source of truth for what gather / densify actually call — not a marketing list.
 * Each row uses a concrete GET that mirrors the live client path (aspirin / CID 2244).
 *
 * Optional-key services (PatentsView) may return skip, not fail.
 */

export type PublicProbeCategory =
  | "identity"
  | "hazards"
  | "literature"
  | "patents"
  | "pathways"
  | "reactions"
  | "regulatory"
  | "supporting"
  | "densify";

export type PublicProbeDef = {
  /** Stable id — aligned with gather soft() family when possible */
  id: string;
  name: string;
  organization: string;
  category: PublicProbeCategory;
  /** Concrete GET URL used for health */
  url: string;
  /** gather soft() labels this supports */
  gatherFamilies?: string[];
  /** Notes for operators */
  notes?: string;
  /** HTTP statuses treated as "reachable / configured-as-expected" */
  acceptStatus?: number[];
  /** Optional: body must match for ok (case-insensitive substring or regex source) */
  bodyMustMatch?: string;
  /** If true, 401/403 become skip (optional key) */
  optionalKey?: boolean;
};

/** Aspirin / CID 2244 probe fixtures — same anchors used in production gather. */
const Q = "aspirin";
const CID = 2244;

/**
 * Every free-public HTTP dependency wired into live gather / densify / search.
 * Keep in sync when adding soft() families in gather.ts.
 */
export const PUBLIC_API_PROBE_DEFS: PublicProbeDef[] = [
  // ── Identity / PubChem family ───────────────────────────────────
  {
    id: "pubchem-pug",
    name: "PubChem PUG REST · identity",
    organization: "NCBI (NIH)",
    category: "identity",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${CID}/property/MolecularFormula,IUPACName,Title/JSON`,
    gatherFamilies: ["pubchem-identity"],
    bodyMustMatch: "PropertyTable|MolecularFormula",
  },
  {
    id: "pubchem-pug-view",
    name: "PubChem PUG View · GHS / manufacturing",
    organization: "NCBI (NIH)",
    category: "hazards",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${CID}/JSON?heading=${encodeURIComponent("Use and Manufacturing")}`,
    gatherFamilies: ["pubchem-view"],
    bodyMustMatch: "Record|Section",
  },
  {
    id: "pubchem-autocomplete",
    name: "PubChem autocomplete",
    organization: "NCBI (NIH)",
    category: "identity",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent("asp")}/json?limit=5`,
    gatherFamilies: ["search-suggest"],
    bodyMustMatch: "dictionary_terms|total",
    notes: "Used by /api/search/suggest and SearchForm",
  },
  {
    id: "pubchem-patents",
    name: "PubChem PatentID xrefs",
    organization: "NCBI (NIH)",
    category: "patents",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${CID}/xrefs/PatentID/JSON`,
    gatherFamilies: ["pubchem-patents"],
    bodyMustMatch: "PatentID|InformationList",
  },
  {
    id: "pubchem-classification",
    name: "PubChem classification / MeSH xrefs",
    organization: "NCBI (NIH)",
    category: "identity",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${CID}/classification/JSON`,
    gatherFamilies: ["pubchem-class"],
    bodyMustMatch: "Hierarchies|Section",
  },
  {
    id: "pubchem-patent-record",
    name: "PubChem patent record densify",
    organization: "NCBI (NIH)",
    category: "densify",
    url: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/patent/patentid/US${encodeURIComponent("6090958")}/JSON`,
    gatherFamilies: ["patent-uspto-densify"],
    bodyMustMatch: "Patent|Record|Fault",
    notes: "USPTO densify path via PubChem patent JSON (known US patent id)",
  },
  {
    id: "unichem-v1-sources",
    name: "UniChem API v1 sources",
    organization: "EMBL-EBI",
    category: "identity",
    url: "https://www.ebi.ac.uk/unichem/api/v1/sources",
    gatherFamilies: ["unichem"],
    bodyMustMatch: "sources|response",
    notes: "Live UniChem v1 — sources inventory",
  },
  {
    id: "unichem-legacy-rest",
    name: "UniChem legacy REST (gather path)",
    organization: "EMBL-EBI",
    category: "identity",
    url: `https://www.ebi.ac.uk/unichem/rest/src_compound_id/${CID}/22`,
    gatherFamilies: ["unichem"],
    notes: "gather unichem.ts still uses legacy REST (often 404 after UniChem migration)",
  },
  {
    id: "chebi-ols",
    name: "ChEBI via OLS4 search",
    organization: "EMBL-EBI",
    category: "identity",
    url: `https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(Q)}&ontology=chebi&rows=1`,
    gatherFamilies: ["chebi"],
    bodyMustMatch: "response|docs",
  },
  {
    id: "chebi-backend",
    name: "ChEBI backend compounds",
    organization: "EMBL-EBI",
    category: "identity",
    url: `https://www.ebi.ac.uk/chebi/backend/api/public/compounds?search=${encodeURIComponent(Q)}&size=3`,
    gatherFamilies: ["chebi"],
  },
  {
    id: "mychem",
    name: "MyChem.info",
    organization: "BioThings",
    category: "identity",
    url: `https://mychem.info/v1/query?q=${encodeURIComponent(Q)}&size=1`,
    gatherFamilies: ["mychem"],
    bodyMustMatch: "hits|total",
  },
  {
    id: "gsrs",
    name: "GSRS / Ginas substances",
    organization: "FDA / NCATS",
    category: "identity",
    url: `https://gsrs.ncats.nih.gov/ginas/app/api/v1/substances/search?q=${encodeURIComponent(Q)}&top=3`,
    gatherFamilies: ["gsrs"],
  },
  {
    id: "chembl",
    name: "ChEMBL molecule",
    organization: "EMBL-EBI",
    category: "identity",
    url: "https://www.ebi.ac.uk/chembl/api/data/molecule/CHEMBL25.json",
    gatherFamilies: ["chembl"],
    bodyMustMatch: "molecule_chembl_id|CHEMBL",
  },
  {
    id: "rxnorm",
    name: "RxNorm rxcui",
    organization: "NLM (NIH)",
    category: "identity",
    url: `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(Q)}`,
    gatherFamilies: ["rxnorm"],
    bodyMustMatch: "idGroup|rxnormId",
  },
  {
    id: "drugcentral",
    name: "DrugCentral structures",
    organization: "UNM / DrugCentral",
    category: "identity",
    url: `https://drugcentral.org/api/v1/structures/?filter=name,${encodeURIComponent(Q)}&page_size=3`,
    gatherFamilies: ["drugcentral"],
  },

  // ── Hazards / regulatory ────────────────────────────────────────
  {
    id: "comptox",
    name: "EPA CompTox chemical search",
    organization: "EPA",
    category: "hazards",
    url: `https://comptox.epa.gov/dashboard-api/ccdapp1/search/chemical/equal/${encodeURIComponent(Q)}`,
    gatherFamilies: ["comptox"],
  },
  {
    id: "openfda-label",
    name: "openFDA drug label",
    organization: "U.S. FDA",
    category: "regulatory",
    url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(Q)}&limit=1`,
    gatherFamilies: ["openfda"],
    bodyMustMatch: "results|meta",
  },
  {
    id: "openfda-drugsfda",
    name: "openFDA Drugs@FDA",
    organization: "U.S. FDA",
    category: "regulatory",
    url: `https://api.fda.gov/drug/drugsfda.json?search=openfda.generic_name:${encodeURIComponent(Q)}&limit=1`,
    gatherFamilies: ["openfda"],
  },
  {
    id: "dailymed",
    name: "DailyMed SPL search",
    organization: "NLM (NIH)",
    category: "regulatory",
    url: `https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(Q)}&pagesize=1`,
    gatherFamilies: ["dailymed"],
    bodyMustMatch: "data|metadata|setid",
  },
  {
    id: "clinicaltrials",
    name: "ClinicalTrials.gov studies",
    organization: "NLM (NIH)",
    category: "regulatory",
    url: `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(Q)}&pageSize=1`,
    gatherFamilies: ["clinicaltrials"],
    bodyMustMatch: "studies|totalCount",
  },

  // ── Literature ──────────────────────────────────────────────────
  {
    id: "europepmc",
    name: "Europe PMC search",
    organization: "EMBL-EBI",
    category: "literature",
    url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(Q + " synthesis")}&pageSize=1&format=json`,
    gatherFamilies: ["europepmc"],
    bodyMustMatch: "resultList|hitCount",
  },
  {
    id: "europepmc-oa",
    name: "Europe PMC OA fullTextXML",
    organization: "EMBL-EBI",
    category: "densify",
    url: "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13289645/fullTextXML",
    gatherFamilies: ["europepmc-oa", "patent-epmc-densify"],
    bodyMustMatch: "article|full-text|xml",
    notes: "Known OA PMC with full text (aspirin-related)",
  },
  {
    id: "europepmc-patents",
    name: "Europe PMC patents (SRC:PAT)",
    organization: "EMBL-EBI",
    category: "patents",
    url: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`(SRC:PAT) ${Q}`)}&pageSize=1&format=json`,
    gatherFamilies: ["europepmc-pat", "patent-literature"],
    bodyMustMatch: "resultList|hitCount",
  },
  {
    id: "pubmed",
    name: "PubMed E-utilities esearch",
    organization: "NLM (NIH)",
    category: "literature",
    url: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(Q + "[Title] synthesis")}&retmax=1&retmode=json&tool=ChemistryRecipes&email=noreply%40chemistry-recipes.local`,
    gatherFamilies: ["pubmed"],
    bodyMustMatch: "esearchresult|idlist",
  },
  {
    id: "openalex",
    name: "OpenAlex works",
    organization: "OurResearch",
    category: "literature",
    url: `https://api.openalex.org/works?search=${encodeURIComponent(Q + " process")}&per_page=1`,
    gatherFamilies: ["openalex"],
    bodyMustMatch: "results|meta",
  },
  {
    id: "crossref",
    name: "Crossref works",
    organization: "Crossref",
    category: "literature",
    url: `https://api.crossref.org/works?query=${encodeURIComponent(Q + " synthesis")}&rows=1`,
    gatherFamilies: ["crossref"],
    bodyMustMatch: "message|items",
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar paper search",
    organization: "AI2",
    category: "literature",
    url: `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(Q + " synthesis")}&limit=1&fields=title`,
    gatherFamilies: ["semanticscholar"],
    bodyMustMatch: "data|total|paperId|title",
  },
  {
    id: "arxiv",
    name: "arXiv API query",
    organization: "Cornell University",
    category: "literature",
    url: `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(Q)}+AND+all:synthesis&start=0&max_results=1`,
    gatherFamilies: ["arxiv"],
    bodyMustMatch: "feed|entry|arxiv",
  },

  // ── Patents ─────────────────────────────────────────────────────
  {
    id: "patentsview",
    name: "PatentsView patent search",
    organization: "USPTO / PatentsView",
    category: "patents",
    url: `https://search.patentsview.org/api/v1/patent/?q=${encodeURIComponent(JSON.stringify({ patent_title: Q }))}&f=${encodeURIComponent(JSON.stringify(["patent_id"]))}&o=${encodeURIComponent(JSON.stringify({ size: 1 }))}`,
    gatherFamilies: ["patentsview"],
    optionalKey: true,
    acceptStatus: [200, 401, 403],
    notes: "401/403 expected without PATENTSVIEW_API_KEY — marked skip",
  },

  // ── Pathways / reactions ────────────────────────────────────────
  {
    id: "kegg",
    name: "KEGG compound find",
    organization: "KEGG / Kyoto",
    category: "pathways",
    url: `https://rest.kegg.jp/find/compound/${encodeURIComponent(Q)}`,
    gatherFamilies: ["kegg"],
  },
  {
    id: "rhea",
    name: "Rhea reaction search",
    organization: "SIB / EMBL-EBI",
    category: "reactions",
    url: `https://www.rhea-db.org/rhea/?query=${encodeURIComponent(Q)}&columns=rhea-id,equation&format=tsv&limit=3`,
    gatherFamilies: ["rhea"],
  },
  {
    id: "reactome",
    name: "Reactome ContentService search",
    organization: "Reactome",
    category: "pathways",
    url: `https://reactome.org/ContentService/search/query?query=${encodeURIComponent(Q)}&types=Pathway,Reaction,ChemicalCompound&cluster=true`,
    gatherFamilies: ["reactome"],
  },
  {
    id: "wikipathways",
    name: "WikiPathways findPathwaysByText",
    organization: "WikiPathways",
    category: "pathways",
    url: `https://webservice.wikipathways.org/findPathwaysByText?query=${encodeURIComponent(Q)}&format=json`,
    gatherFamilies: ["wikipathways"],
  },
  {
    id: "pathway-commons",
    name: "Pathway Commons search",
    organization: "UBC / EMBL-EBI",
    category: "pathways",
    url: `https://www.pathwaycommons.org/pc2/search?q=${encodeURIComponent(Q)}&type=Pathway&page=0`,
    gatherFamilies: ["pathway-commons"],
    bodyMustMatch: "searchHit|numHits",
    notes: "No .json suffix — PC2 returns JSON from /search",
  },
  {
    id: "ord-site",
    name: "Open Reaction Database site",
    organization: "ORD community",
    category: "reactions",
    url: "https://open-reaction-database.org/",
    gatherFamilies: ["ord"],
    acceptStatus: [200, 301, 302, 303, 307, 308],
    notes: "SPA browse; reachability only (no bulk JSON API)",
  },
  {
    id: "orgsyn",
    name: "Organic Syntheses search page",
    organization: "Organic Syntheses, Inc.",
    category: "literature",
    url: `https://www.orgsyn.org/search.aspx?q=${encodeURIComponent(Q)}`,
    gatherFamilies: ["orgsyn"],
    acceptStatus: [200, 301, 302, 303, 307, 308],
    notes: "HTML extract path — no bulk API",
  },

  // ── Supporting ──────────────────────────────────────────────────
  {
    id: "massbank",
    name: "MassBank EU search",
    organization: "MassBank",
    category: "supporting",
    url: `https://massbank.eu/MassBank-api/search?compound.name=${encodeURIComponent(Q)}`,
    gatherFamilies: ["massbank"],
  },
];

/** Unique gather soft families covered by at least one probe def */
export function coveredGatherFamilies(): string[] {
  const s = new Set<string>();
  for (const p of PUBLIC_API_PROBE_DEFS) {
    for (const f of p.gatherFamilies || []) s.add(f);
  }
  return [...s].sort();
}

export function probeCatalogStats() {
  return {
    probeCount: PUBLIC_API_PROBE_DEFS.length,
    categories: [...new Set(PUBLIC_API_PROBE_DEFS.map((p) => p.category))].sort(),
    coveredGatherFamilies: coveredGatherFamilies(),
  };
}
