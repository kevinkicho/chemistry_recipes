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
   │    ├─ process-rank literature before OA budget
   │    ├─ OA full text + extra PMC; patent densify
   │    │    (higher patent budget when OA sparse)
   │    └─ OrgSyn retry; process-dense abstracts as secondary windows
   └─ extractProcessFacts     condition/unit-op atoms from densified text
2. scoreCompoundEvidence      0–100 score (weights process-fact density)
3. buildScaffoldDossier       fact-enriched leads + procedureExcerpts on LiveDossier
4. partial SSE                UI usable early
5. synthesize (if canCall && score gate)
   └─ qualityGateSynthesis    drop junk / invented plant language
   └─ stripUncitedRouteDetails  drop numeric conditions not aligned to facts
   └─ preferRoutesForEvidence   one route when thin; two when rich
6. enrich                     modality, related entities, contradictions,
                              unit-op fill, plant deliverables, recipe readiness,
                              ideal-page parity, process-knowledge package, audit
7. complete SSE               full LiveDossier (+ processFacts + procedureExcerpts)
8. client IndexedDB put       dossier cache + procedure vault + snapshot
```

## Agentic AI evidence package

`lib/dossier/aiEvidencePackage.ts` builds a **budgeted** prompt feed (up to ~32k chars full model / ~16k fast):

1. `processFacts.atoms` (numeric grounding)  
2. `procedureExcerpts` (OA / patent / OrgSyn densify)  
3. densified literature + patents  
4. manufacturing / GHS / multi-API annotations  

System prompt prioritizes structuring densified procedure text into dual-view routes; uncited numbers still stripped post-AI.

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
