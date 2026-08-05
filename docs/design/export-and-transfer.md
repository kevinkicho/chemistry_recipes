# Export & tech-transfer UX

## Goal

Help MSAT / tech-transfer users leave the app with a **structured pack** they can drop into a review folder — without implying GMP approval.

## Export surfaces

| Control | Output | Where |
|---------|--------|--------|
| Print / PDF | Browser print of dossier | Live densify + compare (primary) |
| Role pack | Role-scoped Monday deliverable JSON | `TechTransferExport` primary |
| Agent pack | Guidance + densify-next + vault fingerprint | `TechTransferExport` primary |
| Tech-transfer JSON | Schema `chemistry-recipes.tech-transfer.v2` | More… secondary |
| MES/LIMS / brief / job aid | Flattened plant handoffs | More… secondary |
| Compare dual export | Both sides as one JSON | `/compare` → Export both |

## Readiness checklist (UX)

On live dossiers, **Transfer readiness checklist** surfaces the same items embedded in tech-transfer v2:

- Identity present  
- Evidence score reviewed  
- Lit / patents linked  
- BOM / steps / apparatus / EHS  
- Explicit “not site batch record” review item  

Statuses: `ok` | `review` | `gap`.

## Compare flow

1. Enter two live PubChem CIDs / names on `/compare`.  
2. Open each live page once so IndexedDB caches metrics.  
3. Side-by-side evidence score, routes, annotations.  
4. **Export both** → single compare pack with two tech-transfer payloads.

No sharing server — local caches only.

## Disclaimers

Every pack includes:

- Product dossier disclaimer  
- `REGULATORY_DISCLAIMER` (not for regulatory decision support)

## Related engineering

- [../engineering/tech-transfer-export.md](../engineering/tech-transfer-export.md)  
- Schema builders: `web/src/lib/export/techTransfer.ts`  
