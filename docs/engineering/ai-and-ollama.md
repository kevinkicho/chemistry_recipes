# AI & Ollama

## Modes

| Mode | Host | Auth |
|------|------|------|
| **Ollama Cloud** | `https://ollama.com` | Bearer API key (request or `.env`) |
| **Local Ollama** | `http://127.0.0.1:11434` (default) | None required |

Env:

```env
# Cloud
OLLAMA_CLOUD_API_KEY=
# OLLAMA_CLOUD_MODEL=gpt-oss:120b
# OLLAMA_CLOUD_FAST_MODEL=gpt-oss:120b
# OLLAMA_CLOUD_HOST=https://ollama.com

# Local (server-side synthesis without cloud key)
# OLLAMA_HOST=http://127.0.0.1:11434
# OLLAMA_MODEL=llama3.1
```

## Server readiness

`getServerAiEnv()` (`lib/ai/serverEnv.ts`):

- `hasKey` — cloud key present  
- `canCall` — `hasKey || isLocalOllamaHost(host)`  
- `provider` — `ollama-cloud` | `ollama-local`  

Pipeline runs Ollama only when `canCall && evidenceScore.shouldSynthesize`.

## Proxy allowlist

Shared helpers in `lib/ai/config.ts`:

- `isAllowedOllamaHost` — cloud hostname **or** loopback / RFC1918 private LAN  
- `isLocalOllamaHost` — loopback + private ranges  

Routes:

- `POST /api/ai/chat`  
- `POST /api/ai/models`  

Cloud without key → 401. Local without key → allowed. Host outside allowlist → 400 (SSRF protection).

## Browser settings

`AiSettingsPanel` + `useAiConfig`:

- Provider radio: Cloud vs Local  
- Host, primary model, fast model  
- Cloud API key optional if server `.env` has key  
- Local: no key field; test connection hits tags  

Config storage: `localStorage` key `cr-ai-config-v1`.

## Synthesis

`synthesizeDossierFromEvidence` (`lib/dossier/synthesize.ts`):

- Streaming `/api/chat` with `format: "json"`  
- Bearer header only if key present  
- Evidence-only system prompt (no inventing plant limits)  
- `qualityGateSynthesis` post-parse  
- Full `AiProvenanceRecord` (provider, host, prompts, timing)  

## Science & campaign agents (quote-bound)

Beyond dossier synthesis, Ollama can structure answers over **densify packages only**:

| Endpoint | Package context | Body flags |
|----------|-----------------|------------|
| `POST /api/ai/science` | `formatAiGuidanceContext` + process-knowledge | `useLlm`, `densifyNeighbors` |
| `POST /api/ai/campaign` | `formatCampaignAiGuidanceContext` | `useLlm`, `force`, `cids[]` |

Rules (shared):

1. Answer only from package facts/windows.  
2. Never invent temperatures, yields, equipment IDs, or plant CPPs.  
3. Thin packages skip LLM and return densify-next guidance instead.  
4. Prefer harvesting more free-public data over inventing numbers.

Full densify-first design: [frontier-science.md](./frontier-science.md).

## Related

- Security → [../security.md](../security.md)  
- Pipeline → [dossier-pipeline.md](./dossier-pipeline.md)  
- Frontier science → [frontier-science.md](./frontier-science.md)  

