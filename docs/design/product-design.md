# Product design

## Problem

Process chemists and MSAT engineers need a fast, **evidence-grounded** starting point for “how is this molecule / modality made?” — without pretending the app is a site batch record or regulatory system.

## Solution shape

A **process recipe hub**:

| Layer | What it is |
|-------|------------|
| **Live dossiers** | Free multi-API harvest + optional Ollama dual-view synthesis for any PubChem CID |
| **Tier-A examples** | Hand-curated deep dual-view dossiers |
| **Packages** | ~100+ educational packages with modality unit-ops + parameter scaffolds |
| **Compare / export** | Side-by-side scouting + tech-transfer JSON / print |

## Information architecture

```text
Home
├── Search ──────────────► Live dossier (PubChem CID)
├── Packages ────────────► Package detail (modality + params)
├── Catalog / examples ──► Tier-A dual-view dossier
├── Compare ─────────────► Two recipes + dual export
├── Workspace ───────────► Local pins only
├── Sources ─────────────► Free API registry
└── Diagnostics ─────────► Operator health
```

## Content tiers

| Tier | Intent | UX depth |
|------|--------|----------|
| **A** | Teaching “gold” dual-view | Full routes, apparatus, EHS, citations |
| **B** | Structured package + live path | Unit ops + params + live CID link |
| **C** | Identity / platform pointer | Thin card → search or PubChem |

## Personas → primary surfaces

| Persona | Primary path | Success moment |
|---------|--------------|----------------|
| Process chemist | Search → live recipe | Dual-view steps + BOM |
| R&D / organic | Tier-A or live mechanism view | Mechanism notes + lit |
| Tech transfer / MSAT | Package + export + checklist | Tech-transfer v2 JSON |
| Biotech MSAT | Packages (mAb, gene, …) | Parameter framework honesty |

## Explicit non-goals (product)

- Multi-user collab / org workspaces  
- Paid database connectors  
- Predictive retrosynthesis product  
- Closed-loop MES/LIMS execution  
- GMP certification claims  

## Design constraints

1. Free public data only for live harvest.  
2. AI text always labeled; quality gate can reject thin routes.  
3. Disclaimers visible on packages, dossiers, exports.  
4. Browser AI keys never leave localStorage / request path to server proxy.

## Related engineering

- Pipeline → [../engineering/dossier-pipeline.md](../engineering/dossier-pipeline.md)  
- Export schema → [../engineering/tech-transfer-export.md](../engineering/tech-transfer-export.md)  
