# Claude Agent SDK — Study Designer Agent (Phase 0 + Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an autonomous, tool-using Claude Agent SDK agent inside the `python-ai` service that powers the Study Designer wizard, streaming over Laravel Reverb, with a read-only-safe first slice (search concepts, fetch guidance, recommend phenotypes, draft concept sets — no canonical materialization yet).

**Architecture:** A reusable `ParthenonAgentService` (Python, Claude Agent SDK) runs the agent loop. Its custom MCP tools are thin authenticated clients that call existing Laravel study-design routes via `http://nginx:80` using a short-lived RBAC-scoped Sanctum token minted by Laravel. The agent publishes streaming events directly to Reverb (Pusher protocol); the React `AgentCopilotPanel` subscribes to a private channel via the existing `laravel-echo` setup. PHP stays the source of truth for all writes.

**Tech Stack:** Python 3.12 / FastAPI / `claude-agent-sdk` / `pusher` / `httpx` / `respx` / pytest · Laravel 11 / Sanctum / Reverb / Pest · React 19 / TypeScript / TanStack Query / Zustand / laravel-echo / Vitest.

**Spec:** `docs/superpowers/specs/2026-05-21-claude-agent-sdk-study-designer-design.md`

---

## Key facts this plan depends on (verified)

- Routes nest under `studies/{study}/design-sessions/{session}/versions/{version}/...`; `{study}` is route-model-bound and resolves by slug. All under `auth:sanctum`.
- Target Laravel routes (all exist): `GET .../guidance` (`permission:studies.view`), `POST .../phenotypes/recommend` (`permission:studies.create`,`throttle:10,1`, no body, returns 201 `{data}`), `POST .../concept-sets/draft` (`permission:studies.create`,`throttle:10,1`, inline-validated, returns 201 `{data}`), `GET /api/v1/vocabulary/search` (`auth:sanctum` only; params `q,domain,vocabulary,standard,limit,offset`; returns `{data,total,...}`).
- python-ai → Laravel pattern already exists: `ai/app/agency/api_client.py::AgencyApiClient` (async httpx, `Authorization: Bearer`, base `settings.agency_api_base_url = "http://nginx:80"`, calls `/api/v1/{path}`).
- Config singleton: `ai/app/config.py` → `class Settings(BaseSettings)` → `settings = Settings()`. No `reverb_*` fields yet.
- python-ai compose block has **no** `REVERB_*` env and **no** `env_file`; runs as `${HOST_UID}:${HOST_GID}`, `uvicorn ... --workers 1`. Image `docker/python/Dockerfile` (python:3.12-slim, **no Node.js**).
- `claude-agent-sdk` and `pusher`/`respx` are **not** in `ai/requirements.txt`. Test deps in `ai/requirements-dev.txt` (pytest 9, pytest-asyncio 1.3, `asyncio_mode="auto"`).
- Reverb runs (`reverb:8080`, Pusher-compatible). Frontend `frontend/src/lib/echo.ts` (singleton `getEcho()`, `broadcaster:"reverb"`, `authEndpoint:"/api/broadcasting/auth"`), `laravel-echo@^2`, `pusher-js@^8` present. Private-channel + ownership precedent: `commons.channel.{channelId}` in `backend/routes/channels.php`.
- TanStack hooks live in `frontend/src/features/studies/hooks/useStudies.ts`; query keys are hierarchical `["studies", slug, "design-sessions", sessionId, "versions", versionId, <leaf>]`; shared invalidator `invalidateStudyDesignCompiler(qc, slug, sessionId, versionId?)`.

---

## File structure (created/modified)

**Python (`ai/`)**
- Create `ai/app/agents/__init__.py`
- Create `ai/app/agents/reverb_publisher.py` — publishes typed events to Reverb (Pusher protocol)
- Create `ai/app/agents/study_design_tools.py` — `@tool` definitions + Laravel client
- Create `ai/app/agents/profiles.py` — `AgentProfile` dataclass + `study_design` profile (system prompt, model/effort)
- Create `ai/app/agents/service.py` — `ParthenonAgentService` (runs a turn, streams to Reverb)
- Create `ai/app/agents/registry.py` — in-memory session/turn registry with concurrency cap
- Create `ai/app/routers/study_designer.py` — FastAPI router `/study-designer/*`
- Modify `ai/app/main.py` — register the router
- Modify `ai/app/config.py` — add agent + reverb settings
- Modify `ai/requirements.txt` — add `claude-agent-sdk`, `pusher`
- Modify `ai/requirements-dev.txt` — add `respx`
- Modify `docker/python/Dockerfile` — add Node.js + Claude Code CLI
- Modify `docker-compose.yml` — add `REVERB_*` + `AGENT_*` env to `python-ai`
- Create tests: `ai/tests/test_reverb_publisher.py`, `ai/tests/test_study_design_tools.py`, `ai/tests/test_agent_service.py`, `ai/tests/test_study_designer_router.py`

**Laravel (`backend/`)**
- Create migration `database/migrations/2026_05_21_000000_create_study_design_agent_sessions_table.php`
- Create `app/Models/StudyDesign/StudyDesignAgentSession.php`
- Create `app/Http/Controllers/Api/V1/StudyDesignAgentController.php`
- Modify `routes/api.php` — agent routes under the design-sessions group
- Modify `routes/channels.php` — `study-design.session.{session}` private channel
- Create tests: `tests/Feature/Api/V1/StudyDesignAgentSessionTest.php`, `tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php`

**Frontend (`frontend/`)**
- Create `src/features/studies/api/agentApi.ts` — fns + Zod schemas + event types
- Create `src/features/studies/hooks/useStudyDesignerAgent.ts` — TanStack hooks + Echo subscription
- Create `src/features/studies/stores/studyDesignerAgentStore.ts` — Zustand event store
- Create `src/features/studies/components/v2/agent/AgentCopilotPanel.tsx`
- Create `src/features/studies/components/v2/agent/AgentTranscript.tsx`
- Modify `src/features/studies/components/v2/StudyDesignerWizard.tsx` — mount the panel
- Modify `src/i18n/resources.ts` — agent panel strings
- Create tests: `src/features/studies/stores/studyDesignerAgentStore.test.ts`, `src/features/studies/components/v2/agent/AgentCopilotPanel.test.tsx`

---

# PHASE 0 — Foundations

Goal: the Agent SDK runs inside the container, config + transport plumbing exist, and a Python→Reverb→Echo round trip is proven. No user-facing behavior yet.

### Task 0.1: Add dependencies (Agent SDK, pusher, respx)

**Files:**
- Modify: `ai/requirements.txt`
- Modify: `ai/requirements-dev.txt`

- [ ] **Step 1: Add runtime deps to `ai/requirements.txt`**

Append after line 22 (`anthropic>=0.42.0`):

```
claude-agent-sdk>=0.1.0
pusher>=3.3.2
```

- [ ] **Step 2: Add dev dep to `ai/requirements-dev.txt`**

Append:

```
respx>=0.22.0
```

- [ ] **Step 3: Commit**

```bash
git add ai/requirements.txt ai/requirements-dev.txt
git commit -m "chore(ai): add claude-agent-sdk, pusher, respx deps"
```

---

### Task 0.2: Install Node.js + Claude Code CLI in the python-ai image

The Python Agent SDK launches the Claude Code CLI as a subprocess over stdio; the `python:3.12-slim` image has no Node.js or CLI. Add both.

**Files:**
- Modify: `docker/python/Dockerfile`

- [ ] **Step 1: Read the Dockerfile to find the apt/install layer and the USER directive**

Run: `sed -n '1,80p' docker/python/Dockerfile`
Expected: a `FROM python:3.12-slim`, an `apt-get install` block (build-essential, curl, git, libpq-dev), a spaCy model download, an `appuser` creation, and a final `USER` line.

- [ ] **Step 2: Add a Node.js + Claude Code CLI layer BEFORE the `USER`/non-root switch**

Insert after the existing `apt-get install ...` layer (keep root for this layer):

```dockerfile
# Node.js 20 + Claude Code CLI (required by claude-agent-sdk, which shells out to the CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 3: Rebuild the image**

Run: `docker compose build python-ai`
Expected: build succeeds; `nodejs` and `@anthropic-ai/claude-code` install without error.

- [ ] **Step 4: Verify the CLI is on PATH inside the container**

Run: `docker compose run --rm --entrypoint sh python-ai -lc "node --version && claude --version"`
Expected: prints a Node v20.x line and a Claude Code CLI version line.

- [ ] **Step 5: Commit**

```bash
git add docker/python/Dockerfile
git commit -m "build(ai): install Node.js 20 + Claude Code CLI for claude-agent-sdk"
```

---

### Task 0.3: Add agent + Reverb settings to config

**Files:**
- Modify: `ai/app/config.py`

- [ ] **Step 1: Write the failing test**

Create `ai/tests/test_agent_config.py`:

```python
from app.config import Settings


def test_agent_settings_have_expected_defaults():
    s = Settings()
    assert s.agent_model == "claude-opus-4-7"
    assert s.agent_effort == "xhigh"
    assert s.agent_max_turns == 24
    assert s.agent_max_budget_usd == 5.0
    assert s.agent_max_concurrent_turns == 4
    # Reverb defaults target the internal reverb container
    assert s.reverb_host == "reverb"
    assert s.reverb_port == 8080
    assert s.reverb_scheme == "http"
