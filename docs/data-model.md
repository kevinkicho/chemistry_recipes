# Process data model

Canonical types: `web/src/lib/types/process.ts`  
Live dossier types: `web/src/lib/dossier/types.ts`  
Tier-A seeds: `web/src/data/molecules/*.json`  
Packages: `web/src/lib/data/curatedPackages.ts`

## Entity graph

```
Entity / Molecule
  ├── identifiers (CAS, InChIKey, PubChem CID, UNII, …)
  ├── modality + entityRole
  ├── properties, hazards
  ├── routes[]  ── ProcessRoute
  │                 ├── materials[] (BOM)
  │                 ├── steps[] ── ProcessStep
  │                 │              ├── chemistry (mechanism)
  │                 │              ├── conditions, apparatus, environment
  │                 │              └── controls (IPC, CQAs, CPPs, holds)
  │                 └── scaleUp
  ├── relatedEntities[] (impurities, intermediates, DP links)
  └── educational parameter set (by modality)
```

## Scale classes

| Code | Typical intent |
|------|----------------|
| `lab` | Discovery / method development |
| `kilo` | Kilo lab / early pilot |
| `pilot` | Pilot plant |
| `commercial` | Manufacturing plant |
| `continuous` | Continuous manufacturing |

## Equipment classes

Prefer classes (not brands): `glass-lined-reactor`, `hastelloy-reactor`, `filter-dryer`, `centrifuge`, `hydrogenator`, `scrubber`, …

## Provenance

```ts
sourceRefs: {
  type: 'api' | 'literature' | 'patent' | 'editorial' | …;
  id: string;
  url?: string;
  note?: string;
}[]
```

## Parameter fill status

See README / `lib/modality/biologicParameters.ts`:

- `literature-typical` — teaching envelope  
- `site-fill-required` — site QMS only  
- `evidence-only` — free-public / AI-from-evidence  
- `template-empty` — deliberately blank  

## Live dossier extras

- `evidenceScore` (score, confidence, explainer, aiRecommendation)  
- `buildMode`, `buildAudit`  
- `annotations[]` (multi-source free APIs)  
- `contradictions[]`, `unitOpFills[]`  
- `relatedEntities[]`, `modality`  
- `traces[]` (HTTP provenance for API chips)  

## Export models

- Tech-transfer pack v2 — `lib/export/techTransfer.ts`  
- MES/LIMS flat rows — same module  
- Compare dual pack — `/compare`  

Detail: [engineering/tech-transfer-export.md](./engineering/tech-transfer-export.md)

## Related docs

- [README.md](./README.md) (full TOC)  
- [engineering/dossier-pipeline.md](./engineering/dossier-pipeline.md)  
- [design/ux-live-dossier.md](./design/ux-live-dossier.md)  

