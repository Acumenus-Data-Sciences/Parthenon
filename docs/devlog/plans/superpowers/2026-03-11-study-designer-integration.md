# Study Designer Integration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate OHDSI StudyAgent as a Docker sidecar providing AI-assisted study design (phenotype search, cohort linting, intent splitting) within Parthenon.

**Architecture:** StudyAgent runs as a single Docker container (ACP + MCP processes) accessed via FastAPI proxy → Laravel proxy → React frontend. The phenotype index is pre-built from OHDSI PhenotypeLibrary, LLM calls go through shared Ollama.

**Tech Stack:** Python 3.12 (StudyAgent), FastAPI (proxy), Laravel 11 (controller), React 19 + TanStack Query (frontend), Docker Compose, Ollama

**Spec:** `docs/superpowers/specs/2026-03-11-study-agent-integration-design.md`

---

## Pre-existing Scaffolding (Already Done)

The following files already exist and are functional. The plan references them but does NOT recreate them:

| File | Status | Notes |
|------|--------|-------|
| `docker/study-agent/Dockerfile` | Needs fix | Clones StudyAgent at build time — must switch to submodule mount |
| `docker/study-agent/entrypoint.sh` | Needs fix | Uses `sleep 3` — must replace with readiness poll |
| `docker-compose.yml` (study-agent service) | Needs fix | Missing `MCP_TRANSPORT`, `MCP_HOST`; uses `curl` healthcheck |
| `ai/app/routers/study_agent.py` | Needs fix | Creates new `httpx.AsyncClient` per request — needs module-level pooled client + per-endpoint timeouts |
| `ai/app/config.py` | Done | Has `study_agent_url` setting |
| `ai/app/main.py` | Done | Router registered at `/study-agent` |
| `backend/app/Http/Controllers/Api/V1/StudyAgentController.php` | Needs fix | Uses inline `$request->validate()` — needs Form Requests; missing role middleware + throttle |
| `backend/routes/api.php` | Needs fix | Missing `role:researcher|super-admin` and `throttle:10,1` middleware |
| `frontend/src/features/study-agent/api.ts` | Done | All 6 API functions implemented |
| `frontend/src/features/study-agent/pages/StudyDesignerPage.tsx` | Done | 4 tabs working (intent, search, recommend, lint) |
| `frontend/src/app/router.tsx` | Done | Route at `/study-designer` |
| `frontend/src/components/layout/Sidebar.tsx` | Done | "Study Designer" nav item with Brain icon |

## What Remains

1. **Git submodule** — not added yet (Dockerfile clones at build time instead)
2. **Entrypoint readiness polling** — uses `sleep 3`, needs proper poll loop
3. **Docker Compose env alignment** — missing `MCP_TRANSPORT`, `MCP_HOST` vars
4. **FastAPI proxy** — needs connection pooling + per-endpoint timeouts
5. **Laravel middleware** — missing role + throttle on study-agent routes
6. **Laravel Form Requests** — uses inline validation, needs dedicated classes
7. **Feature flag** — `VITE_STUDY_AGENT_ENABLED` not implemented
8. **Convenience endpoints** — `lint-cohort` and `recommend-phenotypes` not built
9. **SystemHealth card** — StudyAgent not shown on health dashboard
10. **Phenotype index build script** — `scripts/build-phenotype-index.sh` not created

---

## Chunk 1: Infrastructure Fixes

### Task 1: Add Git Submodule

**Files:**
- Create: `.gitmodules`
- Create: `study-agent/` (submodule)

- [ ] **Step 1: Add the OHDSI StudyAgent submodule**

```bash
cd /home/smudoshi/Github/Parthenon
git submodule add https://github.com/OHDSI/StudyAgent.git study-agent
```

- [ ] **Step 2: Verify submodule is initialized**

```bash
git submodule status
```

Expected: Shows commit hash + `study-agent` path

- [ ] **Step 3: Commit submodule**

```bash
git add .gitmodules study-agent
git commit -m "chore: add OHDSI StudyAgent as git submodule"
```

---

### Task 1B: Update Dockerfile to Use Submodule

**Files:**
- Modify: `docker/study-agent/Dockerfile`

The Dockerfile currently clones StudyAgent at build time (`git clone`). Since we now have a git submodule at `./study-agent/`, the docker-compose volume mount (`./study-agent:/opt/study-agent:ro`) provides the code at runtime. The Dockerfile should install from that mount path instead.

