# Study Designer Integration Design

**Date:** 2026-03-11
**Status:** Approved
**Approach:** Docker Sidecar (Approach A)

## Overview

Integrate OHDSI's [StudyAgent](https://github.com/OHDSI/StudyAgent) into Parthenon as a Docker sidecar, branded as "Study Designer" in the UI. StudyAgent is an AI-powered study design assistant that helps researchers design observational studies through phenotype recommendation, cohort linting, concept set review, and protocol generation.

The integration provides:
- A dedicated Study Designer page with flow-based UI for 5 MVP study design flows (6th deferred to post-MVP)
- Embedded lint/recommendation capabilities on existing cohort and study pages (Phase 4, deferred)
- Zero changes to StudyAgent source code — upstream updates via `git submodule update`

## Architecture

```
Browser
  ↓
Laravel (auth + proxy, role: researcher|super-admin)
  ↓
FastAPI (proxy router, per-endpoint timeouts)
  ↓
StudyAgent Container (single container, entrypoint runs both)
  ├── ACP (HTTP server, port 8765) — orchestrates LLM + MCP
  └── MCP (HTTP transport, port 3100) — phenotype index + tools
       ↓                    ↓
  Phenotype Index       Ollama (shared)
  (FAISS + BM25)        (MedGemma / qwen3)
```

StudyAgent runs as a **single Docker container** with an entrypoint script that starts the MCP server first (with readiness polling), then the ACP server. This avoids the complexity of managing two separate containers while keeping the services internally separated.

Key architectural properties:
- StudyAgent does **not** connect to databases — it works from a local phenotype index and generates artifacts (cohort JSON, concept sets, R code)
- LLM calls go through Ollama, shared with Parthenon's existing Abby assistant
- Phenotype index is built from the OHDSI PhenotypeLibrary (pre-built, stored in a Docker volume)
- All communication is HTTP — no subprocess spawning at runtime

## Infrastructure

### Git Submodule

```bash
git submodule add https://github.com/OHDSI/StudyAgent.git study-agent
```

The submodule lives at `study-agent/` in the repo root. Updates are pulled via `git submodule update --remote`.

### Dockerfile

Create `docker/study-agent/Dockerfile`:
- Base: `python:3.12-slim`
- Install: `pip install -e /opt/study-agent` (installs `study_agent_core`, `study_agent_mcp`, `study_agent_acp`)
- Copy entrypoint script
- No additional system dependencies required (no DB drivers, no C extensions beyond FAISS)

### Entrypoint Script

Create `docker/study-agent/entrypoint.sh`:
1. Start MCP server in background (`study-agent-mcp &`)
2. Poll `http://127.0.0.1:${MCP_PORT}/mcp` in a loop with timeout (max 30s) until ready
3. Start ACP server in foreground (`study-agent-acp`)

This ensures MCP is fully ready before ACP attempts to connect, without relying on a fixed `sleep`.

### Docker Compose Service

```yaml
study-agent:
  build:
    context: .
    dockerfile: docker/study-agent/Dockerfile
  ports:
    - "${STUDY_AGENT_PORT:-8765}:8765"
  environment:
    # MCP config
    - MCP_TRANSPORT=http
    - MCP_HOST=0.0.0.0
    - MCP_PORT=3100
    - PHENOTYPE_INDEX_DIR=/data/phenotype-index
    - EMBED_URL=http://host.docker.internal:11434/api/embed
    - EMBED_MODEL=qwen3-embedding:4b
    # ACP config
    - STUDY_AGENT_MCP_URL=http://127.0.0.1:3100/mcp
    - LLM_API_URL=http://host.docker.internal:11434/v1/chat/completions
    - LLM_API_KEY=ollama
    - LLM_MODEL=MedAIBase/MedGemma1.5:4b
    - STUDY_AGENT_HOST=0.0.0.0
    - STUDY_AGENT_PORT=8765
    - STUDY_AGENT_THREADING=1
    - STUDY_AGENT_ALLOW_CORE_FALLBACK=1
  extra_hosts:
    - "host.docker.internal:host-gateway"
  volumes:
    - study-agent-index:/data/phenotype-index
    - ./study-agent:/opt/study-agent:ro
  restart: unless-stopped
  networks:
    - parthenon
  healthcheck:
    test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8765/health')"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 45s
```

