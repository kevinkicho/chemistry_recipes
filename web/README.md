# Chemistry Recipes — web app

Next.js 15 application for the Chemistry Recipes process hub.

## Develop

From repo root:

```bash
cp .env.example .env   # if not already
cd web
npm install
npm run dev
```

## Tests

```bash
npm test
npx tsc --noEmit
```

## Documentation

| Doc | Link |
|-----|------|
| **Docs TOC** | [../docs/README.md](../docs/README.md) |
| Getting started | [../docs/getting-started.md](../docs/getting-started.md) |
| Design | [../docs/design/README.md](../docs/design/README.md) |
| Engineering | [../docs/engineering/README.md](../docs/engineering/README.md) |
| Architecture | [../docs/engineering/architecture.md](../docs/engineering/architecture.md) |
| Dossier pipeline | [../docs/engineering/dossier-pipeline.md](../docs/engineering/dossier-pipeline.md) |
| AI & Ollama | [../docs/engineering/ai-and-ollama.md](../docs/engineering/ai-and-ollama.md) |
| Security | [../docs/security.md](../docs/security.md) |
| Root README | [../README.md](../README.md) |

## Notes

- Secrets live in **repo-root** `.env` (gitignored). See [../.env.example](../.env.example).  
- Source layout summary: [../docs/engineering/README.md](../docs/engineering/README.md).  
