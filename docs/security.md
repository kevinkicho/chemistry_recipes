# Security & secrets

## Never commit

The root [`.gitignore`](../.gitignore) excludes:

- All `.env` variants (except `.env.example`)
- Private keys and certificates (`*.pem`, `*.key`, `id_rsa`, …)
- Credential JSON dumps (`service-account*.json`, `credentials.json`, …)
- Local npm auth (`.npmrc`)
- `node_modules/`, `.next/`, build artifacts

## Recommended practice

1. Copy `.env.example` → `.env` and fill secrets locally.  
2. Use cloud host secret stores for deploy (never bake keys into the image).  
3. Prefer server `.env` for dossier synthesis; browser keys are optional overrides (localStorage).  
4. Rotate any key that was ever pasted into chat logs or screenshots.  
5. Before `git add -A`, run `git status` and confirm no `.env` or key files appear.

## What the app stores in the browser

| Storage | Contents | Sensitive? |
|---------|----------|------------|
| `localStorage` AI config | Optional API key, model names | **Yes** if user pastes a key — never shared to git |
| `localStorage` workspace | Project pins / notes | Low (user labels) |
| IndexedDB | Cached dossiers + snapshots | Public-source composites; may include AI text |

Clear site data to wipe local keys and caches.

## API proxy rules

- `/api/ai/*` forwards to `https://ollama.com` only (host allow-list).  
- Request Bearer key wins; otherwise server env key.  
- Raw keys are never returned from `/api/ai/status`.

## Reporting

If a secret is committed by mistake: revoke the key immediately, purge git history if needed, and force a new key.
