# Live dossier UX

## Goal

Make a live PubChem-based dossier feel like a **recipe**, not a literature dump — while keeping multi-source evidence and AI trust signals visible.

## Layout (recipe-first)

Primary column (≈2/3):

1. **Identity** — name, CAS, CID, structure  
2. **Evidence score** — process-fact density + AI gate (`EvidenceScoreExplainer`)  
3. **Source coverage** — which free APIs returned data (`SourceCoverageMap`)  
4. **Manager / MSAT brief** — preferred path, risks, open site gaps (`ManagerBriefPanel`)  
5. **Public process facts** — sourced atoms vs dashed open gaps (`ProcessFactsPanel`)  
6. **Transfer readiness checklist** — pre-validation gaps (`ValidationChecklist`)  
7. **Process recipe** — plant-first dual view; conditions marked `src` when sourced  
8. **Control points** — qualitative CPPs only when evidence-backed  
9. **Multi-source annotations** — ChEMBL, openFDA, CompTox, …  
10. Literature / patents / manufacturing excerpts  

Secondary column:

- TOC (section anchors that exist in the DOM)  
- Export controls, refresh, cache age  
- Related materials graph  

## Dual view

| View | Audience | Emphasizes |
|------|----------|------------|
| **Manufacturing** | Plant / MSAT | Conditions, apparatus classes, IPC, holds |
| **Chemistry** | R&D | Mechanism class, stoichiometry notes |

Steps share IDs so the two views never drift.

## Trust UI patterns

| Pattern | Component / signal |
|---------|-------------------|
| Evidence score + recommendation | `EvidenceScoreExplainer` |
| API coverage strip | `SourceCoverageMap` |
| Real HTTP chips | `ApiProvenance` + traces |
| AI prompt/model chips | `AiProvenance` |
| Contradictions | `EvidenceContradictions` |
| Build progress | SSE overlay (`ApiProgressOverlay`) |

## Interaction rules

- **Refresh live data** clears IndexedDB for that CID and re-runs the pipeline.  
- Early **shell** partial may appear before Ollama finishes.  
- Thin evidence → AI skipped with an explicit gap message (no invented plant IPC).  
- Print hides chrome (`print:hidden`) and keeps disclaimer + recipe body.

## Empty / degraded states

| State | User sees |
|-------|-----------|
| No Ollama | Evidence shell + “set key or local host” gap |
| Thin score | Shell + literature leads; AI skipped |
| Quality gate reject | Shell kept; rawError on synthesis |
| API fail | Slot status `fail` / `empty` on coverage map |

## Related

- Product design → [product-design.md](./product-design.md)  
- Pipeline eng → [../engineering/dossier-pipeline.md](../engineering/dossier-pipeline.md)  
