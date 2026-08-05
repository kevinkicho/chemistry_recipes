# Engineering architecture

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router (`web/`) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS 4 + client components |
| AI | Ollama Cloud **or** local Ollama (`ollama serve`) |
| Live data | Free public chemistry / literature / patent APIs |
| Client cache | IndexedDB (`chemistry-recipes-v1`, snapshots DB) |
| Workspace | `localStorage` projects only |

## System context

```text
┌─────────────┐     SSE      ┌──────────────────────────┐
│   Browser   │◄────────────►│  Next.js (web/)          │
│  React UI   │   JSON POST  │  API routes              │
│  IndexedDB  │◄────────────►│  /api/dossier/[cid]/stream│
│  AI settings│              │  /api/ai/*  /api/diagnostics│
└─────────────┘              └────────────┬─────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
        Free public APIs           Ollama Cloud              Local Ollama
     (PubChem, ChEMBL, …)        ollama.com                 127.0.0.1:11434
```

## App routes (implementation)

| Path | Module |
|------|--------|
| `/compounds/pubchem/[cid]` | Live dossier shell + client loader |
| `/api/dossier/[cid]/stream` | SSE pipeline entry |
| `/api/ai/chat` | Proxied chat (cloud or local allowlist) |
| `/api/ai/models` | `/api/tags` proxy |
| `/api/ai/status` | Non-secret readiness |
| `/api/ai/science` | Quote-bound single-CID science agent |
| `/api/ai/campaign` | Multi-CID densify + campaign agent |
| `/api/diagnostics` | Env snapshot + optional probes |
| `/compare` | Dual CID compare + dual export |
| `/workspace` | Campaigns, vault, frontier panels, densify telemetry |
| `/packages`, `/info`, `/examples/*`, `/catalog` | Redirect → search (mocks retired) |
| `/sources` | `SourcesRegistry` client table |
| `/diagnostics` | Operator UI |

## Key libraries

| Path | Responsibility |
|------|----------------|
| `lib/dossier/pipeline.ts` | Orchestration + SSE emits |
| `lib/dossier/gather.ts` | Multi-API harvest |
| `lib/dossier/densifyPass.ts` | Second-pass OA/patent densify |
| `lib/dossier/evidenceScore.ts` | Score + AI gate |
| `lib/dossier/synthesize.ts` | Ollama stream + quality gate |
| `lib/dossier/sourceCoverage.ts` | Coverage slots for UI |
| `lib/frontier/*` | Process-knowledge, AI guidance, campaign agents |
| `lib/export/techTransfer.ts` | Export schema builders |
| `lib/ai/serverEnv.ts` | Root `.env` resolve |
| `lib/ai/config.ts` | Browser AI config + host allow helpers |
| `lib/idb/dossierCache.ts` | Cache + health probe |
| `lib/sources/registry.ts` | Product-ranked API list |
| `lib/diagnostics/probes.ts` | Live GET health checks |

## Env loading

Monorepo-friendly: `getServerAiEnv()` reads process env and merges root / `web/` `.env` files.  
Browser models can be passed on the dossier stream query string.

## Security boundaries

- Host allowlist on AI proxies (cloud HTTPS + local/LAN loopback/private).  
- No secrets in `/api/ai/status` or diagnostics.  
- See [../security.md](../security.md) and [ai-and-ollama.md](./ai-and-ollama.md).

## Related design

- [../design/product-design.md](../design/product-design.md)  
- [../architecture.md](../architecture.md) (short overview)  
