# Testing

## Commands

```bash
cd web
npm test              # evidence + hub contracts
npm run test:evidence
npm run test:hub
npx tsc --noEmit      # TypeScript
npm run build         # production Next.js build
```

## Contract suites

| Script | Focus |
|--------|--------|
| `scripts/test-evidence-filter.mjs` | Evidence text filter, process-lit heuristics, scoring sanity |
| `scripts/test-hub-lib.mjs` | Related entities, contradictions, curated package count ≥100, biologic params |

These are lightweight Node scripts (no browser). Keep them green before PR.

## Manual checks (high value)

1. Live CID with Ollama Cloud key — dual-view routes + AI chips.  
2. Local Ollama — Settings → Local, Test connection, refresh dossier.  
3. `/diagnostics` — probes + IndexedDB health.  
4. `/sources` — wired filter includes CompTox / DailyMed / Semantic Scholar.  
5. `/compare` — dual export after caching both CIDs.  
6. Tech-transfer JSON contains `schema: "…v2"` and `validationChecklist`.  

## Related

- Pipeline → [dossier-pipeline.md](./dossier-pipeline.md)  
- Getting started → [../getting-started.md](../getting-started.md)  
