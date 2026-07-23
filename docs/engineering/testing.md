# Testing

## Commands

```bash
cd web

# Unit / contract integrity (offline, default CI)
npm test
# same as:
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
npm run test:smoke          # soft network probes (skip offline)
npm run test:smoke:strict   # fail on any skip/fail

npx tsc --noEmit
npx eslint src --max-warnings 0
npm run build
```

## Suites

| Script | Offline? | Focus |
|--------|----------|--------|
| `test-evidence-filter.mjs` | Yes | TOC junk, process-lit heuristics, score floors |
| `test-hub-lib.mjs` | Yes | Related entities, contradictions, packages ≥100, modality params |
| `test-process-facts.mjs` | Yes | Condition/unit-op extract, uncited strip, route preference, quality gate |
| `test-export-and-ai.mjs` | Yes | Tech-transfer v2, public process brief, Ollama host allowlist, wired IDs |
| `test-lib-modules.mjs` | Yes | Critical files exist; accuracy strings/exports not regressed |
| `test-tier-a-golden.mjs` | Yes | Curated Tier-A dossiers keep depth + citation discipline |
| `test-smoke-apis.mjs` | Needs net | Live GETs to PubChem, Europe PMC, OpenAlex, ChEMBL, RxNorm, Crossref, DailyMed |

## Smoke modes

- **Soft (default):** network errors → `skip`, exit 0 (offline-friendly). Hard-fails only if PubChem returns a bad body (not transport skip).
- **Strict (`--strict` / `SMOKE_STRICT=1`):** any skip/fail fails the process — use on a networked machine for durability checks.

## Manual high-value checks

1. Live CID with Ollama — dual-view + process facts panel + uncited numbers stripped.  
2. Settings → Local Ollama — Test connection.  
3. `/diagnostics` — probes + IndexedDB health.  
4. Export **Public process brief** JSON schema.  
5. `/compare` dual export after caching two CIDs.  

## Related

- Accuracy layer → [process-facts-accuracy.md](./process-facts-accuracy.md)  
- Pipeline → [dossier-pipeline.md](./dossier-pipeline.md)  