- [ ] **Step 1: Rewrite Dockerfile**

Replace contents of `docker/study-agent/Dockerfile` with:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Pre-install heavy Python dependencies (cached across rebuilds)
RUN pip install --no-cache-dir \
    mcp>=1.0.0 \
    pydantic>=2.0.0 \
    httpx \
    anyio \
    faiss-cpu \
    numpy \
    requests \
    pyyaml

# The submodule is mounted at /opt/study-agent via docker-compose volume
# Install packages in editable mode at container startup (entrypoint handles this)
# This allows the mount to be read-only while still working with pip install -e

# Copy entrypoint script
COPY docker/study-agent/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create data directory for phenotype index
RUN mkdir -p /data/phenotype-index

EXPOSE 3000 8765

ENTRYPOINT ["/app/entrypoint.sh"]
```

- [ ] **Step 2: Update entrypoint to pip install from mounted submodule**

The entrypoint.sh (Task 2) will include a `pip install -e /opt/study-agent` at startup if not already installed.

- [ ] **Step 3: Update docker-compose volumes to match spec**

In `docker-compose.yml`, update the study-agent service's `volumes:` section:

```yaml
    volumes:
      - study-agent-data:/data/phenotype-index
      - ./study-agent:/opt/study-agent:ro
```

Also update the `PHENOTYPE_INDEX_DIR` env var:
```yaml
      - PHENOTYPE_INDEX_DIR=/data/phenotype-index
```

- [ ] **Step 4: Commit**

```bash
git add docker/study-agent/Dockerfile docker-compose.yml
git commit -m "refactor: switch Dockerfile from git clone to submodule mount"
```

---

### Task 2: Fix Entrypoint Readiness Polling

**Files:**
- Modify: `docker/study-agent/entrypoint.sh`

The current entrypoint uses `sleep 3` which is unreliable. Replace with a polling loop that waits for MCP to respond.

- [ ] **Step 1: Update entrypoint.sh with readiness polling**

Replace the contents of `docker/study-agent/entrypoint.sh` with:

```bash
#!/bin/bash
set -e

echo "=== StudyAgent Entrypoint ==="

# Install StudyAgent packages from mounted submodule (if not already installed)
if ! python -c "import study_agent_core" 2>/dev/null; then
    echo "Installing StudyAgent packages..."
    pip install --no-cache-dir -e /opt/study-agent/core/ \
        -e /opt/study-agent/mcp_server/ \
        -e /opt/study-agent/acp_agent/ 2>/dev/null
fi

# Build phenotype index if it doesn't exist
if [ ! -f "${PHENOTYPE_INDEX_DIR:-/data/phenotype-index}/dense.index" ]; then
    echo "Building phenotype index (first run)..."
    cd /app/study-agent/mcp_server
    python -m study_agent_mcp.retrieval.build_phenotype_index 2>/dev/null || \
        echo "Warning: Phenotype index build skipped (embedding service may not be ready)"
fi

# Start MCP server in HTTP mode (background)
MCP_PORT="${MCP_PORT:-3000}"
echo "Starting MCP server on port ${MCP_PORT}..."
MCP_TRANSPORT=http \
MCP_HOST=0.0.0.0 \
MCP_PORT="${MCP_PORT}" \
study-agent-mcp &
MCP_PID=$!

# Poll MCP readiness (max 30s)
echo "Waiting for MCP to be ready..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:${MCP_PORT}/mcp')" 2>/dev/null; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
        echo "ERROR: MCP failed to start within ${MAX_ATTEMPTS}s"
        kill $MCP_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done
echo "MCP is ready."

# Start ACP server (foreground)
echo "Starting ACP server on port ${STUDY_AGENT_PORT:-8765}..."
STUDY_AGENT_HOST=0.0.0.0 \
STUDY_AGENT_PORT=${STUDY_AGENT_PORT:-8765} \
STUDY_AGENT_MCP_URL="http://127.0.0.1:${MCP_PORT}/mcp" \
study-agent-acp &
ACP_PID=$!

echo "StudyAgent services started (MCP=$MCP_PID, ACP=$ACP_PID)"

