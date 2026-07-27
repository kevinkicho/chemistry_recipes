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
   ├─ densify pass if procedure text thin (OA full text, patents, OrgSyn)
   └─ extractProcessFacts     condition/unit-op atoms from densified text
2. scoreCompoundEvidence      0–100 score (weights process-fact density)
3. buildScaffoldDossier       fact-enriched leads (no fake IPC)
4. partial SSE                UI usable early
5. synthesize (if canCall && score gate)
   └─ qualityGateSynthesis    drop junk / invented plant language
   └─ stripUncitedRouteDetails  drop numeric conditions not aligned to facts
   └─ preferRoutesForEvidence   one route when thin; two when rich
6. enrich                     modality, related entities, contradictions,
                              unit-op fill, parameters, recipe readiness, audit
7. complete SSE               full LiveDossier (+ processFacts)
8. client IndexedDB put       dossier cache + procedure vault + snapshot
```

## Durability (breaking free-API ceilings)

| Layer | Module | Role |
|-------|--------|------|
| HTTP retries | `lib/api/trace.ts` | 429/502/503/504/timeout retries with backoff |
| Soft gather | `gather.ts` `soft()` | One source failure never aborts the wave |
| Server cache | `serverEvidenceCache.ts` | Merge denser prior evidence across rebuilds |
| Densify pass | `densifyPass.ts` | Second pass when procedure chars/excerpts thin |
| Client vault | `idb/procedureVault.ts` | Browser-durable procedure windows across sessions |

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
