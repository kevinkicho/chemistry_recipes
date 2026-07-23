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

- `evidenceScore`, `buildMode`, `buildAudit`  
- `contradictions[]`, `unitOpFills[]`  
- `relatedEntities[]`, `modality`  