```

- [ ] **Step 2: Run it to confirm failure**

Run: `cd ai && python -m pytest tests/test_agent_config.py -v`
Expected: FAIL — `AttributeError: 'Settings' object has no attribute 'agent_model'`.

- [ ] **Step 3: Add the fields to `Settings` in `ai/app/config.py`**

Insert after the existing Claude block (after line 73, the `cloud_budget_cutoff_threshold` line):

```python
    # Claude Agent SDK (Study Designer agent)
    agent_model: str = "claude-opus-4-7"
    agent_effort: str = "xhigh"
    agent_max_turns: int = 24
    agent_max_budget_usd: float = 5.0
    agent_max_concurrent_turns: int = 4
    agent_approval_timeout_seconds: int = 600

    # Reverb (Pusher-protocol) — python-ai publishes agent events
    reverb_app_id: str = ""
    reverb_app_key: str = ""
    reverb_app_secret: str = ""
    reverb_host: str = "reverb"
    reverb_port: int = 8080
    reverb_scheme: str = "http"
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd ai && python -m pytest tests/test_agent_config.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ai/app/config.py ai/tests/test_agent_config.py
git commit -m "feat(ai): add Claude Agent SDK + Reverb settings"
```

---

### Task 0.4: Pass Reverb + agent env to the python-ai container

**Files:**
- Modify: `docker-compose.yml` (the `python-ai` `environment:` block)

- [ ] **Step 1: Add env lines to the `python-ai` `environment:` block**

Append to `python-ai.environment` (after the `CLOUD_MONTHLY_BUDGET_USD` line):

```yaml
      - REVERB_APP_ID=${REVERB_APP_ID}
      - REVERB_APP_KEY=${REVERB_APP_KEY}
      - REVERB_APP_SECRET=${REVERB_APP_SECRET}
      - REVERB_HOST=reverb
      - REVERB_PORT=8080
      - REVERB_SCHEME=http
      - AGENT_MODEL=${AGENT_MODEL:-claude-opus-4-7}
      - AGENT_EFFORT=${AGENT_EFFORT:-xhigh}
      - AGENT_MAX_BUDGET_USD=${AGENT_MAX_BUDGET_USD:-5}
```

Note: `config.py` reads these via `env_file=".env"` default + process env; pydantic-settings maps `REVERB_APP_ID` → `reverb_app_id` case-insensitively, so no field rename is needed.

- [ ] **Step 2: Add a `depends_on` edge so reverb is up first**

In the `python-ai.depends_on` block, add:

```yaml
      reverb:
        condition: service_started
```

- [ ] **Step 3: Validate compose**

Run: `docker compose config --quiet && echo OK`
Expected: `OK` (valid YAML; `${REVERB_APP_ID}` etc. resolve from the root `.env`).

- [ ] **Step 4: Confirm REVERB_* exist in backend/.env (used by reverb + interpolated here)**

Run: `grep -c '^REVERB_APP_ID=' backend/.env && grep -c '^BROADCAST_CONNECTION=reverb' backend/.env`
Expected: both print `1`. If `BROADCAST_CONNECTION` is not `reverb`, STOP and confirm with the user — the JS Echo client needs Reverb broadcasting; Commons messaging already relies on it, so it should be set. (Do not edit `.env` without confirmation.)

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "build(ai): pass Reverb + agent env to python-ai container"
```

---

### Task 0.5: Reverb publisher (Python → Reverb, Pusher protocol)

**Files:**
- Create: `ai/app/agents/__init__.py`
- Create: `ai/app/agents/reverb_publisher.py`
- Test: `ai/tests/test_reverb_publisher.py`

- [ ] **Step 1: Create the package marker**

Create `ai/app/agents/__init__.py`:

```python
"""Reusable Claude Agent SDK service and Study Designer profile."""
```

- [ ] **Step 2: Write the failing test**

Create `ai/tests/test_reverb_publisher.py`:

```python
from unittest.mock import MagicMock

from app.agents.reverb_publisher import ReverbPublisher, channel_for_session


def test_channel_name_is_private_prefixed():
    assert channel_for_session(42) == "private-study-design.session.42"


def test_publish_triggers_pusher_with_private_channel():
    fake_client = MagicMock()
    pub = ReverbPublisher(client=fake_client)

    pub.publish(session_id=42, event="agent.text.delta", data={"text": "hi"})

    fake_client.trigger.assert_called_once_with(
        "private-study-design.session.42",
        "agent.text.delta",
        {"text": "hi"},
    )


def test_publish_swallows_errors_fail_open():
    fake_client = MagicMock()
    fake_client.trigger.side_effect = RuntimeError("reverb down")
    pub = ReverbPublisher(client=fake_client)

    # Must not raise — streaming is best-effort; Laravel snapshot is authoritative.
    pub.publish(session_id=1, event="agent.error", data={"message": "x"})
```

- [ ] **Step 3: Run it to confirm failure**

Run: `cd ai && python -m pytest tests/test_reverb_publisher.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.agents.reverb_publisher'`.

- [ ] **Step 4: Implement `ai/app/agents/reverb_publisher.py`**

```python
"""Publish Study Designer agent events to Reverb over the Pusher HTTP protocol.

Reverb is Pusher-compatible, so we use the official ``pusher`` client pointed at
the internal ``reverb`` container. Publishing is fail-open: a transport error must
never break an in-flight agent turn (the Laravel snapshot endpoint is the
authoritative source of final state).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import pusher

from app.config import settings

logger = logging.getLogger(__name__)

_CHANNEL_PREFIX = "private-study-design.session."


def channel_for_session(session_id: int) -> str:
    """Return the private Reverb channel name for a design session."""
    return f"{_CHANNEL_PREFIX}{session_id}"


def _build_default_client() -> pusher.Pusher:
    return pusher.Pusher(
        app_id=settings.reverb_app_id,
        key=settings.reverb_app_key,
        secret=settings.reverb_app_secret,
        host=settings.reverb_host,
        port=settings.reverb_port,
        ssl=settings.reverb_scheme == "https",
    )


class ReverbPublisher:
    """Thin wrapper around a Pusher client for agent event fan-out."""

    def __init__(self, client: Optional[pusher.Pusher] = None) -> None:
        self._client = client or _build_default_client()

    def publish(self, *, session_id: int, event: str, data: dict[str, Any]) -> None:
        channel = channel_for_session(session_id)
        try:
            self._client.trigger(channel, event, data)
        except Exception as exc:  # noqa: BLE001 — fail-open by design
            logger.warning("Reverb publish failed (%s on %s): %s", event, channel, exc)
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd ai && python -m pytest tests/test_reverb_publisher.py -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add ai/app/agents/__init__.py ai/app/agents/reverb_publisher.py ai/tests/test_reverb_publisher.py
git commit -m "feat(ai): Reverb publisher for agent event fan-out"
```

---

### Task 0.6: Prove the Python→Reverb→Echo round trip (manual gate)

**Files:** none (verification only)

- [ ] **Step 1: Bring up the stack**

Run: `docker compose up -d python-ai reverb && docker compose ps`
Expected: both healthy/started.

- [ ] **Step 2: Trigger a test event from inside python-ai**

Run:
```bash
docker compose exec -T python-ai python -c "
from app.agents.reverb_publisher import ReverbPublisher
ReverbPublisher().publish(session_id=999, event='agent.text.delta', data={'text':'roundtrip-ok'})
print('published')
"
```
Expected: prints `published` with no traceback. (Reverb logs show an event on `private-study-design.session.999`.)

- [ ] **Step 3: Record the result**

If publish succeeds, Phase 0 transport is proven. If `pusher` raises an auth error, re-check `REVERB_APP_*` parity between `python-ai` env and `backend/.env`; do not proceed to Phase 1 until this passes.

---

# PHASE 1 — Read-only vertical slice

Goal: end-to-end — user opens the panel, sends a message, the agent uses tools (search concepts, get guidance, recommend phenotypes, draft concept sets) and streams its work into the panel over Reverb. Tools create only *draft* assets via existing throttled `studies.create` routes; **no canonical materialization** (Phase 2).

## 1A — Laravel: session, token, channel, endpoints

### Task 1.1: `study_design_agent_sessions` migration + model

**Files:**
- Create: `backend/database/migrations/2026_05_21_000000_create_study_design_agent_sessions_table.php`
- Create: `backend/app/Models/StudyDesign/StudyDesignAgentSession.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_design_agent_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_design_session_id')->constrained('study_design_sessions')->cascadeOnDelete();
            $table->foreignId('study_design_version_id')->nullable()->constrained('study_design_versions')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('anthropic_session_id')->nullable();
            $table->string('status', 32)->default('active'); // active|closed|error
            $table->decimal('cost_usd', 10, 4)->default(0);
            $table->unsignedBigInteger('tokens_in')->default(0);
            $table->unsignedBigInteger('tokens_out')->default(0);
            $table->unsignedBigInteger('token_id')->nullable(); // personal_access_tokens.id of the scoped token (for revocation)
            $table->timestamp('last_active_at')->nullable();
            $table->timestamps();
            $table->index(['study_design_session_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_design_agent_sessions');
    }
};
```

- [ ] **Step 2: Run the migration against the dev DB**

Run: `docker compose exec -T php php artisan migrate --path=database/migrations/2026_05_21_000000_create_study_design_agent_sessions_table.php`
Expected: `Migrated:` line. (Per project rules, never `migrate --force`; always `--path=`.)

- [ ] **Step 3: Write the model**

