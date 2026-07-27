# Multi-source free APIs

## Principle

Live dossiers are **not PubChem-only**. Identity, regulatory, pathway, literature, and hazard context come from multiple free public endpoints. Paid databases are out of scope.

## Wired clients (`web/src/lib/api/`)

| Client | Source | Typical use |
|--------|--------|-------------|
| `pubchem.ts` / `pubchemView.ts` | NCBI PubChem | Identity, structure, GHS, **rich manufacturing** sections |
| `chembl.ts` | EMBL-EBI ChEMBL | Molecule / phase / mechanism |
| `mychem.ts` | BioThings MyChem | Aggregated annotations |
| `openFda.ts` | openFDA | Drug labels / regulatory text |
| `rxnorm.ts` | NLM RxNorm | Name normalization (RxCUI) |
| `kegg.ts` | KEGG REST | Compound / pathway + **reaction equations** |
| `rhea.ts` | Rhea | Enzyme-catalyzed reaction equations |
| `comptox.ts` | EPA CompTox | DTXSID / toxicology context |
| `dailyMed.ts` | NLM DailyMed | SPL setids / labeling |
| `europePmc.ts` | Europe PMC | Process literature + **OA fullTextXML windows** |
| `patentFullText.ts` | Europe PMC SRC:PAT | Patent abstracts / procedure windows |
| `openAlex.ts` | OpenAlex | Scholarly works |
| `crossref.ts` | Crossref | DOI metadata |
| `semanticScholar.ts` | Semantic Scholar | Related papers |
| `patentsView.ts` | PatentsView | Process patents (optional key) |
| `ord.ts` | ORD | Browse deep-link + best-effort reaction snippets |
| `pubchemPatents.ts` | PubChem | Patent ID xrefs |

Orchestration: `lib/dossier/gather.ts` (parallel fetches + `ApiFetchTrace[]` + `procedureExcerpts[]`).

## Recipe density path

1. **Gather** builds `procedureExcerpts` from OA full text, patent windows, PubChem mfg, ORD, KEGG/Rhea.  
2. **processFacts** extracts conditions / unit ops from abstracts **and** excerpts.  
3. **recipeReadiness** scores scout vs **recipe-draft** and lists missing blockers.  
4. UI: `RecipeReadinessPanel` + Local full-text enrich (.txt upload).

## Product registry

`lib/sources/registry.ts` lists product-ranked sources for `/sources`.  
`SourcesRegistry` marks **wired** IDs and a **Recipe-density sources** filter.

## Coverage map

`lib/dossier/sourceCoverage.ts` builds ok / empty / fail / partial slots for UI and tech-transfer export.

## Diagnostics probes

`lib/diagnostics/probes.ts` — short GETs for operator health on `/diagnostics`  
(includes CompTox, DailyMed, Semantic Scholar, core identity/literature APIs).

## Rate limiting / resilience

- Best-effort parallel harvest; failures become traces + empty slots, not hard crashes.  
- Optional `PATENTSVIEW_API_KEY` improves patents; 401 without key is skip-friendly.  

## Related

- Manifest notes → [../api-sources-manifest.md](../api-sources-manifest.md)  
- Pipeline → [dossier-pipeline.md](./dossier-pipeline.md)  
