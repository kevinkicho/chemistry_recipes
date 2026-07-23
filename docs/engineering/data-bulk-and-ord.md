# Bulk data, ORD, and patent full text

Remaining accuracy depth that cannot be fully solved by live free REST alone.

## What is live today

| Source | Live behavior |
|--------|----------------|
| **PubChem PatentID xrefs** | Free PUG REST lists patent IDs for a CID → IP pointers + Google Patents links |
| **PatentsView** | When `PATENTSVIEW_API_KEY` set — longer abstracts (up to 4k) for process-fact extract |
| **Europe PMC patent lit** | Free patent-style literature without USPTO key |
| **Local full-text enrich** | User pastes public patent **Example** text → process facts (browser only) |
| **ORD** | Deep-link to public browse UI by name/SMILES + annotation on live dossier |

## Open Reaction Database (ORD)

- **Role:** Lab-scale / ML reaction records — **not** commercial plant SOPs.  
- **Browse:** [open-reaction-database.org](https://open-reaction-database.org/)  
- **Bulk:** Protocol buffers / datasets via [docs.open-reaction-database.org](https://docs.open-reaction-database.org/)  
- **App wiring:** `lib/api/ord.ts` → annotation + source ref on every live gather  

### Offline bulk ingest (future power user)

1. Download ORD release datasets.  
2. Filter reactions mentioning compound SMILES/name.  
3. Map conditions into `ProcessFact` with provenance `annotation` / custom.  
4. Keep framing rules: never promote lab ORD conditions to site CPPs.

## Patent full text / claims

USPTO **live** full-text search APIs have moved toward Open Data Portal (keys, transition). Reliable free paths in-app:

1. PubChem patent ID list (always free)  
2. PatentsView abstracts when keyed  
3. **Human paste** of public Google Patents / USPTO example text (recommended for density)  
4. Optional future: weekly USPTO full-text bulk XML offline job (not in request path)

OCR of multi-page PDFs is intentionally **out of scope** for the Next.js free hub (cost, liability, accuracy).

## Product law reminder

Bulk and ORD data improve **chemical reaction context**. Manufacturing plant truth still requires primary process literature/patents + site QMS.

## Related

- [process-facts-accuracy.md](./process-facts-accuracy.md)  
- [multi-source-apis.md](./multi-source-apis.md)  
