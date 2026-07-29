# Provenance coverage specification

**Goal:** Every content card on the live compound / molecule dossier that shows free-public API data or Ollama-structured text must expose **API provenance** and/or **AI provenance** so users can disseminate and audit claims.

**Scanner:** `web/scripts/test-provenance-coverage.mjs`  
**Registry:** `web/scripts/fixtures/provenance-surface-registry.json`  
**REQ family:** **PROV-*** (also listed in [test-spec.md](./test-spec.md) § N)

## Product law

1. **API provenance** — free-public HTTP traces / source links only (PubChem, EPMC, patents, …). Never invent endpoints.  
2. **AI provenance** — full Ollama call record: system/user prompts, data fed, sources inventory, model, timing, regenerate.  
3. **Honesty** — free-public structured shells must **not** wear an AI chip; use “free-public” labels when content is not from Ollama.  
4. **Per-field** — prefer field-specific AI chips (`aiProvenanceForField`) over a single global chip so each card disseminates the right call context.

## Chip stack

| Module | Role |
|--------|------|
| `ApiProvenance` | Free-public traces + public source refs |
| `AiProvenance` | Ollama modal (prompts, data, sources, regenerate) |
| `ContentProvenance` | Universal strip: API + optional AI |
| `DossierSectionTitle` | Section heading + ContentProvenance |
| `aiFieldProvenance` | Which synthesis fields are AI-generated |

## AI field keys (`fieldsGenerated` / helper)

| Field | Typical UI surface |
|-------|-------------------|
| `overview` | Header overview prose |
| `applications` | Application chips |
| `manufacturingSummary` | Aside manufacturing summary |
| `routes` | Process recipe + steps + route compare |
| `criticalParameters` | Control points board (from AI routes) |
| `apparatusCatalog` | Aside apparatus |
| `environmentBaseline` | Aside plant environment |
| `ehsHighlights` | Aside EHS (when AI wrote them) |
| `relatedEntities` | Related entities graph/list |
| `unitOpFills` | Modality unit-op fill |
| `gaps` | Evidence gaps list |
| `disclaimer` | AI disclaimer line |
| `modality` | Modality inference |

## Surface registry (source of truth)

Machine-readable list: **`web/scripts/fixtures/provenance-surface-registry.json`**.

Each surface:

| Key | Meaning |
|-----|---------|
| `id` | Stable PROV surface id |
| `label` | Human name |
| `file` | Source file under `web/src/` |
| `api` | `required` \| `optional` \| `none` |
| `ai` | `required` \| `when-field:<key>` \| `when-parsed` \| `when-parsed-or-attempt` \| `when-routes-from-ai` \| `optional` \| `none` |
| `patterns` | Substrings that must appear in `file` (wiring markers) |

### Live dossier (compound view)

| Surface id | API | AI |
|------------|-----|-----|
| `live.header.identity` | required | attempt / parsed |
| `live.overview` | required | when-field:overview |
| `live.applications` | required | when-field:applications |
| `live.critical-params` | required | when-field:criticalParameters |
| `live.routes` | required | when-field:routes |
| `live.routes.panel` | required | when routes from AI |
| `live.route-compare` | required | when-field:routes |
| `live.related` | required | when-field:relatedEntities |
| `live.unit-ops` | required | when-field:unitOpFills |
| `live.mfg-public` | required | none (API table) |
| `live.literature` | required | none |
| `live.patents` | required | none |

### Aside plant cards

| Surface id | API | AI |
|------------|-----|-----|
| `aside.manufacturing` | required | when-field:manufacturingSummary |
| `aside.environment` | required | when-field:environmentBaseline |
| `aside.apparatus` | required | when-field:apparatusCatalog |
| `aside.ehs` | required | when-field:ehsHighlights |
| `aside.hazards` | required | none (GHS API) |
| `aside.gaps` | required | when-parsed |

### Worker / brief panels

| Surface id | API | AI |
|------------|-----|-----|
| `panel.manager-brief` | required | when routes from AI |
| `panel.operator-aid` | required | optional |
| `panel.process-facts` | required | **none** (sourced atoms) |
| `panel.recipe-readiness` | required | optional |
| `panel.monday-pack` | required | optional |
| `panel.shift-pack` | required | optional |
| `panel.pdf-worker` | required | optional |
| `panel.worker-playbook` | required | optional |
| `panel.evidence-critique` | required | optional |
| `panel.ideal-parity` | required | optional |
| `panel.problem-unitop` | required | optional |

## Scanner requirements (PROV-SCAN-*)

| ID | Check |
|----|--------|
| **PROV-SCAN-01** | Registry fixture present + schema |
| **PROV-SCAN-02** | Chip modules exist; ContentProvenance dual-wires API+AI |
| **PROV-SCAN-03** | AI modal has prompts/data/sources/regenerate; API free-public only |
| **PROV-SCAN-10** | Every surface `file` exists |
| **PROV-SCAN-11** | Every surface `patterns` match source |
| **PROV-SCAN-12** | `api: required` → Api/Content provenance present |
| **PROV-SCAN-13** | AI-aware surfaces → AI wiring present |
| **PROV-SCAN-20–23** | Live + aside field bindings + helper field list |
| **PROV-SCAN-24** | Registry `when-field:*` keys known to helper |
| **PROV-SCAN-30** | Spec docs present |
| **PROV-SCAN-40** | Minimum surface count (≥ 45) |

## Adding a new content card

1. Add UI with `ContentProvenance` (or SectionTitle / Api+Ai chips).  
2. If AI-generated, bind `ai={aiProvenanceForField(synthesis, "field")}` and extend `fieldsFromSynthesis` if new.  
3. Register the surface in `provenance-surface-registry.json`.  
4. Run `npm run test:provenance-coverage` (included in `npm test` / precommit).  
5. Update this table if the surface is user-visible on the compound page.

## Commands

```bash
cd web
npm run test:provenance           # chip contracts + field helper
npm run test:provenance-coverage  # full surface registry scan
npm run precommit                 # all units + tsc + eslint
```

## Related

- [test-spec.md](./test-spec.md) — full REQ matrix  
- [testing.md](./testing.md) — precommit cheatsheet  
- [ai-and-ollama.md](./ai-and-ollama.md) — synthesis  
- [process-facts-accuracy.md](./process-facts-accuracy.md) — free-public atoms ≠ AI invention  
