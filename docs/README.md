# Chemistry Recipes — Documentation

Evidence-first process recipe hub (not GMP / not regulatory decision support).

**Repository:** [github.com/kevinkicho/chemistry_recipes](https://github.com/kevinkicho/chemistry_recipes)  
**App root:** [`web/`](../web/) · **Screenshots:** [`../screenshots/`](../screenshots/)

---

## Table of contents

### Start here

| Doc | Description |
|-----|-------------|
| [Getting started](./getting-started.md) | Install, env vars, first workflows, troubleshooting |
| [Product vision](./product-vision.md) | Positioning, personas, product law, non-goals |
| [Security & secrets](./security.md) | `.env`, host allowlists, browser storage |

### Design (product & UX)

| Doc | Description |
|-----|-------------|
| [Design hub](./design/README.md) | Design table of contents |
| [Product design](./design/product-design.md) | Information architecture, tiers, surfaces |
| [Live dossier UX](./design/ux-live-dossier.md) | Recipe-first layout, dual views, trust UI |
| [Export & tech-transfer UX](./design/export-and-transfer.md) | Print, JSON packs, compare, readiness checklist |

### Engineering (implementation)

| Doc | Description |
|-----|-------------|
| [Engineering hub](./engineering/README.md) | Engineering table of contents |
| [Architecture](./engineering/architecture.md) | Stack, modules, request paths |
| [Dossier pipeline](./engineering/dossier-pipeline.md) | Gather → score → shell → Ollama → enrich |
| [Process facts & accuracy](./engineering/process-facts-accuracy.md) | Sourced manufacturing atoms, public process brief |
| [Multi-source APIs](./engineering/multi-source-apis.md) | Wired free APIs, registry, probes |
| [AI & Ollama](./engineering/ai-and-ollama.md) | Cloud + local hosts, proxies, quality gate |
| [Client storage](./engineering/client-storage.md) | IndexedDB cache, snapshots, health |
| [Tech-transfer export](./engineering/tech-transfer-export.md) | Schema v2, MES/LIMS rows, validation checklist |
| [Testing](./engineering/testing.md) | Unit contracts, API smoke, coverage commands |

### Reference (data & sources)

| Doc | Description |
|-----|-------------|
| [Architecture (overview)](./architecture.md) | Short architecture summary (points to engineering) |
| [Data model](./data-model.md) | Process types, scale, provenance, live extras |
| [API sources manifest](./api-sources-manifest.md) | Free public API inventory notes |
| [Chemistry API sources](./chemistry-api-sources.md) | Extended source notes |
| Machine-readable | [api-sources-manifest.json](./api-sources-manifest.json), [chemistry-api-sources.json](./chemistry-api-sources.json) |

### In-app pages

| Route | Purpose |
|-------|---------|
| `/` | Home + Tier-A examples |
| `/packages` | Educational process packages (~100+) |
| `/search` | PubChem identity search |
| `/compounds/pubchem/[cid]` | Live dossier (SSE build) |
| `/examples/[id]` | Curated dual-view dossier |
| `/compare` | Side-by-side recipes + dual export |
| `/diagnostics` | API probes, Ollama readiness, IndexedDB health |
| `/sources` | Expandable free-API registry (wired vs planned) |
| `/workspace` | Local-only project pins |
| Header **AI** | Ollama Cloud or local Ollama settings |

---

## Product law (summary)

1. Free public APIs only (no paid DB connectors).  
2. No invented process content without evidence + AI/editorial labels.  
3. Provenance chips show real HTTP captures only.  
4. **Not** GMP, DMF, CTD, batch records, or clinical decision support.  
5. Literature-typical parameters are teaching envelopes — never site limits.  
6. Single-user / local-first — **not** a multi-tenant collaborative workspace.

Full law: [product-vision.md](./product-vision.md).

---

## Quick links for contributors

```text
docs/
├── README.md                 ← you are here (TOC)
├── getting-started.md
├── product-vision.md
├── architecture.md
├── data-model.md
├── security.md
├── api-sources-manifest.md
├── chemistry-api-sources.md
├── design/
│   ├── README.md
│   ├── product-design.md
│   ├── ux-live-dossier.md
│   └── export-and-transfer.md
└── engineering/
    ├── README.md
    ├── architecture.md
    ├── dossier-pipeline.md
    ├── multi-source-apis.md
    ├── ai-and-ollama.md
    ├── client-storage.md
    ├── tech-transfer-export.md
    └── testing.md
```
