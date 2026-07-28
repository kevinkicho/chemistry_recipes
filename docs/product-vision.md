# Chemistry Recipes — Product Vision

**Working title:** Chemistry Recipes  
**Positioning:** Evidence-first process recipe hub for pharmaceutical, clinical, and biotech production teams — dual views (mechanism + manufacturing), multi-modality templates, educational parameter scaffolds, tech-transfer export.  
**Not** regulatory decision support. **Not** GMP certification. **Not** a multi-tenant collaborative workspace.

**Repo:** https://github.com/kevinkicho/chemistry_recipes  

**Docs index:** [README.md](./README.md) · **Design:** [design/README.md](./design/README.md) · **Engineering:** [engineering/README.md](./engineering/README.md)

## Product law

1. **Evidence-first, not GMP certification.** Content is a *production guide scaffold* for trained process teams. Plants validate under their own quality systems.  
2. **Free public sources + curated educational packages.** Identity, hazards, and literature from free APIs; manufacturing notes are curated or AI-synthesized with explicit provenance.  
3. **Dual audience, dual views.** Mechanism (R&D) and manufacturing (plant) share step IDs.  
4. **Scale-up ready language.** Industrial units, equipment *classes*, operating envelopes.  
5. **No regulatory decision support.** Not a substitute for FDA/EMA filings, DMF, or batch record approval.  
6. **No invented site limits.** Literature-typical parameters are teaching envelopes only.  
7. **Local-first.** IndexedDB + local projects; no collab multi-user backend.  
8. **Curated Tier-A is the ideal-page depth goal.** Live free-API dossiers chase the same dual-view inventory (recipe, BOM, apparatus, environment, EHS, related entities) that Example dossiers already show — via densify, grounded AI, and labeled Tier-A teaching merges — never by inventing plant numbers to fake polish.  
9. **Frontier science = process knowledge, not cosmetic dossiers.** Condition-space atlases, competing route hypotheses with kill criteria, evidence-only Q&A, and next-experiment suggestions are first-class — exported as `process-knowledge.v1` for agents and notebooks.

## Ideal page (north star)

The **curated Example dossier** (`ExampleDossierView` + `web/src/data/molecules/*.json`) is the product’s **ideal page**: complete dual-view process recipe, manufacturing narrative, plant environment, apparatus catalog, EHS, related materials, control points.

Live builds measure progress with **`idealParity`** (0–100) against that inventory. Hub CIDs may promote **Tier-A teaching** routes when live leads are thin (always labeled editorial).

## Frontier process knowledge

Live dossiers also attach **`processKnowledge`** (`chemistry-recipes.process-knowledge.v1`):

- **Condition atlas** — distributions of T/t/P/… from free-public quotes (conflicts flagged)  
- **Route hypotheses** — competing public sequences with evidence scores and kill criteria  
- **Scientific conflicts** + **next experiments** (research questions, not plant setpoints)  
- **Seed Q&A** grounded only in the densified package (`insufficientEvidence` allowed)  

Export: process-knowledge JSON from the Evidence science panel.

### Frontier v2 surfaces

| Surface | Purpose |
|---------|---------|
| **Unit-normalized atlas** | °C / h / bar base units for fair conflict detection |
| **Reaction network** | Multi-CID nodes/edges from related entities + route materials |
| **Science campaigns** | Local CID sets (workspace) for batch densify |
| **`POST /api/dossier/batch`** | Sequential densify up to 12 CIDs |
| **`POST /api/ai/science`** | Quote-bound agent loop (retrieve ± densify neighbors ± optional Ollama over package only) |
| **`GET|POST /api/dossier/batch/stream`** | SSE progress per CID during multi-CID densify |
| **Campaign graph panel** | Merge networks + atlases from IndexedDB; stream densify missing CIDs |
| **`campaign-knowledge.v1` export** | Multi-CID packages + merged network/atlas for agents |
| **Parallel batch densify** | Concurrency 1–4 (`mapPool`) on JSON + SSE batch endpoints |
| **Edge evidence compare** | Side-by-side network edge evidence + linked condition quotes |
| **Edge-pair experiments** | Auto research questions from contrasting / thin network edges |
| **Campaign agent** | Multi-CID Q&A over merged cache (`campaign-agent.v1`) |
| **`POST /api/ai/campaign`** | Server densify up to 8 CIDs then quote-bound campaign answer (force optional) |
| **Campaign package preflight** | Cached/thin CID status before ask; force re-gather checkbox |
| **Paste ideal delta** | After local procedure paste: Ideal score and process-fact before→after |
| **Densify quality audit** | Procedure chars, OA/patent windows, atlas obs, hypotheses on build audit |
| **Densify telemetry** | Local concurrency / ok-fail / duration history (incl. campaign-server) |
| **Knowledge fingerprint** | Skip process-knowledge rebuild when densify inputs unchanged |
| **Batch cache skip** | Warm IndexedDB hits skip server rebuild (12h, force override) |
| **Transient retries** | Per-CID exponential backoff on timeout/5xx during batch densify |
| **Local-first science agent** | Answer from in-page package without full server pipeline when possible | 

## User journeys

| Persona | Goal | Primary UI |
|---------|------|------------|
| Process / manufacturing chemist | Stand up or improve a route | Manufacturing view, BOM, equipment, EHS |
| Organic / R&D chemist | Understand how the molecule is made | Mechanism view, literature |
| Tech transfer / MSAT | Lab → pilot → commercial bridge | Dual view, checklist, tech-transfer export |
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
- Source coverage shows multi-API health, not PubChem-only opacity.  

## Non-goals

- Predictive retrosynthesis competing with commercial tools  
- Closed-loop LIMS / MES execution  
- Paid DB connectors (Reaxys, SciFinder, …)  
- Regulatory submission generation  
- Multi-tenant cloud orgs / collaborative editing  
- Claiming 100 GMP-validated plant packages  

## Related docs

| Doc | Role |
|-----|------|
| [design/product-design.md](./design/product-design.md) | Surfaces & IA |
| [design/ux-live-dossier.md](./design/ux-live-dossier.md) | Dossier UX |
| [engineering/architecture.md](./engineering/architecture.md) | Implementation |
| [getting-started.md](./getting-started.md) | Setup |
| [data-model.md](./data-model.md) | Types |
| [security.md](./security.md) | Secrets |