# Wait for either process to exit
wait -n $MCP_PID $ACP_PID
EXIT_CODE=$?
echo "A process exited with code $EXIT_CODE, shutting down..."
kill $MCP_PID $ACP_PID 2>/dev/null || true
exit $EXIT_CODE
```

- [ ] **Step 2: Commit**

```bash
git add docker/study-agent/entrypoint.sh
git commit -m "fix: replace sleep with MCP readiness polling in study-agent entrypoint"
```

---

### Task 3: Update Docker Compose Environment Variables

**Files:**
- Modify: `docker-compose.yml` (lines 193-225, `study-agent` service)

Add missing environment variables (`MCP_TRANSPORT`, `MCP_HOST`, `STUDY_AGENT_THREADING`, `STUDY_AGENT_ALLOW_CORE_FALLBACK`) and update healthcheck from `curl` to `python` (curl may not be installed in slim image).

- [ ] **Step 1: Update the study-agent service environment block**

In `docker-compose.yml`, update the `study-agent` service's `environment:` section. Add these vars after the existing ones:

```yaml
      - MCP_TRANSPORT=http
      - MCP_HOST=0.0.0.0
      - STUDY_AGENT_HOST=0.0.0.0
      - STUDY_AGENT_THREADING=1
      - STUDY_AGENT_ALLOW_CORE_FALLBACK=1
```

- [ ] **Step 2: Update healthcheck to use python instead of curl**

Replace the healthcheck `test` line:
```yaml
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8765/health')"]
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "fix: add missing MCP env vars and python healthcheck for study-agent"
```

---

### Task 4: Create Phenotype Index Build Script

**Files:**
- Create: `scripts/build-phenotype-index.sh`

- [ ] **Step 1: Write the build script**

```bash
#!/bin/bash
set -euo pipefail

# Build the OHDSI PhenotypeLibrary index for StudyAgent
# Run once during setup; re-run to update the phenotype catalog.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TEMP_DIR=$(mktemp -d)
INDEX_VOLUME="parthenon_study-agent-data"

echo "=== Building Phenotype Index ==="

# 1. Clone PhenotypeLibrary
echo "Cloning OHDSI/PhenotypeLibrary..."
git clone --depth 1 https://github.com/OHDSI/PhenotypeLibrary.git "$TEMP_DIR/PhenotypeLibrary"

# 2. Run the index builder inside the study-agent container
echo "Building index..."
docker compose -f "$REPO_ROOT/docker-compose.yml" run --rm \
    -v "$TEMP_DIR/PhenotypeLibrary:/tmp/PhenotypeLibrary:ro" \
    study-agent \
    python -m study_agent_mcp.retrieval.build_phenotype_index \
        --library-dir /tmp/PhenotypeLibrary \
        --output-dir "${PHENOTYPE_INDEX_DIR:-/app/study-agent/data/phenotype_index}"

# 3. Cleanup
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo "=== Phenotype Index build complete ==="
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/build-phenotype-index.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/build-phenotype-index.sh
git commit -m "feat: add phenotype index build script for StudyAgent"
```

---

## Chunk 2: Backend Fixes

### Task 5: Fix FastAPI Proxy — Connection Pooling + Per-Endpoint Timeouts

**Files:**
- Modify: `ai/app/routers/study_agent.py`

Replace per-request `httpx.AsyncClient` instantiation with a module-level pooled client. Add per-endpoint timeout overrides. Add the two convenience endpoints (`lint-cohort`, `recommend-phenotypes`).

- [ ] **Step 1: Rewrite the proxy helpers with module-level client**

Replace the top section of `ai/app/routers/study_agent.py` (lines 1-53) with:

```python
"""StudyAgent proxy endpoints.

Proxies requests to the OHDSI StudyAgent ACP server for
AI-assisted phenotype search, cohort linting, and study design.
"""
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Module-level client with connection pooling — reused across requests
_client = httpx.AsyncClient(
    base_url=settings.study_agent_url,
    timeout=10.0,  # default; overridden per-endpoint
)

# Timeout constants (seconds)
_TIMEOUT_HEALTH = 10.0
_TIMEOUT_TOOLS = 60.0
_TIMEOUT_FLOW = 180.0


async def _proxy_get(path: str, timeout: float = _TIMEOUT_HEALTH) -> dict[str, Any]:
    """Forward a GET request to the StudyAgent ACP server."""
    try:
        resp = await _client.get(path, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="StudyAgent service unavailable")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))


