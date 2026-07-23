# Dossier pipeline

Live builds run on the server and stream progress to the browser over **SSE**.

**Entry:** `GET /api/dossier/[cid]/stream`  
**Orchestrator:** `web/src/lib/dossier/pipeline.ts`  
**Client:** `DossierClientLoader` + `ApiProgressOverlay`

## Stages

```text
1. gatherCompoundEvidence     multi-API harvest + traces
2. scoreCompoundEvidence      0–100 score, shouldSynthesize, preferFastModel
3. buildScaffoldDossier       evidence shell (no fake IPC)
4. partial SSE                UI usable early
5. synthesize (if canCall && score gate)
   └─ qualityGateSynthesis    drop junk / thin routes
6. enrich                     modality, related entities, contradictions,
                              unit-op fill, parameters, build audit
7. complete SSE               full LiveDossier
8. client IndexedDB put       cache + optional snapshot
```

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
