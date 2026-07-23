/** Product-ranked free API registry for Chemistry Recipes. */

export type SourcePriority = "P0" | "P1" | "P2";

export interface ApiSource {
  id: string;
  name: string;
  organization: string;
  priority: SourcePriority;
  role: string;
  endpointUrl: string;
  docsUrl: string;
  category:
    | "identity"
    | "hazards"
    | "reactions"
    | "pathways"
    | "literature"
    | "patents"
    | "regulatory"
    | "supporting";
  notes?: string;
}

export const CHEMISTRY_API_SOURCES: ApiSource[] = [
  {
    id: "pubchem-pug",
    name: "PubChem PUG REST",
    organization: "NCBI (NIH)",
    priority: "P0",
    role: "Name/CAS/SMILES search, CID resolution, properties, structure images",
    endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
    docsUrl: "https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest",
    category: "identity",
  },
  {
    id: "pubchem-pug-view",
    name: "PubChem PUG View",
    organization: "NCBI (NIH)",
    priority: "P0",
    role: "Sectioned records: GHS hazards, use & manufacturing text",
    endpointUrl: "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view",
    docsUrl: "https://pubchem.ncbi.nlm.nih.gov/docs/pug-view",
    category: "hazards",
  },
  {
    id: "unichem",
    name: "UniChem",
    organization: "EMBL-EBI",
    priority: "P0",
    role: "Cross-database chemical identifier mapping",
    endpointUrl: "https://www.ebi.ac.uk/unichem/rest",
    docsUrl: "https://www.ebi.ac.uk/unichem/info/wsoverview",
    category: "identity",
  },
  {
    id: "chebi",
    name: "ChEBI",
    organization: "EMBL-EBI",
    priority: "P0",
    role: "Chemical ontology and biological roles",
    endpointUrl: "https://www.ebi.ac.uk/chebi/api/data",
    docsUrl: "https://www.ebi.ac.uk/chebi/about",
    category: "identity",
  },
  {
    id: "mychem",
    name: "MyChem.info",
    organization: "BioThings",
    priority: "P0",
    role: "Aggregated chemical annotation",
    endpointUrl: "https://mychem.info/v1",
    docsUrl: "https://mychem.info/v1",
    category: "identity",
  },
  {
    id: "gsrs",
    name: "GSRS / UNII",
    organization: "FDA",
    priority: "P0",
    role: "Global substance registration identifiers",
    endpointUrl: "https://gsrs.ncats.nih.gov/api",
    docsUrl: "https://gsrs.ncats.nih.gov/api",
    category: "identity",
  },
  {
    id: "comptox",
    name: "EPA CompTox",
    organization: "EPA",
    priority: "P0",
    role: "DTXSID, toxicology and exposure context",
    endpointUrl: "https://comptox.epa.gov/dashboard-api",
    docsUrl: "https://www.epa.gov/comptox-tools",
    category: "hazards",
  },
  {
    id: "kegg",
    name: "KEGG REST",
    organization: "KEGG / Kyoto University",
    priority: "P1",
    role: "Compound–reaction–pathway (often biosynthetic)",
    endpointUrl: "https://rest.kegg.jp",
    docsUrl: "https://www.kegg.jp/kegg/rest/keggapi.html",
    category: "pathways",
    notes: "Not a substitute for industrial organic routes.",
  },
  {
    id: "rhea",
    name: "Rhea",
    organization: "SIB / EMBL-EBI",
    priority: "P1",
    role: "Expert-curated enzyme-catalyzed reactions",
    endpointUrl: "https://www.rhea-db.org/rhea",
    docsUrl: "https://www.rhea-db.org/help/rest-api",
    category: "reactions",
  },
  {
    id: "reactome",
    name: "Reactome",
    organization: "Reactome",
    priority: "P1",
    role: "Curated biological pathway maps",
    endpointUrl: "https://reactome.org/ContentService",
    docsUrl: "https://reactome.org/dev/content-service",
    category: "pathways",
  },
  {
    id: "wikipathways",
    name: "WikiPathways",
    organization: "WikiPathways",
    priority: "P1",
    role: "Community pathway models",
    endpointUrl: "https://webservice.wikipathways.org",
    docsUrl: "https://webservice.wikipathways.org/",
    category: "pathways",
  },
  {
    id: "pathway-commons",
    name: "Pathway Commons",
    organization: "UBC / EMBL-EBI",
    priority: "P1",
    role: "Integrated pathway interaction graphs",
    endpointUrl: "https://www.pathwaycommons.org/pc2",
    docsUrl: "https://www.pathwaycommons.org/pc2/",
    category: "pathways",
  },
  {
    id: "ord",
    name: "Open Reaction Database",
    organization: "ORD community",
    priority: "P1",
    role: "Structured organic reaction records (bulk datasets)",
    endpointUrl: "https://open-reaction-database.org/",
    docsUrl: "https://docs.open-reaction-database.org/",
    category: "reactions",
    notes: "Prefer bulk download / dataset ingestion over ad-hoc REST.",
  },
  {
    id: "patentsview",
    name: "PatentsView",
    organization: "USPTO / PatentsView",
    priority: "P1",
    role: "Process patents, assignees, CPC classification",
    endpointUrl: "https://search.patentsview.org/api/v1",
    docsUrl: "https://patentsview.org/apis/api-query-language",
    category: "patents",
  },
  {
    id: "europepmc",
    name: "Europe PMC",
    organization: "EMBL-EBI",
    priority: "P1",
    role: "Process chemistry and organic synthesis literature",
    endpointUrl: "https://www.ebi.ac.uk/europepmc/webservices/rest",
    docsUrl: "https://europepmc.org/RestfulWebService",
    category: "literature",
  },
  {
    id: "pubmed",
    name: "PubMed E-utilities",
    organization: "NLM (NIH)",
    priority: "P1",
    role: "Biomedical and chemical literature search",
    endpointUrl: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
    docsUrl: "https://www.ncbi.nlm.nih.gov/books/NBK25501/",
    category: "literature",
  },
  {
    id: "openalex",
    name: "OpenAlex",
    organization: "OurResearch",
    priority: "P1",
    role: "Scholarly works graph and concepts",
    endpointUrl: "https://api.openalex.org",
    docsUrl: "https://docs.openalex.org/",
    category: "literature",
  },
  {
    id: "crossref",
    name: "CrossRef",
    organization: "CrossRef",
    priority: "P1",
    role: "DOI metadata and citation links",
    endpointUrl: "https://api.crossref.org/works",
    docsUrl: "https://api.crossref.org/",
    category: "literature",
  },
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    organization: "AI2",
    priority: "P1",
    role: "Related papers and influence metrics",
    endpointUrl: "https://api.semanticscholar.org/graph/v1",
    docsUrl: "https://api.semanticscholar.org/",
    category: "literature",
  },
  {
    id: "openfda",
    name: "openFDA",
    organization: "U.S. FDA",
    priority: "P2",
    role: "Marketed drug products, labels, enforcement (context only)",
    endpointUrl: "https://api.fda.gov",
    docsUrl: "https://open.fda.gov/api/",
    category: "regulatory",
  },
  {
    id: "dailymed",
    name: "DailyMed",
    organization: "NLM (NIH)",
    priority: "P2",
    role: "FDA labeling (formulation context, not synthesis)",
    endpointUrl: "https://dailymed.nlm.nih.gov/dailymed/services/v2",
    docsUrl: "https://dailymed.nlm.nih.gov/dailymed/app-support.cfm#api",
    category: "regulatory",
  },
  {
    id: "chembl",
    name: "ChEMBL",
    organization: "EMBL-EBI",
    priority: "P2",
    role: "Bioactivity and drug-like molecule context",
    endpointUrl: "https://www.ebi.ac.uk/chembl/api/data",
    docsUrl: "https://www.ebi.ac.uk/chembl/",
    category: "supporting",
  },
  {
    id: "massbank",
    name: "MassBank",
    organization: "MassBank",
    priority: "P2",
    role: "MS reference spectra for IPC method design",
    endpointUrl: "https://massbank.eu/MassBank-api/records",
    docsUrl: "https://massbank.eu/MassBank-api",
    category: "supporting",
  },
];

export function sourcesByPriority(priority?: SourcePriority): ApiSource[] {
  if (!priority) return CHEMISTRY_API_SOURCES;
  return CHEMISTRY_API_SOURCES.filter((s) => s.priority === priority);
}
