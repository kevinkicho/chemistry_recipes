# Chemistry Recipes — free public API sources (enriched)

Product-focused registry for **synthesis, process chemistry, hazards, and plant context**.  
Complements the broader BioIntel-style list in [`api-sources-manifest.md`](./api-sources-manifest.md).

**Product law:** Free public APIs only. Evidence-first; not regulatory decision support. Manufacturing views come from live densify of free-public procedure text + optional grounded AI — never mock plant dossiers.

## Priority tiers for this product

### P0 — Core identity & discovery

| API | Org | Endpoint | Docs | Role |
|-----|-----|----------|------|------|
| PubChem PUG REST | NCBI (NIH) | `https://pubchem.ncbi.nlm.nih.gov/rest/pug` | https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest | Name/CAS/SMILES search, CID, props, synonyms |
| PubChem PUG View | NCBI (NIH) | `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view` | https://pubchem.ncbi.nlm.nih.gov/docs/pug-view | Sections: hazards, manufacturing, use |
| PubChem Properties | NCBI (NIH) | `…/pug/compound` | same | MW, formula, XLogP, TPSA, etc. |
| UniChem | EMBL-EBI | `https://www.ebi.ac.uk/unichem/rest` | https://www.ebi.ac.uk/unichem/info/wsoverview | Cross-DB ID mapping |
| ChEBI | EMBL-EBI | `https://www.ebi.ac.uk/chebi/api/data` | https://www.ebi.ac.uk/chebi/about | Ontology / roles |
| GSRS / UNII | FDA | `https://gsrs.ncats.nih.gov/api` | https://gsrs.ncats.nih.gov/api | Substance registration IDs |
| MyChem.info | BioThings | `https://mychem.info/v1` | https://mychem.info/v1 | Aggregated chem annotation |

### P0 — Hazards & environment (plant EHS)

| API | Org | Endpoint | Docs | Role |
|-----|-----|----------|------|------|
| PubChem Hazards / GHS | NCBI | PUG / PUG View | https://pubchem.ncbi.nlm.nih.gov/docs/pug-view | GHS pictograms, H/P statements |
| CompTox Dashboard | EPA | `https://comptox.epa.gov/dashboard-api` | https://www.epa.gov/comptox-tools | DTXSID, tox, exposure |
| IRIS (via PubChem) | EPA / NLM | PUG View | https://www.epa.gov/iris | Chronic tox reference values |
| PubChem BioAssay | NCBI | `…/pug/assay` | PUG docs | Activity context (secondary) |

### P1 — Reactions, pathways, biosynthesis

| API | Org | Endpoint | Docs | Role |
|-----|-----|----------|------|------|
| KEGG REST | Kyoto | `https://rest.kegg.jp` | https://www.kegg.jp/kegg/rest/keggapi.html | Compound ↔ reaction ↔ pathway |
| Rhea | SIB / EMBL-EBI | `https://www.rhea-db.org/rhea` | https://www.rhea-db.org/help/rest-api | Expert-curated enzyme reactions |
| Reaction Decoder / Rhea WS | EMBL-EBI | Rhea REST | same | Balanced reaction atoms |
| Pathway Commons | UBC / EBI | `https://www.pathwaycommons.org/pc2` | https://www.pathwaycommons.org/pc2/ | Pathway graphs |
| Reactome | Reactome | `https://reactome.org/ContentService` | https://reactome.org/dev/content-service | Biological pathways |
| WikiPathways | WikiPathways | `https://webservice.wikipathways.org` | same | Community pathways |
| BioCyc | SRI | `https://websvc.biocyc.org` | https://biocyc.org/api/ | Organism pathways (rate limits) |
| Open Reaction Database (ORD) | ORD community | datasets / GitHub releases | https://docs.open-reaction-database.org/ | Structured organic reaction records (bulk; not always live REST) |
| Organic Syntheses | OrgSyn | HTML procedures (no free bulk API) | https://www.orgsyn.org/ | Classic validated prep literature (cite + link) |

> **Note:** KEGG/Rhea emphasize **biochemical** routes. Industrial **organic** routes usually come from **patents + literature densify + grounded AI**, not metabolic APIs alone.

### P1 — Process literature & IP (scale-up clues)

