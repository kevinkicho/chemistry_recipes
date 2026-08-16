# Testing

Full requirement IDs and matrix: **[test-spec.md](./test-spec.md)**.

## Pre-commit (do this before every commit)

```bash
# From repo root (preferred)
npm run precommit

# Or from web/
cd web
npm run precommit
# same as:
npm run test:precommit
```

Runs **all offline unit contracts** + **TypeScript** + **ESLint**.  
Do not commit if precommit fails — the app has many soft-fail paths; contracts catch wiring regressions that feel like “brittleness” in the UI.

## Commands

```bash
cd web

# Offline unit / contracts (default CI)
npm test
# same:
npm run test:unit

# Pre-commit gate (unit + tsc + eslint)
npm run precommit

# Unit + free-API smoke + tsc + eslint
npm run test:coverage

# Full durability: coverage + production build
npm run test:all

# Individual suites
npm run test:evidence
npm run test:hub
npm run test:process-facts
npm run test:export-ai
npm run test:lib-modules
npm run test:tier-a
npm run test:ai-regression
npm run test:plant-parity
npm run test:lifecycle        # pipeline lifecycle, densify, cache, modes
npm run test:prompt-qc        # AI package + response quality gates
npm run test:resilience       # soft-fail, retries, vault
npm run test:api-wiring       # product API list wired into gather
npm run test:frontier         # densify-first AI guidance, campaigns, agents
npm run test:nav-abort        # browser Back / leave abort
npm run test:search-contracts # multi-source + problem search
npm run test:densify-depth    # densify harvest quality
npm run test:diagnostics-honesty  # Ollama vs free-public content
npm run test:api-agent            # harvest agent tools + planner
npm run test:api-etiquette        # rate-limit etiquette
npm run test:horizon-a            # procedure segments + ideal densify plan
npm run test:horizon-b            # adaptive gather + agent pack
npm run test:horizon-c            # MSAT journey, neighborhood, modality, role pack
npm run test:cold-cid-kpi         # golden CID densify floors
npm run test:product-path         # Monday path, vault, README honesty
npm run test:accuracy-fixtures    # hermetic processFacts / quality-gate fixtures
npm run report:cold-cid-kpi       # live golden CID densify floors (needs BASE_URL)
# GitHub Actions: .github/workflows/cold-cid-kpi.yml (nightly + workflow_dispatch)
npm run test:provenance           # AI/API chip contracts
npm run test:provenance-coverage  # scan all content surfaces for provenance wiring
npm run test:suite-inventory  # meta: suites wired + test-spec families
npm run test:worker-ux
npm run test:provenance
npm run test:roadmap
npm run test:ideal-page
npm run test:smoke            # soft network probes
npm run test:smoke:strict     # fail on skip/fail

npx tsc --noEmit
npx eslint src --max-warnings 0
npm run build
```

## Suites

