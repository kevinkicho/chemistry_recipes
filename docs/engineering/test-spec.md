# Test specification — Chemistry Recipes

Formal coverage map for **fine workings**, **lifecycle**, **prompt/response quality control**, **densify-first AI**, **navigation abort**, and **durability**.  
Executable suites live under `web/scripts/test-*.mjs`. CI runs offline unit suites via `.github/workflows/ci.yml`.

## Principles

1. **Offline-first unit contracts** — no network required for `npm test` / CI / precommit.  
2. **Accuracy law** — tests fail if AI invents numerics or plant fiction is allowed through.  
3. **Lifecycle order** — gather → densify/cache → score → scaffold → AI (gated) → strip → enrich → client cache.  
4. **Soft network** — live API probes are soft unless `test:smoke:strict`.  
5. **Specs as requirements** — each REQ-ID below maps to at least one automated check.  
6. **Precommit gate** — `npm run precommit` (unit + tsc + eslint) before every commit when practical.

## Commands

```bash
# From repo root
npm run precommit           # recommended before commit: unit + tsc + eslint
npm test                    # offline unit suites only

# From web/
cd web
npm run test:precommit      # unit + tsc + eslint (same as precommit)
npm test                    # all offline unit suites (CI)
npm run test:unit           # same
npm run test:lifecycle      # pipeline stages, densify, cache, package
npm run test:prompt-qc      # AI prompt rules + response quality gates
npm run test:resilience     # soft-fail, retries, vault, durable cache
npm run test:api-wiring     # product-list APIs wired into gather
npm run test:frontier       # process-knowledge + AI guidance + campaigns
npm run test:nav-abort      # browser Back / leave abort contracts
npm run test:search-contracts
npm run test:densify-depth
npm run test:diagnostics-honesty
npm run test:provenance              # AI/API chip contracts
npm run test:provenance-coverage     # full surface registry scan
npm run test:suite-inventory
npm run test:smoke          # live free APIs (soft offline)
npm run test:smoke:strict   # live free APIs (fail on skip)
npm run test:coverage       # unit + smoke + tsc + eslint
npm run test:all            # coverage + production build
```

## Pre-commit checklist (thorough)

| Step | Command | Blocks commit if |
|------|---------|------------------|
| 1. Offline contracts | `npm run test:unit` | Any suite fails |
| 2. Typecheck | `npx tsc --noEmit` | Type errors |
| 3. Lint | `npx eslint src --max-warnings 0` | Lint violations |
| **All three** | `npm run precommit` | Any of the above |

Optional before release/deploy:

| Step | Command |
|------|---------|
| Smoke free APIs | `npm run test:smoke:strict` |
| Production build | `npm run build` |
| Full durability | `npm run test:all` |

## Requirement matrix

### A. Product law & accuracy

| ID | Requirement | Suite |
|----|-------------|--------|
| **ACC-01** | AI system prompt forbids inventing numeric conditions | `test-ai-regression`, `test-prompt-qc` |
| **ACC-02** | Quality gate drops AI IPC methods / CQA targets | `test-ai-regression`, `test-prompt-qc` |
| **ACC-03** | Invented plant language rejected (typical industrial, GMP release, …) | `test-process-facts`, `test-prompt-qc` |
| **ACC-04** | Uncited numeric route conditions stripped post-AI | `test-process-facts`, `test-lib-modules` |
| **ACC-05** | Process-recipe framing needs ≥3 conditions + ≥2 unit ops + isolation/example/patent density | `test-process-facts`, `test-ai-regression` |
| **ACC-06** | TOC / PubChem boilerplate never becomes process steps | `test-evidence-filter`, `test-process-facts` |
| **ACC-07** | Public process brief / tech-transfer v2 only export sourced facts | `test-export-and-ai` |

### B. Pipeline lifecycle

