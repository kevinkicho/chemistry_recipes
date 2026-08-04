# Product design

## Problem

Process chemists and MSAT engineers need a fast, **evidence-grounded** starting point for “how is this molecule / modality made?” — without pretending the app is a site batch record or regulatory system.

## Solution shape

A **live densify process hub** (curated mock packages/examples retired from the live app):

| Layer | What it is |
|-------|------------|
| **Live dossiers** | Free multi-API densify + integral Ollama dual-view for any PubChem CID |
| **MSAT journey** | Problem / unit-op → campaign densify → impurity neighborhood → brief + agent |
| **Ideal parity** | Score toward dual-view inventory (not a separate curated dossier catalog) |
| **Compare / export** | Side-by-side scouting + tech-transfer / agent / role packs |

## Information architecture

```text
Home
├── Live search ─────────► Live densify dossier (PubChem CID)
├── Problem / MSAT ──────► Campaign densify → Workspace brief + agent
├── Compare ─────────────► Two CIDs + dual export
├── Workspace ───────────► Campaigns, graph, agents, densify telemetry
├── Sources ─────────────► Free API registry
└── Diagnostics ─────────► API health + cold-CID KPI floors
```

## Depth signals (live product)

| Signal | Intent | UX |
|--------|--------|-----|
| **Ideal parity** | Dual-view inventory completeness | 0–100 score + weak sections |
| **Recipe readiness** | Scout vs recipe-draft honesty | Framing banner |
| **Ingest score** | AI densify readiness (not GMP) | AI guidance / densify-next |
| **Procedure vault** | Local densify memory | Paste + OA/patent windows |

## Personas → primary surfaces

| Persona | Primary path | Success moment |
|---------|--------------|----------------|
| Process chemist | Search → live densify | Dual-view steps + process facts |
| R&D / organic | Live mechanism view + lit | Mechanism notes + densified windows |
| Tech transfer / MSAT | Problem journey → role pack | Brief + tech-transfer / agent pack |
| Biotech MSAT | Modality playbooks + params | Parameter framework honesty |

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