| Script | Offline? | Spec focus |
|--------|----------|------------|
| `test-evidence-filter.mjs` | Yes | ACC-06, process-lit heuristics, score floors |
| `test-hub-lib.mjs` | Yes | Mock hub empty; curated packages deleted |
| `test-process-facts.mjs` | Yes | PF-*, ACC-03/05, strip rules |
| `test-export-and-ai.mjs` | Yes | ACC-07, AI-08 SSRF, tech-transfer v2 |
| `test-lib-modules.mjs` | Yes | Module integrity, wired panels, exports |
| `test-tier-a-golden.mjs` | Yes | CUR-01 mock catalogs deleted; live-only contracts |
| `test-ai-regression.mjs` | Yes | ACC-01/02, AI-07, framing |
| `test-plant-parity.mjs` | Yes | CUR-03 plant narrative / merge |
| `test-lifecycle.mjs` | Yes | **LIFE-*** pipeline stages, densify, modes |
| `test-prompt-qc.mjs` | Yes | **AI-*** / prompt & response QC |
| `test-resilience.mjs` | Yes | Soft-fail, retries, vault, cache merge |
| `test-api-wiring.mjs` | Yes | **API-*** product list wired |
| `test-frontier.mjs` | Yes | **FRN-*** process-knowledge, AI guidance, campaigns |
| `test-nav-abort.mjs` | Yes | **NAV-*** leave-page abort densify/SSE/search |
| `test-search-contracts.mjs` | Yes | **SEARCH-*** multi-source + problem densify |
| `test-densify-depth.mjs` | Yes | **DENS-*** process-rank, OA-sparse, excerpts |
| `test-diagnostics-honesty.mjs` | Yes | **DIAG-*** Ollama vs free-public shells |
| `test-api-agent.mjs` | Yes | Harvest agent tools / planner |
| `test-api-etiquette.mjs` | Yes | Rate-limit etiquette + 429 |
| `test-horizon-a.mjs` | Yes | **HZC-A** procedure segments + ideal densify plan |
| `test-horizon-b.mjs` | Yes | **HZC-B** adaptive gather + agent pack |
| `test-horizon-c.mjs` | Yes | **HZC-*** MSAT journey, neighborhood, modality, role pack, vault |
| `test-cold-cid-kpi.mjs` | Yes | Cold-CID densify floors + golden set |
| `test-product-path.mjs` | Yes | Monday path, vault hero, MSAT workspace, doc honesty |
| `test-accuracy-fixtures.mjs` | Yes | Hermetic processFacts + quality-gate fixtures |
| `report-cold-cid-kpi.mjs` | Needs net | Live densify floors for golden CIDs |
| `test-provenance.mjs` | Yes | **PROV-01…03** chip + field helper contracts |
| `test-provenance-coverage.mjs` | Yes | **PROV-SCAN-*** registry scan of all content cards |
| `test-suite-inventory.mjs` | Yes | **INV-*** suite wiring + test-spec families |
| `test-worker-ux.mjs` | Yes | Worker role surfaces |
| `test-provenance.mjs` | Yes | Provenance chips / honesty |
| `test-roadmap.mjs` | Yes | Roadmap feature flags / mounts |
| `test-ideal-page.mjs` | Yes | Ideal page parity |
| `test-smoke-apis.mjs` | Needs net | API-09 live free endpoints |

## Smoke modes

- **Soft (default):** network errors → `skip`, exit 0.  
- **Strict (`--strict` / `SMOKE_STRICT=1`):** any skip/fail fails the process.

## Why the app can feel brittle

Many paths are **soft-fail by design** (one free API down must not blank the page). That means:

- Diagnostics can show probe fails while dossiers still have content.  
- Ollama “not ready” still allows evidence-shell / densify-structured routes.  
- Leaving mid-densify cancels the **client** stream; the server may finish work already started.

Contracts exist so **wiring regressions** (missing abort, lost densify ranking, silent AI invention paths) fail offline before commit — even when live behavior is soft.

## Manual QC (Ollama configured)

See [test-spec.md](./test-spec.md) § Prompt response quality control.

1. Live CID `?refresh=1` with densify — check AI provenance feed counts.  
2. Conditions only when processFacts / procedure text support them.  
3. Recipe readiness blockers honest when thin.  
4. Local full-text enrich densifies facts without inventing site CPPs.  
5. Browser Back mid-search / mid-dossier / mid-densify does not hang the UI.

## CI

`.github/workflows/ci.yml`: `npm run test:precommit` + `tsc` + eslint on `main` push/PR.

Locally, prefer **`npm run precommit`** so you run the same gates as CI before pushing.

## Related

- [test-spec.md](./test-spec.md) — full REQ matrix (ACC…DIAG + INV)  
- [frontier-science.md](./frontier-science.md)  
- [process-facts-accuracy.md](./process-facts-accuracy.md)  
- [dossier-pipeline.md](./dossier-pipeline.md)  
- [multi-source-apis.md](./multi-source-apis.md)  
