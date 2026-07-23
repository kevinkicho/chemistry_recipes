# Process facts & accuracy layer

Goal: manufacturing guidance that hands-on workers and managers can **verify**, not fluent AI fiction.

## Law

> Every manufacturing number is either extracted from free-public text (with source), or **omitted**. Site CPPs/IPCs are never invented.

## Framing

| Framing | When |
|---------|------|
| `process-recipe` | ≥3 conditions, ≥2 unit ops, and isolation **or** example-dense source **or** ≥2 patent/user conditions |
| `evidence-lead-pack` | Otherwise — UI must not claim a manufacturing recipe |

## Local full-text enrich

Users may paste **public** patent example text (browser localStorage).  
`extractFactsFromUserText` → merged via `applyLocalFactEnrichment` on the live dossier.

## Live ≈ curated parity helpers

| Module | Role |
|--------|------|
| `plantDeliverables.ts` | Manufacturing narrative train, apparatus, BOM, step plant bodies |
| `chemicalMentions.ts` | Named reagents/solvents/SMs from public text → related entities |
| `tierABaseline.ts` | Hub CIDs merge Tier-A teaching routes/entities (labeled editorial) |

## Route compare

Single-route dossiers still get a plant scouting panel (BOM, equipment, conditions, steps).

## Module

`web/src/lib/dossier/processFacts.ts`

| Export | Role |
|--------|------|
| `extractProcessFacts` | Pull condition / unit-op / isolation / hazard / scale atoms from lit, patents, PubChem mfg, GHS |
| `routesFromProcessFacts` | Fact-enriched process leads (pre-AI shell) |
| `stripUncitedRouteDetails` | Drop AI numeric conditions not aligned to atoms |
| `preferRoutesForEvidence` | One route when thin; up to two when rich |
| `PublicProcessBrief` / export | Sourced-only handout JSON |

## Pipeline integration

1. **Gather** attaches `processFacts` on `CompoundEvidence`  
2. **Score** weights condition + unit-op density (`evidenceScore.ts`)  
3. **Scaffold** uses fact-enriched routes when atoms exist  
4. **AI** receives `processFacts.atoms[]` in the evidence JSON; system prompt forbids invented numbers  
5. **Quality gate** drops invented plant language and AI IPC/CQA tables  
6. **Post-AI strip** removes uncited numerics; prefers fewer routes when thin  
7. **UI** Manager brief + Process facts panels; plant view default; `src` condition chips  

## UI

- `ManagerBriefPanel` — preferred path, risks, site open gaps  
- `ProcessFactsPanel` — solid = sourced, dashed = open gap  
- `RoutePanel` — manufacturing default; sourced conditions tagged  
- Export **Public process brief** — `chemistry-recipes.public-process-brief.v1`  

## What remains intentionally empty

- Validated IPC methods  
- Site CQAs / hold times  
- Cleaning / campaign rules  
- Full patent experimental sections (abstracts only unless user opens primary source)  

## Related

- [dossier-pipeline.md](./dossier-pipeline.md)  
- [tech-transfer-export.md](./tech-transfer-export.md)  
- Design: [../design/ux-live-dossier.md](../design/ux-live-dossier.md)  
