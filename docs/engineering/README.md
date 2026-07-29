# Engineering documentation

Implementation notes for the Chemistry Recipes Next.js app (`web/`).

## Table of contents

| Doc | Contents |
|-----|----------|
| [Architecture](./architecture.md) | Stack, modules, routes, data flow |
| [Dossier pipeline](./dossier-pipeline.md) | SSE build: gather → score → shell → AI → enrich |
| [Process facts & accuracy](./process-facts-accuracy.md) | Sourced atoms, strip uncited, public process brief |
| [Bulk data & ORD](./data-bulk-and-ord.md) | PubChem patents, ORD browse, full-text strategy |
| [Multi-source APIs](./multi-source-apis.md) | Clients, registry, diagnostics probes |
| [AI & Ollama](./ai-and-ollama.md) | Cloud + local, proxies, synthesis, quality gate |
| [Frontier science](./frontier-science.md) | Densify-first AI guidance, campaigns, agents |
| [Client storage](./client-storage.md) | IndexedDB, snapshots, health probe |
| [Tech-transfer export](./tech-transfer-export.md) | Schema v2, MES/LIMS, checklist |
| [Testing](./testing.md) | `npm run precommit` + suite cheatsheet |
| [Test specification](./test-spec.md) | Full REQ matrix: lifecycle, densify, agents, nav abort, diagnostics |

## Related

- Design → [../design/README.md](../design/README.md)  
- Security → [../security.md](../security.md)  
- Data model → [../data-model.md](../data-model.md)  
- Docs index → [../README.md](../README.md)  

## Source layout (high signal)

```text
web/src/
├── app/                 # App Router pages + API routes
├── components/          # UI (dossier, frontier, export, AI settings, …)
└── lib/
    ├── ai/              # Browser config + server env + proxy helpers
    ├── api/             # Free public API clients
    ├── dossier/         # Live pipeline + densify pass + AI evidence package
    ├── frontier/        # Process-knowledge, AI guidance, campaign agents
    ├── export/          # Tech-transfer / MES
    ├── idb/             # IndexedDB
    ├── modality/        # Unit-op + parameter frameworks
    ├── search/          # Multi-source + problem densify handoff
    ├── sources/         # Product API registry
    └── types/process.ts # Canonical process types
```
