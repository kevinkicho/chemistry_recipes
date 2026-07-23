# Getting started

## Prerequisites

- Node.js 20+ recommended  
- npm 10+  
- Optional: [Ollama Cloud](https://ollama.com) API key **or** [local Ollama](https://ollama.com/download) for dual-view AI synthesis  

## Install & run

```bash
git clone https://github.com/kevinkicho/chemistry_recipes.git
cd chemistry_recipes
cp .env.example .env
# Edit .env — Cloud key and/or local OLLAMA_HOST

cd web
npm install
npm run dev
```

Visit http://localhost:3000

Full documentation index: [README.md](./README.md)

## Environment variables

Create **repo-root** `.env` (never commit it):

```env
# Cloud AI (optional)
OLLAMA_CLOUD_API_KEY=your_key_here
# OLLAMA_CLOUD_MODEL=gpt-oss:120b
# OLLAMA_CLOUD_FAST_MODEL=gpt-oss:120b
# OLLAMA_CLOUD_HOST=https://ollama.com

# Local Ollama for server-side synthesis without a cloud key (optional)
# OLLAMA_HOST=http://127.0.0.1:11434
# OLLAMA_MODEL=llama3.1

# Optional USPTO PatentsView
# PATENTSVIEW_API_KEY=
```

Restart `npm run dev` after env changes.

### Browser AI settings

Header **AI**:

- **Ollama Cloud** — API key (or rely on server `.env`)  
- **Local Ollama** — no key; default host `http://127.0.0.1:11434`  
- Primary + fast model for the next dossier stream  

Engineering detail: [engineering/ai-and-ollama.md](./engineering/ai-and-ollama.md)

## First workflows

1. **Packages** — `/packages`, filter by modality, open unit ops + parameters.  
2. **Tier-A example** — home → Aspirin / Sitagliptin dual-view.  
3. **Live build** — Search a name or CID → SSE progress → evidence score + coverage.  
4. **Compare** — `/compare` with two CIDs (open each once for cache) → dual export.  
5. **Diagnostics** — `/diagnostics` free-API probes + IndexedDB health.  
6. **Sources** — `/sources` wired vs planned free APIs.  
7. **Workspace** — pin with **+ Project** (local only).

## Tests

```bash
cd web
npm test
npx tsc --noEmit
```

See [engineering/testing.md](./engineering/testing.md).

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| AI always skipped | No cloud key / local host, or low evidence score |
| Host not allowed | AI host outside ollama.com / loopback / private LAN |
| Empty models (local) | `ollama serve` not running or no model pulled |
| Empty models (cloud) | Invalid key / network to ollama.com |
| Stale dossier | **Refresh live data** (schema bump discards old cache) |
| Patents thin | Optional `PATENTSVIEW_API_KEY` |
| Env not loaded | `.env` not at repo root, or dev server not restarted |

## Production build

```bash
cd web
npm run build
npm start
```

Set secrets in the host environment, not in git. See [security.md](./security.md).

## Docs map

| Area | Start |
|------|--------|
| Design | [design/README.md](./design/README.md) |
| Engineering | [engineering/README.md](./engineering/README.md) |
| Product law | [product-vision.md](./product-vision.md) |