| ID | Requirement | Suite |
|----|-------------|--------|
| **LIFE-01** | Pipeline order includes gather → score → scaffold → AI gate → strip → enrich | `test-lifecycle` |
| **LIFE-02** | Gather uses soft-fail so one API cannot abort the wave | `test-lifecycle`, `test-resilience` |
| **LIFE-03** | Durable server evidence cache merge prefers denser excerpts | `test-lifecycle`, `test-resilience` |
| **LIFE-04** | Densify pass triggers when procedure density thin | `test-lifecycle`, `test-densify-depth` |
| **LIFE-05** | Recipe readiness modes: scout-dossier / recipe-draft / teaching-package | `test-lifecycle` |
| **LIFE-06** | Client IndexedDB schema version ≥ 11; vault + dossier cache modules present | `test-lib-modules`, `test-resilience` |
| **LIFE-07** | Live dossier mounts process panels + RecipeReadinessPanel | `test-lib-modules`, `test-plant-parity` |
| **LIFE-08** | Force densify skips server evidence cache (`force=1` stream) | `test-densify-depth`, `test-lifecycle` |

### C. Multi-source harvest & API wiring

| ID | Requirement | Suite |
|----|-------------|--------|
| **API-01** | Core identity: PubChem PUG + PUG View wired | `test-api-wiring` |
| **API-02** | Process literature: Europe PMC, PubMed, OpenAlex, Crossref, S2, arXiv | `test-api-wiring` |
| **API-03** | Patents: PatentsView, EPMC PAT, PubChem xrefs, densify helpers | `test-api-wiring` |
| **API-04** | Identity graph: UniChem, ChEBI, GSRS | `test-api-wiring` |
| **API-05** | Pathways/reactions: KEGG, Rhea, Reactome, WikiPathways, Pathway Commons, ORD | `test-api-wiring` |
| **API-06** | Regulatory/clinical: openFDA, DailyMed, ClinicalTrials | `test-api-wiring` |
| **API-07** | Supporting: CompTox, MassBank, DrugCentral, OrgSyn, classifications | `test-api-wiring` |
| **API-08** | SourcesRegistry marks wired IDs + recipe-density filter | `test-lib-modules` |
| **API-09** | Live smoke probes for key free endpoints (network) | `test-smoke-apis` |

### D. Agentic prompt package & response QC

| ID | Requirement | Suite |
|----|-------------|--------|
| **AI-01** | Evidence package prioritizes processFacts.atoms then procedureExcerpts | `test-prompt-qc`, `test-densify-depth` |
| **AI-02** | Full-model budget ≥ 32k chars; fast budget defined | `test-prompt-qc` |
| **AI-03** | System prompt agentic priority: structure densest procedures first | `test-prompt-qc` |
| **AI-04** | Synthesis timeout longer for full model than fast path | `test-prompt-qc` |
| **AI-05** | Quality gate rejects junk TOC steps and thin non-op steps | `test-prompt-qc` |
| **AI-06** | Evidence score credits densify depth; full model when dense | `test-prompt-qc` |
| **AI-07** | Pipeline strips uncited AI routes after synthesis | `test-ai-regression` |
| **AI-08** | Ollama host allowlist (SSRF): ollama.com + loopback/LAN only | `test-export-and-ai` |
| **AI-09** | Ollama optional: evidence-shell builds without canCall | `test-diagnostics-honesty` |

### E. Process facts extraction

| ID | Requirement | Suite |
|----|-------------|--------|
| **PF-01** | Temperature / time / pressure extraction from public text | `test-process-facts` |
| **PF-02** | Unit ops: hydrogenation, crystallization, fermentation, … | `test-process-facts` |
| **PF-03** | Thin clinical text does not yield process-recipe framing | `test-process-facts` |
| **PF-04** | Isolation / hazard cues extracted when present | `test-process-facts` |
| **PF-05** | User-supplement provenance supported | `test-ai-regression` |

### F. Curated content & plant parity

