# Test specification — Chemistry Recipes

Formal coverage map for **fine workings**, **lifecycle**, **prompt/response quality control**, and **durability**.  
Executable suites live under `web/scripts/test-*.mjs`. CI runs offline unit suites via `.github/workflows/ci.yml`.

## Principles

1. **Offline-first unit contracts** — no network required for `npm test` / CI.  
2. **Accuracy law** — tests fail if AI invents numerics or plant fiction is allowed through.  
3. **Lifecycle order** — gather → densify/cache → score → scaffold → AI (gated) → strip → enrich → client cache.  
4. **Soft network** — live API probes are soft unless `test:smoke:strict`.  
5. **Specs as requirements** — each REQ-ID below maps to at least one automated check.

## Commands

```bash
cd web

npm test                    # all offline unit suites (CI)
npm run test:unit           # same
npm run test:lifecycle      # pipeline stages, densify, cache, package
npm run test:prompt-qc      # AI prompt rules + response quality gates
npm run test:resilience     # soft-fail, retries, vault, durable cache
npm run test:api-wiring     # product-list APIs wired into gather
npm run test:smoke          # live free APIs (soft offline)
npm run test:smoke:strict   # live free APIs (fail on skip)
npm run test:coverage       # unit + smoke + tsc + eslint
npm run test:all            # coverage + production build
```

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
| **LIFE-04** | Densify pass triggers when procedure density thin | `test-lifecycle` |
| **LIFE-05** | Recipe readiness modes: scout-dossier / recipe-draft / teaching-package | `test-lifecycle` |
| **LIFE-06** | Client IndexedDB schema version ≥ 11; vault + dossier cache modules present | `test-lib-modules`, `test-resilience` |
| **LIFE-07** | Live dossier mounts process panels + RecipeReadinessPanel | `test-lib-modules`, `test-plant-parity` |

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
| **AI-01** | Evidence package prioritizes processFacts.atoms then procedureExcerpts | `test-prompt-qc` |
| **AI-02** | Full-model budget ≥ 32k chars; fast budget defined | `test-prompt-qc` |
| **AI-03** | System prompt agentic priority: structure densest procedures first | `test-prompt-qc` |
| **AI-04** | Synthesis timeout longer for full model than fast path | `test-prompt-qc` |
| **AI-05** | Quality gate rejects junk TOC steps and thin non-op steps | `test-prompt-qc` |
| **AI-06** | Evidence score credits densify depth; full model when dense | `test-prompt-qc` |
| **AI-07** | Pipeline strips uncited AI routes after synthesis | `test-ai-regression` |
| **AI-08** | Ollama host allowlist (SSRF): ollama.com + loopback/LAN only | `test-export-and-ai` |

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

## Lifecycle diagram (validated by LIFE-*)

```text
CID request
  → gatherCompoundEvidence (soft multi-API + retries)
  → merge server evidence cache (denser wins)
  → densify pass if thin
  → extractProcessFacts
  → scoreCompoundEvidence (AI gate)
  → scaffold shell (SSE partial)
  → [if AI] densified evidence package → Ollama JSON
  → qualityGate + stripUncited + preferRoutes
  → modality / entities / contradictions / recipe readiness
  → SSE complete → client IDB + procedure vault
```

## Prompt response quality control (QC)

Automated (offline):

1. **Input package shape** — atoms + procedureExcerpts present in packer.  
2. **Prompt rules** — never invent numerics; agentic prioritization strings.  
3. **Output gates** — junk steps, invented plant language, IPC/CQA cleared.  
4. **Post-process** — uncited numeric strip; thin evidence → fewer routes.

Manual / live (when Ollama configured):

1. Build aspirin or sitagliptin live CID with Cloud/local key.  
2. Open AI provenance chip — full system/user prompts (paginated), data fed, sources, Regenerate, evidence char counts.  
3. Every major content block shows API + AI chips via `ContentProvenance` where traces/AI exist.  
3. Confirm route conditions either match processFacts or are absent.  
4. Confirm gaps[] lists site CPPs / full patent examples when thin.  
5. Manager brief + operator job aid do not claim GMP validation.

## Exit criteria for release

| Gate | Pass condition |
|------|----------------|
| Unit | `npm test` exit 0 |
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
| Sources UI | `components/SourcesRegistry.tsx`, `lib/sources/registry.ts` |

## Adding a new test

1. Add REQ-ID row to this matrix.  
2. Add assertion to the matching `test-*.mjs` (or new suite).  
3. Wire npm script + `test:unit` chain.  
4. Keep offline unless smoke/network intentional.
