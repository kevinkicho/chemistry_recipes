# Dossier pipeline

Live builds run on the server and stream progress to the browser over **SSE**.

**Entry:** `GET /api/dossier/[cid]/stream`  
**Orchestrator:** `web/src/lib/dossier/pipeline.ts`  
**Client:** `DossierClientLoader` + `ApiProgressOverlay`

## Stages

```text
1. gatherCompoundEvidence     durable multi-API harvest
   ├─ live wave (soft-fail per source; HTTP retries on 429/5xx/timeout)
   ├─ merge with server evidence cache (memory + .cache/evidence)
   │    (skip cache when force=1 / refresh)
   ├─ densify pass if procedure text thin
   │    ├─ densifyBudgetPlanner (thin high-score lit/pat first)
   │    ├─ OA full text + extra PMC; patent densify
   │    │    (higher patent budget when OA sparse)
   │    ├─ annotations → procedureExcerpts (process-relevant only)
   │    └─ OrgSyn retry; process-dense abstracts as secondary windows
   ├─ auto recovery (when still thin + soft-fails)
   │    ├─ retryFailedFamilies for soft/api-fail labels
   │    └─ second densify pass after successful retry
   └─ extractProcessFacts     condition/unit-op atoms from densified text
2. scoreCompoundEvidence      0–100 score + procedure-density AI gate
3. buildScaffoldDossier       fact-enriched leads + procedureExcerpts on LiveDossier
4. partial SSE                UI usable early
5. synthesize (if canCall && score + densify gate)
   ├─ value-weighted evidence package (atoms + ranked windows first)
   ├─ two-pass full model: extract quote-bound atoms → assemble dual-view
   ├─ qualityGateSynthesis    drop junk / invented plant language
   ├─ mergeExtractAtoms       quote-grounded pass1 atoms into processFacts
   ├─ stripUncitedRouteDetails  drop numeric conditions not aligned to facts
   ├─ groundRoutes + attachQuotesToRoutes  bind conditions to fact quotes
   └─ preferRoutesForEvidence   one route when thin; two when rich
6. enrich                     modality, related entities, contradictions,
                              unit-op fill, plant deliverables, recipe readiness,
                              ideal-page parity, process-knowledge package, audit
7. complete SSE               full LiveDossier (+ processFacts + procedureExcerpts)
8. client IndexedDB put       dossier cache + procedure vault + snapshot
```

## Agentic AI evidence package

`lib/dossier/aiEvidencePackage.ts` builds a **budgeted, value-weighted** prompt feed (up to ~32k chars full model / ~16k fast):

1. `processFacts.atoms` (conditions/yields first — numeric grounding)  
2. `procedureExcerpts` ranked by procedure-window score  
3. `processKnowledgeDigest` + `relatedProcessContext` (structure / impurity cues)  
4. densified process literature + patents (clinical context last)  
5. manufacturing / GHS / multi-API annotations  

Full model uses **two-pass** extract→assemble when densify body is rich; draft model stays single-pass. Uncited numbers are still stripped post-AI; quote-bind attaches process-fact refs to matching step conditions.

## Durability (breaking free-API ceilings)

| Layer | Module | Role |
|-------|--------|------|
| HTTP retries | `lib/api/trace.ts` | 429/502/503/504/timeout retries with backoff |
| Soft gather | `gather.ts` `soft()` | One source failure never aborts the wave |
| Server cache | `serverEvidenceCache.ts` | Merge denser prior evidence across rebuilds |
| Densify pass | `densifyPass.ts` | Second pass when procedure chars/excerpts thin |
| Procedure excerpts on dossier | `scaffold.ts` / `types.ts` | Keep densify windows for AI ingest after build |
| Force stream | `?force=1` on dossier stream | Skip durable server evidence cache |
| Client vault | `idb/procedureVault.ts` | Browser-durable procedure windows across sessions |
| AI guidance | `lib/frontier/aiGuidancePackage.ts` | Densify-first agent package (see [frontier-science.md](./frontier-science.md)) |

## Accuracy law

Manufacturing numbers and public process brief export only include **sourced** process-fact atoms or fact-aligned conditions. See `lib/dossier/processFacts.ts` and [tech-transfer-export.md](./tech-transfer-export.md).

## Evidence score

Implementation: `lib/dossier/evidenceScore.ts`.

Contributors include:

- PubChem identity / manufacturing excerpts / GHS  
- Non-PubChem annotation source diversity (ChEMBL, openFDA, CompTox, …)  
- Process-oriented literature & patents  
- Multi-API literature diversity  

UI: `EvidenceScoreExplainer` (explainer lines + AI recommendation).

## Quality gate

`qualityGateSynthesis` in `lib/dossier/synthesize.ts`:

- Rejects boilerplate / TOC-like steps  
- Requires minimum description length and ≥2 real steps  
- Scrubs placeholder IPC / “define on site” junk  
- On total reject: shell kept + gap message  

## Progress events

Types in `lib/dossier/progress.ts` — `step_start`, `step_done`, `log`, `partial`, `complete`, errors.  
The overlay must **not** reset completed free-API steps when Ollama logs arrive.

## Related

- Multi-API gather → [multi-source-apis.md](./multi-source-apis.md)  
- AI path → [ai-and-ollama.md](./ai-and-ollama.md)  
- UX → [../design/ux-live-dossier.md](../design/ux-live-dossier.md)  