| ID | Requirement | Suite |
|----|-------------|--------|
| **CUR-01** | Tier-A molecules: routes, steps, sourceRefs, disclaimer | `test-tier-a-golden` |
| **CUR-02** | Packages catalog ≥ 100 educational entries | `test-hub-lib` |
| **CUR-03** | Live plant narrative / BOM / tier-A merge labels | `test-plant-parity` |
| **CUR-04** | Parameter sets include literature-typical disclaimer | `test-hub-lib` |

### G. Security & deploy

| ID | Requirement | Suite |
|----|-------------|--------|
| **SEC-01** | Firebase Admin JSON gitignored; secrets path documented | manual + `.gitignore` review |
| **SEC-02** | AI chat rejects non-Ollama hosts (SSRF) | `test-export-and-ai` |
| **SEC-03** | Typecheck + eslint on CI | `.github/workflows/ci.yml` |
| **DEP-01** | App Hosting rootDir web; status script | `status-deploy` (ops) |

### H. Frontier science & AI guidance (densify-first)

| ID | Requirement | Suite |
|----|-------------|--------|
| **FRN-01** | process-knowledge.v1 package builder + metrics | `test-frontier` |
| **FRN-02** | ai-guidance.v1 + ingestScore + densifyNext | `test-frontier`, `test-densify-depth` |
| **FRN-03** | campaign-ai-guidance.v1 multi-CID rollup | `test-frontier` |
| **FRN-04** | Science agent never invents plant numbers | `test-frontier` |
| **FRN-05** | Campaign agent optional LLM over guidance context | `test-frontier` |
| **FRN-06** | Densify action queue maps actions → harvest work | `test-frontier` |
| **FRN-07** | UI: Evidence Science / Science Agent densify queue | `test-frontier` |
| **FRN-08** | Live dossier keeps procedureExcerpts for AI ingest | `test-densify-depth`, `test-frontier` |

### I. Densify depth (harvest quality)

| ID | Requirement | Suite |
|----|-------------|--------|
| **DENS-01** | needsDensifyPass thresholds | `test-densify-depth` |
| **DENS-02** | Process-rank literature before OA budget | `test-densify-depth` |
| **DENS-03** | OA-sparse patent densify budget boost | `test-densify-depth` |
| **DENS-04** | Procedure excerpts on LiveDossier + scaffold | `test-densify-depth` |
| **DENS-05** | Literature depth ranks procedure windows | `test-densify-depth` |
| **DENS-06** | AI evidence package prioritizes densify windows | `test-densify-depth`, `test-prompt-qc` |
| **DENS-07** | Client enrich reuses harvested excerpts | `test-densify-depth` |

### J. Navigation & leave-page abort

| ID | Requirement | Suite |
|----|-------------|--------|
| **NAV-01** | Batch densify stream honors AbortSignal | `test-nav-abort` |
| **NAV-02** | warmLiveDossier abortable; no incomplete cache promote | `test-nav-abort` |
| **NAV-03** | Problem densify passes abort signal | `test-nav-abort` |
| **NAV-04** | Densify action queue abortable | `test-nav-abort` |
| **NAV-05** | Dossier SSE closed on unmount | `test-nav-abort` |
| **NAV-06** | Search + autocomplete abort on unmount | `test-nav-abort` |
| **NAV-07** | Problem UI aborts densify on leave + beforeunload warn | `test-nav-abort` |

### K. Search contracts

| ID | Requirement | Suite |
|----|-------------|--------|
| **SEARCH-01** | multiSourceSearch fan-out + API route | `test-search-contracts` |
| **SEARCH-02** | multi suggest + SearchForm wiring | `test-search-contracts` |
| **SEARCH-03** | Problem-first local + multi-source API | `test-search-contracts` |
| **SEARCH-04** | SearchResults: local → browser PubChem → multi | `test-search-contracts` |
| **SEARCH-05** | Campaign densify from problem hits | `test-search-contracts` |
| **SEARCH-06** | Openable vs identity-only honesty | `test-search-contracts` |

### L. Diagnostics honesty

