# Frontier science engine (densify-first AI)

Multi-CID **process knowledge** and **AI guidance** packages built from free-public densify only. Goal: maximize useful process data **in the app** for agents and workers — **not** full-text paper previews (users open primary sources externally).

> **Not GMP.** Never invent plant limits, CPPs, or site setpoints. Every manufacturing claim stays quote-bound.

## Product intent

| Do | Don't |
|----|--------|
| Harvest OA / patent / OrgSyn / ORD procedure **windows** into durable packages | Re-render PDFs or full papers in-app as “preview” |
| Rank process-dense literature before OA budget spend | Spend densify budget on non-process titles first |
| Export `process-knowledge.v1` + `ai-guidance.v1` for agents | Invent numbers to fill empty fields |
| Surface **densify-next** actions + auto-queue | Pretend thin evidence is plant-ready |

## Schemas

| Schema | Module | Purpose |
|--------|--------|---------|
| `chemistry-recipes.process-knowledge.v1` | `lib/frontier/buildKnowledge.ts` | Condition atlas, hypotheses, experiments, reaction network |
| `chemistry-recipes.ai-guidance.v1` | `lib/frontier/aiGuidancePackage.ts` | Ranked procedure windows, process atoms, **ingestScore**, densify-next |
| `chemistry-recipes.campaign-ai-guidance.v1` | `lib/frontier/campaignAiGuidance.ts` | Multi-CID ingest rollup + densify queue CIDs |
| `chemistry-recipes.campaign-knowledge.v1` | `lib/frontier/campaignExport.ts` | Campaign export (includes optional `aiGuidance`) |
| `chemistry-recipes.science-agent.v1` | `lib/frontier/scienceAgent.ts` + `/api/ai/science` | Quote-bound single-CID agent |
| `chemistry-recipes.campaign-agent.v1` | `lib/frontier/campaignAgent.ts` + `/api/ai/campaign` | Multi-CID agent (± Ollama over guidance) |

## Densify harvest

**Pipeline:** `gather.ts` → optional `densifyPass.ts` when procedure chars/excerpts thin.

| Pass | Behavior |
|------|----------|
| First gather | Multi-API literature/patents + procedure excerpts (cap ~56) |
| Densify pass | Process-rank lit → OA full text (up to 10) + extra PMC → patent densify |
| OA-sparse boost | If &lt;2 OA windows, raise patent EPMC/US budgets (12/10) |
| Live dossier | Keeps `procedureExcerpts[]` for AI ingest after build |
| Force rebuild | `GET /api/dossier/[cid]/stream?force=1` skips durable server evidence cache |

## AI guidance package

`buildAiGuidancePackage(dossier)`:

1. **Procedure windows** — harvested excerpts first, then lit depth / OA / patents  
2. **Process atoms** — sourced `processFacts` (no open-gap filler)  
3. **Condition atlas summaries**  
4. **Multi-source identity/EHS hints** (annotations)  
5. **densifyNext** — high/medium/low actions (OA, patents, paste, force, impurities, multi-source)  
6. **ingestScore** 0–100 — readiness for AI structure (not GMP readiness)

`formatAiGuidanceContext` flattens the package for Ollama / agents (budgeted, quote-bound).

## Densify action queue

`lib/frontier/densifyActionQueue.ts`:

- Maps densify-next kinds → force primary re-gather, neighbor densify, or manual paste hints  
- UI: **Queue high densify** / **Queue densify** on Evidence Science + Science Agent  
- Campaign graph: **Queue AI densify** for thin/low-ingest CIDs  
- Telemetry: `recordIngestDeltaRun` with `ingestBefore/After` or `meanIngestBefore/After`

## Science agent (single CID)

| Path | Behavior |
|------|----------|
| Local | `runScienceAgentLocal` — retrieval over package + densify tips |
| Tools | Optional neighbor densify mid-loop |
| LLM | `runScienceAgentWithTools` + Ollama over densify-first context |
| API | `POST /api/ai/science` `{ cid, question, useLlm?, densifyNeighbors? }` |

## Campaign agent (multi-CID)

| Path | Behavior |
|------|----------|
| Local | Merged IndexedDB caches → `answerCampaignQuestion` |
| Server | Densify CIDs then merge |
| LLM | `runCampaignAgentWithLlm` over `formatCampaignAiGuidanceContext` |
| API | `POST /api/ai/campaign` `{ cids, question, force?, useLlm? }` |

## UI surfaces

| Panel | Location | Role |
|-------|----------|------|
| Evidence Science | Live dossier (chemist/MSAT/manager) | Q&A, exports, densify-next, queue high densify |
| Science Agent | Live dossier | Agent loop, queue densify, optional Ollama |
| Campaign Graph | `/workspace` | Merge, stream densify, export knowledge + AI guidance |
| Campaign Agent | `/workspace` | Multi-CID Q&A, densify queue, optional Ollama |
| Densify Telemetry | `/workspace` | Local runs + AI ingest Δ |

## Exports (agents / notebooks)

| Export | File / schema |
|--------|----------------|
| Process knowledge | `process-knowledge-*.json` |
| AI guidance | `ai-guidance-*.json` |
| Campaign knowledge | `campaign-knowledge-*.json` (+ nested `aiGuidance`) |
| Campaign AI guidance | `campaign-ai-guidance-*.json` |
| Notebook Markdown | process-knowledge / campaign brief markdown |

## Tests

```bash
cd web
npm run test:frontier   # densify-first contracts (guidance, queue, campaign LLM flags)
npm test                # full unit suite including frontier
```

## Related

- [Dossier pipeline](./dossier-pipeline.md) — gather + densify pass  
- [AI & Ollama](./ai-and-ollama.md) — hosts, proxies, synthesis  
- [Client storage](./client-storage.md) — IndexedDB densify caches  
- [Process facts & accuracy](./process-facts-accuracy.md) — quote law  
