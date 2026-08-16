# Chemistry Recipes

**Evidence-first process recipe hub** for pharmaceutical, clinical, and biotech manufacturing teams.

Free public chemical APIs + optional [Ollama Cloud](https://docs.ollama.com/cloud) or **local Ollama** synthesis. Live densify → dual views (mechanism + manufacturing). MSAT campaigns, role packs, tech-transfer exports.

> **Not GMP. Not regulatory decision support. Not a batch record or clinical protocol.**  
> Literature-typical parameter envelopes are **teaching scaffolds only** — validate under your site QMS.  
> **Not** a multi-user collaborative workspace — local-first only.

**Repository:** [github.com/kevinkicho/chemistry_recipes](https://github.com/kevinkicho/chemistry_recipes)

---

## Documentation (start here)

**Full table of contents:** [docs/README.md](docs/README.md)

| Area | Entry point |
|------|-------------|
| **Getting started** | [docs/getting-started.md](docs/getting-started.md) |
| **Product vision & law** | [docs/product-vision.md](docs/product-vision.md) |
| **Design** | [docs/design/README.md](docs/design/README.md) |
| **Engineering** | [docs/engineering/README.md](docs/engineering/README.md) |
| **Security / secrets** | [docs/security.md](docs/security.md) |
| **Data model** | [docs/data-model.md](docs/data-model.md) |
| **API sources** | [docs/api-sources-manifest.md](docs/api-sources-manifest.md) |

### Design docs

| Doc | Description |
|-----|-------------|
| [Product design](docs/design/product-design.md) | Information architecture, tiers, personas |
| [Live dossier UX](docs/design/ux-live-dossier.md) | Recipe-first layout, dual views, trust UI |
| [Export & tech-transfer UX](docs/design/export-and-transfer.md) | Print, JSON packs, compare, checklist |

### Engineering docs

| Doc | Description |
|-----|-------------|
| [Architecture](docs/engineering/architecture.md) | Stack, modules, routes |
| [Dossier pipeline](docs/engineering/dossier-pipeline.md) | Gather → score → shell → Ollama → enrich |
| [Process facts & accuracy](docs/engineering/process-facts-accuracy.md) | Sourced manufacturing atoms, public process brief |
| [Multi-source APIs](docs/engineering/multi-source-apis.md) | Wired free APIs, registry, probes |
| [AI & Ollama](docs/engineering/ai-and-ollama.md) | Cloud + local hosts, proxies, quality gate |
| [Frontier science](docs/engineering/frontier-science.md) | Densify-first AI guidance, campaigns, agents |
| [Client storage](docs/engineering/client-storage.md) | IndexedDB cache, snapshots, health |
| [Tech-transfer export](docs/engineering/tech-transfer-export.md) | Schema v2, MES/LIMS, validation checklist |
| [Testing](docs/engineering/testing.md) | Precommit gate + contract suites |
| [Test specification](docs/engineering/test-spec.md) | REQ matrix (ACC…PROV, densify, nav abort) |
| [Provenance coverage](docs/engineering/provenance-coverage-spec.md) | API/AI chip registry for every content card |

---

## Screenshots

<div align="center">

<table>
  <tr>
    <td align="center" width="50%" valign="top">
      <a href="screenshots/Screenshot%202026-07-23%20094203.png">
        <img
          src="screenshots/Screenshot%202026-07-23%20094203.png"
          alt="Chemistry Recipes — dossier and process UI"
          width="100%"
        />
      </a>
      <br />
      <sub><b>Live densify dossier</b> — dual-view process intelligence</sub>
    </td>
    <td align="center" width="50%" valign="top">
      <a href="screenshots/Screenshot%202026-07-23%20094236.png">
        <img
          src="screenshots/Screenshot%202026-07-23%20094236.png"
          alt="Chemistry Recipes — search and workspace navigation"
          width="100%"
        />
      </a>
      <br />
      <sub><b>Search + workspace</b> — problem-first MSAT path and campaigns</sub>
    </td>
  </tr>
</table>

</div>

---

## Features

| Area | What you get |
|------|----------------|
| **Live dossiers** | Multi free APIs (PubChem, ChEMBL, openFDA, CompTox, DailyMed, Europe PMC, OpenAlex, Crossref, Semantic Scholar, patents, …) → evidence score → optional Ollama dual-view routes |
| **Densify-first harvest** | Process-ranked OA full text, patent procedure windows, OrgSyn/ORD excerpts kept on the live dossier for AI ingest (not paper previews) |
| **Frontier science** | Condition atlas, route hypotheses, reaction network, process-knowledge + **AI guidance** packages (`ingestScore`, densify-next) |
| **Science / campaign agents** | Quote-bound Q&A over densified packages; optional Ollama; multi-CID campaign merge + densify queue |
| **Trust UI** | Evidence score explainer, source coverage map, transfer readiness checklist, API + AI provenance chips |
| **MSAT journey** | Problem / unit-op search → campaign densify → impurity neighborhood → brief + agent + role pack |
| **Ideal parity** | Live score (0–100) toward dual-view inventory — no curated mock dossiers in the live app |
| **Parameters** | Modality frameworks (mAb, fermentation, peptide, gene therapy, …) with fill-status honesty |
| **Compare** | Side-by-side CIDs + dual tech-transfer export |
| **Export** | Print/PDF, tech-transfer JSON **v2**, agent pack, role pack, MES/LIMS-style rows |
| **AI** | Ollama Cloud **or** local Ollama (no key on loopback); agents never invent plant numbers |
| **Diagnostics** | Live API probes, Ollama readiness, IndexedDB health, densify telemetry, cold-CID KPI floors |

---

## Quick start

```bash
git clone https://github.com/kevinkicho/chemistry_recipes.git
cd chemistry_recipes
cp .env.example .env   # OLLAMA_CLOUD_API_KEY and/or OLLAMA_HOST for local
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Step-by-step and troubleshooting: **[docs/getting-started.md](docs/getting-started.md)**

### Environment (secrets stay local)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OLLAMA_CLOUD_API_KEY` | For Cloud AI | Ollama Cloud API key |
| `OLLAMA_HOST` | For local AI | e.g. `http://127.0.0.1:11434` |
| `OLLAMA_CLOUD_MODEL` / `OLLAMA_MODEL` | No | Primary model default |
| `OLLAMA_CLOUD_FAST_MODEL` | No | Thin-evidence draft model |
| `PATENTSVIEW_API_KEY` | No | USPTO PatentsView |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local Admin only | Path to service-account JSON under `secrets/firebase/` |
| `NEXT_PUBLIC_FIREBASE_*` | For Auth/client | See `.env.example` |

- Copy **`.env.example`** → **`.env`** at the **repo root** (gitignored).  
- Put Firebase Admin JSON in **`secrets/firebase/`** (never commit; see [secrets/README.md](secrets/README.md)).  
- Never commit `.env`, `*.pem`, private keys, or credential JSON.  
- Browser Settings → **AI**: Cloud or Local provider (localStorage only).  
- Details: [docs/security.md](docs/security.md) · [docs/engineering/ai-and-ollama.md](docs/engineering/ai-and-ollama.md)

---

## App routes

| Path | Purpose |
|------|---------|
| `/` | Home · live densify entry + problem-first MSAT journey |
| `/search` | Multi-source + PubChem (name, CAS, SMILES, InChI, InChIKey, UNII, CID) |
| `/workspace` | Local projects, science campaigns, graph, agents, densify telemetry |
| `/compare` | Side-by-side recipes + dual export |
| `/diagnostics` | API probes, Ollama readiness, IndexedDB + cold-CID KPI floors |
| `/sources` | Free public API registry (wired expand/collapse) |
| `/compounds/pubchem/[cid]` | Live densify dossier (+ Monday path + frontier science lab) |
| `/packages`, `/info`, `/examples/*`, `/catalog` | Redirect to search (curated mocks retired from live product) |
| Header **AI** | Ollama Cloud or local settings / model picker |
| `POST /api/ai/science` | Quote-bound single-CID science agent (± densify neighbors, ± Ollama) |
| `POST /api/ai/campaign` | Multi-CID densify + campaign agent (± Ollama over AI guidance) |

### Deploy (Firebase App Hosting)

| Piece | Value |
|-------|--------|
| App root | **`web/`** (`firebase.json` → `apphosting.rootDir`) |
| Config | `web/apphosting.yaml` |
| Status CLI | `cd web && npm run status:deploy` |
| Docs | [docs/engineering/deploy-status.md](docs/engineering/deploy-status.md) |

---

## Live dossier pipeline

1. **Harvest** — multi free APIs (not PubChem-only)  
2. **Score** — evidence richness; gates AI  
3. **Shell** — early UI (no fake IPC placeholders)  
4. **Ollama** — dual-view routes when warranted; quality gate  
5. **Enrich** — modality, related entities, contradictions, unit-op fill, parameters, build audit  
6. **Export** — tech-transfer v2 / MES-LIMS / print  

Caches in **IndexedDB**. **Refresh live data** or History ↻ rebuilds (schema versioned).

Deep dive: [docs/engineering/dossier-pipeline.md](docs/engineering/dossier-pipeline.md)

---

## Scripts

```bash
cd web
npm run dev              # Next.js dev server
npm run build            # production build
npm test                 # unit / contract integrity (offline)
npm run test:coverage    # unit + free-API smoke + tsc + eslint
npm run test:all         # coverage + production build
npm run test:smoke       # live free-API probes (soft if offline)
npm run test:smoke:strict
npx tsc --noEmit
```

See [docs/engineering/testing.md](docs/engineering/testing.md).

---

## Product law

1. Free public APIs only (government / research)  
2. No paid database connectors  
3. No invented process content without evidence + **AI / editorial** labels  
4. Provenance shows real HTTP captures only  
5. **Not** GMP, DMF, CTD, batch records, or clinical decision support  
6. Literature-typical parameters are teaching envelopes — never site limits  
7. Live densify is free-public evidence only — never validated plant packages or GMP  

8. Local-first — **not** multi-tenant collaboration  

Full vision: [docs/product-vision.md](docs/product-vision.md)

### Parameter fill status

| Status | Meaning |
|--------|---------|
| `literature-typical` | Public teaching envelope — **not validated** |
| `site-fill-required` | Your QMS / validation only |
| `evidence-only` | Only when free-public evidence supports it |
| `template-empty` | Left blank on purpose |

---

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4  
- Free APIs: PubChem, ChEMBL, MyChem, openFDA, RxNorm, KEGG, CompTox, DailyMed, Europe PMC, OpenAlex, Crossref, Semantic Scholar, PatentsView (optional key)  
- Optional AI: Ollama Cloud (`ollama.com`) or local Ollama  

---

## License / use

**MIT License** — see [LICENSE](./LICENSE).

| | |
|--|--|
| **Copyright** | © 2026 Kevinkicho |
| **Code authorship** | **Grok 4.5 (xAI)** wrote the application source code in this repository |
| **License** | MIT — free to use, modify, and distribute with notice |

Educational and professional **scaffold**. Validate every claim against primary public sources and your site quality system before any manufacturing or clinical use.

No warranty. Not a medical device. Not prescribing information.