| ID | Requirement | Suite |
|----|-------------|--------|
| **DIAG-01** | canCall / ollamaCanCall exposed without secrets | `test-diagnostics-honesty` |
| **DIAG-02** | Advice: free-public shells work without Ollama | `test-diagnostics-honesty` |
| **DIAG-03** | UI labels separate dual-view vs free API probes | `test-diagnostics-honesty` |
| **DIAG-04** | Dossier buildMode chip: evidence-shell ≠ Ollama | `test-diagnostics-honesty` |
| **DIAG-05** | Env checklist uses canCall, not key alone | `test-diagnostics-honesty` |
| **DIAG-06** | Pipeline can emit evidence-shell without AI | `test-diagnostics-honesty` |

### M. Suite inventory (meta)

| ID | Requirement | Suite |
|----|-------------|--------|
| **INV-01** | All unit suite files exist | `test-suite-inventory` |
| **INV-02** | Each suite has npm script + is in `test:unit` | `test-suite-inventory` |
| **INV-03** | test-spec.md lists REQ families ACC…DIAG + PROV | `test-suite-inventory` |
| **INV-04** | precommit runs unit + tsc + eslint | `test-suite-inventory` |

### M2. Horizon C product slices (MSAT path)

| ID | Requirement | Suite |
|----|-------------|--------|
| **HZC-01** | MSAT journey: problem → campaign densify → neighborhood → agent handoff | `test-horizon-c` |
| **HZC-02** | Route-neighborhood densify prioritizes impurities | `test-horizon-c` |
| **HZC-03** | Modality densify playbooks + AI instruction (no invented CPPs) | `test-horizon-c` |
| **HZC-04** | Health-weighted densify budget (down-rank rate-limited hosts) | `test-horizon-c` |
| **HZC-05** | Role-pack.v1 primary export for worker roles | `test-horizon-c` |
| **HZC-06** | Bulk vault ingest after densify cache | `test-horizon-c` |

### M3. Product path (Monday / cold-CID / honesty)

| ID | Requirement | Suite |
|----|-------------|--------|
| **PATH-01** | README/design do not advertise retired mock packages | `test-product-path` |
| **PATH-02** | Default worker role MSAT; science lab progressive disclosure | `test-product-path`, `test-cold-cid-kpi` |
| **PATH-03** | Thin→useful queues high densify-next + vault + neighborhood | `test-product-path` |
| **PATH-04** | Procedure vault panel on live dossier | `test-product-path` |
| **PATH-05** | Cold-CID golden floors + diagnostics panel | `test-cold-cid-kpi` |
| **PATH-06** | Workspace campaign-first MSAT framing | `test-product-path` |
| **PATH-07** | MSAT wizard stepper (problem → review → densify → agent) | `test-product-path` |
| **PATH-08** | Campaign vault bag export/import | `test-product-path` |
| **PATH-09** | Hermetic accuracy fixtures (strip uncited / drop IPC) | `test-accuracy-fixtures` |
| **PATH-10** | Live cold-CID densify report script | `report-cold-cid-kpi` |

### N. Provenance coverage (API + AI tracking)

Full surface registry and policies: **[provenance-coverage-spec.md](./provenance-coverage-spec.md)**.  
Machine registry: `web/scripts/fixtures/provenance-surface-registry.json`.

| ID | Requirement | Suite |
|----|-------------|--------|
| **PROV-01** | AiProvenanceRecord carries prompts, dataFed, sources, timing | `test-provenance` |
| **PROV-02** | ContentProvenance dual-wires API + AI chips | `test-provenance` |
| **PROV-03** | Per-field helper maps synthesis → AI chips | `test-provenance`, `test-provenance-coverage` |
| **PROV-04** | Live dossier binds field AI chips (overview…critical) | `test-provenance-coverage` |
| **PROV-05** | Aside plant cards use ContentProvenance + field AI | `test-provenance-coverage` |
| **PROV-06** | Process facts use API provenance (not fake AI) | `test-provenance-coverage` |
| **PROV-07** | Registry lists ≥28 content surfaces | `test-provenance-coverage` |
| **PROV-SCAN-*** | Scanner asserts every registry surface still wired | `test-provenance-coverage` |

