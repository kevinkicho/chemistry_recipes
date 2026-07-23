# Architecture

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 15 App Router (`web/`) |
| Language | TypeScript |
| UI | Tailwind CSS 4, client components where needed |
| AI | Ollama Cloud (`https://ollama.com`) via server proxy |
| Data | Free public APIs only + curated JSON examples |
| Client cache | IndexedDB (dossiers + version snapshots) |
| Workspace | `localStorage` projects |

## High-level data flow

```
Browser
  │  EventSource ?model=&fastModel=
  ▼
GET /api/dossier/[cid]/stream
  │
  ├─► gatherCompoundEvidence (PubChem, PUG View, Europe PMC, OpenAlex, patents)
  ├─► scoreCompoundEvidence
  ├─► buildScaffoldDossier  ── partial SSE (shell UI)
  ├─► synthesizeDossierFromEvidence (Ollama, gated) ── progress SSE
  └─► enrich: modality, relatedEntities, contradictions, unitOpFills,
              parameter framework, buildAudit ── complete SSE
```

## Key modules (`web/src`)

| Path | Role |
|------|------|
| `lib/dossier/pipeline.ts` | Orchestrates live build + progress |
| `lib/dossier/gather.ts` | Multi-source free API harvest |
| `lib/dossier/synthesize.ts` | Ollama prompts, parse, quality gate |
| `lib/dossier/relatedEntities.ts` | Impurity / intermediate graph |
| `lib/dossier/contradictions.ts` | Evidence tensions |
| `lib/modality/templates.ts` | Unit-op templates by modality |
| `lib/modality/biologicParameters.ts` | Educational parameter frameworks |
| `lib/data/curatedPackages.ts` | ~140 educational packages |
| `lib/data/examples.ts` | Tier-A JSON dossiers |
| `lib/export/techTransfer.ts` | Tech-transfer + MES/LIMS JSON |
| `lib/ai/serverEnv.ts` | Loads root `.env` safely on server |
| `lib/workspace/projects.ts` | Local project library |
| `app/api/ai/*` | Status, models list, chat proxy |
| `app/api/dossier/[cid]/stream` | SSE progress stream |

## Provenance model

- **API chips** — real `ApiFetchTrace` HTTP captures (URL, status, preview, time).
- **AI chips** — system/user prompt excerpts, model id, timing, data sources fed.
- No mock HTTP traces.

## Security notes

- API keys: repo-root `.env` (server) or browser localStorage (optional override).
- Keys never written to disk by the app except via user’s own `.env`.
- Ollama host restricted to `ollama.com` on proxy routes.
- See [security.md](./security.md).

## Curated content tiers

| Tier | Meaning |
|------|---------|
| **A** | Full dual-view example dossier JSON |
| **B** | Structured package + live PubChem path |
| **C** | Identity / platform pointer |

None of these are GMP-validated plant packages.