Create `backend/app/Models/StudyDesign/StudyDesignAgentSession.php`:

```php
<?php

namespace App\Models\StudyDesign;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyDesignAgentSession extends Model
{
    protected $fillable = [
        'study_design_session_id',
        'study_design_version_id',
        'user_id',
        'anthropic_session_id',
        'status',
        'cost_usd',
        'tokens_in',
        'tokens_out',
        'token_id',
        'last_active_at',
    ];

    protected $casts = [
        'cost_usd' => 'float',
        'tokens_in' => 'integer',
        'tokens_out' => 'integer',
        'last_active_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(StudyDesignSession::class, 'study_design_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 4: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Models/StudyDesign/StudyDesignAgentSession.php database/migrations/2026_05_21_000000_create_study_design_agent_sessions_table.php"`
Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_05_21_000000_create_study_design_agent_sessions_table.php backend/app/Models/StudyDesign/StudyDesignAgentSession.php
git commit -m "feat(studies): study_design_agent_sessions table + model"
```

---

### Task 1.2: Private channel authorization

**Files:**
- Modify: `backend/routes/channels.php`
- Test: `backend/tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php`

- [ ] **Step 1: Write the failing test (via the broadcasting auth route — no custom helper)**

Create `backend/tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php`:

```php
<?php

use App\Models\Study;
use App\Models\StudyDesign\StudyDesignSession;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('authorizes the owner and rejects a stranger on the design-session channel', function () {
    $owner = User::factory()->create();
    $study = Study::factory()->create(['owner_id' => $owner->id]);
    $session = StudyDesignSession::factory()->create([
        'study_id' => $study->id,
        'created_by' => $owner->id,
    ]);

    Sanctum::actingAs($owner);
    $this->post('/api/broadcasting/auth', [
        'socket_id' => '123.456',
        'channel_name' => "private-study-design.session.{$session->id}",
    ])->assertOk();

    $stranger = User::factory()->create();
    Sanctum::actingAs($stranger);
    $this->post('/api/broadcasting/auth', [
        'socket_id' => '123.456',
        'channel_name' => "private-study-design.session.{$session->id}",
    ])->assertForbidden();
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php"`
Expected: FAIL — the owner request is rejected (403) because the channel is not registered. (If `/api/broadcasting/auth` 404s, confirm `Broadcast::routes(['middleware' => ['auth:sanctum']])` is registered — check the broadcasting service provider / `routes/channels.php`; add it if missing before proceeding.)

- [ ] **Step 3: Register the channel in `backend/routes/channels.php`**

Append (mirroring the existing `commons.channel.{channelId}` ownership pattern):

```php
use App\Models\StudyDesign\StudyDesignSession;

Broadcast::channel('study-design.session.{session}', function ($user, int $session) {
    $design = StudyDesignSession::find($session);
    if ($design === null) {
        return false;
    }

    // Owner of the design session OR a member of its study team may listen.
    return (int) $design->created_by === (int) $user->id
        || $design->study?->team()->where('user_id', $user->id)->exists();
});
```

(If `StudyDesignSession` uses a different ownership column than `created_by`, or the study team relation differs, match the existing `StudyDesignController::authorizeVersion()` ownership logic exactly. Read that method first and mirror it.)

- [ ] **Step 4: Run the test to confirm it passes**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php"`
Expected: PASS (owner authorized, stranger forbidden).

- [ ] **Step 5: Pint + commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint routes/channels.php tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php"
git add backend/routes/channels.php backend/tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php
git commit -m "feat(studies): private Reverb channel auth for design-session agent"
```

---

### Task 1.3: Agent session controller — `start` (mint scoped token)

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/StudyDesignAgentSessionTest.php`

- [ ] **Step 1: Write the failing test (RBAC + token abilities + python-ai forwarding mocked)**

Create `backend/tests/Feature/Api/V1/StudyDesignAgentSessionTest.php`:

```php
<?php

use App\Models\Study;
use App\Models\StudyDesign\StudyDesignSession;
use App\Models\StudyDesign\StudyDesignVersion;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    foreach (['studies.view', 'studies.create'] as $p) {
        Permission::findOrCreate($p, 'web');
    }
    $this->researcher = Role::findOrCreate('researcher', 'web');
    $this->researcher->givePermissionTo(['studies.view', 'studies.create']);
});

function makeDesign(User $user): array
{
    $study = Study::factory()->create(['owner_id' => $user->id]);
    $session = StudyDesignSession::factory()->create(['study_id' => $study->id, 'created_by' => $user->id]);
    $version = StudyDesignVersion::factory()->create(['study_design_session_id' => $session->id]);

    return [$study, $session, $version];
}

it('starts an agent session and returns channel + agent session id', function () {
    // python-ai /study-designer/sessions is the only outbound call; stub it.
    Http::fake(['*' => Http::response(['ok' => true], 200)]);

    $user = User::factory()->create();
    $user->assignRole('researcher');
    [$study, $session, $version] = makeDesign($user);
    Sanctum::actingAs($user, ['*']);

    $resp = $this->postJson("/api/v1/studies/{$study->slug}/design-sessions/{$session->id}/agent/sessions", [
        'version_id' => $version->id,
    ]);

    $resp->assertCreated()
        ->assertJsonStructure(['data' => ['agent_session_id', 'channel_name']]);

    expect($resp->json('data.channel_name'))->toBe("private-study-design.session.{$session->id}");

    $this->assertDatabaseHas('study_design_agent_sessions', [
        'study_design_session_id' => $session->id,
        'user_id' => $user->id,
        'status' => 'active',
    ]);
});

it('mints a token scoped to studies.view + studies.create only', function () {
    Http::fake(['*' => Http::response(['ok' => true], 200)]);
    $user = User::factory()->create();
    $user->assignRole('researcher');
    [$study, $session, $version] = makeDesign($user);
    Sanctum::actingAs($user, ['*']);

    $this->postJson("/api/v1/studies/{$study->slug}/design-sessions/{$session->id}/agent/sessions", ['version_id' => $version->id])
        ->assertCreated();

    $token = $user->tokens()->where('name', 'study-designer-agent')->latest()->first();
    expect($token)->not->toBeNull();
    expect($token->abilities)->toEqualCanonicalizing(['studies.view', 'studies.create']);
});

it('forbids a viewer without studies.create', function () {
    Permission::findOrCreate('studies.view', 'web');
    $viewer = Role::findOrCreate('viewer', 'web');
    $viewer->givePermissionTo('studies.view');

    $user = User::factory()->create();
    $user->assignRole('viewer');
    [$study, $session, $version] = makeDesign($user);
    Sanctum::actingAs($user, ['*']);

    $this->postJson("/api/v1/studies/{$study->slug}/design-sessions/{$session->id}/agent/sessions", ['version_id' => $version->id])
        ->assertForbidden();
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/StudyDesignAgentSessionTest.php"`
Expected: FAIL — route/controller missing (404).

- [ ] **Step 3: Implement the controller**

Create `backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php`:

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Study;
use App\Models\StudyDesign\StudyDesignAgentSession;
use App\Models\StudyDesign\StudyDesignSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class StudyDesignAgentController extends Controller
{
    private const AGENT_ABILITIES = ['studies.view', 'studies.create'];

    private function aiBaseUrl(): string
    {
        return rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
    }

    /**
     * Start (or resume) an agent session for a design session: mint a scoped
     * token and hand it to the python-ai agent service.
     */
    public function start(Request $request, Study $study, StudyDesignSession $session): JsonResponse
    {
        abort_unless((int) $session->study_id === (int) $study->id, 404);
        $this->authorizeOwnership($study, $session, $request->user()->id);

        $validated = $request->validate([
            'version_id' => ['nullable', 'integer'],
        ]);

        $agentSession = StudyDesignAgentSession::create([
            'study_design_session_id' => $session->id,
            'study_design_version_id' => $validated['version_id'] ?? null,
            'user_id' => $request->user()->id,
            'status' => 'active',
            'last_active_at' => now(),
        ]);

        $newToken = $request->user()->createToken('study-designer-agent', self::AGENT_ABILITIES);
        $agentSession->update(['token_id' => $newToken->accessToken->id]);

        $channel = "private-study-design.session.{$session->id}";

        // Internal call to python-ai (internal-only network, unauthenticated —
        // same pattern as StudyIntentService). The scoped token travels in the body.
        $resp = Http::acceptJson()
            ->post($this->aiBaseUrl().'/study-designer/sessions', [
                'profile' => 'study_design',
                'agent_session_id' => $agentSession->id,
                'study_slug' => $study->slug,
                'design_session_id' => $session->id,
                'version_id' => $validated['version_id'] ?? null,
                'scoped_token' => $newToken->plainTextToken,
                'channel' => $channel,
            ]);

        if ($resp->failed()) {
            $agentSession->update(['status' => 'error']);

            return response()->json(['message' => 'Agent service unavailable'], 503);
        }

        return response()->json([
            'data' => [
                'agent_session_id' => $agentSession->id,
                'channel_name' => $channel,
            ],
        ], 201);
    }

    private function authorizeOwnership(Study $study, StudyDesignSession $session, int $userId): void
    {
        $owns = (int) $session->created_by === $userId
            || $study->team()->where('user_id', $userId)->exists();
        abort_unless($owns, 403);
    }
}
```

(If `Study` has no `team()` relation or `created_by` differs, read `StudyDesignController::authorizeVersion()` and copy its exact ownership predicate into `authorizeOwnership()`.)

- [ ] **Step 4: Register routes in `backend/routes/api.php`**

Inside the `Route::prefix('design-sessions')->group(...)` block (near the other `{session}` routes, ~line 877), add:

```php
Route::post('{session}/agent/sessions', [StudyDesignAgentController::class, 'start'])
    ->middleware(['permission:studies.create', 'throttle:20,1']);
```

And add the import near the other controller imports (~line 139):

```php
use App\Http\Controllers\Api\V1\StudyDesignAgentController;
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/StudyDesignAgentSessionTest.php"`
Expected: PASS (3 tests). If the `version_id`/`created_by`/`slug` factory fields differ, fix the factories or field names to match the real models (read them first).

- [ ] **Step 6: Pint + commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/StudyDesignAgentController.php routes/api.php tests/Feature/Api/V1/StudyDesignAgentSessionTest.php"
git add backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php backend/routes/api.php backend/tests/Feature/Api/V1/StudyDesignAgentSessionTest.php
git commit -m "feat(studies): start agent session endpoint with RBAC-scoped token"
```

---

### Task 1.4: Agent `message` + `snapshot` endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/Api/V1/StudyDesignAgentSessionTest.php`

- [ ] **Step 1: Add the failing test for `message`**

Append to `StudyDesignAgentSessionTest.php`:

```php
it('forwards a user message to python-ai and returns 202', function () {
    Http::fake([
        '*/study-designer/sessions' => Http::response(['ok' => true], 200),
        '*/study-designer/sessions/*/turn' => Http::response(['accepted' => true], 202),
    ]);

    $user = User::factory()->create();
    $user->assignRole('researcher');
    [$study, $session, $version] = makeDesign($user);
    Sanctum::actingAs($user, ['*']);

    $agent = $this->postJson("/api/v1/studies/{$study->slug}/design-sessions/{$session->id}/agent/sessions", ['version_id' => $version->id])
        ->json('data');

    $resp = $this->postJson(
        "/api/v1/studies/{$study->slug}/design-sessions/{$session->id}/agent/sessions/{$agent['agent_session_id']}/messages",
        ['text' => 'Find concept sets for type 2 diabetes', 'idempotency_key' => 'abc-123']
    );

    $resp->assertAccepted();
    Http::assertSent(fn ($req) => str_contains($req->url(), "/study-designer/sessions/{$agent['agent_session_id']}/turn"));
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/StudyDesignAgentSessionTest.php --filter='forwards a user message'"`
Expected: FAIL (404 — route missing).

- [ ] **Step 3: Add `message` + `snapshot` methods to the controller**

Append to `StudyDesignAgentController`:

```php
    public function message(Request $request, Study $study, StudyDesignSession $session, StudyDesignAgentSession $agentSession): JsonResponse
    {
        abort_unless((int) $session->study_id === (int) $study->id, 404);
        abort_unless((int) $agentSession->study_design_session_id === (int) $session->id, 404);
        $this->authorizeOwnership($study, $session, $request->user()->id);

        $validated = $request->validate([
            'text' => ['required', 'string', 'max:8000'],
            'idempotency_key' => ['required', 'string', 'max:128'],
        ]);

        $agentSession->update(['last_active_at' => now()]);

        $resp = Http::acceptJson()
            ->post($this->aiBaseUrl()."/study-designer/sessions/{$agentSession->id}/turn", [
                'text' => $validated['text'],
                'idempotency_key' => $validated['idempotency_key'],
            ]);

        if ($resp->failed()) {
            return response()->json(['message' => 'Agent service unavailable'], 503);
        }

        return response()->json(['data' => ['accepted' => true]], 202);
    }

    public function snapshot(Request $request, Study $study, StudyDesignSession $session, StudyDesignAgentSession $agentSession): JsonResponse
    {
        abort_unless((int) $session->study_id === (int) $study->id, 404);
        abort_unless((int) $agentSession->study_design_session_id === (int) $session->id, 404);
        $this->authorizeOwnership($study, $session, $request->user()->id);

        return response()->json(['data' => [
            'agent_session_id' => $agentSession->id,
            'status' => $agentSession->status,
            'cost_usd' => $agentSession->cost_usd,
            'tokens_in' => $agentSession->tokens_in,
            'tokens_out' => $agentSession->tokens_out,
            'channel_name' => "private-study-design.session.{$session->id}",
        ]]);
    }
```

- [ ] **Step 4: Add the routes**

```php
Route::post('{session}/agent/sessions/{agentSession}/messages', [StudyDesignAgentController::class, 'message'])
    ->middleware(['permission:studies.create', 'throttle:30,1']);
Route::get('{session}/agent/sessions/{agentSession}/snapshot', [StudyDesignAgentController::class, 'snapshot'])
    ->middleware('permission:studies.view');
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/StudyDesignAgentSessionTest.php"`
Expected: PASS (4 tests).

- [ ] **Step 6: Pint + commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/StudyDesignAgentController.php routes/api.php tests/Feature/Api/V1/StudyDesignAgentSessionTest.php"
git add backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php backend/routes/api.php backend/tests/Feature/Api/V1/StudyDesignAgentSessionTest.php
git commit -m "feat(studies): agent message + snapshot endpoints"
```

---

## 1B — Python: tools, profile, service, router

### Task 1.5: Study-design tool client + read tools

**Files:**
- Create: `ai/app/agents/study_design_tools.py`
- Test: `ai/tests/test_study_design_tools.py`

- [ ] **Step 1: Write the failing test (Laravel mocked with respx)**

Create `ai/tests/test_study_design_tools.py`:

```python
import httpx
import pytest
import respx

from app.agents.study_design_tools import StudyDesignToolContext, build_tool_pack

BASE = "http://nginx:80/api/v1"


def _ctx() -> StudyDesignToolContext:
    return StudyDesignToolContext(
        study_slug="t2dm-study",
        design_session_id=7,
        version_id=3,
        auth_token="scoped-token-xyz",
    )


@respx.mock
async def test_search_concepts_calls_vocabulary_search():
    route = respx.get(f"{BASE}/vocabulary/search").mock(
        return_value=httpx.Response(200, json={"data": [{"concept_id": 201826, "concept_name": "Type 2 diabetes mellitus"}], "total": 1})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["search_concepts"].handler({"query": "type 2 diabetes", "limit": 5})

    assert route.called
    sent = route.calls.last.request
    assert sent.headers["authorization"] == "Bearer scoped-token-xyz"
    assert "type 2 diabetes" in sent.url.params["q"]
    assert "Type 2 diabetes mellitus" in result["content"][0]["text"]


@respx.mock
async def test_get_guidance_uses_nested_path():
    respx.get(f"{BASE}/studies/t2dm-study/design-sessions/7/versions/3/guidance").mock(
        return_value=httpx.Response(200, json={"data": {"initial_gate": {"status": "blocked"}}})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_guidance"].handler({})
    assert "blocked" in result["content"][0]["text"]


@respx.mock
async def test_draft_concept_sets_posts_validated_shape():
    route = respx.post(f"{BASE}/studies/t2dm-study/design-sessions/7/versions/3/concept-sets/draft").mock(
        return_value=httpx.Response(201, json={"data": [{"id": 99, "title": "T2DM"}]})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    drafts = [{"title": "T2DM", "concepts": [{"concept_id": 201826, "include_descendants": True}]}]
    result = await tools["draft_concept_sets"].handler({"drafts": drafts})
    assert route.called
    assert route.calls.last.request.method == "POST"
    assert "T2DM" in result["content"][0]["text"]


@respx.mock
async def test_tool_returns_error_content_on_http_failure():
    respx.get(f"{BASE}/vocabulary/search").mock(return_value=httpx.Response(403, json={"message": "Forbidden"}))
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["search_concepts"].handler({"query": "x"})
    assert result.get("is_error") is True
    assert "403" in result["content"][0]["text"]
```

- [ ] **Step 2: Run it to confirm failure**

Run: `cd ai && python -m pytest tests/test_study_design_tools.py -v`
Expected: FAIL — `ModuleNotFoundError: app.agents.study_design_tools`.

- [ ] **Step 3: Implement `ai/app/agents/study_design_tools.py`**

```python
"""Custom Claude Agent SDK tools for the Study Designer.

Each tool is a thin authenticated client over an existing Laravel study-design
route. The agent never touches the database directly: Laravel enforces RBAC,
validation, and audit, and performs all writes. Route context (study slug,
session id, version id, scoped token) is captured per session via closures.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Callable

import httpx
from claude_agent_sdk import tool

from app.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 60.0


@dataclass(frozen=True)
class StudyDesignToolContext:
    study_slug: str
    design_session_id: int
    version_id: int | None
    auth_token: str

    @property
    def version_base(self) -> str:
        return (
            f"studies/{self.study_slug}/design-sessions/{self.design_session_id}"
            f"/versions/{self.version_id}"
        )


def _api_url(path: str) -> str:
    base = settings.agency_api_base_url.rstrip("/")
    return f"{base}/api/v1/{path.lstrip('/')}"


def _text(payload: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(payload, default=str)[:20000]}]}


def _error(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "is_error": True}


async def _request(ctx: StudyDesignToolContext, method: str, path: str, *, params: dict | None = None, json_body: dict | None = None) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {ctx.auth_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(method, _api_url(path), headers=headers, params=params, json=json_body)
    except httpx.HTTPError as exc:
        return _error(f"tool transport error calling {path}: {exc}")

    if resp.status_code >= 400:
        return _error(f"Laravel returned {resp.status_code} for {path}: {resp.text[:500]}")
    try:
        body = resp.json()
    except ValueError:
        body = {"raw": resp.text[:2000]}
    return _text(body.get("data", body))


def build_tool_pack(ctx: StudyDesignToolContext) -> list:
    """Return the read/draft tool list for a session (Phase 1 — no materialization)."""

    @tool("search_concepts", "Search the OMOP vocabulary for standard concepts by free text. Use before drafting concept sets.", {"query": str, "domain": str, "vocabulary": str, "limit": int})
    async def search_concepts(args: dict[str, Any]) -> dict[str, Any]:
        params = {"q": args["query"], "limit": args.get("limit", 20)}
        if args.get("domain"):
            params["domain"] = args["domain"]
        if args.get("vocabulary"):
            params["vocabulary"] = args["vocabulary"]
        return await _request(ctx, "GET", "vocabulary/search", params=params)

    @tool("get_guidance", "Get the current Study Design Compiler guidance: readiness gates, blocking issues, and next-best-actions for this version.", {})
    async def get_guidance(args: dict[str, Any]) -> dict[str, Any]:
        return await _request(ctx, "GET", f"{ctx.version_base}/guidance")

    @tool("recommend_phenotypes", "Recommend phenotype candidates for this version's intent. Stages draft assets; does not modify canonical study records.", {})
    async def recommend_phenotypes(args: dict[str, Any]) -> dict[str, Any]:
        return await _request(ctx, "POST", f"{ctx.version_base}/phenotypes/recommend", json_body={})

    @tool(
        "draft_concept_sets",
        "Draft one or more concept sets as proposals. Each draft needs a title and a non-empty concepts list of {concept_id, include_descendants?, is_excluded?, include_mapped?}. Stages drafts only; materialization requires human approval (not available yet).",
        {"drafts": list},
    )
    async def draft_concept_sets(args: dict[str, Any]) -> dict[str, Any]:
        return await _request(ctx, "POST", f"{ctx.version_base}/concept-sets/draft", json_body={"drafts": args["drafts"]})

    return [search_concepts, get_guidance, recommend_phenotypes, draft_concept_sets]
```

Note: the `@tool` decorator returns an object exposing `.name` and an async `.handler`. If the installed `claude-agent-sdk` version names the callable attribute differently, adjust the test's `tools[name].handler(...)` accordingly after Step 4 (inspect with `dir()`), but keep the implementation unchanged.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd ai && python -m pytest tests/test_study_design_tools.py -v`
Expected: PASS (4 tests). If `.handler` is not the attribute exposed by the SDK's `@tool`, run `cd ai && python -c "from claude_agent_sdk import tool; t=tool('x','y',{})(lambda a: a); print([a for a in dir(t) if not a.startswith('__')])"` and update the test to call the correct attribute.

- [ ] **Step 5: Commit**

```bash
git add ai/app/agents/study_design_tools.py ai/tests/test_study_design_tools.py
git commit -m "feat(ai): study-design agent tools (search, guidance, recommend, draft)"
```

---

### Task 1.6: Agent profile

**Files:**
- Create: `ai/app/agents/profiles.py`
- Test: `ai/tests/test_agent_profiles.py`

- [ ] **Step 1: Write the failing test**

Create `ai/tests/test_agent_profiles.py`:

```python
from app.agents.profiles import get_profile, STUDY_DESIGN


def test_study_design_profile_locks_model_and_effort():
    p = get_profile("study_design")
    assert p.name == "study_design"
    assert p.model == "claude-opus-4-7"
    assert p.effort == "xhigh"
    assert "study" in p.system_prompt.lower()


def test_unknown_profile_raises():
    import pytest

    with pytest.raises(KeyError):
        get_profile("does-not-exist")
```

- [ ] **Step 2: Run it to confirm failure**

Run: `cd ai && python -m pytest tests/test_agent_profiles.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `ai/app/agents/profiles.py`**

```python
"""Agent profiles: a profile bundles a system prompt + model/effort for a domain.

The Study Designer is the first profile. Future assistive features add profiles
without touching the generic ParthenonAgentService.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings

_STUDY_DESIGN_SYSTEM_PROMPT = """You are the Study Designer assistant for Parthenon, an OHDSI outcomes-research platform built on OMOP CDM v5.4.

You help a clinical researcher design an observational study step by step: clarifying intent (PICO), finding standard OMOP concepts, drafting concept sets, recommending phenotypes, and reading the Study Design Compiler's readiness guidance.

Rules:
- Use the provided tools to do real work. Never invent concept_ids — always confirm them with search_concepts against the OMOP vocabulary.
- Prefer standard concepts. Explain clinical rationale for each concept set you draft.
- Drafting stages proposals only; it never commits canonical study records. Tell the user when something is a draft awaiting their review.
- Call get_guidance to ground your suggestions in the current readiness gates and next-best-actions.
- Be concise and clinical. Use correct OMOP terminology (domain, vocabulary, descendants, standard concept).
- You cannot read the filesystem, run shell commands, or browse the web. Your only capabilities are the study-design tools provided.
"""


@dataclass(frozen=True)
class AgentProfile:
    name: str
    system_prompt: str
    model: str
    effort: str


STUDY_DESIGN = AgentProfile(
    name="study_design",
    system_prompt=_STUDY_DESIGN_SYSTEM_PROMPT,
    model=settings.agent_model,
    effort=settings.agent_effort,
)

_PROFILES = {STUDY_DESIGN.name: STUDY_DESIGN}


def get_profile(name: str) -> AgentProfile:
    return _PROFILES[name]
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd ai && python -m pytest tests/test_agent_profiles.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ai/app/agents/profiles.py ai/tests/test_agent_profiles.py
git commit -m "feat(ai): study_design agent profile (Opus 4.7 xhigh)"
```

---

### Task 1.7: ParthenonAgentService (run a turn, stream to Reverb)

**Files:**
- Create: `ai/app/agents/service.py`
- Test: `ai/tests/test_agent_service.py`

- [ ] **Step 1: Write the failing test (SDK + publisher mocked)**

Create `ai/tests/test_agent_service.py`:

```python
from dataclasses import dataclass
from unittest.mock import MagicMock

import pytest

from app.agents.service import ParthenonAgentService, AgentSessionState
from app.agents.study_design_tools import StudyDesignToolContext


@dataclass
class _FakeTextBlock:
    text: str


@dataclass
class _FakeAssistantMessage:
    content: list


@dataclass
class _FakeResultMessage:
    total_cost_usd: float
    session_id: str
    usage: dict


class _FakeClient:
    """Stand-in for ClaudeSDKClient that yields a scripted response."""

    def __init__(self, *args, **kwargs):
        self.options = kwargs.get("options")

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def query(self, prompt):
        self._prompt = prompt

    async def receive_response(self):
        yield _FakeAssistantMessage(content=[_FakeTextBlock(text="Here are the concepts.")])
        yield _FakeResultMessage(total_cost_usd=0.12, session_id="sess-abc", usage={"input_tokens": 100, "output_tokens": 40})


def _state() -> AgentSessionState:
    ctx = StudyDesignToolContext("t2dm", 7, 3, "tok")
    return AgentSessionState(agent_session_id=11, design_session_id=7, profile_name="study_design", tool_context=ctx, anthropic_session_id=None)


async def test_run_turn_publishes_text_and_done(monkeypatch):
    publisher = MagicMock()
    # Patch the SDK client + message classes used for isinstance checks.
    import app.agents.service as svc
    monkeypatch.setattr(svc, "ClaudeSDKClient", _FakeClient)
    monkeypatch.setattr(svc, "AssistantMessage", _FakeAssistantMessage)
    monkeypatch.setattr(svc, "TextBlock", _FakeTextBlock)
    monkeypatch.setattr(svc, "ResultMessage", _FakeResultMessage)

    service = ParthenonAgentService(publisher=publisher)
    state = _state()
    await service.run_turn(state, "find diabetes concept sets")

    events = [c.kwargs["event"] for c in publisher.publish.call_args_list]
    assert "agent.text.delta" in events
    assert "agent.turn.done" in events
    # session id captured for resume
    assert state.anthropic_session_id == "sess-abc"
    # cost surfaced on the done event
    done = next(c for c in publisher.publish.call_args_list if c.kwargs["event"] == "agent.turn.done")
    assert done.kwargs["data"]["cost_usd"] == 0.12
```

- [ ] **Step 2: Run it to confirm failure**

Run: `cd ai && python -m pytest tests/test_agent_service.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `ai/app/agents/service.py`**

```python
"""ParthenonAgentService — runs one agent turn and streams events to Reverb.

Phase 1: read/draft tools only, auto-approved (no can_use_tool gate yet).
Session continuity via resume=anthropic_session_id (no idle in-memory clients).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
)

from app.agents.profiles import get_profile
from app.agents.reverb_publisher import ReverbPublisher
from app.agents.study_design_tools import StudyDesignToolContext, build_tool_pack
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AgentSessionState:
    agent_session_id: int
    design_session_id: int
    profile_name: str
    tool_context: StudyDesignToolContext
    anthropic_session_id: Optional[str] = None
    cost_usd: float = 0.0
    tokens_in: int = 0
    tokens_out: int = 0
    _busy: bool = field(default=False, repr=False)


class ParthenonAgentService:
    def __init__(self, publisher: Optional[ReverbPublisher] = None) -> None:
        self._publisher = publisher or ReverbPublisher()

    def _options(self, state: AgentSessionState) -> ClaudeAgentOptions:
        profile = get_profile(state.profile_name)
        tools = build_tool_pack(state.tool_context)
        server = create_sdk_mcp_server(name="parthenon", version="1.0.0", tools=tools)
        allowed = [f"mcp__parthenon__{t.name}" for t in tools]
        return ClaudeAgentOptions(
            system_prompt=profile.system_prompt,
            model=profile.model,
            effort=profile.effort,
            mcp_servers={"parthenon": server},
            allowed_tools=allowed,
            setting_sources=[],  # never load dev .claude/ into a clinical agent
            permission_mode="acceptEdits",  # only safe domain tools are allowed anyway
            max_turns=settings.agent_max_turns,
            max_budget_usd=settings.agent_max_budget_usd,
            resume=state.anthropic_session_id,
        )

    async def run_turn(self, state: AgentSessionState, text: str) -> None:
        sid = state.design_session_id

        def emit(event: str, data: dict) -> None:
            self._publisher.publish(session_id=sid, event=event, data=data)

        emit("agent.turn.start", {"agent_session_id": state.agent_session_id})
        try:
            async with ClaudeSDKClient(options=self._options(state)) as client:
                await client.query(text)
                async for message in client.receive_response():
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                emit("agent.text.delta", {"text": block.text})
                            elif isinstance(block, ToolUseBlock):
                                emit("agent.tool.start", {"name": block.name, "input": block.input})
                    elif isinstance(message, ResultMessage):
                        state.anthropic_session_id = getattr(message, "session_id", state.anthropic_session_id)
                        cost = float(getattr(message, "total_cost_usd", 0.0) or 0.0)
                        usage = getattr(message, "usage", {}) or {}
                        state.cost_usd += cost
                        state.tokens_in += int(usage.get("input_tokens", 0) or 0)
                        state.tokens_out += int(usage.get("output_tokens", 0) or 0)
                        emit("agent.turn.done", {
                            "cost_usd": cost,
                            "tokens_in": usage.get("input_tokens", 0),
                            "tokens_out": usage.get("output_tokens", 0),
                            "anthropic_session_id": state.anthropic_session_id,
                        })
        except Exception as exc:  # noqa: BLE001
            logger.exception("agent turn failed")
            emit("agent.error", {"message": str(exc)[:500]})
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd ai && python -m pytest tests/test_agent_service.py -v`
Expected: PASS. (The test patches the SDK symbols imported into `service`, so it runs without the CLI.)

- [ ] **Step 5: Commit**

```bash
git add ai/app/agents/service.py ai/tests/test_agent_service.py
git commit -m "feat(ai): ParthenonAgentService runs a turn and streams to Reverb"
```

---

### Task 1.8: Session registry + FastAPI router

**Files:**
- Create: `ai/app/agents/registry.py`
- Create: `ai/app/routers/study_designer.py`
- Modify: `ai/app/main.py`
- Test: `ai/tests/test_study_designer_router.py`

- [ ] **Step 1: Write the failing test (router; service.run_turn patched)**

Create `ai/tests/test_study_designer_router.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_session_then_turn(monkeypatch):
    calls = {}

    async def fake_run_turn(self, state, text):
        calls["text"] = text
        calls["session"] = state.design_session_id

    import app.agents.service as svc
    monkeypatch.setattr(svc.ParthenonAgentService, "run_turn", fake_run_turn)

    create = client.post("/study-designer/sessions", json={
        "profile": "study_design",
        "agent_session_id": 11,
        "study_slug": "t2dm",
        "design_session_id": 7,
        "version_id": 3,
        "scoped_token": "tok",
        "channel": "private-study-design.session.7",
    })
    assert create.status_code == 200
    assert create.json()["agent_session_id"] == 11

    turn = client.post("/study-designer/sessions/11/turn", json={"text": "hi", "idempotency_key": "k1"})
    assert turn.status_code == 202

    # background task runs synchronously enough for the test harness
    assert calls.get("session") == 7


def test_turn_on_unknown_session_404():
    resp = client.post("/study-designer/sessions/99999/turn", json={"text": "hi", "idempotency_key": "k2"})
    assert resp.status_code == 404
```

- [ ] **Step 2: Run it to confirm failure**

Run: `cd ai && python -m pytest tests/test_study_designer_router.py -v`
Expected: FAIL — 404 on `/study-designer/sessions` (router not registered).

- [ ] **Step 3: Implement the registry**

Create `ai/app/agents/registry.py`:

```python
"""In-memory registry of active agent sessions (single-worker uvicorn).

Holds AgentSessionState by agent_session_id. Bounded concurrency for in-flight
turns. Not persisted — Laravel owns durable session state; the registry is a
per-process cache rebuilt on /sessions create.
"""

from __future__ import annotations

import asyncio
from typing import Optional

from app.agents.service import AgentSessionState
from app.config import settings

_sessions: dict[int, AgentSessionState] = {}
_turn_semaphore = asyncio.Semaphore(settings.agent_max_concurrent_turns)


def put(state: AgentSessionState) -> None:
    _sessions[state.agent_session_id] = state


def get(agent_session_id: int) -> Optional[AgentSessionState]:
    return _sessions.get(agent_session_id)


def drop(agent_session_id: int) -> None:
    _sessions.pop(agent_session_id, None)


def turn_slot() -> asyncio.Semaphore:
    return _turn_semaphore
```

- [ ] **Step 4: Implement the router**

Create `ai/app/routers/study_designer.py`:

```python
"""Study Designer agent endpoints (called by Laravel, internal-only)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from app.agents import registry
from app.agents.service import AgentSessionState, ParthenonAgentService
from app.agents.study_design_tools import StudyDesignToolContext

router = APIRouter()
logger = logging.getLogger(__name__)

_service = ParthenonAgentService()


class CreateSessionRequest(BaseModel):
    profile: str = "study_design"
    agent_session_id: int
    study_slug: str
    design_session_id: int
    version_id: int | None = None
    scoped_token: str
    channel: str


class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    idempotency_key: str


@router.post("/sessions")
async def create_session(body: CreateSessionRequest) -> dict:
    ctx = StudyDesignToolContext(
        study_slug=body.study_slug,
        design_session_id=body.design_session_id,
        version_id=body.version_id,
        auth_token=body.scoped_token,
    )
    state = AgentSessionState(
        agent_session_id=body.agent_session_id,
        design_session_id=body.design_session_id,
        profile_name=body.profile,
        tool_context=ctx,
    )
    registry.put(state)
    return {"agent_session_id": body.agent_session_id, "channel": body.channel}


async def _run(agent_session_id: int, text: str) -> None:
    state = registry.get(agent_session_id)
    if state is None:
        return
    async with registry.turn_slot():
        await _service.run_turn(state, text)


@router.post("/sessions/{agent_session_id}/turn", status_code=202)
async def turn(agent_session_id: int, body: TurnRequest, background: BackgroundTasks) -> dict:
    if registry.get(agent_session_id) is None:
        raise HTTPException(status_code=404, detail="agent session not found")
    background.add_task(_run, agent_session_id, body.text)
    return {"accepted": True}
```

- [ ] **Step 5: Register the router in `ai/app/main.py`**

Append to the `OPTIONAL_ROUTERS` list:

```python
    ("app.routers.study_designer", {"prefix": "/study-designer", "tags": ["study-designer"]}),
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `cd ai && python -m pytest tests/test_study_designer_router.py -v`
Expected: PASS (2 tests). FastAPI `BackgroundTasks` run after the response within `TestClient`, so `calls["session"]` is populated by assertion time.

- [ ] **Step 7: Run the whole python suite**

Run: `cd ai && python -m pytest tests/ -q`
Expected: all green (new tests + existing).

- [ ] **Step 8: Commit**

```bash
git add ai/app/agents/registry.py ai/app/routers/study_designer.py ai/app/main.py ai/tests/test_study_designer_router.py
git commit -m "feat(ai): /study-designer agent router + session registry"
```

---

## 1C — Frontend: API, store, panel

### Task 1.9: Agent API module (Zod schemas + functions)

**Files:**
- Create: `frontend/src/features/studies/api/agentApi.ts`

- [ ] **Step 1: Implement `agentApi.ts`**

```typescript
import { z } from "zod";
import apiClient from "@/lib/api-client";

const base = (slug: string, sessionId: number) =>
  `/studies/${slug}/design-sessions/${sessionId}/agent/sessions`;

export const startAgentSessionResponse = z.object({
  agent_session_id: z.number(),
  channel_name: z.string(),
});
export type StartAgentSessionResponse = z.infer<typeof startAgentSessionResponse>;

export async function startAgentSession(
  slug: string,
  sessionId: number,
  versionId: number | null,
): Promise<StartAgentSessionResponse> {
  const { data } = await apiClient.post(base(slug, sessionId), { version_id: versionId });
  return startAgentSessionResponse.parse(data.data ?? data);
}

export async function sendAgentMessage(
  slug: string,
  sessionId: number,
  agentSessionId: number,
  text: string,
): Promise<void> {
  await apiClient.post(`${base(slug, sessionId)}/${agentSessionId}/messages`, {
    text,
    idempotency_key: crypto.randomUUID(),
  });
}

// ── Reverb event payloads ────────────────────────────────────────────────────
export const agentTextDelta = z.object({ text: z.string() });
export const agentToolStart = z.object({ name: z.string(), input: z.unknown() });
export const agentTurnDone = z.object({
  cost_usd: z.number(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  anthropic_session_id: z.string().nullable(),
});
export const agentError = z.object({ message: z.string() });

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  | { type: "done"; costUsd: number }
  | { type: "error"; message: string };
```

- [ ] **Step 2: Type-check**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/studies/api/agentApi.ts
git commit -m "feat(studies/agent): API client + Zod event schemas"
```

---

### Task 1.10: Agent event store (Zustand) + test

**Files:**
- Create: `frontend/src/features/studies/stores/studyDesignerAgentStore.ts`
- Test: `frontend/src/features/studies/stores/studyDesignerAgentStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/studies/stores/studyDesignerAgentStore.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { useStudyDesignerAgentStore } from "./studyDesignerAgentStore";

afterEach(() => {
  useStudyDesignerAgentStore.getState().reset();
});

describe("studyDesignerAgentStore", () => {
  it("starts empty and not streaming", () => {
    const s = useStudyDesignerAgentStore.getState();
    expect(s.transcript).toEqual([]);
    expect(s.isStreaming).toBe(false);
  });

  it("appends user + assistant turns and accumulates text deltas", () => {
    const st = useStudyDesignerAgentStore.getState();
    st.pushUserMessage("find diabetes concepts");
    st.applyEvent({ type: "text", text: "Searching " });
    st.applyEvent({ type: "text", text: "the vocabulary." });

    const s = useStudyDesignerAgentStore.getState();
    expect(s.transcript[0]).toEqual({ role: "user", text: "find diabetes concepts" });
    expect(s.transcript[1]).toEqual({ role: "assistant", text: "Searching the vocabulary.", tools: [] });
  });

  it("records tool calls on the active assistant turn", () => {
    const st = useStudyDesignerAgentStore.getState();
    st.pushUserMessage("hi");
    st.applyEvent({ type: "tool", name: "search_concepts", input: { query: "t2dm" } });
    const s = useStudyDesignerAgentStore.getState();
    expect(s.transcript[1].tools).toEqual([{ name: "search_concepts", input: { query: "t2dm" } }]);
  });

  it("marks streaming done and stores cost", () => {
    const st = useStudyDesignerAgentStore.getState();
    st.pushUserMessage("hi");
    st.setStreaming(true);
    st.applyEvent({ type: "done", costUsd: 0.2 });
    const s = useStudyDesignerAgentStore.getState();
    expect(s.isStreaming).toBe(false);
    expect(s.lastCostUsd).toBe(0.2);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/studies/stores/studyDesignerAgentStore.test.ts"`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the store**

Create `frontend/src/features/studies/stores/studyDesignerAgentStore.ts`:

```typescript
import { create } from "zustand";
import type { AgentEvent } from "../api/agentApi";

export interface ToolCall {
  name: string;
  input: unknown;
}

export interface TranscriptTurn {
  role: "user" | "assistant";
  text: string;
  tools?: ToolCall[];
}

interface AgentState {
  agentSessionId: number | null;
  channelName: string | null;
  transcript: TranscriptTurn[];
  isStreaming: boolean;
  lastCostUsd: number | null;
  errorMessage: string | null;
  setSession: (id: number, channel: string) => void;
  pushUserMessage: (text: string) => void;
  setStreaming: (v: boolean) => void;
  applyEvent: (event: AgentEvent) => void;
  reset: () => void;
}

function ensureAssistantTurn(transcript: TranscriptTurn[]): TranscriptTurn[] {
  const last = transcript[transcript.length - 1];
  if (last && last.role === "assistant") {
    return transcript;
  }
  return [...transcript, { role: "assistant", text: "", tools: [] }];
}

export const useStudyDesignerAgentStore = create<AgentState>((set) => ({
  agentSessionId: null,
  channelName: null,
  transcript: [],
  isStreaming: false,
  lastCostUsd: null,
  errorMessage: null,

  setSession: (id, channel) => set({ agentSessionId: id, channelName: channel }),

  pushUserMessage: (text) =>
    set((s) => ({
      transcript: [...s.transcript, { role: "user", text }],
      isStreaming: true,
      errorMessage: null,
    })),

  setStreaming: (v) => set({ isStreaming: v }),

  applyEvent: (event) =>
    set((s) => {
      if (event.type === "text") {
        const t = ensureAssistantTurn(s.transcript);
        const last = t[t.length - 1];
        const updated: TranscriptTurn = { ...last, text: last.text + event.text };
        return { transcript: [...t.slice(0, -1), updated] };
      }
      if (event.type === "tool") {
        const t = ensureAssistantTurn(s.transcript);
        const last = t[t.length - 1];
        const updated: TranscriptTurn = {
          ...last,
          tools: [...(last.tools ?? []), { name: event.name, input: event.input }],
        };
        return { transcript: [...t.slice(0, -1), updated] };
      }
      if (event.type === "done") {
        return { isStreaming: false, lastCostUsd: event.costUsd };
      }
      // error
      return { isStreaming: false, errorMessage: event.message };
    }),

  reset: () =>
    set({
      agentSessionId: null,
      channelName: null,
      transcript: [],
      isStreaming: false,
      lastCostUsd: null,
      errorMessage: null,
    }),
}));
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/studies/stores/studyDesignerAgentStore.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/studies/stores/studyDesignerAgentStore.ts frontend/src/features/studies/stores/studyDesignerAgentStore.test.ts
git commit -m "feat(studies/agent): Zustand event store"
```

---

### Task 1.11: Agent hook (start + send + Echo subscription)

**Files:**
- Create: `frontend/src/features/studies/hooks/useStudyDesignerAgent.ts`

- [ ] **Step 1: Implement the hook**

```typescript
import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import {
  agentError,
  agentTextDelta,
  agentToolStart,
  agentTurnDone,
  sendAgentMessage,
  startAgentSession,
} from "../api/agentApi";
import { useStudyDesignerAgentStore } from "../stores/studyDesignerAgentStore";
import { invalidateStudyDesignCompiler } from "./useStudies";

interface Params {
  slug: string | null;
  sessionId: number | null;
  versionId: number | null;
}

export function useStudyDesignerAgent({ slug, sessionId, versionId }: Params) {
  const qc = useQueryClient();
  const store = useStudyDesignerAgentStore();
  const subscribedRef = useRef<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => startAgentSession(slug!, sessionId!, versionId),
    onSuccess: (data) => store.setSession(data.agent_session_id, data.channel_name),
  });

  // Subscribe to the private Reverb channel once a session exists.
  useEffect(() => {
    const channel = store.channelName;
    if (!channel) return;
    const echo = getEcho();
    if (!echo) return;

    // channel_name already includes the "private-" prefix; Echo.private adds it,
    // so strip it for the .private() call.
    const name = channel.replace(/^private-/, "");
    if (subscribedRef.current === name) return;
    if (subscribedRef.current) echo.leave(subscribedRef.current);

    echo
      .private(name)
      .listen(".agent.text.delta", (e: unknown) => store.applyEvent({ type: "text", ...agentTextDelta.parse(e) }))
      .listen(".agent.tool.start", (e: unknown) => {
        const p = agentToolStart.parse(e);
        store.applyEvent({ type: "tool", name: p.name, input: p.input });
      })
      .listen(".agent.turn.done", (e: unknown) => {
        store.applyEvent({ type: "done", costUsd: agentTurnDone.parse(e).cost_usd });
        if (slug && sessionId && versionId) invalidateStudyDesignCompiler(qc, slug, sessionId, versionId);
      })
      .listen(".agent.error", (e: unknown) => store.applyEvent({ type: "error", ...agentError.parse(e) }));

    subscribedRef.current = name;
    return () => {
      echo.leave(name);
      subscribedRef.current = null;
    };
  }, [store, slug, sessionId, versionId, qc]);

  const send = useCallback(
    async (text: string) => {
      if (!slug || !sessionId || store.agentSessionId == null) return;
      store.pushUserMessage(text);
      await sendAgentMessage(slug, sessionId, store.agentSessionId, text);
    },
    [slug, sessionId, store],
  );

  return { start: startMutation.mutate, starting: startMutation.isPending, send };
}
```

Note: events are published by python-ai with raw names like `agent.text.delta` (no app namespace), so the Echo listener uses a **leading dot** (`.agent.text.delta`) — matching the Commons `.CallUpdated` convention for `broadcastAs`-style events.

- [ ] **Step 2: Type-check**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: no errors. (If `invalidateStudyDesignCompiler` is not exported from `useStudies.ts`, export it there — confirm with `grep -n "invalidateStudyDesignCompiler" frontend/src/features/studies/hooks/useStudies.ts`; it exists per the fact report but may be module-private.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/studies/hooks/useStudyDesignerAgent.ts
git commit -m "feat(studies/agent): start/send hook with Echo subscription"
```

---

### Task 1.12: AgentCopilotPanel + transcript + render test

**Files:**
- Create: `frontend/src/features/studies/components/v2/agent/AgentTranscript.tsx`
- Create: `frontend/src/features/studies/components/v2/agent/AgentCopilotPanel.tsx`
- Test: `frontend/src/features/studies/components/v2/agent/AgentCopilotPanel.test.tsx`

- [ ] **Step 1: Implement the transcript (presentational)**

Create `AgentTranscript.tsx`:

```typescript
import type { TranscriptTurn } from "../../../stores/studyDesignerAgentStore";

interface Props {
  transcript: TranscriptTurn[];
  isStreaming: boolean;
}

export function AgentTranscript({ transcript, isStreaming }: Props) {
  return (
    <div data-testid="agent-transcript" className="flex flex-col gap-3">
      {transcript.map((turn, i) => (
        <div key={i} className={turn.role === "user" ? "text-[#C9A227]" : "text-slate-100"}>
          <div className="text-xs uppercase tracking-wide opacity-60">{turn.role}</div>
          <div className="whitespace-pre-wrap">{turn.text}</div>
          {turn.tools && turn.tools.length > 0 && (
            <ul className="mt-1 text-xs text-[#2DD4BF]">
              {turn.tools.map((t, j) => (
                <li key={j}>⚙ {t.name}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {isStreaming && <div className="text-xs text-slate-400">…thinking</div>}
    </div>
  );
}
```

- [ ] **Step 2: Implement the panel**

Create `AgentCopilotPanel.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStudyDesignerAgent } from "../../../hooks/useStudyDesignerAgent";
import { useStudyDesignerAgentStore } from "../../../stores/studyDesignerAgentStore";
import { AgentTranscript } from "./AgentTranscript";

interface Props {
  slug: string | null;
  sessionId: number | null;
  versionId: number | null;
}

export function AgentCopilotPanel({ slug, sessionId, versionId }: Props) {
  const { t } = useTranslation();
  const { start, starting, send } = useStudyDesignerAgent({ slug, sessionId, versionId });
  const { transcript, isStreaming, agentSessionId, errorMessage } = useStudyDesignerAgentStore();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (agentSessionId == null && slug && sessionId) start();
  }, [agentSessionId, slug, sessionId, start]);

  return (
    <aside data-testid="agent-copilot-panel" className="flex h-full w-[360px] flex-col border-l border-white/10 bg-[#0E0E11] p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">{t("studies.agent.title", "Study Designer Assistant")}</h2>
      {errorMessage && <div className="mb-2 rounded bg-[#9B1B30]/20 p-2 text-xs text-[#9B1B30]">{errorMessage}</div>}
      <div className="flex-1 overflow-y-auto">
        <AgentTranscript transcript={transcript} isStreaming={isStreaming} />
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !isStreaming) {
            void send(draft.trim());
            setDraft("");
          }
        }}
      >
        <input
          aria-label={t("studies.agent.input", "Message the assistant")}
          className="flex-1 rounded bg-white/5 px-2 py-1 text-sm text-slate-100"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={starting || agentSessionId == null}
        />
        <button type="submit" disabled={isStreaming || agentSessionId == null} className="rounded bg-[#2DD4BF] px-3 py-1 text-sm text-black disabled:opacity-40">
          {t("common.send", "Send")}
        </button>
      </form>
    </aside>
  );
}
```

- [ ] **Step 3: Write the render test**

Create `AgentCopilotPanel.test.tsx`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentCopilotPanel } from "./AgentCopilotPanel";
import { useStudyDesignerAgentStore } from "../../../stores/studyDesignerAgentStore";

// Echo + network are not under test here; stub the hook's side effects.
vi.mock("@/lib/echo", () => ({ getEcho: () => null }));
vi.mock("../../../api/agentApi", async (orig) => {
  const actual = await orig<typeof import("../../../api/agentApi")>();
  return {
    ...actual,
    startAgentSession: vi.fn().mockResolvedValue({ agent_session_id: 1, channel_name: "private-study-design.session.7" }),
    sendAgentMessage: vi.fn().mockResolvedValue(undefined),
  };
});

function renderPanel() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AgentCopilotPanel slug="t2dm" sessionId={7} versionId={3} />
    </QueryClientProvider>,
  );
}

afterEach(() => useStudyDesignerAgentStore.getState().reset());

describe("AgentCopilotPanel", () => {
  it("renders the panel and an empty transcript", () => {
    renderPanel();
    expect(screen.getByTestId("agent-copilot-panel")).toBeInTheDocument();
    expect(screen.getByTestId("agent-transcript")).toBeInTheDocument();
  });

  it("renders streamed assistant text from the store", () => {
    renderPanel();
    useStudyDesignerAgentStore.getState().pushUserMessage("find diabetes concepts");
    useStudyDesignerAgentStore.getState().applyEvent({ type: "text", text: "Searching the vocabulary." });
    expect(screen.getByText("Searching the vocabulary.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/studies/components/v2/agent/AgentCopilotPanel.test.tsx"`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check + lint**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit && npx eslint src/features/studies/components/v2/agent src/features/studies/hooks/useStudyDesignerAgent.ts src/features/studies/stores/studyDesignerAgentStore.ts src/features/studies/api/agentApi.ts"`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/studies/components/v2/agent/
git commit -m "feat(studies/agent): copilot panel + transcript"
```

---

### Task 1.13: Add i18n strings + mount the panel in the wizard

**Files:**
- Modify: `frontend/src/i18n/resources.ts`
- Modify: `frontend/src/features/studies/components/v2/StudyDesignerWizard.tsx`

- [ ] **Step 1: Add the strings**

In `frontend/src/i18n/resources.ts`, add under the `studies` namespace (match the file's existing nesting style):

```typescript
agent: {
  title: "Study Designer Assistant",
  input: "Message the assistant",
},
```

(If the file has multiple locales, add the same keys to each; mirror the structure of an existing `studies.*` entry.)

- [ ] **Step 2: Read the wizard to find where the step content renders**

Run: `sed -n '1,80p' frontend/src/features/studies/components/v2/StudyDesignerWizard.tsx`
Expected: a layout wrapper around the active step. Identify the slug/sessionId/versionId already in scope (the wizard already loads guidance, so these are available via props or a hook).

- [ ] **Step 3: Mount the panel beside the step content**

Wrap the wizard body in a flex row and add the panel. Example edit (adapt to the actual JSX):

```tsx
import { AgentCopilotPanel } from "./agent/AgentCopilotPanel";

// ...inside the returned layout, alongside the step content:
<div className="flex h-full">
  <div className="flex-1 min-w-0">{/* existing step + stepper + footer */}</div>
  <AgentCopilotPanel slug={studySlug} sessionId={designSessionId} versionId={activeVersionId} />
</div>
```

- [ ] **Step 4: Type-check + build (vite is stricter than tsc)**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit && npx vite build"`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n/resources.ts frontend/src/features/studies/components/v2/StudyDesignerWizard.tsx
git commit -m "feat(studies/agent): mount copilot panel in the wizard"
```

---

### Task 1.14: End-to-end manual verification

**Files:** none

- [ ] **Step 1: Deploy frontend + restart services**

Run: `docker compose up -d python-ai reverb && ./deploy.sh --frontend`
Expected: clean build; services healthy.

- [ ] **Step 2: Open the Study Designer for an existing study/version**

Navigate to a study's design wizard at http://localhost:8082. Confirm the assistant panel mounts and a session starts (network: `POST .../agent/sessions` → 201; WS subscription to `private-study-design.session.{id}` authorized via `/api/broadcasting/auth`).

- [ ] **Step 3: Send a message**

Type: "Find standard OMOP concepts for type 2 diabetes and draft a concept set." Expected: assistant text streams into the panel; a `⚙ search_concepts` (and likely `⚙ draft_concept_sets`) tool row appears; a turn-done event clears the streaming indicator; the draft concept set appears in the wizard's concept-set step after query invalidation.

- [ ] **Step 4: Verify cost + audit recorded**

Run: `docker compose exec -T php php artisan tinker --execute="echo App\Models\StudyDesign\StudyDesignAgentSession::latest()->first()->cost_usd;"`
Expected: a non-zero USD value for the session (cost persistence is wired in Phase 2's turn-done handler; for Phase 1 this may be 0 — acceptable, note it).

- [ ] **Step 5: Record outcome in a short devlog**

Create `docs/devlog/modules/studies/2026-05-21-agent-sdk-phase-1.md` summarizing what works, the Reverb round-trip, and any deviations. Commit:

```bash
git add docs/devlog/modules/studies/2026-05-21-agent-sdk-phase-1.md
git commit -m "docs(studies): devlog for Agent SDK Phase 1 read-only slice"
```

---

## Self-review notes (gaps deferred by design)

- **Cost/token persistence to `study_design_agent_sessions`** and the cloud-budget ledger is wired in **Phase 2** (the turn-done handler needs an internal python-ai→Laravel callback or a Reverb-side listener). Phase 1 streams cost to the UI but may not persist it — acceptable for the slice; flagged in Task 1.14 Step 4.
- **`can_use_tool` approval gate + materialize/lock tools** = **Phase 2** (separate plan). Phase 1 deliberately exposes only search/guidance/recommend/draft (draft creates *draft* assets via existing throttled routes, never canonical records).
- **PHI sanitizer** on user free-text and **budget cutoff → deterministic fallback** = **Phase 3/4** hardening (the hooks exist: `PHISanitizer.scan`, `CostTracker.is_budget_exhausted`).
- **Scoped-token revocation on session close** (`token_id` is stored for this) and **idle eviction** = Phase 4.
- **Inline "Help with this step"** actions and the **reconnect snapshot reconciliation** (the `snapshot` endpoint exists) = Phase 3.

These are intentional phase boundaries, not omissions; each subsequent phase gets its own plan once this slice lands and is verified.