## Lifecycle diagram (validated by LIFE-* / DENS-*)

```text
CID request
  → gatherCompoundEvidence (soft multi-API + retries)
  → merge server evidence cache (denser wins; skip if force)
  → densify pass if thin (process-rank OA; OA-sparse patent boost)
  → extractProcessFacts
  → scoreCompoundEvidence (AI gate)
  → scaffold shell + procedureExcerpts on LiveDossier (SSE partial)
  → [if canCall && shouldSynthesize] densified package → Ollama JSON
  → qualityGate + stripUncited + preferRoutes
  → modality / entities / process-knowledge / recipe readiness
  → SSE complete → client IDB + procedure vault
  → [leave page] client aborts SSE / densify stream (NAV-*)
```

## Prompt response quality control (QC)

Automated (offline):

1. **Input package shape** — atoms + procedureExcerpts present in packer.  
2. **Prompt rules** — never invent numerics; agentic prioritization strings.  
3. **Output gates** — junk steps, invented plant language, IPC/CQA cleared.  
4. **Post-process** — uncited numeric strip; thin evidence → fewer routes.  
5. **Honesty** — evidence-shell content is not claimed as Ollama dual-view.

Manual / live (when Ollama configured):

1. Build aspirin or sitagliptin live CID with Cloud/local key.  
2. Open AI provenance chip — full system/user prompts, data fed, sources.  
3. Every major content block shows API + AI chips where traces/AI exist.  
4. Confirm route conditions either match processFacts or are absent.  
5. Confirm gaps[] lists site CPPs / full patent examples when thin.  
6. Manager brief + operator job aid do not claim GMP validation.  
7. Browser Back mid-densify cancels client stream (no hang); completed CIDs may remain cached.

## Exit criteria for release

| Gate | Pass condition |
|------|----------------|
| Unit | `npm test` exit 0 |
| Precommit | `npm run precommit` exit 0 |
| Types | `npx tsc --noEmit` exit 0 |
| Lint | `npx eslint src --max-warnings 0` |
| Optional smoke | `npm run test:smoke:strict` on networked CI |
| Optional build | `npm run build` |

## File map

| Spec area | Primary files |
|-----------|----------------|
| Gather / densify | `lib/dossier/gather.ts`, `densifyPass.ts`, `serverEvidenceCache.ts` |
| AI package / QC | `lib/dossier/aiEvidencePackage.ts`, `synthesize.ts`, `processFacts.ts` |
| Lifecycle | `lib/dossier/pipeline.ts`, `app/api/dossier/[cid]/stream/route.ts` |
| Client durability | `lib/idb/dossierCache.ts`, `procedureVault.ts` |
| Provenance coverage | `fixtures/provenance-surface-registry.json`, `aiFieldProvenance.ts`, `ContentProvenance.tsx` |
| Frontier / agents | `lib/frontier/*`, `components/frontier/*` |
| Search | `lib/search/*`, `components/SearchResults.tsx`, `ProblemFirstSearch.tsx` |
| Nav abort | `lib/dossier/batchClient.ts`, `warmCache.ts`, `DossierClientLoader.tsx` |
| Diagnostics | `app/api/diagnostics/route.ts`, `DossierDiagnostics.tsx` |
| Sources UI | `components/SourcesRegistry.tsx`, `lib/sources/registry.ts` |

## Adding a new test

1. Add REQ-ID row to this matrix.  
2. Add assertion to the matching `test-*.mjs` (or new suite).  
3. Wire npm script + `test:unit` chain (+ inventory list).  
4. Keep offline unless smoke/network intentional.  
5. Run `npm run precommit` before commit.

## Related

- [testing.md](./testing.md) — command cheatsheet  
- [frontier-science.md](./frontier-science.md) — densify-first product design  
- [dossier-pipeline.md](./dossier-pipeline.md)  
- [process-facts-accuracy.md](./process-facts-accuracy.md)  
