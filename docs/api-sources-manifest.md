# BioIntel free public API sources

Combined list of API **names**, **docs URLs**, and **endpoints** used by BioIntel Discovery Workbench.

## Source of truth

| File | Role |
|------|------|
| `src/lib/panelSources.ts` | Panel id → display name, docs, endpoint |
| `src/lib/analytics/api-meta.ts` | Tracker/meta key → org, docs, endpoint |

Machine-readable twin: [`api-sources-manifest.json`](./api-sources-manifest.json).

Regenerate after editing the TS catalogs:

```bash
node scripts/export-api-sources-manifest.js
```

Generated: `2026-07-22T18:35:01.362Z`

Counts: **131** unique sources · **122** panels · **13** meta-only · **120** API_METADATA keys.

## Product law

Free public APIs only. Evidence-first; not regulatory decision support. Endpoints may require optional free keys (e.g. openFDA rate limit, College Scorecard DEMO_KEY).

## Unique sources (name + URLs)

| API name | Organization | Endpoint | Docs |
|----------|--------------|----------|------|
| AlphaFold | DeepMind / EMBL-EBI | https://alphafold.ebi.ac.uk/api/prediction | https://www.alphafold.ebi.ac.uk/api/ |
| AnVIL | NHGRI (NIH) | https://anvilproject.org/api | https://anvilproject.org/ |
| arXiv | Cornell University | http://export.arxiv.org/api/query | https://info.arxiv.org/help/api/ |
| Bgee | SIB / UNIL | https://www.bgee.org/api | https://www.bgee.org/ |
| BindingDB | BindingDB | https://bindingdb.org/bind/chemsearch/marvin/MolsFromName.json | https://www.bindingdb.org/bind/chemsearch/marvin/BindingDB-API.pdf |
| BioCyc | SRI International | https://websvc.biocyc.org | https://biocyc.org/api/ |
| biologics-licensed | U.S. FDA (openFDA) | https://api.fda.gov/drug/drugsfda.json | https://open.fda.gov/apis/drug/drugsfda/ |
| BioModels | EMBL-EBI | https://www.ebi.ac.uk/biomodels | https://www.ebi.ac.uk/biomodels/ |
| BioSamples | EMBL-EBI | https://www.ebi.ac.uk/biosamples/samples | https://www.ebi.ac.uk/biosamples/docs/api |
| BioThings TTD KP | NIH / SJTU via NCATS BioThings | https://biothings.ncats.io/ttd | https://db.idrblab.net/ttd/ |
| CATH | UCL | http://www.cathdb.info/api/v1 | https://www.cath.info/api/ |
| ChEBI | EMBL-EBI | https://www.ebi.ac.uk/chebi/api/data | https://www.ebi.ac.uk/chebi/about |
| ChEMBL | EMBL-EBI | https://www.ebi.ac.uk/chembl/api/data | https://www.ebi.ac.uk/chembl/ |
| ChEMBL Indications | EMBL-EBI | https://www.ebi.ac.uk/chembl/api/data | https://www.ebi.ac.uk/chembl/ |
| ChEMBL Mechanisms | EMBL-EBI | https://www.ebi.ac.uk/chembl/api/data/mechanism | https://www.ebi.ac.uk/chembl/ |
| ChemSpider (via PubChem) | RSC | https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| ClinGen | NCBI (NIH) | https://clinicalgenomics.org/api | https://clinicalgenomics.org/api/ |
| ClinicalTrials.gov | NLM (NIH) | https://clinicaltrials.gov/api/v2/studies | https://clinicaltrials.gov/api/ |
| ClinVar | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/clinvar/api/ |
| cms-hospitals | U.S. CMS | https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0 | https://data.cms.gov/provider-data/dataset/xubh-q36u |
| College Scorecard | U.S. Dept of Education | https://api.data.gov/ed/collegescorecard/v1/schools | https://collegescorecard.ed.gov/data/api-documentation/ |
| college-scorecard | U.S. Department of Education | https://api.data.gov/ed/collegescorecard/v1/schools | https://collegescorecard.ed.gov/data/api-documentation/ |
| CompTox | EPA | https://comptox.epa.gov/dashboard-api/ccdapp1 | https://comptox.epa.gov/dashboard-api/ccdapp1 |
| CompTox (ToxCast) | EPA | https://comptox.epa.gov/dashboard-api/ccdapp1 | https://www.epa.gov/comptoxics-tools/exploring-toxcast-data |
| CPIC | CPIC | https://api.cpic.org | https://cpic.org/ |
| CrossRef | CrossRef | https://api.crossref.org/works | https://api.crossref.org/ |
| CT.gov · ROR · CMS · Scorecard · RePORTER · Europe PMC | Multi-source join | join://profile/clinical-safety+research-literature | https://clinicaltrials.gov/data-api/about-api |
| CTD | NCSU | https://ctdbase.org/tools/api | https://ctdbase.org/go/api |
| CTD | NCSU | http://ctdbase.org | https://ctdbase.org/go/api |
| DailyMed | NLM (NIH) | https://dailymed.nlm.nih.gov/dailymed/services/v2 | https://dailymed.nlm.nih.gov/dailymed/app-support.cfm#api |
| dbSNP | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/snp/ |
| DGIdb v5 | DGIdb | https://dgidb.org/api/graphql | https://www.dgidb.org/api |
| DisGeNET | DisGeNET | https://www.disgenet.org/api/gda | https://www.disgenet.org/api/ |
| DRLS · FEI · Data Dashboard | U.S. FDA | https://www.accessdata.fda.gov/scripts/cder/drls/default.cfm | https://www.accessdata.fda.gov/scripts/cder/drls/default.cfm |
| DrugCentral | University of Rome Tor Vergata | https://drugcentral.org/api | https://drugcentral.org/ |
| ema-bulk | European Medicines Agency | https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx | https://www.ema.europa.eu/en/medicines/download-medicine-data |
| ema-medicines | Open Targets + EMA | https://api.platform.opentargets.org/api/v4/graphql | https://platform-docs.opentargets.org/data-access/graphql-api |
| Ensembl | EMBL-EBI | https://rest.ensembl.org | https://rest.ensembl.org/ |
| Europe PMC | EMBL-EBI | https://www.ebi.ac.uk/europepmc/webservices/rest/search | https://www.ebi.ac.uk/europepmc/webservices/rest/search/ |
| Expression Atlas | EMBL-EBI | https://www.ebi.ac.uk/gxa | https://www.ebi.ac.uk/gxa/rest |
| FDA Drug Shortages | U.S. FDA | https://www.fda.gov/drug-shortages | https://www.fda.gov/drug-shortages |
| FooDB | University of Alberta | https://foodb.ca/api | https://foodb.ca/ |
| gene-ontology | Gene Ontology Consortium / EBI | https://www.ebi.ac.uk/QuickGO/services/ontology/go | https://www.ebi.ac.uk/QuickGO/api/ |
| gene3d | UCL | https://www.cath.info/api | https://www.cath.info/api/ |
| GEO | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/geo/info/geo_prolonged.html |
| GNPS | UC San Diego | https://gnps.ucsd.edu/ProteoSAFe | https://gnps.ucsd.edu/ProteoSAFe/static/gnps-theoretical-api.jsp |
| GSRS | FDA | https://gsrs.ncats.nih.gov/api | https://gsrs.ncats.nih.gov/api |
| GTEx | Broad Institute | https://gtexportal.org/rest/v1 | https://gtexportal.org/home/apiDoc |
| Guide to Pharmacology | IUPHAR/BPS | https://www.guidetopharmacology.org/services | https://www.guidetopharmacology.org/services |
| GWAS Catalog | EMBL-EBI | https://www.ebi.ac.uk/gwas/api/search | https://www.ebi.ac.uk/gwas/rest/api |
| HMDB | University of Alberta | https://hmdb.ca/unearth | https://hmdb.ca/unearth/apidoc |
| Hospital General Information | CMS | https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0 | https://data.cms.gov/provider-data/dataset/xubh-q36u |
| HPO | JAX | https://hpo.jax.org/api/hpo | https://hpo.jax.org/api/ |
| IEDB | NIAID (NIH) | https://iedb.org/api | https://iedb.org/api |
| ImmPort Shared Data Search | NIAID (NIH) | https://www.immport.org/data/query/api/search/study | https://docs.immport.org/apidocumentation/shareddataapi/search/ |
| IntAct | EMBL-EBI | https://www.ebi.ac.uk/intact/api | https://www.ebi.ac.uk/intact/api/ |
| InterPro | EMBL-EBI | https://www.ebi.ac.uk/interpro/api | https://www.ebi.ac.uk/interpro/api/ |
| IRIS (PubChem) | EPA / NLM PubChem | https://pubchem.ncbi.nlm.nih.gov/rest/pug_view | https://www.epa.gov/iris |
| ISRCTN | ISRCTN / BioMed Central | https://www.isrctn.com/api | https://www.isrctn.com/page/api |
| KEGG | KEGG / Kyoto University | https://rest.kegg.jp | https://www.kegg.jp/kegg/rest/keggapi.html |
| KEGG Reaction | KEGG / Rhea | https://rest.kegg.jp | https://www.kegg.jp/kegg/rest/keggapi.html |
| LINCS | NIH LINCS | https://lincsportal.ccs.miami.edu/api/v2 | https://lincsproject.org/ |
| LIPID MAPS | LIPID MAPS | https://www.lipidmaps.org/rest | https://lipidmaps.org/resources/tools/rest-api |
| MassBank | MassBank | https://massbank.eu/MassBank-api/records | https://massbank.eu/MassBank-api |
| MassIVE | UC San Diego | https://massive.ucsd.edu/api | https://massive.ucsd.edu/ |
| MedGen | NLM (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/medgen/ |
| MeSH | NLM (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=mesh | https://www.ncbi.nlm.nih.gov/mesh/ |
| MetaboLights | EMBL-EBI | https://www.ebi.ac.uk/metabolights/ws | https://www.ebi.ac.uk/metabolights/ws |
| Metabolomics Workbench | Metabolomics Workbench | https://www.metabolomicsworkbench.org/rest | https://www.metabolomicsworkbench.org/tools/MWRestAPIv1.0.pdf |
| Monarch | Monarch Initiative | https://api.monarchinitiative.org/api | https://monarchinitiative.org/api |
| MyChem | MyChem.info | https://mychem.info/v1/query | https://mychem.info/v1 |
| MyGene | MyGene.info | https://mygene.info/v3/query | https://docs.mygene.info/en/v3/ |
| NADAC | CMS | https://data.medicaid.gov/resource/a4y5-998d.json | https://data.medicaid.gov/dataset/nadac |
| NCATS Translator | NCATS (NIH) | https://translator.broadinstitute.org | https://ncats.nih.gov/translator |
| NCBI Gene | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/gene/ |
| NCI EVS REST (NCIt) | NCI (NIH) | https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search | https://api-evsrest.nci.nih.gov/ |
| NCI Thesaurus | NCI (NIH) | https://evs.nci.nih.gov/api | https://evsexplore.semantics.cancer.gov/evs-apex/ |
| NIH RePORTER | NIH | https://api.reporter.nih.gov/v2/projects/search | https://api.reporter.nih.gov/ |
| NINDS NeuroMMSig | NINDS (NIH) | https://stemcells.nindsgenetics.org/api/search | https://neurmmsig.scai.fraunhofer.de/ |
| NSF Awards Search | U.S. National Science Foundation | https://api.nsf.gov/services/v2/awards.json | https://www.research.gov/common/webapi/awardapisearch-v1.htm |
| OLS | EMBL-EBI | https://www.ebi.ac.uk/ols4/api | https://www.ebi.ac.uk/ols4/help |
| OMIM | Johns Hopkins | https://api.omim.org/api | https://omim.org/api |
| Open Targets | Open Targets | https://api.platform.opentargets.org/api/v4/graphql | https://platform.opentargets.org/api |
| OpenAlex | OurResearch | https://api.openalex.org | https://docs.openalex.org/ |
| OpenCitations | OpenCitations | https://opencitations.net/index/api/v2 | https://opencitations.net/api |
| OpenFDA | U.S. FDA | https://api.fda.gov/drug/ndc.json | https://open.fda.gov/api/ |
| OpenFDA (Enforcement) | U.S. FDA | https://api.fda.gov/drug/enforcement.json | https://open.fda.gov/apis/drug/enforcement/ |
| OpenFDA (FAERS) | U.S. FDA | https://api.fda.gov/drug/event.json | https://open.fda.gov/apis/drug/event/ |
| openFDA Drug Event | UNIV Paris-Saclay | https://api.fda.gov/drug/event.json | https://open.fda.gov/apis/drug/event/ |
| openFDA drug/label | U.S. FDA | https://api.fda.gov/drug/label.json | https://open.fda.gov/apis/drug/label/ |
| openFDA Drugs@FDA | U.S. FDA | https://api.fda.gov/drug/drugsfda.json | https://open.fda.gov/apis/drug/drugsfda/ |
| OpenFDA NDC | U.S. FDA | https://api.fda.gov/drug/ndc.json | https://open.fda.gov/apis/drug/ndc/ |
| Orange Book | U.S. FDA | https://api.fda.gov/drug/ndc.json | https://open.fda.gov/apis/drug/ndc/ |
| Orphanet | Orphanet | https://api.orphadata.com | https://www.orphadata.com/api/ |
| PatentsView | USPTO / PatentsView | https://search.patentsview.org/api/v1/patent | https://www.patentsview.org/api/api-inventor/ |
| Pathway Commons | UBC / EMBL-EBI | https://www.pathwaycommons.org/pc2 | https://www.pathwaycommons.org/pc2/ |
| PDBe Ligands | EMBL-EBI | https://www.ebi.ac.uk/pdbe/api/pdb/entry | https://www.ebi.ac.uk/pdbe/api/ |
| PeptideAtlas | ISB | https://peptideatlas.org/api | https://peptideatlas.org/api/ |
| PharmGKB | Stanford | https://api.pharmgkb.org/v1 | https://www.pharmgkb.org/page/api |
| Pharos | NIH NCATS | https://pharos.nih.gov/idg/api/v1 | https://pharos.nih.gov/api |
| PRIDE | EMBL-EBI | https://www.ebi.ac.uk/pride/ws/archive | https://www.ebi.ac.uk/pride/help/archive/rest-api |
| Protein Atlas | Human Protein Atlas | https://www.proteinatlas.org/api | https://www.proteinatlas.org/about/help/api |
| Proteins API | EMBL-EBI | https://www.ebi.ac.uk/proteins/api | https://www.ebi.ac.uk/proteins/api/ |
| Proteins API (Cross-references) | EMBL-EBI | https://www.ebi.ac.uk/proteins/api | https://www.ebi.ac.uk/proteins/api/ |
| PubChem BioAssay | NCBI (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug/assay | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| PubChem Hazards | NCBI (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| PubChem Properties | NCBI (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| PubMed | NLM (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed | https://www.ncbi.nlm.nih.gov/books/NBK25501/ |
| Purple Book / openFDA BLA | U.S. FDA | https://api.fda.gov/drug/drugsfda.json | https://purplebooksearch.fda.gov/ |
| purple-book | U.S. FDA | https://www.accessdata.fda.gov/drugsatfda_docs/PurpleBook/ | https://purplebooksearch.fda.gov/downloads |
| purple-book-patents | U.S. FDA | https://purplebooksearch.fda.gov/patent-list | https://purplebooksearch.fda.gov/patent-list |
| QuickGO | Gene Ontology Consortium / EBI | https://www.ebi.ac.uk/QuickGO/services/ontology/go | https://www.ebi.ac.uk/QuickGO/api/ |
| RCSB PDB | RCSB / wwPDB | https://data.rcsb.org/rest/v1/core/entry | https://data.rcsb.org/ |
| Reactome | Reactome | https://reactome.org/ContentService | https://reactome.org/dev/content-service |
| Regulator public portals | EMA · MHRA · TGA · PMDA · Health Canada · FDA | https://www.ema.europa.eu/en/search | https://www.ema.europa.eu/en/medicines/download-medicine-data |
| Research Organization Registry | Research Organization Registry | https://api.ror.org/v2/organizations | https://ror.readme.io/docs/rest-api |
| ror-eu-pack | Research Organization Registry | https://api.ror.org/v2/organizations | https://ror.readme.io/docs/api-filtering |
| RxClass (ATC) | WHO | https://rxnav.nlm.nih.gov/REST/rxclass | https://rxnav.nlm.nih.gov/RxClassIntro.html |
| RxNorm | NLM (NIH) | https://rxnav.nlm.nih.gov/REST | https://rxnav.nlm.nih.gov/RESTfulInteraction.html |
| SAbDab | Oxford | http://opig.stats.ox.ac.uk/webapps/abdb/sabdab-json | https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab |
| search | PubChem (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| SEC EDGAR | U.S. SEC | https://efts.sec.gov/LATEST/search-index | https://www.sec.gov/edgar/sec-api-documentation |
| Semantic Scholar | AI2 | https://api.semanticscholar.org/graph/v1 | https://api.semanticscholar.org/api/v2/ |
| similar | PubChem (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| SMPDB | University of Alberta | https://smpdb.ca/api | https://smpdb.ca/ |
| STITCH | EMBL-EBI | https://stitch-db.org/api | https://stitch-db.org/help/api/ |
| STRING | EMBL-EBI | https://string-db.org/api | https://string-db.org/help/api/ |
| UniChem | EMBL-EBI | https://www.ebi.ac.uk/unichem/api | https://www.ebi.ac.uk/unichem/info/wsoverview |
| UniProt | EMBL-EBI / SIB | https://rest.uniprot.org/uniprotkb | https://www.uniprot.org/help/api_queries |
| urban-ipeds | Urban Institute | https://educationdata.urban.org/api/v1/college-university/ipeds/directory | https://educationdata.urban.org/documentation/colleges.html |
| WikiPathways | WikiPathways | https://webservice.wikipathways.org | https://webservice.wikipathways.org/ |

## Panels (profile panel id → source)

| Panel id | API name | Organization | Endpoint | Docs |
|----------|----------|--------------|----------|------|
| `adverse-events` | OpenFDA (FAERS) | U.S. FDA | https://api.fda.gov/drug/event.json | https://open.fda.gov/apis/drug/event/ |
| `alphafold` | AlphaFold | DeepMind / EMBL-EBI | https://alphafold.ebi.ac.uk/api/prediction | https://www.alphafold.ebi.ac.uk/api/ |
| `arxiv` | arXiv | Cornell University | http://export.arxiv.org/api/query | https://info.arxiv.org/help/api/ |
| `atc` | RxClass (ATC) | WHO | https://rxnav.nlm.nih.gov/REST/rxclass | https://rxnav.nlm.nih.gov/RxClassIntro.html |
| `bgee` | Bgee | SIB / UNIL | https://www.bgee.org/api | https://www.bgee.org/ |
| `bindingdb` | BindingDB | BindingDB | https://bindingdb.org/bind/chemsearch/marvin/MolsFromName.json | https://www.bindingdb.org/bind/chemsearch/marvin/BindingDB-API.pdf |
| `bioassay` | PubChem BioAssay | NCBI (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug/assay | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| `biocyc` | BioCyc | SRI International | https://websvc.biocyc.org | https://biocyc.org/api/ |
| `biomodels` | BioModels | EMBL-EBI | https://www.ebi.ac.uk/biomodels | https://www.ebi.ac.uk/biomodels/ |
| `biosamples` | BioSamples | EMBL-EBI | https://www.ebi.ac.uk/biosamples/samples | https://www.ebi.ac.uk/biosamples/docs/api |
| `biosimilar-family` | Purple Book / openFDA BLA | U.S. FDA | https://api.fda.gov/drug/drugsfda.json | https://purplebooksearch.fda.gov/ |
| `cath` | CATH | UCL | http://www.cathdb.info/api/v1 | https://www.cath.info/api/ |
| `chebi` | ChEBI | EMBL-EBI | https://www.ebi.ac.uk/chebi/api/data | https://www.ebi.ac.uk/chebi/about |
| `chembl` | ChEMBL | EMBL-EBI | https://www.ebi.ac.uk/chembl/api/data | https://www.ebi.ac.uk/chembl/ |
| `chembl-indications` | ChEMBL Indications | EMBL-EBI | https://www.ebi.ac.uk/chembl/api/data | https://www.ebi.ac.uk/chembl/ |
| `chembl-mechanisms` | ChEMBL Mechanisms | EMBL-EBI | https://www.ebi.ac.uk/chembl/api/data/mechanism | https://www.ebi.ac.uk/chembl/ |
| `chemspider` | ChemSpider (via PubChem) | RSC | https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| `clingen` | ClinGen | NCBI (NIH) | https://clinicalgenomics.org/api | https://clinicalgenomics.org/api/ |
| `clinical-trials` | ClinicalTrials.gov | NLM (NIH) | https://clinicaltrials.gov/api/v2/studies | https://clinicaltrials.gov/api/ |
| `clinvar` | ClinVar | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/clinvar/api/ |
| `companies` | OpenFDA | U.S. FDA | https://api.fda.gov/drug/ndc.json | https://open.fda.gov/api/ |
| `comptox` | CompTox | EPA | https://comptox.epa.gov/dashboard-api/ccdapp1 | https://comptox.epa.gov/dashboard-api/ccdapp1 |
| `cpic` | CPIC | CPIC | https://api.cpic.org | https://cpic.org/ |
| `crossref` | CrossRef | CrossRef | https://api.crossref.org/works | https://api.crossref.org/ |
| `ctd` | CTD | NCSU | https://ctdbase.org/tools/api | https://ctdbase.org/go/api |
| `ctd-diseases` | CTD | NCSU | http://ctdbase.org | https://ctdbase.org/go/api |
| `dailymed` | DailyMed | NLM (NIH) | https://dailymed.nlm.nih.gov/dailymed/services/v2 | https://dailymed.nlm.nih.gov/dailymed/app-support.cfm#api |
| `dbsnp` | dbSNP | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/snp/ |
| `dgidb` | DGIdb v5 | DGIdb | https://dgidb.org/api/graphql | https://www.dgidb.org/api |
| `disgenet` | DisGeNET | DisGeNET | https://www.disgenet.org/api/gda | https://www.disgenet.org/api/ |
| `drug-interactions` | RxNorm | NLM (NIH) | https://rxnav.nlm.nih.gov/REST | https://rxnav.nlm.nih.gov/RESTfulInteraction.html |
| `drug-shortages` | FDA Drug Shortages | U.S. FDA | https://www.fda.gov/drug-shortages | https://www.fda.gov/drug-shortages |
| `drugcentral` | DrugCentral | University of Rome Tor Vergata | https://drugcentral.org/api | https://drugcentral.org/ |
| `drugs-fda` | openFDA Drugs@FDA | U.S. FDA | https://api.fda.gov/drug/drugsfda.json | https://open.fda.gov/apis/drug/drugsfda/ |
| `ebi-crossrefs` | Proteins API (Cross-references) | EMBL-EBI | https://www.ebi.ac.uk/proteins/api | https://www.ebi.ac.uk/proteins/api/ |
| `ebi-proteins` | Proteins API | EMBL-EBI | https://www.ebi.ac.uk/proteins/api | https://www.ebi.ac.uk/proteins/api/ |
| `ebi-proteomics` | Proteins API | EMBL-EBI | https://www.ebi.ac.uk/proteins/api | https://www.ebi.ac.uk/proteins/api/ |
| `ensembl` | Ensembl | EMBL-EBI | https://rest.ensembl.org | https://rest.ensembl.org/ |
| `establishment-links` | DRLS · FEI · Data Dashboard | U.S. FDA | https://www.accessdata.fda.gov/scripts/cder/drls/default.cfm | https://www.accessdata.fda.gov/scripts/cder/drls/default.cfm |
| `evidence-neighborhood` | CT.gov · ROR · CMS · Scorecard · RePORTER · Europe PMC | Multi-source join | join://profile/clinical-safety+research-literature | https://clinicaltrials.gov/data-api/about-api |
| `expression-atlas` | Expression Atlas | EMBL-EBI | https://www.ebi.ac.uk/gxa | https://www.ebi.ac.uk/gxa/rest |
| `foodb` | FooDB | University of Alberta | https://foodb.ca/api | https://foodb.ca/ |
| `gene-info` | NCBI Gene | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/gene/ |
| `geo` | GEO | NCBI (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/geo/info/geo_prolonged.html |
| `gnps` | GNPS | UC San Diego | https://gnps.ucsd.edu/ProteoSAFe | https://gnps.ucsd.edu/ProteoSAFe/static/gnps-theoretical-api.jsp |
| `go` | QuickGO | Gene Ontology Consortium / EBI | https://www.ebi.ac.uk/QuickGO/services/ontology/go | https://www.ebi.ac.uk/QuickGO/api/ |
| `gsrs` | GSRS | FDA | https://gsrs.ncats.nih.gov/api | https://gsrs.ncats.nih.gov/api |
| `gtex` | GTEx | Broad Institute | https://gtexportal.org/rest/v1 | https://gtexportal.org/home/apiDoc |
| `gwas` | GWAS Catalog | EMBL-EBI | https://www.ebi.ac.uk/gwas/api/search | https://www.ebi.ac.uk/gwas/rest/api |
| `hazards` | PubChem Hazards | NCBI (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| `hmdb` | HMDB | University of Alberta | https://hmdb.ca/unearth | https://hmdb.ca/unearth/apidoc |
| `hpo` | HPO | JAX | https://hpo.jax.org/api/hpo | https://hpo.jax.org/api/ |
| `human-protein-atlas` | Protein Atlas | Human Protein Atlas | https://www.proteinatlas.org/api | https://www.proteinatlas.org/about/help/api |
| `iedb` | IEDB | NIAID (NIH) | https://iedb.org/api | https://iedb.org/api |
| `intact` | IntAct | EMBL-EBI | https://www.ebi.ac.uk/intact/api | https://www.ebi.ac.uk/intact/api/ |
| `international-regulators` | Regulator public portals | EMA · MHRA · TGA · PMDA · Health Canada · FDA | https://www.ema.europa.eu/en/search | https://www.ema.europa.eu/en/medicines/download-medicine-data |
| `interpro` | InterPro | EMBL-EBI | https://www.ebi.ac.uk/interpro/api | https://www.ebi.ac.uk/interpro/api/ |
| `iris` | IRIS (PubChem) | EPA / NLM PubChem | https://pubchem.ncbi.nlm.nih.gov/rest/pug_view | https://www.epa.gov/iris |
| `isrctn` | ISRCTN | ISRCTN / BioMed Central | https://www.isrctn.com/api | https://www.isrctn.com/page/api |
| `iuphar` | Guide to Pharmacology | IUPHAR/BPS | https://www.guidetopharmacology.org/services | https://www.guidetopharmacology.org/services |
| `kegg` | KEGG | KEGG / Kyoto University | https://rest.kegg.jp | https://www.kegg.jp/kegg/rest/keggapi.html |
| `lincs` | LINCS | NIH LINCS | https://lincsportal.ccs.miami.edu/api/v2 | https://lincsproject.org/ |
| `lipidmaps` | LIPID MAPS | LIPID MAPS | https://www.lipidmaps.org/rest | https://lipidmaps.org/resources/tools/rest-api |
| `literature` | Europe PMC | EMBL-EBI | https://www.ebi.ac.uk/europepmc/webservices/rest/search | https://www.ebi.ac.uk/europepmc/webservices/rest/search/ |
| `massbank` | MassBank | MassBank | https://massbank.eu/MassBank-api/records | https://massbank.eu/MassBank-api |
| `massive` | MassIVE | UC San Diego | https://massive.ucsd.edu/api | https://massive.ucsd.edu/ |
| `medgen` | MedGen | NLM (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils | https://www.ncbi.nlm.nih.gov/medgen/ |
| `mesh` | MeSH | NLM (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=mesh | https://www.ncbi.nlm.nih.gov/mesh/ |
| `metabolights` | MetaboLights | EMBL-EBI | https://www.ebi.ac.uk/metabolights/ws | https://www.ebi.ac.uk/metabolights/ws |
| `metabolomics` | Metabolomics Workbench | Metabolomics Workbench | https://www.metabolomicsworkbench.org/rest | https://www.metabolomicsworkbench.org/tools/MWRestAPIv1.0.pdf |
| `monarch` | Monarch | Monarch Initiative | https://api.monarchinitiative.org/api | https://monarchinitiative.org/api |
| `mychem` | MyChem | MyChem.info | https://mychem.info/v1/query | https://mychem.info/v1 |
| `mygene` | MyGene | MyGene.info | https://mygene.info/v3/query | https://docs.mygene.info/en/v3/ |
| `nadac` | NADAC | CMS | https://data.medicaid.gov/resource/a4y5-998d.json | https://data.medicaid.gov/dataset/nadac |
| `ncats-translator` | NCATS Translator | NCATS (NIH) | https://translator.broadinstitute.org | https://ncats.nih.gov/translator |
| `nci-cadsr` | NCI EVS REST (NCIt) | NCI (NIH) | https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search | https://api-evsrest.nci.nih.gov/ |
| `nci-thesaurus` | NCI Thesaurus | NCI (NIH) | https://evs.nci.nih.gov/api | https://evsexplore.semantics.cancer.gov/evs-apex/ |
| `ndc` | OpenFDA NDC | U.S. FDA | https://api.fda.gov/drug/ndc.json | https://open.fda.gov/apis/drug/ndc/ |
| `nhgri-anvil` | AnVIL | NHGRI (NIH) | https://anvilproject.org/api | https://anvilproject.org/ |
| `niaid-immport` | ImmPort Shared Data Search | NIAID (NIH) | https://www.immport.org/data/query/api/search/study | https://docs.immport.org/apidocumentation/shareddataapi/search/ |
| `nih-reporter` | NIH RePORTER | NIH | https://api.reporter.nih.gov/v2/projects/search | https://api.reporter.nih.gov/ |
| `ninds-neurommsig` | NINDS NeuroMMSig | NINDS (NIH) | https://stemcells.nindsgenetics.org/api/search | https://neurmmsig.scai.fraunhofer.de/ |
| `nsf-awards` | NSF Awards Search | U.S. National Science Foundation | https://api.nsf.gov/services/v2/awards.json | https://www.research.gov/common/webapi/awardapisearch-v1.htm |
| `ols` | OLS | EMBL-EBI | https://www.ebi.ac.uk/ols4/api | https://www.ebi.ac.uk/ols4/help |
| `omim` | OMIM | Johns Hopkins | https://api.omim.org/api | https://omim.org/api |
| `open-alex` | OpenAlex | OurResearch | https://api.openalex.org | https://docs.openalex.org/ |
| `open-citations` | OpenCitations | OpenCitations | https://opencitations.net/index/api/v2 | https://opencitations.net/api |
| `openfda-labels` | openFDA drug/label | U.S. FDA | https://api.fda.gov/drug/label.json | https://open.fda.gov/apis/drug/label/ |
| `opentargets` | Open Targets | Open Targets | https://api.platform.opentargets.org/api/v4/graphql | https://platform.opentargets.org/api |
| `orange-book` | Orange Book | U.S. FDA | https://api.fda.gov/drug/ndc.json | https://open.fda.gov/apis/drug/ndc/ |
| `orphanet` | Orphanet | Orphanet | https://api.orphadata.com | https://www.orphadata.com/api/ |
| `patents` | PatentsView | USPTO / PatentsView | https://search.patentsview.org/api/v1/patent | https://www.patentsview.org/api/api-inventor/ |
| `pathway-commons` | Pathway Commons | UBC / EMBL-EBI | https://www.pathwaycommons.org/pc2 | https://www.pathwaycommons.org/pc2/ |
| `pdb` | RCSB PDB | RCSB / wwPDB | https://data.rcsb.org/rest/v1/core/entry | https://data.rcsb.org/ |
| `pdbe-ligands` | PDBe Ligands | EMBL-EBI | https://www.ebi.ac.uk/pdbe/api/pdb/entry | https://www.ebi.ac.uk/pdbe/api/ |
| `peptideatlas` | PeptideAtlas | ISB | https://peptideatlas.org/api | https://peptideatlas.org/api/ |
| `pharmgkb` | PharmGKB | Stanford | https://api.pharmgkb.org/v1 | https://www.pharmgkb.org/page/api |
| `pharos` | Pharos | NIH NCATS | https://pharos.nih.gov/idg/api/v1 | https://pharos.nih.gov/api |
| `pride` | PRIDE | EMBL-EBI | https://www.ebi.ac.uk/pride/ws/archive | https://www.ebi.ac.uk/pride/help/archive/rest-api |
| `properties` | PubChem Properties | NCBI (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| `protein-atlas` | Protein Atlas | Human Protein Atlas | https://www.proteinatlas.org/api | https://www.proteinatlas.org/about/help/api |
| `pubmed` | PubMed | NLM (NIH) | https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed | https://www.ncbi.nlm.nih.gov/books/NBK25501/ |
| `quickgo` | QuickGO | Gene Ontology Consortium / EBI | https://www.ebi.ac.uk/QuickGO/services/ontology/go | https://www.ebi.ac.uk/QuickGO/api/ |
| `reactome` | Reactome | Reactome | https://reactome.org/ContentService | https://reactome.org/dev/content-service |
| `recalls` | OpenFDA (Enforcement) | U.S. FDA | https://api.fda.gov/drug/enforcement.json | https://open.fda.gov/apis/drug/enforcement/ |
| `research-orgs` | Research Organization Registry | Research Organization Registry | https://api.ror.org/v2/organizations | https://ror.readme.io/docs/rest-api |
| `sabdab` | SAbDab | Oxford | http://opig.stats.ox.ac.uk/webapps/abdb/sabdab-json | https://opig.stats.ox.ac.uk/webapps/sabdab-sabpred/sabdab |
| `sec` | SEC EDGAR | U.S. SEC | https://efts.sec.gov/LATEST/search-index | https://www.sec.gov/edgar/sec-api-documentation |
| `semantic-scholar` | Semantic Scholar | AI2 | https://api.semanticscholar.org/graph/v1 | https://api.semanticscholar.org/api/v2/ |
| `sider` | openFDA Drug Event | UNIV Paris-Saclay | https://api.fda.gov/drug/event.json | https://open.fda.gov/apis/drug/event/ |
| `smpdb` | SMPDB | University of Alberta | https://smpdb.ca/api | https://smpdb.ca/ |
| `stitch` | STITCH | EMBL-EBI | https://stitch-db.org/api | https://stitch-db.org/help/api/ |
| `string` | STRING | EMBL-EBI | https://string-db.org/api | https://string-db.org/help/api/ |
| `synthesis` | KEGG Reaction | KEGG / Rhea | https://rest.kegg.jp | https://www.kegg.jp/kegg/rest/keggapi.html |
| `toxcast` | CompTox (ToxCast) | EPA | https://comptox.epa.gov/dashboard-api/ccdapp1 | https://www.epa.gov/comptoxics-tools/exploring-toxcast-data |
| `ttd` | BioThings TTD KP | NIH / SJTU via NCATS BioThings | https://biothings.ncats.io/ttd | https://db.idrblab.net/ttd/ |
| `unichem` | UniChem | EMBL-EBI | https://www.ebi.ac.uk/unichem/api | https://www.ebi.ac.uk/unichem/info/wsoverview |
| `uniprot` | UniProt | EMBL-EBI / SIB | https://rest.uniprot.org/uniprotkb | https://www.uniprot.org/help/api_queries |
| `uniprot-extended` | UniProt | EMBL-EBI / SIB | https://rest.uniprot.org/uniprotkb | https://www.uniprot.org/help/api_queries |
| `us-colleges` | College Scorecard | U.S. Dept of Education | https://api.data.gov/ed/collegescorecard/v1/schools | https://collegescorecard.ed.gov/data/api-documentation/ |
| `us-hospitals` | Hospital General Information | CMS | https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0 | https://data.cms.gov/provider-data/dataset/xubh-q36u |
| `wikipathways` | WikiPathways | WikiPathways | https://webservice.wikipathways.org | https://webservice.wikipathways.org/ |

## Meta-only (no dedicated panel row)

Tracker / analytics keys present in `API_METADATA` but not linked via `_metaKey` from a panel entry (or used only in fetches).

| Meta key | Organization | Endpoint | Docs |
|----------|--------------|----------|------|
| `biologics-licensed` | U.S. FDA (openFDA) | https://api.fda.gov/drug/drugsfda.json | https://open.fda.gov/apis/drug/drugsfda/ |
| `cms-hospitals` | U.S. CMS | https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0 | https://data.cms.gov/provider-data/dataset/xubh-q36u |
| `college-scorecard` | U.S. Department of Education | https://api.data.gov/ed/collegescorecard/v1/schools | https://collegescorecard.ed.gov/data/api-documentation/ |
| `ema-bulk` | European Medicines Agency | https://www.ema.europa.eu/en/documents/report/medicines-output-medicines-report_en.xlsx | https://www.ema.europa.eu/en/medicines/download-medicine-data |
| `ema-medicines` | Open Targets + EMA | https://api.platform.opentargets.org/api/v4/graphql | https://platform-docs.opentargets.org/data-access/graphql-api |
| `gene-ontology` | Gene Ontology Consortium / EBI | https://www.ebi.ac.uk/QuickGO/services/ontology/go | https://www.ebi.ac.uk/QuickGO/api/ |
| `gene3d` | UCL | https://www.cath.info/api | https://www.cath.info/api/ |
| `purple-book` | U.S. FDA | https://www.accessdata.fda.gov/drugsatfda_docs/PurpleBook/ | https://purplebooksearch.fda.gov/downloads |
| `purple-book-patents` | U.S. FDA | https://purplebooksearch.fda.gov/patent-list | https://purplebooksearch.fda.gov/patent-list |
| `ror-eu-pack` | Research Organization Registry | https://api.ror.org/v2/organizations | https://ror.readme.io/docs/api-filtering |
| `search` | PubChem (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| `similar` | PubChem (NIH) | https://pubchem.ncbi.nlm.nih.gov/rest/pug | https://pubchem.ncbi.nlm.nih.gov/rest/pug/ |
| `urban-ipeds` | Urban Institute | https://educationdata.urban.org/api/v1/college-university/ipeds/directory | https://educationdata.urban.org/documentation/colleges.html |

## Notes for other apps

- Prefer **`sources`** in the JSON for a deduped list of `apiName` + `endpointUrl` + `docsUrl`.
- Prefer **`panels`** if you need BioIntel panel ids.
- Some “endpoints” are portal/search URLs or local joins (`join://…`), not JSON APIs.
- Optional free API keys improve rate limits for some hosts (openFDA, data.gov); product does not require paid DBs.
- Client implementations live under `src/lib/api/`.

## Chemistry Recipes enrichment (2026-07-22)

This inventory remains the **broad free-API catalog**. For the Chemistry Recipes product, use the **ranked** subset:

| Doc | Role |
|-----|------|
| [`chemistry-api-sources.md`](./chemistry-api-sources.md) | Human-readable P0/P1/P2 stack for synthesis, hazards, patents, literature |
| [`chemistry-api-sources.json`](./chemistry-api-sources.json) | Machine-readable twin |
| `web/src/lib/sources/registry.ts` | Runtime registry in the Next.js app |

### Synthesis / manufacturing-critical sources already in this manifest

| Need | Sources in this file |
|------|----------------------|
| Identity | PubChem, ChEBI, UniChem, GSRS, MyChem, ChemSpider-via-PubChem |
| Hazards / tox | PubChem Hazards, CompTox, IRIS, CTD |
| Biosynthetic pathways | KEGG, Reactome, WikiPathways, Pathway Commons, BioCyc, SMPDB |
| Reactions (biochem) | KEGG Reaction / Rhea (panel `synthesis`) |
| Process IP | PatentsView |
| Literature | Europe PMC, PubMed, OpenAlex, CrossRef, Semantic Scholar, arXiv |
| Drug commercial context | openFDA, DailyMed, ChEMBL, Orange/Purple Book portals |
| Plant establishment links | DRLS / FEI portals (no full plant–product graph API) |

### Gaps intentionally filled outside free APIs

| Gap | Mitigation in Chemistry Recipes |
|-----|----------------------------------|
| Industrial organic mechanisms | Live densify of OA/patents + process facts + optional grounded AI dual-view |
| Apparatus / ATEX / utilities | Unit-op → plant deliverables from densify; site fill for plant truth |
| Validated plant SOPs | Out of scope — product law: guide scaffold only |
| Structured organic reaction corpus | ORD browse (science lab) + patents + free reaction DBs |

### New sources to prefer when extending beyond this BioIntel list

- **Open Reaction Database (ORD)** — structured organic reactions (bulk)
- **Rhea REST** — expert enzyme reactions (complement KEGG)
- **Organic Syntheses (OrgSyn)** — validated prep literature (link/cite; no free bulk API)
- **NIST WebBook** — thermo/spectra support (link-out; limited automated API)
