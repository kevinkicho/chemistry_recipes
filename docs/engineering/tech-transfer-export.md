# Tech-transfer export

**Module:** `web/src/lib/export/techTransfer.ts`  
**UI:** `components/TechTransferExport.tsx`, `ValidationChecklist.tsx`, `/compare`

## Schemas

### Tech-transfer pack v2

```text
schema: "chemistry-recipes.tech-transfer.v2"
```

Includes:

- Entity identity (CID, CAS, formula, …)  
- Confidence / evidence score  
- Routes (materials, steps, controls, apparatus)  
- Literature + patents + annotations  
- **validationChecklist** — ok / gap / review items  
- **sourceCoverage** — summary counts  
- Regulatory + product disclaimers  

Builders:

- `buildTechTransferFromLive(LiveDossier)`  
- `buildTechTransferFromExample(MoleculeDossier)`  

### MES / LIMS flat export

```text
schema: "chemistry-recipes.mes-lims.v1"
```

Derived via `buildMesLimsFromTechTransfer` — BOM rows, step condition rows, equipment rows.

### Compare export

```text
schema: "chemistry-recipes.compare-export.v1"
```

`{ a, b, links }` where `a`/`b` are tech-transfer packs or null.

### Public process brief (sourced-only)

```text
schema: "chemistry-recipes.public-process-brief.v1"
```

Builder: `buildPublicProcessBrief(LiveDossier)`  

Contains extracted process-fact atoms, open gaps, manager risks, and preferred route **without** AI narrative padding or uncited plant numbers. Intended for workers/managers who need verifiable public leads.

## Validation checklist items (live)

Identity, evidence score, sources, BOM, steps, CPP/IPC, apparatus, EHS, explicit not-GMP review.

## Filenames

- `{slug}-tech-transfer-v2.json`  
- `{slug}-mes-lims.json`  
- `{name-a}-vs-{name-b}-compare.json`  

## Related design

- [../design/export-and-transfer.md](../design/export-and-transfer.md)  