Add `study-agent-index` to the `volumes:` section.

Note: `extra_hosts` is required for `host.docker.internal` to resolve on native Linux Docker Engine (Docker Desktop provides it automatically).

### Phenotype Index Build

Create `scripts/build-phenotype-index.sh`:
1. Clone `OHDSI/PhenotypeLibrary` to a temp directory
2. Run StudyAgent's `build_phenotype_index.py` to produce FAISS + BM25 index
3. Copy index files into the `study-agent-index` Docker volume
4. Clean up temp directory

This runs once during initial setup and can be re-run to update the phenotype catalog. Recommended refresh cadence: monthly, aligned with PhenotypeLibrary releases.

### Embedding Model

Pull `qwen3-embedding:4b` into Ollama:
```bash
ollama pull qwen3-embedding:4b
```

This is the default model StudyAgent uses for dense vector search over the phenotype catalog. ~2.3GB download. Future optimization: evaluate reusing Parthenon's existing SapBERT embeddings via an adapter.

### LLM Model

MedGemma 4B (already running for Abby) serves as the default. If JSON output reliability is poor with MedGemma, fall back to a dedicated general model:
```bash
ollama pull qwen3:4b
```

Update `LLM_MODEL` env var on the `study-agent` service accordingly.

## Backend Integration

### FastAPI Proxy Router

Create `ai/app/routers/study_agent.py`:

A thin HTTP proxy that forwards requests to the StudyAgent ACP server at `http://study-agent:8765` (internal Docker network).

**Module-level `httpx.AsyncClient`** with connection pooling (reused across requests):
```python
_client = httpx.AsyncClient(base_url="http://study-agent:8765", timeout=10.0)
```

**Endpoints with per-endpoint timeouts:**

| Method | Path | Forwards To | Timeout | Purpose |
|--------|------|-------------|---------|---------|
| `GET` | `/study-agent/health` | `GET /health` | 10s | Health check with MCP + index status |
| `GET` | `/study-agent/tools` | `GET /tools` | 10s | List available tools |
| `POST` | `/study-agent/phenotype/search` | `POST /tools/call` (phenotype_search) | 60s | Search phenotype catalog |
| `POST` | `/study-agent/phenotype/recommend` | `POST /flows/phenotype_recommendation` | 180s | Get phenotype recommendations for a study description |
| `POST` | `/study-agent/phenotype/improve` | `POST /flows/phenotype_improvements` | 180s | Get improvement suggestions for a cohort |
| `POST` | `/study-agent/intent/split` | `POST /flows/phenotype_intent_split` | 180s | Split study intent into target/outcome |
| `POST` | `/study-agent/cohort/lint` | `POST /flows/cohort_critique_general_design` | 180s | Lint/critique a cohort definition |
| `POST` | `/study-agent/concept-set/review` | `POST /flows/concept_sets_review` | 180s | Review concept set for issues |

**Convenience endpoints** (compose multiple ACP calls):

| Method | Path | Timeout | Purpose |
|--------|------|---------|---------|
| `POST` | `/study-agent/lint-cohort` | 180s | Accept cohort JSON, call `concept_sets_review` + `cohort_critique_general_design`, return combined findings |
| `POST` | `/study-agent/recommend-phenotypes` | 180s | Accept study description string, call `phenotype_recommendation` flow, return suggestions |

**Implementation pattern:**
- Module-level `httpx.AsyncClient` with connection pooling
- Per-endpoint timeout overrides (10s health, 60s tools, 180s flows)
- Error wrapping: ACP errors → `HTTPException` with descriptive messages
- No request/response transformation — pass through as-is

**Router registration** in `ai/app/main.py`:
```python
app.include_router(study_agent.router, prefix="/study-agent", tags=["study-agent"])
```

### Laravel Controller & Routes

Create `backend/app/Http/Controllers/Api/V1/StudyAgentController.php`:

Proxies to FastAPI at `python-ai:8000/study-agent/*`. Same pattern as existing AI proxy controllers.

