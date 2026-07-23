# Getting started

## Prerequisites

- Node.js 20+ recommended  
- npm 10+  
- Optional: [Ollama Cloud](https://ollama.com) API key for AI synthesis  

## Install & run

```bash
git clone https://github.com/kevinkicho/chemistry_recipes.git
cd chemistry_recipes
cp .env.example .env
# Edit .env — set OLLAMA_CLOUD_API_KEY if desired

cd web
npm install
npm run dev
```

Visit http://localhost:3000

## Environment variables

Create **repo-root** `.env` (never commit it):

```env
OLLAMA_CLOUD_API_KEY=your_key_here
# optional:
# OLLAMA_CLOUD_MODEL=gpt-oss:120b
# OLLAMA_CLOUD_FAST_MODEL=gpt-oss:120b
# PATENTSVIEW_API_KEY=
```

Next.js loads the root file via `web/next.config.ts`. Restart `npm run dev` after changes.

### Browser AI settings

Header **AI** opens the settings modal:

- Paste a browser-only key (localStorage), or rely on server `.env`
- **Refresh models** lists Ollama Cloud tags
- Primary + fast model selections apply on the next dossier stream

## First workflows

1. **Packages** — open `/packages`, filter by modality (e.g. mAb), open a package for unit ops + educational parameters.  
2. **Tier-A example** — home page → Aspirin / Sitagliptin dual-view.  
3. **Live build** — Search `ibuprofen` or CID `3672` → watch SSE progress → export tech-transfer JSON.  
4. **Workspace** — pin dossiers with **+ Project**, export/import project JSON.  
5. **Compare** — `/compare` with two CIDs or example ids.

## Tests

```bash
cd web
npm test
```

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| AI always skipped | Missing `OLLAMA_CLOUD_API_KEY` or low evidence score |
| Empty models list | Key invalid / no network to ollama.com |
| Stale dossier content | Click **Refresh live data** (IndexedDB schema bump) |
| Patents thin | Optional `PATENTSVIEW_API_KEY` not set |
| Env not loaded | `.env` not at repo root, or dev server not restarted |

## Production build

```bash
cd web
npm run build
npm start
```

Set secrets in the host environment (Vercel/env panel), not in git.
