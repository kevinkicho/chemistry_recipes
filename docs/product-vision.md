# Chemistry Recipes — Product Vision

**Working title:** Chemistry Recipes  
**Positioning:** Evidence-first process recipe hub for pharmaceutical, clinical, and biotech production teams — dual views (mechanism + manufacturing), multi-modality templates, educational parameter scaffolds, tech-transfer export.  
**Not** regulatory decision support. **Not** GMP certification.

**Repo:** https://github.com/kevinkicho/chemistry_recipes

## Product law

1. **Evidence-first, not GMP certification.** Content is a *production guide scaffold* for trained process teams. Plants validate, qualify, and control under their own quality systems.  
2. **Free public sources + curated educational packages.** Identity, hazards, reactions, and literature from free APIs; manufacturing notes are curated or AI-synthesized with explicit provenance.  
3. **Dual audience, dual views.** Mechanism (R&D) and manufacturing (plant) share step IDs.  
4. **Scale-up ready language.** Industrial units, equipment *classes*, operating envelopes.  
5. **No regulatory decision support.** Not a substitute for FDA/EMA filings, DMF, or batch record approval.  
6. **No invented site limits.** Literature-typical parameters are teaching envelopes only.

## User journeys

| Persona | Goal | Primary UI |
|---------|------|------------|
| Process / manufacturing chemist | Stand up or improve a route | Manufacturing view, BOM, equipment, EHS |
| Organic / R&D chemist | Understand how the molecule is made | Mechanism view, lit |
| Tech transfer / MSAT | Lab → pilot → commercial bridge | Dual view, critical params, packages |
| Biotech MSAT | Modality unit ops + educational CQAs | Packages (mAb, gene, cell), parameter panels |

## Content tiers

| Tier | Coverage | Quality | Source |
|------|----------|---------|--------|
| **A** | Full dual-view routes, apparatus, EHS | High educational | Curated JSON + citations |
| **B** | Structured package + live APIs | Medium | Catalog / free APIs + AI |
| **C** | Identity / platform pointer | Low | Catalog stub |

## Success metrics

- Time from “I need to make X” → structured route + equipment list &lt; 2 minutes for Tier-A / package hits.  
- Every manufacturing claim has provenance or an explicit AI/editorial label.  
- Dual views never contradict (shared step IDs).  
- Parameter tables never present site-fill fields as invented numbers.

## Non-goals

- Predictive retrosynthesis competing with commercial tools  
- Closed-loop LIMS / MES execution  
- Paid DB connectors (Reaxys, SciFinder, …)  
- Regulatory submission generation  
- Multi-tenant cloud orgs (local-first workspace only today)  
- Claiming 100 GMP-validated plant packages  

## Related docs

- [architecture.md](./architecture.md)  
- [getting-started.md](./getting-started.md)  
- [data-model.md](./data-model.md)  
- [security.md](./security.md)  
