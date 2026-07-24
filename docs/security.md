# Security & secrets

## Never commit

The root [`.gitignore`](../.gitignore) excludes:

- All `.env` variants (except `.env.example`)  
- Private keys and certificates (`*.pem`, `*.key`, `id_rsa`, …)  
- Credential JSON dumps  
- **Firebase Admin SDK** service-account JSON (`*firebase-adminsdk*.json`)  
- Local npm auth (`.npmrc`)  
- `node_modules/`, `.next/`, build artifacts  

## Firebase

| Artifact | Safe to commit? | Notes |
|----------|-----------------|--------|
| `NEXT_PUBLIC_FIREBASE_*` in `.env` | No (`.env` ignored); values are public-by-design in client bundles | Restrict authorized domains in Console |
| Admin SDK `*-firebase-adminsdk-*.json` | **Never** | Local path via `GOOGLE_APPLICATION_CREDENTIALS` |
| Firestore / RTDB / Storage rules | Yes | Tighten before open access expires |
| Google web API key | Client-visible | App Check + domain restrictions recommended |

Local Admin probe (no secrets returned): `GET /api/diagnostics/firebase`.

Code: `web/src/lib/firebase/*`, App Hosting root `web/` (`firebase.json` → `apphosting.rootDir`).

## Recommended practice

1. Copy `.env.example` → `.env` and fill secrets locally.  
2. Use host secret stores for deploy (never bake keys into images).  
3. Prefer server `.env` for dossier synthesis; browser keys are optional overrides (localStorage).  
4. Rotate any key pasted into chat logs or screenshots.  
5. Before `git add -A`, run `git status` and confirm no `.env` or key files appear.  

## What the app stores in the browser

| Storage | Contents | Sensitive? |
|---------|----------|------------|
| `localStorage` AI config | Optional API key, provider, host, models | **Yes** if user pastes a Cloud key |
| `localStorage` workspace / history | Project pins, search labels | Low |
| IndexedDB dossiers + snapshots | Public-source composites + optional AI text | Public + generated content |

Clear site data to wipe local keys and caches. Operator UI: `/diagnostics` → IndexedDB health / clear cache.

Detail: [engineering/client-storage.md](./engineering/client-storage.md)

## API proxy rules

`/api/ai/chat` and `/api/ai/models`:

| Host class | Allowed | Auth |
|------------|---------|------|
| `https://ollama.com` | Yes | Bearer required (request or env) |
| Loopback / private LAN Ollama | Yes (http or https) | Optional |
| Everything else | **Rejected** (SSRF) | — |

- Request Bearer wins over env key when present.  
- Local mode may omit Authorization.  
- `/api/ai/status` never returns raw keys.  

Implementation: `lib/ai/config.ts` (`isAllowedOllamaHost`), `app/api/ai/*`.  
Full AI notes: [engineering/ai-and-ollama.md](./engineering/ai-and-ollama.md)

## Diagnostics

`/api/diagnostics` returns key **presence**, length, host, provider — never secret material. Probes hit public endpoints only.

## Reporting

If a secret is committed by mistake: revoke the key immediately, purge git history if needed, and issue a new key.
