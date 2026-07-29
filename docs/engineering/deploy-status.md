# Deploy status: Git push + App Hosting

## Quick checks

```bash
# Full workstation report (git + App Hosting REST + live HTTP)
npm run status:deploy
# JSON for scripts/CI
npm run status:deploy:json

# Lightweight HTTP API (live probe + GitHub main tip)
curl -s http://localhost:3000/api/diagnostics/deploy | jq .
```

Requires for full CLI report:

- `git` remote `origin`
- `gcloud auth login` (or ADC) for App Hosting builds/rollouts

## Architecture (this repo)

| Piece | Value |
|-------|--------|
| GitHub | `kevinkicho/chemistry_recipes` · branch `main` |
| Firebase project | `chemistryrecipes` |
| App Hosting backend | `chemrecipe` |
| Live URL | https://chemrecipe--chemistryrecipes.us-central1.hosted.app |
| App root | **`web/`** (`firebase.json` → `apphosting.rootDir`) |
| Config | `web/apphosting.yaml` |

## Known failure mode (2026-07-24)

1. Backend was created with `codebase.rootDirectory: "/"` (repo root).  
2. Root `package.json` runs `npm run build --prefix web` **without** installing `web/node_modules`.  
3. Cloud Build log: `sh: 1: next: not found` → build **FAILED**, rollout **FAILED**, live site **HTTP 404**.  
4. Fix: set root directory to **`web`**, then create a new rollout.

```bash
# After rootDir is web (Console or REST PATCH):
npx firebase-tools@latest apphosting:rollouts:create chemrecipe -b main -f --project chemistryrecipes
```

Build logs example:

`https://console.cloud.google.com/cloud-build/builds;region=us-central1/<BUILD_ID>?project=959359907375`

Console: https://console.firebase.google.com/project/chemistryrecipes/apphosting

## What “healthy” looks like

| Signal | Healthy |
|--------|---------|
| `git` ahead of origin/main | `0` |
| Latest App Hosting build | `READY` / `SUCCEEDED` |
| Latest rollout | `SUCCEEDED` / `ACTIVE` |
| Live URL | HTTP 200, Chemistry Recipes HTML |
| `rootDirectory` | `web` (matches monorepo Next app) |

## Secrets on App Hosting

- **Do not** commit or bake Admin SDK JSON into the image.  
- Prefer Cloud Run / App Hosting **Application Default Credentials**.  
- Optional secrets: `firebase apphosting:secrets:set …` and reference them from `apphosting.yaml`.  
- Local dev only: `secrets/firebase/*-firebase-adminsdk-*.json` + `GOOGLE_APPLICATION_CREDENTIALS` (see [../security.md](../security.md)).

## Uncommitted local work

App Hosting only builds **pushed** GitHub commits. Local changes do not deploy until committed and pushed to `main` (or the connected branch).

## Manual rollout (after push to main)

```bash
# Pre-flight
cd web && npm test && npx tsc --noEmit
cd .. && git push origin main

# Create App Hosting rollout for backend chemrecipe from main
npx -y firebase-tools@latest apphosting:rollouts:create chemrecipe \
  --git-branch main \
  --force \
  --project chemistryrecipes

# Status
npm run status:deploy
```

Live: https://chemrecipe--chemistryrecipes.us-central1.hosted.app
