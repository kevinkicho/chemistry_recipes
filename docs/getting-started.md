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

# Firebase (Auth / Firestore / RTDB / Storage) — see .env.example
# NEXT_PUBLIC_FIREBASE_API_KEY=…
# NEXT_PUBLIC_FIREBASE_PROJECT_ID=chemistryrecipes
# GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase/chemistryrecipes-firebase-adminsdk-….json
# FIREBASE_ADMIN_PROJECT_ID=chemistryrecipes
```

Restart `npm run dev` after env changes.

### Firebase

| Product | Status |
|---------|--------|
| Auth (Google) | Header **Google sign-in** · enable provider in Console |
| Firestore / RTDB / Storage | Client + Admin helpers · **rules deny all** until product models need access |
| Admin SDK | Place JSON under `secrets/firebase/` (gitignored) · probe `GET /api/diagnostics/firebase` |
| App Hosting | `firebase.json` → `rootDir: "web"` · config `web/apphosting.yaml` · use ADC, not baked JSON |
| Functions | `functions/` · deploy with Firebase CLI |

```text
secrets/firebase/chemistryrecipes-firebase-adminsdk-….json   # never commit
```

Prefer `web/.env.local` for Next-visible `NEXT_PUBLIC_*` vars (and a relative Admin path `../secrets/firebase/...` when cwd is `web/`). Details: [secrets/README.md](../secrets/README.md) · [security.md](./security.md).

### Browser AI settings

Header **AI**:

- **Ollama Cloud** — API key (or rely on server `.env`)  
- **Local Ollama** — no key; default host `http://127.0.0.1:11434`  
- Primary + fast model for the next dossier stream  

Engineering detail: [engineering/ai-and-ollama.md](./engineering/ai-and-ollama.md)

## First workflows

1. **Packages** — `/packages`, filter by modality, open unit ops + parameter frameworks.  
2. **Info (for-show)** — `/info` · curated Tier-A examples, mock packages, and design demos only (isolated from live nav).  
3. **Live build** — `/search` (browser-first PubChem when possible) → open a CID → SSE dossier → evidence score + coverage.  
4. **Compare** — `/compare` with two CIDs (open each once for cache) → dual export.  
5. **Diagnostics** — `/diagnostics` free-API probes + IndexedDB health + Firebase probe.  
6. **Sources** — `/sources` wired vs planned free APIs.  
7. **Workspace** — pin with **+ Project** (local only, not multi-user collab).

## Tests

```bash
cd web
npm test
npx tsc --noEmit
```

See [engineering/testing.md](./engineering/testing.md).

## Search & PubChem notes

- **Browser-first search** prefers the user's network for PubChem PUG (Cloud Run egress often returns HTTP 503 to NIH).  
- Server `/api/search/pubchem` remains a fallback; soft failures surface hub/package matches when possible.  
- Live dossier gather continues multi-API harvest even if PubChem identity fails (hub catalog or CID-only name).  

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| AI always skipped | No cloud key / local host, or low evidence score |
| Host not allowed | AI host outside ollama.com / loopback / private LAN |
| Empty models (local) | `ollama serve` not running or no model pulled |
| Search “PubChem busy / 503” | NIH or Cloud egress; try again, use CID, or open a hub twin |
| Admin Firebase probe fails | Missing `secrets/firebase/*.json` or wrong `GOOGLE_APPLICATION_CREDENTIALS` path |
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