async def _proxy_post(
    path: str, payload: dict[str, Any], timeout: float = _TIMEOUT_FLOW
) -> dict[str, Any]:
    """Forward a POST request to the StudyAgent ACP server."""
    try:
        resp = await _client.post(path, json=payload, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="StudyAgent service unavailable")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
```

- [ ] **Step 2: Add convenience endpoints at the bottom of the file**

Append after the existing `concept_set_review` endpoint:

```python
# ---------------------------------------------------------------------------
# Convenience: combined endpoints
# ---------------------------------------------------------------------------


class LintCohortRequest(BaseModel):
    cohort_definition: dict[str, Any] = Field(
        ..., description="OHDSI cohort definition JSON — runs both cohort lint and concept set review",
    )


@router.post("/lint-cohort")
async def lint_cohort_combined(request: LintCohortRequest) -> dict[str, Any]:
    """Combined lint: runs cohort design critique + concept set review.

    Returns merged findings from both analyses.
    """
    cohort = request.cohort_definition
    critique = None
    concept_review = None
    errors = []

    try:
        critique = await _proxy_post(
            "/flows/cohort_critique_general_design",
            {"cohort_definition": cohort},
        )
    except HTTPException as e:
        errors.append(f"Cohort critique failed: {e.detail}")

    try:
        concept_review = await _proxy_post(
            "/flows/concept_sets_review",
            {"concept_set": cohort},
        )
    except HTTPException as e:
        errors.append(f"Concept set review failed: {e.detail}")

    return {
        "cohort_findings": critique,
        "concept_set_findings": concept_review,
        "errors": errors,
    }


class RecommendPhenotypesRequest(BaseModel):
    description: str = Field(
        ..., max_length=5000, description="Study description for phenotype recommendations",
    )


@router.post("/recommend-phenotypes")
async def recommend_phenotypes_convenience(
    request: RecommendPhenotypesRequest,
) -> dict[str, Any]:
    """Convenience: get phenotype recommendations from a study description."""
    return await _proxy_post(
        "/flows/phenotype_recommendation",
        {"study_intent": request.description},
    )