| API | Org | Endpoint | Docs | Role |
|-----|-----|----------|------|------|
| PatentsView | USPTO | `https://search.patentsview.org/api/v1` | https://patentsview.org/apis/api-query-language | Process patents, assignees, CPC |
| Europe PMC | EMBL-EBI | `https://www.ebi.ac.uk/europepmc/webservices/rest` | https://europepmc.org/RestfulWebService | Full-text process papers |
| PubMed E-utilities | NLM | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils` | https://www.ncbi.nlm.nih.gov/books/NBK25501/ | Biomedical / chem lit |
| OpenAlex | OurResearch | `https://api.openalex.org` | https://docs.openalex.org/ | Works, concepts, citations |
| CrossRef | CrossRef | `https://api.crossref.org/works` | https://api.crossref.org/ | DOI metadata |
| Semantic Scholar | AI2 | `https://api.semanticscholar.org/graph/v1` | API docs | Related process papers |
| arXiv | Cornell | `http://export.arxiv.org/api/query` | https://info.arxiv.org/help/api/ | Preprints (process chem / catalysis) |

### P2 — Drug / commercial product context (if API is a drug substance)

| API | Org | Endpoint | Docs | Role |
|-----|-----|----------|------|------|
| openFDA NDC / Drugs@FDA | FDA | `https://api.fda.gov/…` | https://open.fda.gov/ | Marketed products, sponsors |
| DailyMed | NLM | `https://dailymed.nlm.nih.gov/dailymed/services/v2` | DailyMed app support | Labels (formulation, not synthesis) |
| ChEMBL | EMBL-EBI | `https://www.ebi.ac.uk/chembl/api/data` | https://www.ebi.ac.uk/chembl/ | Bioactivity, parent molecules |
| DrugCentral | Univ. Rome / UNM | drugcentral.org | https://drugcentral.org/ | Drug cards |
| Orange Book / Purple Book | FDA | portals + openFDA | FDA sites | Exclusivity / biologics context |
| FDA DRLS / FEI portals | FDA | portal URLs | accessdata.fda.gov | Establishment deep links (no full plant-product graph API) |
| NADAC | CMS | `https://data.medicaid.gov/…` | medicaid.gov | Acquisition cost (commercial context only) |

### P2 — Structures, spectra, metabolites (supporting)

| API | Org | Role |
|-----|-----|------|
| RCSB PDB / PDBe ligands | wwPDB | Co-crystal ligands |
| LIPID MAPS | LIPID MAPS | Lipid classification |
| HMDB / FooDB / MetaboLights | various | Metabolite / food chem context |
| MassBank | MassBank | MS reference (IPC method design) |
| AlphaFold | DeepMind/EBI | Enzyme structure if biocatalytic route |

## Recommended fetch stack (app)

| Feature | Primary | Fallback |
|---------|---------|----------|
| Search / resolve molecule | PubChem PUG | MyChem, UniChem |
| Structure image | PubChem `…/PNG` | RDKit local later |
| Physchem props | PubChem properties | MyChem |
| GHS / hazards | PubChem PUG View | CompTox |
| Biosynthetic / metabolic path | KEGG + Rhea | Reactome, WikiPathways |
| Organic reaction corpus | ORD bulk + editorial | PatentsView claims titles |
| Process patents | PatentsView | Google Patents link-out |
| Literature | Europe PMC + OpenAlex | PubMed, Semantic Scholar |
| Manufacturing dossier | **Live densify** (OA/patents + process facts + optional AI) | PUG View “Use and Manufacturing” text |

## Gaps (honest)

| Need | Public API gap | Mitigation |
|------|----------------|------------|
| Full electron-pushing mechanisms | No standard free API | AI dual-view from densified quotes + lit citations |
| Validated plant SOPs | Proprietary | Out of scope — guide scaffold only; site QMS owns SOPs |
| Materials of construction / ATEX zoning | Not structured in public chem DBs | Modality educational envelopes; site fill for plant truth |
| Yields at commercial scale | Patents often incomplete | Sourced ranges only; never invent site setpoints |
| Costed BOM | No free reliable pricing API | Optional later; NADAC only for finished drugs |

## Enrichment vs BioIntel manifest

Keep `api-sources-manifest.*` as the large free-API inventory. This file is the **product-ranked** subset for Chemistry Recipes. When adding a source:

1. Prefer free, documented REST/GraphQL.
2. Record rate limits / key needs in JSON `notes`.
3. Map to UI panel ids in `src/lib/sources/registry.ts`.
4. Never present API text as GMP-approved procedure.
