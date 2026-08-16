# Chemistry Recipes — Product Vision

**Working title:** Chemistry Recipes  
**Positioning:** Evidence-first process recipe hub for pharmaceutical, clinical, and biotech production teams — dual views (mechanism + manufacturing), multi-modality templates, educational parameter scaffolds, tech-transfer export.  
**Not** regulatory decision support. **Not** GMP certification. **Not** a multi-tenant collaborative workspace.

**Repo:** https://github.com/kevinkicho/chemistry_recipes  

**Docs index:** [README.md](./README.md) · **Design:** [design/README.md](./design/README.md) · **Engineering:** [engineering/README.md](./engineering/README.md)

## Product law

1. **Evidence-first, not GMP certification.** Content is a *production guide scaffold* for trained process teams. Plants validate under their own quality systems.  
2. **Free public sources + optional AI structure only.** Identity, hazards, literature, and patents from free APIs; manufacturing views are densified evidence and/or AI-synthesized with explicit provenance. **No mock plant dossiers or curated teaching packages.**  
3. **Dual audience, dual views.** Mechanism (R&D) and manufacturing (plant) share step IDs.  
4. **Scale-up ready language.** Industrial units, equipment *classes*, operating envelopes.  
5. **No regulatory decision support.** Not a substitute for FDA/EMA filings, DMF, or batch record approval.  
6. **No invented site limits.** Literature-typical parameters (modality frameworks) are educational envelopes only.  
7. **Local-first.** IndexedDB + local projects; no collab multi-user backend.  
8. **Live densify ideal inventory.** `idealParity` (0–100) measures dual-view depth (recipe, BOM, apparatus, environment, EHS, related entities) from free-public densify + grounded AI — never inventing plant numbers.  
9. **Frontier science = process knowledge, not cosmetic dossiers.** Condition-space atlases, competing route hypotheses with kill criteria, evidence-only Q&A, and next-experiment suggestions — exported as `process-knowledge.v1`.

## Ideal page (north star)

The **live densify dual-view inventory** is the product’s ideal page: process recipe, manufacturing narrative, plant environment, apparatus, EHS, related materials, and control cues — filled only from free-public densify and grounded AI.

Live builds measure progress with **`idealParity`** (0–100). Thin dossiers stay honest (**scout** / evidence-lead); densify and paste public experimental text raise depth.

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
| **Thin-CID auto-queue** | Densify missing or &lt;2 atlas obs from preflight (agent + graph) |
| **Agent + knowledge export** | `campaign-knowledge.v1` optional `agentRun` (Q&A + steps + experiments) |
| **Stream densify ideal delta** | Before→after Ideal score per CID on batch/stream densify |
| **Paste ideal delta** | After local procedure paste: Ideal score and process-fact before→after |
| **Densify quality audit** | Procedure chars, OA/patent windows, atlas obs, hypotheses on build audit |
| **Densify telemetry** | Local concurrency / ok-fail / duration history (incl. campaign-server) |
| **Knowledge fingerprint** | Skip process-knowledge rebuild when densify inputs unchanged |
| **Batch cache skip** | Warm IndexedDB hits skip server rebuild (12h, force override) |
| **Transient retries** | Per-CID exponential backoff on timeout/5xx during batch densify |
| **Local-first science agent** | Answer from in-page package without full server pipeline when possible |
| **Workspace science index** | Cross-campaign densify inventory, condition-kind histogram, global thin queue |
| **Campaign scientific brief** | Depth score, per-CID condition spans, cross-CID range conflicts, research experiments |
| **Auto-ask after queue densify** | Campaign agent densifies thin CIDs then answers the open question |
| **Deeper atlas extractors** | Concentration, molar-ratio, expanded solvents/atmosphere from free-public text |
| **Literature densify depth** | Rank OA/patent windows by procedure richness; atlas prefers high-score text |
| **Campaign route hypotheses** | Shared multi-CID unit-op / step patterns with kill criteria |
| **Problem → campaign** | Spin local science campaign from problem-first / unit-op live hits |
| **Notebook Markdown export** | Brief + atlas + routes + process-knowledge as `.md` for agents/notebooks |
| **Neighbor densify graph** | Impurity-first related-entity densify queue + impurity campaigns |
| **ORD → campaign bridge** | Local ORD snippets → densify paste + spin multi-CID science campaign |
| **Campaign ideal rollup** | Mean/min/max Ideal score + section heatmap + weak-CID densify |
| **Multi-source search** | Identity APIs + openFDA + KEGG + process lit (EPMC, OpenAlex, Crossref, S2, PubMed, arXiv) |
| **Multi-source autocomplete** | Combobox: PubChem + RxNorm + openFDA via `/api/search/suggest` |
| **Problem multi-source** | Unit-op search + live multi CIDs + process papers via `/api/search/problem` |
| **Problem densify queue** | Spin campaign + stream densify CIDs from problem hits in one click |
| **Problem → agent handoff** | After densify, open Workspace campaign agent with auto-ask question |
| **Literature → paste densify** | Attach process papers as local CID pastes; rematerialize IDB packages |
| **Problem → brief + agent** | Handoff opens scientific brief then auto-runs campaign agent |
| **Dossier lit/patent paste** | One-click densify paste from literature & patents tables |
| **Problem densify notebook** | Markdown export of problem hits, lit pastes, densify results |
| **OA full-text before paste** | Europe PMC OA fetch when PMCID present, denser densify pastes |
| **Notebook + agent answer** | Session draft stores densify run; agent answer appended after handoff |
| **Related-entity CID resolve** | Name/CAS → free-public PubChem fill for missing related CIDs |
| **Campaign compare** | Side-by-side densify/ideal/lit-depth metrics for two campaigns |

## User journeys

| Persona | Goal | Primary UI |
|---------|------|------------|
| Process / manufacturing chemist | Stand up or improve a route | Manufacturing view, BOM, equipment, EHS |
| Organic / R&D chemist | Understand how the molecule is made | Mechanism view, literature |
| Tech transfer / MSAT | Lab → pilot → commercial bridge | Dual view, checklist, tech-transfer export |
| Biotech MSAT | Modality unit ops + educational CQAs | MSAT journey, modality templates, parameter panels |

## Content depth (live only)

| Depth | Coverage | Source |
|-------|----------|--------|
| **Recipe draft** | Dual-view routes, BOM cues, apparatus classes, EHS | Dense free-public densify + grounded AI |
| **Scout dossier** | Identity + evidence map + process leads | Live multi-API harvest |
| **Thin / identity** | CID resolve, hazards, sparse lit | Soft-fail free APIs |

## Success metrics

- Time from “I need to make X” → densified scout + equipment cues &lt; 2 minutes on warm public sources.  
- Every manufacturing claim has provenance or an explicit AI/editorial label.  
- Dual views never contradict (shared step IDs).  
- Parameter tables never present site-fill fields as invented numbers.  
- Source coverage shows multi-API health, not PubChem-only opacity.  
- Cold-CID KPI floors pass on golden densify set (no mock hub).  

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