```

- [ ] **Step 2B: Update phenotype_search to use 60s timeout**

The `phenotype_search` endpoint calls `/tools/call` (not a `/flows/*` endpoint), so it should use `_TIMEOUT_TOOLS` (60s) instead of the default 180s:

```python
@router.post("/phenotype/search")
async def phenotype_search(request: PhenotypeSearchRequest) -> dict[str, Any]:
    """Search the OHDSI PhenotypeLibrary using hybrid dense+sparse retrieval."""
    return await _proxy_post("/tools/call", {
        "name": "phenotype_search",
        "arguments": {"query": request.query, "top_k": request.top_k},
    }, timeout=_TIMEOUT_TOOLS)
```

- [ ] **Step 3: Verify the proxy module imports cleanly**

```bash
cd /home/smudoshi/Github/Parthenon/ai
python -c "from app.routers import study_agent; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add ai/app/routers/study_agent.py
git commit -m "fix: use module-level httpx client with per-endpoint timeouts in study-agent proxy"
```

---

### Task 6: Add Laravel Form Request Classes

**Files:**
- Create: `backend/app/Http/Requests/StudyAgent/PhenotypeSearchRequest.php`
- Create: `backend/app/Http/Requests/StudyAgent/PhenotypeRecommendRequest.php`
- Create: `backend/app/Http/Requests/StudyAgent/PhenotypeImproveRequest.php`
- Create: `backend/app/Http/Requests/StudyAgent/IntentSplitRequest.php`
- Create: `backend/app/Http/Requests/StudyAgent/CohortLintRequest.php`
- Create: `backend/app/Http/Requests/StudyAgent/ConceptSetReviewRequest.php`
- Create: `backend/app/Http/Requests/StudyAgent/LintCohortRequest.php`
- Create: `backend/app/Http/Requests/StudyAgent/RecommendPhenotypesRequest.php`

- [ ] **Step 1: Create all 8 Form Request classes**

Each follows this pattern. Create under `backend/app/Http/Requests/StudyAgent/`:

**PhenotypeSearchRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class PhenotypeSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'query' => ['required', 'string', 'min:2', 'max:1000'],
            'top_k' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }
}
```

**PhenotypeRecommendRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class PhenotypeRecommendRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'study_intent' => ['required', 'string', 'min:10', 'max:5000'],
            'search_results' => ['sometimes', 'array'],
        ];
    }
}
```

**PhenotypeImproveRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class PhenotypeImproveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cohort_definition' => ['required', 'array'],
            'study_intent' => ['sometimes', 'string', 'max:5000'],
        ];
    }
}
```

**IntentSplitRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class IntentSplitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'intent' => ['required', 'string', 'min:10', 'max:5000'],
        ];
    }
}
```

**CohortLintRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class CohortLintRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cohort_definition' => ['required', 'array'],
        ];
    }
}
```

**ConceptSetReviewRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class ConceptSetReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'concept_set' => ['required', 'array'],
        ];
    }
}
```

**LintCohortRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class LintCohortRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cohort_definition' => ['required', 'array'],
        ];
    }
}
```

**RecommendPhenotypesRequest.php:**
```php
<?php

namespace App\Http\Requests\StudyAgent;

use Illuminate\Foundation\Http\FormRequest;

class RecommendPhenotypesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'description' => ['required', 'string', 'min:10', 'max:5000'],
        ];
    }
}
```

- [ ] **Step 2: Commit Form Request classes**

```bash
git add backend/app/Http/Requests/StudyAgent/
git commit -m "feat: add Form Request classes for StudyAgent endpoints"
```

---

### Task 7: Update Laravel Controller to Use Form Requests + Add Convenience Endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/StudyAgentController.php`

Replace inline `$request->validate()` calls with type-hinted Form Request parameters. Add `lintCohort()` and `recommendPhenotypes()` convenience methods.

- [ ] **Step 1: Update controller to use Form Requests**

Replace the controller's method signatures and validation. Each method changes from:
```php
public function phenotypeSearch(Request $request): JsonResponse
{
    $validated = $request->validate([...]);
```
To:
```php
use App\Http\Requests\StudyAgent\PhenotypeSearchRequest;

public function phenotypeSearch(PhenotypeSearchRequest $request): JsonResponse
{
    $validated = $request->validated();
```

Apply this pattern to all 6 existing methods: `phenotypeSearch`, `phenotypeRecommend`, `phenotypeImprove`, `intentSplit`, `cohortLint`, `conceptSetReview`.

- [ ] **Step 2: Add convenience endpoints**

Add two new methods to `StudyAgentController`:

```php
/**
 * Combined lint: cohort critique + concept set review.
 */
public function lintCohort(LintCohortRequest $request): JsonResponse
{
    $validated = $request->validated();

    $response = Http::timeout(120)->post(
        "{$this->aiServiceUrl}/study-agent/lint-cohort",
        $validated
    );

    if ($response->failed()) {
        Log::error('Combined lint failed', ['status' => $response->status()]);
        return response()->json(['error' => 'Combined lint failed'], $response->status());
    }

    return response()->json(['data' => $response->json()]);
}

/**
 * Convenience: phenotype recommendations from study description.
 */
