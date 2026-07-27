# Testing

Full requirement IDs and matrix: **[test-spec.md](./test-spec.md)**.

## Commands

```bash
cd web

# Offline unit / contracts (default CI)
npm test
# same:
npm run test:unit

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
| `test-hub-lib.mjs` | Yes | CUR-02/04, entities, packages ≥100 |
| `test-process-facts.mjs` | Yes | PF-*, ACC-03/05, strip rules |
| `test-export-and-ai.mjs` | Yes | ACC-07, AI-08 SSRF, tech-transfer v2 |
| `test-lib-modules.mjs` | Yes | Module integrity, wired panels, exports |
| `test-tier-a-golden.mjs` | Yes | CUR-01 Tier-A depth + citations |
| `test-ai-regression.mjs` | Yes | ACC-01/02, AI-07, framing |
| `test-plant-parity.mjs` | Yes | CUR-03 plant narrative / merge |
| `test-lifecycle.mjs` | Yes | **LIFE-*** pipeline stages, densify, modes |
| `test-prompt-qc.mjs` | Yes | **AI-*** / prompt & response QC |
| `test-resilience.mjs` | Yes | Soft-fail, retries, vault, cache merge |
| `test-api-wiring.mjs` | Yes | **API-*** product list wired |
| `test-smoke-apis.mjs` | Needs net | API-09 live free endpoints |

## Smoke modes

- **Soft (default):** network errors → `skip`, exit 0.  
- **Strict (`--strict` / `SMOKE_STRICT=1`):** any skip/fail fails the process.

## Manual QC (Ollama configured)

See [test-spec.md](./test-spec.md) § Prompt response quality control.

1. Live CID `?refresh=1` with densify — check AI provenance feed counts.  
2. Conditions only when processFacts / procedure text support them.  
3. Recipe readiness blockers honest when thin.  
4. Local full-text enrich densifies facts without inventing site CPPs.

## CI

`.github/workflows/ci.yml`: `npm run test:unit` + `tsc` + eslint on `main` push/PR.

## Related

- [test-spec.md](./test-spec.md) — REQ matrix  
- [process-facts-accuracy.md](./process-facts-accuracy.md)  
- [dossier-pipeline.md](./dossier-pipeline.md)  
- [multi-source-apis.md](./multi-source-apis.md)  