Create **Form Request classes** for all POST endpoints (per Parthenon convention — no inline `$request->validate()`):
- `PhenotypeSearchRequest` — validates `query` (required, string, max 1000)
- `PhenotypeRecommendRequest` — validates `study_intent` (required, string, max 5000)
- `PhenotypeImproveRequest` — validates `cohort_definition` (required, JSON object), `cohort_id` (optional, integer)
- `IntentSplitRequest` — validates `study_intent` (required, string, max 5000)
- `CohortLintRequest` — validates `cohort_definition` (required, JSON object)
- `ConceptSetReviewRequest` — validates `concept_set` (required, JSON object)
- `LintCohortRequest` — validates `cohort_definition` (required, JSON object) — convenience endpoint
- `RecommendPhenotypesRequest` — validates `description` (required, string, max 5000) — convenience endpoint

**Routes** in `backend/routes/api.php`:
```php
Route::prefix('study-agent')
    ->middleware(['auth:sanctum', 'role:researcher|super-admin', 'throttle:10,1'])
    ->group(function () {
        Route::get('health',                [StudyAgentController::class, 'health']);
        Route::get('tools',                 [StudyAgentController::class, 'listTools']);
        Route::post('phenotype/search',     [StudyAgentController::class, 'phenotypeSearch']);
        Route::post('phenotype/recommend',  [StudyAgentController::class, 'phenotypeRecommend']);
        Route::post('phenotype/improve',    [StudyAgentController::class, 'phenotypeImprove']);
        Route::post('intent/split',         [StudyAgentController::class, 'intentSplit']);
        Route::post('cohort/lint',          [StudyAgentController::class, 'cohortLint']);
        Route::post('concept-set/review',   [StudyAgentController::class, 'conceptSetReview']);
        Route::post('lint-cohort',          [StudyAgentController::class, 'lintCohort']);
        Route::post('recommend-phenotypes', [StudyAgentController::class, 'recommendPhenotypes']);
    });
```

Role-gated: `researcher` or `super-admin` only.

## Frontend

### Feature Module Structure

```
frontend/src/features/study-designer/
  pages/
    StudyDesignerPage.tsx       — Main page at /study-designer
  components/
    FlowChat.tsx                — Chat-style interface for flow execution
    FlowSelector.tsx            — Card grid to pick a study design flow
    PhenotypeResultCard.tsx     — Displays recommended phenotype (ID, name, score, description)
    LintFindingCard.tsx         — Displays lint finding (severity icon, description, fix suggestion)
    FlowStatusBar.tsx           — Progress indicator (Searching → Reasoning → Validating)
  hooks/
    useStudyDesigner.ts         — TanStack Query mutations for API calls
  api.ts                        — Axios calls to /api/v1/study-agent/*
  types.ts                      — TypeScript types matching StudyAgent Pydantic models
```

### StudyDesignerPage Layout

Split-panel layout:
- **Left sidebar** (~280px): Flow selector cards for available flows
- **Right panel**: Active flow's input form + results

### Available Flows

**MVP (Phase 3):**

| Flow | Input | Output |
|------|-------|--------|
| Intent Split | Study description (text) | Target statement + outcome statement + rationale |
| Phenotype Search | Search query (text) | Matching phenotypes from OHDSI PhenotypeLibrary |
| Phenotype Recommendation | Study description (text) | Ranked phenotype list with scores |
| Phenotype Improvements | Cohort definition (JSON or dropdown) | Improvement suggestions + code patches |
| Cohort Design Critique | Cohort definition (JSON or dropdown) | Design findings + recommendations |

**Post-MVP (deferred):**

| Flow | Input | Output | Reason for Deferral |
|------|-------|--------|---------------------|
| Phenotype Validation Review | Cohort + keeper case data | Validation label (yes/no/unknown) + rationale | Requires keeper case data pipeline not yet in Parthenon |
| Concept Set Review | Concept set (JSON or dropdown) | Lint findings + proposed diffs | Backend endpoint (`POST /concept-set/review`) ships in Phase 2; UI tab deferred to Phase 4 |

### Flow UX Pattern

