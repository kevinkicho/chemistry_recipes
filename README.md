# Chemistry Recipes

**Evidence-first process recipe hub** for pharmaceutical, clinical, and biotech manufacturing teams.

Free public chemical APIs + optional [Ollama Cloud](https://docs.ollama.com/cloud) synthesis. Dual views (mechanism + manufacturing). Educational process packages. Tech-transfer exports.

> **Not GMP. Not regulatory decision support. Not a batch record or clinical protocol.**  
> Literature-typical parameter envelopes are **teaching scaffolds only** — validate under your site QMS.

**Repository:** [github.com/kevinkicho/chemistry_recipes](https://github.com/kevinkicho/chemistry_recipes)

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
      <sub><b>Live / example dossier</b> — dual-view process intelligence</sub>
    </td>
    <td align="center" width="50%" valign="top">
      <a href="screenshots/Screenshot%202026-07-23%20094236.png">
        <img
          src="screenshots/Screenshot%202026-07-23%20094236.png"
          alt="Chemistry Recipes — packages and navigation UI"
          width="100%"
        />
      </a>
      <br />
      <sub><b>Hub workspace</b> — packages, search, and navigation</sub>
    </td>
  </tr>
</table>

</div>

---

## Features

| Area | What you get |
|------|----------------|
| **Live dossiers** | PubChem identity + PUG View, Europe PMC, OpenAlex, patents → scored evidence → optional Ollama dual-view routes |
| **~140 packages** | Curated educational packages (`/packages`) by modality & role |
| **Tier-A examples** | Deep dual-view dossiers (aspirin, sitagliptin, penicillin G, amoxicillin, …) |
| **Parameters** | Modality frameworks (mAb, fermentation, peptide, gene therapy, …) with fill-status honesty |
| **Compare / workspace** | Route compare, dual-monitor launcher, local projects (import/export JSON) |
| **Export** | Print/PDF, tech-transfer JSON, MES/LIMS-style rows |
| **Provenance** | Real HTTP API chips + AI prompt/data/model chips |

---

## Quick start

```bash
git clone https://github.com/kevinkicho/chemistry_recipes.git
cd chemistry_recipes
cp .env.example .env   # add OLLAMA_CLOUD_API_KEY if you want AI synthesis
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment (secrets stay local)

| Variable | Required | Purpose |
|----------|----------|---------|
| `OLLAMA_CLOUD_API_KEY` | For AI | Ollama Cloud API key |
| `OLLAMA_CLOUD_MODEL` | No | Primary model default |
| `OLLAMA_CLOUD_FAST_MODEL` | No | Thin-evidence draft model |
| `PATENTSVIEW_API_KEY` | No | USPTO PatentsView |

- Copy **`.env.example`** → **`.env`** at the **repo root** (gitignored).
- Never commit `.env`, `*.pem`, private keys, or credential JSON.
- Browser Settings → **AI** can override models (localStorage only).

---

## App routes

| Path | Purpose |
|------|---------|
| `/` | Home + Tier-A examples |
| `/packages` | ~140 educational process packages |
| `/packages/[id]` | Package: unit ops + parameter framework |
| `/catalog` | Faceted hub (examples + live pointers) |
| `/search` | PubChem (name, CAS, SMILES, InChIKey, UNII, CID) |
| `/workspace` | Local project library |
| `/compare` | Launch two recipes (dual monitor) |
| `/sources` | Free public API registry |
| `/compounds/pubchem/[cid]` | Live dossier stream |
| `/examples/[id]` | Curated dual-view dossier |
| Header **AI** | Ollama Cloud settings / model picker |

---

## Live dossier pipeline

1. **Harvest** — PubChem, PUG View, Europe PMC (process-ranked), OpenAlex, patents  
2. **Score** — evidence richness; gates AI  
3. **Shell** — early UI (no fake IPC placeholders)  
4. **Ollama** — dual-view routes when warranted; quality gate  
5. **Enrich** — modality, related entities, contradictions, unit-op fill, parameters, build audit  
6. **Export** — tech-transfer / MES-LIMS / print  

Caches in **IndexedDB**. **Refresh live data** or History ↻ rebuilds (schema versioned).

---

## Scripts

```bash
cd web
npm run dev           # Next.js dev server
npm run build         # production build
npm test              # evidence + hub contract tests
npm run test:evidence
npm run test:hub
```

---

## Product law

1. Free public APIs only (government / research)  
2. No paid database connectors  
3. No invented process content without evidence + **AI / editorial** labels  
4. Provenance shows real HTTP captures only  
5. **Not** GMP, DMF, CTD, batch records, or clinical decision support  
6. Literature-typical parameters are teaching envelopes — never site limits  
7. Package catalog is educational structure, not validated plant packages  

### Parameter fill status

| Status | Meaning |
|--------|---------|
| `literature-typical` | Public teaching envelope — **not validated** |
| `site-fill-required` | Your QMS / validation only |
| `evidence-only` | Only when free-public evidence supports it |
| `template-empty` | Left blank on purpose |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/product-vision.md](docs/product-vision.md) | Positioning, personas, non-goals |
| [docs/architecture.md](docs/architecture.md) | Stack, data flow, key modules |
| [docs/getting-started.md](docs/getting-started.md) | Setup, env, troubleshooting |
| [docs/data-model.md](docs/data-model.md) | Process / recipe types |
| [docs/api-sources-manifest.md](docs/api-sources-manifest.md) | Free public API registry notes |
| [docs/security.md](docs/security.md) | Secrets, .env, what is never committed |

---

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4  
- Free APIs: PubChem, Europe PMC, OpenAlex, PatentsView (optional key)  
- Optional AI: Ollama Cloud (`ollama.com`)  

---

## License / use

Educational and professional **scaffold**. Validate every claim against primary public sources and your site quality system before any manufacturing or clinical use.

No warranty. Not a medical device. Not prescribing information.
