# Architecture (overview)

Short map of the system. For full engineering detail, start at:

**→ [engineering/architecture.md](./engineering/architecture.md)**  
**→ [engineering/README.md](./engineering/README.md)** (TOC)

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 App Router (`web/`) |
| Language | TypeScript |
| UI | Tailwind CSS 4 |
| AI | Ollama Cloud **or** local Ollama |
| Data | Free public APIs only (live densify + optional grounded AI) |
| Client cache | IndexedDB (dossiers + snapshots) |
| Workspace | `localStorage` projects (single-user) |

## Data flow (live dossier)

```
Browser ──SSE──► GET /api/dossier/[cid]/stream
                    ├─ gather (multi free APIs)
                    ├─ score evidence
                    ├─ scaffold shell → partial
                    ├─ Ollama (if canCall + score) → quality gate
                    └─ enrich → complete → client IndexedDB
```

Detail: [engineering/dossier-pipeline.md](./engineering/dossier-pipeline.md)

## Key modules

| Path | Role |
|------|------|
| `lib/dossier/pipeline.ts` | Live build orchestration |
| `lib/dossier/gather.ts` | Multi-source harvest |
| `lib/dossier/synthesize.ts` | Ollama + quality gate |
| `lib/dossier/sourceCoverage.ts` | Coverage map model |
| `lib/export/techTransfer.ts` | Tech-transfer v2 + MES/LIMS |
| `lib/ai/*` | Config, server env, host allowlist |
| `lib/idb/*` | Cache + snapshots + health |
| `lib/sources/registry.ts` | Product API registry |
| `app/api/ai/*` | Chat / models / status proxies |
| `app/api/diagnostics` | Operator probes |

## Design docs

- [design/README.md](./design/README.md)  
- [design/ux-live-dossier.md](./design/ux-live-dossier.md)  

## Security

- [security.md](./security.md)  
- Host allowlist: cloud + local/LAN only ([engineering/ai-and-ollama.md](./engineering/ai-and-ollama.md))  