1. User selects a flow from the sidebar
2. Input form appears — text area for descriptions, or dropdown to select from existing Parthenon cohort definitions/concept sets (fetched from `/api/v1/cohort-definitions`, `/api/v1/concept-sets`)
3. User can also paste raw JSON directly
4. Submit → `FlowStatusBar` shows progress (multi-step: Searching → Reasoning → Validating) → results render as typed cards
5. Results include actionable links where applicable

### Embedded Components (Phase 4 — Deferred)

These components are not part of the initial MVP. They will be implemented in Phase 4 after the core Study Designer page is stable.

**`CohortLintBanner.tsx`** — To be rendered on `CohortDefinitionDetailPage`:
- Triggers after cohort save (or on-demand via button)
- Calls `POST /api/v1/study-agent/lint-cohort` with the cohort's JSON definition
- Displays inline warnings/suggestions as a collapsible banner

**`PhenotypeRecommendations.tsx`** — To be rendered on `StudyCreatePage`:
- Triggers after user enters a study description
- Calls `POST /api/v1/study-agent/recommend-phenotypes`
- Shows recommended phenotypes as selectable cards

### Routing

Add to `frontend/src/app/router.tsx`:
```tsx
{
  path: "study-designer",
  lazy: () => import("@/features/study-designer/pages/StudyDesignerPage"),
}
```

Add nav item in sidebar with `FlaskConical` lucide icon, label "Study Designer".

### Feature Flag

Gated behind `VITE_STUDY_AGENT_ENABLED=true`:
- Nav item only renders when flag is set
- Route only registered when flag is set
- Embedded components (`CohortLintBanner`, `PhenotypeRecommendations`) only render when flag is set
- Allows gradual rollout and easy disable if StudyAgent container isn't running

### Design Tokens

Follows Parthenon's dark clinical theme:
- `#0E0E11` base background
- Crimson (`#9B1B30`) for high-severity lint findings
- Gold (`#C9A227`) for recommendations and medium-severity
- Teal (`#2DD4BF`) for success/pass states
- Ghost text for metadata (cohort IDs, scores)

## Testing

### Health Check
- `GET /api/v1/study-agent/health` returns MCP connection status and phenotype index stats
- Added to `SystemHealthPage` as a new service card

### Integration Tests
- POST sample cohort JSON to `/cohort/lint` → verify findings returned
- POST study description to `/phenotype/recommend` → verify phenotype list returned
- POST concept set JSON to `/concept-set/review` → verify findings returned
- Verify auth gate: unauthenticated requests return 401
- Verify role gate: non-researcher users return 403

### E2E (Playwright)
- Navigate to `/study-designer`
- Select "Cohort Design Critique" flow
- Paste sample cohort JSON
- Submit → verify `LintFindingCard` components render
- Verify `FlowStatusBar` transitions through states

## Rollout Plan

1. **Phase 1**: Infrastructure — submodule, Dockerfile, entrypoint, docker-compose, phenotype index build script, embedding model pull
2. **Phase 2**: Backend — FastAPI proxy router (module-level client, per-endpoint timeouts), Laravel controller + Form Requests + routes (role-gated)
3. **Phase 3**: Frontend — StudyDesignerPage with 5 MVP flows, feature flag, nav item
4. **Phase 4** (deferred): Embedded — CohortLintBanner + PhenotypeRecommendations on existing pages + Concept Set Review UI tab
5. **Phase 5**: Testing + SystemHealth integration

## Dependencies

- Ollama with `qwen3-embedding:4b` model (~2.3GB)
- OHDSI PhenotypeLibrary (cloned during index build)
- No database changes required
- No changes to StudyAgent source code

## Naming Convention

- **Internal/API**: `study-agent` (matches OHDSI repo name, used in routes and Docker service name)
- **UI/User-facing**: "Study Designer" (clearer for researchers, used in sidebar label and page title)

## Open Questions

1. **LLM model choice**: MedGemma 4B may not produce reliable JSON for StudyAgent's structured output prompts. May need a dedicated general-purpose model. Test during Phase 2.
2. **SapBERT reuse**: Could we adapt Parthenon's existing SapBERT embeddings for phenotype search instead of pulling a separate embedding model? Defer to post-MVP.
3. **Phenotype index refresh**: How often should the index be rebuilt? Monthly cadence aligned with PhenotypeLibrary releases seems reasonable.