public function recommendPhenotypes(RecommendPhenotypesRequest $request): JsonResponse
{
    $validated = $request->validated();

    $response = Http::timeout(120)->post(
        "{$this->aiServiceUrl}/study-agent/recommend-phenotypes",
        $validated
    );

    if ($response->failed()) {
        Log::error('Recommend phenotypes failed', ['status' => $response->status()]);
        return response()->json(['error' => 'Phenotype recommendation failed'], $response->status());
    }

    return response()->json(['data' => $response->json()]);
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/StudyAgentController.php
git commit -m "refactor: use Form Requests in StudyAgentController, add convenience endpoints"
```

---

### Task 8: Add Role Middleware + Throttle to Study-Agent Routes

**Files:**
- Modify: `backend/routes/api.php` (line ~415)

- [ ] **Step 1: Add middleware and convenience routes**

Change the study-agent route group from:
```php
Route::prefix('study-agent')->group(function () {
```
To:
```php
Route::prefix('study-agent')
    ->middleware(['role:researcher|super-admin', 'throttle:10,1'])
    ->group(function () {
```

Add the two convenience routes inside the group:
```php
        Route::post('/lint-cohort', [StudyAgentController::class, 'lintCohort']);
        Route::post('/recommend-phenotypes', [StudyAgentController::class, 'recommendPhenotypes']);
```

- [ ] **Step 2: Commit**

```bash
git add backend/routes/api.php
git commit -m "fix: add role + throttle middleware to study-agent routes, add convenience endpoints"
```

---

## Chunk 3: Frontend Improvements

### Task 9: Add Feature Flag Gating

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx` (line 60)
- Modify: `frontend/src/app/router.tsx` (line ~247)

- [ ] **Step 1: Gate the sidebar nav item**

In `Sidebar.tsx`, wrap the Study Designer nav item with a feature flag check. Change the `navItems` array to conditionally include it:

Before the `navItems` const, add:
```typescript
const studyAgentEnabled = import.meta.env.VITE_STUDY_AGENT_ENABLED === "true";
```

Then change the Study Designer entry from a static object to conditionally included:
```typescript
...(studyAgentEnabled
  ? [{ path: "/study-designer", label: "Study Designer", icon: Brain }]
  : []),
```

- [ ] **Step 2: Gate the route**

In `router.tsx`, wrap the study-designer route in a conditional:

```typescript
...(import.meta.env.VITE_STUDY_AGENT_ENABLED === "true"
  ? [
      {
        path: "study-designer",
        lazy: () =>
          import("@/features/study-agent/pages/StudyDesignerPage").then(
            (m) => ({ Component: m.default }),
          ),
      },
    ]
  : []),
```

- [ ] **Step 3: Add the env var to the Vite dev server**

Create or update `frontend/.env` (if not exists) or `frontend/.env.local`:
```
VITE_STUDY_AGENT_ENABLED=true
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/app/router.tsx
git commit -m "feat: gate Study Designer behind VITE_STUDY_AGENT_ENABLED feature flag"
```

---

### Task 10: Add StudyAgent to SystemHealthPage

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php`

Note: The controller is in the `Admin/` subdirectory, not directly under `V1/`.

The SystemHealthController uses a `$this->checkers` map with dedicated private methods for each service. Add StudyAgent following the same pattern.

- [ ] **Step 1: Read the existing SystemHealthController**

Read `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` to understand the checker pattern. Look for:
- The `$this->checkers` array in the constructor
- An existing checker method (e.g., `checkPythonAi()`) to copy the pattern
- The `getLogsForService()` and `getMetricsForService()` match arms

- [ ] **Step 2: Add StudyAgent checker**

Add to the `$this->checkers` array:
```php
'study-agent' => fn () => $this->checkStudyAgent(),
```

Create the checker method following the existing pattern:
```php
private function checkStudyAgent(): array
{
    try {
        $response = Http::timeout(5)->get(
            config('services.ai.url') . '/study-agent/health'
        );

        if ($response->successful()) {
            $data = $response->json();
            return [
                'key' => 'study-agent',
                'name' => 'Study Agent',
                'status' => 'healthy',
                'message' => 'OHDSI StudyAgent is running',
                'details' => $data,
            ];
        }

        return [
            'key' => 'study-agent',
            'name' => 'Study Agent',
            'status' => 'degraded',
            'message' => 'StudyAgent returned HTTP ' . $response->status(),
        ];
    } catch (\Exception $e) {
        return [
            'key' => 'study-agent',
            'name' => 'Study Agent',
            'status' => 'down',
            'message' => 'StudyAgent unavailable: ' . $e->getMessage(),
        ];
    }
}
```

Add a `'study-agent'` case to `getLogsForService()` and `getMetricsForService()` if they exist (return empty arrays if no logs/metrics are available yet).

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/SystemHealthController.php
git commit -m "feat: add StudyAgent health check to SystemHealthPage"
```

---

### Task 11: Add Frontend Types File

**Files:**
- Create: `frontend/src/features/study-agent/types.ts`

The existing `api.ts` has inline types. Extract them to a dedicated `types.ts` for consistency with other feature modules.

- [ ] **Step 1: Create types.ts**

```typescript
export interface PhenotypeSearchResult {
  cohortId: number;
  name: string;
  description: string;
  score: number;
  tags?: string[];
}

export interface PhenotypeRecommendation {
  cohortId: number;
  name: string;
  rationale: string;
  score: number;
}

export interface IntentSplitResult {
  target: string;
  outcome: string;
  rationale?: string;
}

export interface LintWarning {
  rule: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface ConceptSetFinding {
  finding: string;
  severity: "info" | "warning" | "error";
  suggestion?: string;
}

export interface CombinedLintResult {
  cohort_findings: Record<string, unknown>;
  concept_set_findings: Record<string, unknown>;
}

export interface StudyAgentHealth {
  status: string;
  mcp_status?: string;
  index_status?: {
    total_phenotypes: number;
    index_type: string;
  };
}

export type StudyDesignerTab =
  | "intent"
  | "search"
  | "recommend"
  | "lint";
```

- [ ] **Step 2: Update api.ts to import from types.ts**

In `api.ts`, replace the inline interface definitions with:
```typescript
import type {
  PhenotypeSearchResult,
  PhenotypeRecommendation,
  IntentSplitResult,
  LintWarning,
  CombinedLintResult,
  StudyAgentHealth,
} from "./types";

export type {
  PhenotypeSearchResult,
  PhenotypeRecommendation,
  IntentSplitResult,
  LintWarning,
  CombinedLintResult,
  StudyAgentHealth,
};
```

Remove the inline `export interface` blocks that are now in `types.ts`.

- [ ] **Step 3: Verify the frontend builds**

```bash
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/study-agent/types.ts frontend/src/features/study-agent/api.ts
git commit -m "refactor: extract StudyAgent types to dedicated types.ts"
```

---

## Chunk 4: Integration Testing + Deploy

### Task 12: Build and Start StudyAgent Container

- [ ] **Step 1: Build the study-agent image**

```bash
cd /home/smudoshi/Github/Parthenon
docker compose build study-agent
```

- [ ] **Step 2: Start the container**

```bash
docker compose up -d study-agent
```

- [ ] **Step 3: Verify health**

```bash
docker compose ps study-agent
curl -s http://localhost:8765/health | python -m json.tool
```

Expected: Container is `healthy`, health endpoint returns MCP status

- [ ] **Step 4: Pull embedding model if needed**

```bash
ollama pull qwen3-embedding:4b
```

---

### Task 13: End-to-End Smoke Test

- [ ] **Step 1: Test phenotype search via ACP directly**

```bash
curl -s -X POST http://localhost:8765/tools/call \
  -H "Content-Type: application/json" \
  -d '{"name": "phenotype_search", "arguments": {"query": "type 2 diabetes", "top_k": 3}}' | python -m json.tool
```

Expected: Returns phenotype search results

- [ ] **Step 2: Test through Laravel proxy**

```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:8082/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@acumenus.net", "password": "superuser"}' | python -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Test phenotype search
curl -s -X POST http://localhost:8082/api/v1/study-agent/phenotype/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "diabetes"}' | python -m json.tool
```

Expected: Returns `{"data": {...}}` with search results

- [ ] **Step 3: Test cohort lint**

```bash
curl -s -X POST http://localhost:8082/api/v1/study-agent/cohort/lint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cohort_definition": {"ConceptSets": [], "PrimaryCriteria": {}}}' | python -m json.tool
```

Expected: Returns lint findings (empty concept sets should be flagged)

- [ ] **Step 4: Rebuild frontend and verify UI**

```bash
cd /home/smudoshi/Github/Parthenon
./deploy.sh --frontend
```

Navigate to `https://parthenon.acumenus.net/study-designer` and verify:
- All 4 tabs render
- Intent splitting works
- Phenotype search returns results
- Cohort lint produces findings

---

### Task 14: Final Commit + Push

- [ ] **Step 1: Stage all remaining changes**

```bash
git add -A
git status
```

Review staged files — ensure no secrets (.env, .claudeapikey, .resendapikey) are included.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: complete Study Designer integration with OHDSI StudyAgent

- Git submodule for upstream StudyAgent updates
- Docker sidecar with MCP readiness polling
- FastAPI proxy with connection pooling + per-endpoint timeouts
- Laravel Form Requests + role/throttle middleware
- Feature flag (VITE_STUDY_AGENT_ENABLED)
- SystemHealth integration
- Convenience endpoints (lint-cohort, recommend-phenotypes)"
```

- [ ] **Step 3: Push**

```bash
git push origin feature/chromadb-abby-brain
```

- [ ] **Step 4: Deploy**

```bash
./deploy.sh
```
