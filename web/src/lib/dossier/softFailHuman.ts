/**
 * Map soft-fail / api-fail labels to plain English for operators.
 */

const FAMILY_LABELS: Record<string, string> = {
  europepmc: "Europe PMC literature",
  "europepmc-oa": "Europe PMC open-access full text",
  "europepmc-pat": "Europe PMC patents",
  openalex: "OpenAlex scholarly works",
  crossref: "Crossref DOI metadata",
  pubmed: "PubMed E-utilities",
  semanticscholar: "Semantic Scholar",
  arxiv: "arXiv preprints",
  chembl: "ChEMBL molecule API",
  mychem: "MyChem.info",
  openfda: "openFDA drug labels",
  rxnorm: "RxNorm / RxNav",
  kegg: "KEGG compounds",
  comptox: "EPA CompTox",
  dailymed: "DailyMed SPL",
  "pubchem-identity": "PubChem compound properties",
  "pubchem-view": "PubChem PUG View (GHS / manufacturing)",
  "pubchem-patents": "PubChem patent cross-refs",
  "pubchem-class": "PubChem classifications",
  patentsview: "PatentsView USPTO",
  "patent-literature": "Patent literature search",
  "patent-epmc-densify": "Patent densify (Europe PMC)",
  "patent-uspto-densify": "US patent densify (PubChem)",
  orgsyn: "Organic Syntheses",
  ord: "Open Reaction Database",
  rhea: "Rhea reactions",
  unichem: "UniChem cross-IDs",
  chebi: "ChEBI ontology",
  gsrs: "GSRS substances",
  reactome: "Reactome pathways",
  wikipathways: "WikiPathways",
  "pathway-commons": "Pathway Commons",
  massbank: "MassBank spectra",
  drugcentral: "DrugCentral",
  clinicaltrials: "ClinicalTrials.gov",
  "deep-literature": "Deep literature densify",
};

export function humanFamilyLabel(label: string): string {
  const key = label.toLowerCase().replace(/-retry$/, "");
  return FAMILY_LABELS[key] || label;
}

export function humanizeSoftFailLine(raw: string): string {
  const m = raw.match(/^(soft-fail|api-fail) · ([a-z0-9-]+):\s*(.*)$/i);
  if (!m) return raw;
  const kind = m[1]!.toLowerCase() === "soft-fail" ? "Could not reach" : "API returned errors for";
  const family = humanFamilyLabel(m[2]!);
  const detail = (m[3] || "").slice(0, 120);
  return `${kind} ${family}${detail ? ` (${detail})` : ""}. Other free APIs continued.`;
}

export function humanizeSoftFailList(fetchErrors: string[] | undefined): string[] {
  return (fetchErrors || [])
    .filter((e) => e.startsWith("soft-fail ·") || e.startsWith("api-fail ·"))
    .map(humanizeSoftFailLine)
    .slice(0, 12);
}
