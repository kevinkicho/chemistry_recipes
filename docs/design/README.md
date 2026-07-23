# Design documentation

Product and UX design for **Chemistry Recipes** — an evidence-first process recipe hub for manufacturing and MSAT teams.

> Not a collaborative multi-user workspace. Not GMP. Not regulatory decision support.

## Table of contents

| Doc | Audience | Contents |
|-----|----------|----------|
| [Product design](./product-design.md) | PMs, designers, eng leads | Surfaces, tiers, journeys, constraints |
| [Live dossier UX](./ux-live-dossier.md) | Designers, frontend | Recipe-first layout, dual views, trust UI |
| [Export & tech-transfer UX](./export-and-transfer.md) | Designers, MSAT personas | Print, packs, compare, checklist |

## Related

- Vision & product law → [../product-vision.md](../product-vision.md)  
- Engineering implementation → [../engineering/README.md](../engineering/README.md)  
- Full docs index → [../README.md](../README.md)  

## Design principles

1. **Recipe first** — BOM and steps before raw literature dumps.  
2. **Dual view** — mechanism (R&D) and manufacturing (plant) share step IDs.  
3. **Trust by default** — evidence score, source coverage, API/AI chips, gaps labeled.  
4. **Honesty on parameters** — `literature-typical` vs `site-fill-required` never conflated.  
5. **Local-first** — IndexedDB + localStorage; no shared multi-tenant org model.  
6. **Educational scaffold** — every export carries a regulatory disclaimer.  
