---
doc_type: plan
status: active
date: 2026-05-25
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Claude Agent SDK — Publish Assistant (Generalize core + Phase 1 + Phase 2) Implementation Plan

**Status:** Ready to execute
**Design reference:** `docs/reference/agent-sdk-integration-playbook.md` (the Publish worked example is §6; read §10 Gotchas before any code)
**Foundation:** PR #343 (`feature/agent-sdk-study-designer`) — Phase 0 reusable core + Study Designer Phase-1 slice
**Companion to:** `docs/superpowers/plans/2026-05-21-claude-agent-sdk-study-designer.md`

---

## Decisions locked (2026-05-25)

1. **Foundation:** Live-verify PR #343 (Reverb round-trip + one real agent turn with a credited `ANTHROPIC_API_KEY` + a real tool callback), then merge to `main`. Build Publish on `main`.
2. **Core design:** **Generalize first** — `AgentToolContext`, profile-dispatched tool packs, generic `agent_sessions` table — before adding the `publish` profile.
3. **Scope:** Publish **Phase 1 (read-only) + Phase 2 (approval gate + write tools + `abilities:` route enforcement)**.

---

## Key facts this plan depends on (verified against the codebase, 2026-05-25)

- **The reusable core is NOT on `main`.** It lives only on `feature/agent-sdk-study-designer` (PR #343, OPEN, MERGEABLE). `ai/app/agents/` on `main` is empty (`__pycache__` only). Phase A lands it.
- **Publish subject = `PublicationDraft`.** Channel: `private-publish.draft.{draftId}`. Ownership: `PublicationDraftPolicy::view` (read) / `::update` (write) — already exists at `backend/app/Policies/PublicationDraftPolicy.php`.
- **Publish routes carry NO `permission:`/`role:` middleware.** They sit under `auth:sanctum` only (`backend/routes/api.php` ~L1306–1318); there is **no `publications.*` permission domain**. Per-row auth is entirely `PublicationDraftPolicy`. Agent routes therefore use `auth:sanctum` + `throttle:` + policy-based `authorizeAccess()` — **not** a `permission:` gate.
- **Existing endpoints the tools wrap:**
  - `GET /api/v1/studies?per_page=100&include=analyses` (what `useStudiesForPublish` calls)
  - `GET /api/v1/studies/{id}` (what `useStudyWithAnalyses` calls; carries analyses)
  - `GET /api/v1/publish/drafts/{draft}` (`PublicationController::showDraft`)
  - `POST /api/v1/publish/narrative` (`PublicationController::narrative`; the current one-shot)
  - **Write (Phase 2):** `PATCH /api/v1/publish/drafts/{draft}` (uses `If-Unmodified-Since` ETag), `POST /api/v1/publish/drafts/{draft}/snapshots`, `POST /api/v1/publish/report-bundles/export`
- **Mount surface:** `frontend/src/features/publish/pages/PublishPage.tsx` (896 lines). Active draft id = route param `:draftId` (null on the new-draft flow). Panel keys off that id; auto-start guard resets when it changes.
- **`narrative` request shape:** `{ section_type: "methods"|"results"|"discussion"|"caption", analysis_id?, execution_id?, context: {...} }` → `{ data: { text, section_type } }`.
- **`ReverbPublisher.publish` hardcodes `private-study-design.session.` (the `channel_for_session` helper).** Generalization MUST pass the full channel string.
- **`AgentSessionState.design_session_id` doubles as the Reverb routing key.** Generalize to `subject_id` + `channel`.
- **DB:** host PG17 via `host.docker.internal:5432`. Migrations run as `parthenon_migrator` with `--path=` (NEVER `migrate --force`). A migration commit MUST include a lineage doc (`docs/lineage/...`) or the pre-commit hook rejects it.

---

## File structure (created/modified)

```
PHASE A — land foundation (no new files; merge PR #343)

PHASE B — generalize the core (on main, after merge)
  ai/app/agents/tool_base.py                    NEW   (AgentToolContext + shared _request/_text/_error/_api_url)
  ai/app/agents/study_design_tools.py           EDIT  (use AgentToolContext; read ids from ctx.context)
  ai/app/agents/tool_packs.py                    NEW   (profile→builder registry: build_tool_pack(profile, ctx))
  ai/app/agents/service.py                       EDIT  (AgentSessionState: subject_id+channel+ingest_path; persist→ingest_path; publish→channel)
  ai/app/agents/reverb_publisher.py              EDIT  (publish(channel=...) — drop hardcoded prefix)
  ai/app/agents/profiles.py                      EDIT  (no change yet; PUBLISH added in Phase C)
  ai/app/routers/agent.py                        NEW   (generic /agent router; replaces study_designer.py)
  ai/app/routers/study_designer.py               DELETE
  ai/app/main.py                                 EDIT  (register app.routers.agent at /agent; drop study_designer)
  backend/database/migrations/<ts>_create_agent_sessions_table.php   NEW (+ data-migrate + drop study_design_agent_sessions)
  docs/lineage/<ts>-agent-sessions-table.md      NEW
  backend/app/Models/App/AgentSession.php        NEW
  backend/app/Models/App/StudyDesignAgentSession.php   DELETE (after repoint)
  backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php  EDIT (use AgentSession; post /agent/sessions; send ingest_path+context)
  frontend/src/features/studies/api/agentApi.ts  EDIT  (start posts nothing structural-new; event schemas unchanged)
  ai/tests/* + backend/tests/*                   EDIT  (repoint to generic table/router; keep green)

PHASE C — Publish Phase 1 (read-only)
  backend/app/Http/Controllers/Api/V1/PublishAgentController.php   NEW
  backend/routes/api.php                          EDIT (publish agent routes)
  backend/routes/channels.php                     EDIT (private-publish.draft.{draft})
  backend/tests/Feature/Api/V1/PublishAgentSessionTest.php         NEW
  backend/tests/Feature/Broadcasting/PublishChannelAuthTest.php    NEW
  ai/app/agents/publish_tools.py                  NEW (4 read tools)
  ai/app/agents/profiles.py                       EDIT (PUBLISH profile)
  ai/app/agents/tool_packs.py                     EDIT (register "publish")
  ai/tests/test_publish_tools.py                  NEW
  ai/tests/test_agent_profiles.py                 EDIT (assert publish profile)
  frontend/src/features/publish/api/publishAgentApi.ts             NEW
  frontend/src/features/publish/stores/publishAgentStore.ts        NEW
  frontend/src/features/publish/hooks/usePublishAgent.ts           NEW
  frontend/src/features/publish/components/agent/AgentCopilotPanel.tsx   NEW
  frontend/src/features/publish/components/agent/AgentTranscript.tsx     NEW
  frontend/src/features/publish/pages/PublishPage.tsx              EDIT (mount panel)
  frontend/src/features/publish/stores/publishAgentStore.test.ts   NEW
  frontend/src/features/publish/components/agent/AgentCopilotPanel.test.tsx  NEW

PHASE D — Publish Phase 2 (approval gate + write tools + abilities)
  ai/app/agents/service.py                        EDIT (can_use_tool callback + pending-approval futures)
  ai/app/agents/publish_tools.py                  EDIT (write tools: update_draft/create_snapshot/export)
  ai/app/routers/agent.py                         EDIT (POST /agent/sessions/{id}/approve)
  backend/app/Http/Controllers/Api/V1/PublishAgentController.php   EDIT (approve() → forward; abilities)
  backend/routes/api.php                          EDIT (approve route; abilities: on publish write routes)
  frontend/src/features/publish/* (api/store/hook/panel)           EDIT (approval cards)
  + tests across all three layers
```

---

# PHASE A — Land the foundation (PR #343)

**Goal:** the reusable core is on `main`, verified to actually run (unit tests mock the SDK and will NOT catch auth/credit/CLI/Reverb integration). This is operational, not TDD.

### Task A.1: Pre-merge environment check
- [ ] `ANTHROPIC_API_KEY` in repo-root `.env` (NOT `CLAUDE_API_KEY`), valid + **credited** with `claude-opus-4-7` access. Confirm: `docker compose exec -T python-ai sh -lc 'echo ${ANTHROPIC_API_KEY:+set}'` → `set`.
- [ ] `REVERB_APP_ID/KEY/SECRET` in repo-root `.env` (compose-interpolation source), not just `backend/.env`.
- [ ] After any `.env` edit: `docker compose up -d python-ai reverb` (NOT `restart` — env loads at creation).

### Task A.2: Check out the branch and run all suites in-container
```bash
git fetch origin && git checkout feature/agent-sdk-study-designer
git rebase origin/main          # resolve FILE-BY-FILE; never -X ours
git log origin/main..HEAD --diff-filter=D --name-only   # confirm no unexpected deletions
docker compose run --rm --entrypoint sh python-ai -lc "cd /app && python -m pytest tests/ -q"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/StudyDesignAgentSessionTest.php tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php"
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit && npx vite build"
```

### Task A.3: Live transport smoke test (Reverb)
```bash
docker compose exec -T python-ai python -c "from app.agents.reverb_publisher import ReverbPublisher; ReverbPublisher().publish(session_id=999, event='agent.text.delta', data={'text':'ok'}); print('PUBLISH-OK')"
```
- [ ] Expect `PUBLISH-OK` with no Reverb connection warning in `docker compose logs python-ai`.

### Task A.4: Live end-to-end turn (the check unit tests can't do)
- [ ] In the running app, open a study design session, open the copilot, send "Find standard concepts for type 2 diabetes." Confirm in the browser: `agent.turn.start` → streamed `agent.text.delta` → a `mcp__parthenon__search_concepts` `agent.tool.start` → `agent.turn.done` with a non-zero `cost_usd`. Confirm the `study_design_agent_sessions` row accumulated cost/tokens and stored `anthropic_session_id`.
- [ ] If "Invalid API key" / "Credit balance too low" → account/billing, not code (playbook §3). Fix the key, `up -d python-ai`, retry.

### Task A.5: Merge
- [ ] Squash-or-merge PR #343 to `main`. Pull `main`. Re-run Task A.2 suites on `main` to confirm parity.
- [ ] **Gate:** do not start Phase B until `main` has a green agent turn.

---

# PHASE B — Generalize the core

**Goal:** remove Study-Designer naming from the reusable core so a 2nd profile plugs in without copy-paste. **Invariant: all existing SD tests stay green** (refactor, not rewrite). Keep the lockdown `ClaudeAgentOptions` verbatim (playbook §7).

## 2B.1 — Python: generic context + tool-pack dispatch

### Task B.1: Extract `tool_base.py` (shared HTTP helpers + `AgentToolContext`)
- [ ] **Step 1 (test):** `ai/tests/test_tool_base.py` — assert `AgentToolContext(auth_token="t", context={"a":1})` is frozen; `_error("x")` returns `{"content":[...], "is_error": True}`; `_api_url("vocabulary/search")` → `http://nginx:80/api/v1/vocabulary/search` (mock `settings.agency_api_base_url`).
- [ ] **Step 2:** create `ai/app/agents/tool_base.py`:
```python
from __future__ import annotations
import json, logging
from dataclasses import dataclass, field
from typing import Any
import httpx
from app.config import settings

logger = logging.getLogger(__name__)
_TIMEOUT = 60.0

@dataclass(frozen=True)
class AgentToolContext:
    """Generic per-session tool context: a scoped token + a feature-specific id bag."""
    auth_token: str
    context: dict[str, Any] = field(default_factory=dict)

def api_url(path: str) -> str:
    return f"{settings.agency_api_base_url.rstrip('/')}/api/v1/{path.lstrip('/')}"

def text_result(payload: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(payload, default=str)[:20000]}]}

def error_result(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "is_error": True}

async def request(ctx: AgentToolContext, method: str, path: str, *,
                  params: dict | None = None, json_body: dict | None = None) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {ctx.auth_token}", "Accept": "application/json",
               "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(method, api_url(path), headers=headers, params=params, json=json_body)
    except httpx.HTTPError as exc:
        return error_result(f"tool transport error calling {path}: {exc}")
    if resp.status_code >= 400:
        return error_result(f"Laravel returned {resp.status_code} for {path}: {resp.text[:500]}")
    try:
        body = resp.json()
    except ValueError:
        body = {"raw": resp.text[:2000]}
    return text_result(body.get("data", body) if isinstance(body, dict) else body)
```
- [ ] **Step 3:** GREEN; commit `refactor(ai): extract generic AgentToolContext + tool_base helpers`.

### Task B.2: Refactor `study_design_tools.py` onto `AgentToolContext`
- [ ] Replace `StudyDesignToolContext` usage with `AgentToolContext`; read `study_slug = ctx.context["study_slug"]`, `design_session_id = ctx.context["design_session_id"]`, `version_id = ctx.context.get("version_id")`. Reuse `tool_base.request/error_result`. Keep `_require_version` semantics (guard `versions/None` — playbook Bug C). `build_tool_pack(ctx)` unchanged signature.
- [ ] Update `ai/tests/test_study_design_tools.py` to construct `AgentToolContext(auth_token=..., context={...})`. **Tests stay green** (same routes, same payloads).
- [ ] Commit `refactor(ai): study-design tools use generic AgentToolContext`.

### Task B.3: Tool-pack registry (`tool_packs.py`)
- [ ] **Step 1 (test):** `ai/tests/test_tool_packs.py` — `build_tool_pack("study_design", ctx)` returns the 4 SD tools; `build_tool_pack("unknown", ctx)` raises `KeyError`.
- [ ] **Step 2:**
```python
from __future__ import annotations
from collections.abc import Callable
from app.agents.tool_base import AgentToolContext
from app.agents import study_design_tools

_BUILDERS: dict[str, Callable[[AgentToolContext], list]] = {
    "study_design": study_design_tools.build_tool_pack,
}

def register(profile: str, builder: Callable[[AgentToolContext], list]) -> None:
    _BUILDERS[profile] = builder

def build_tool_pack(profile: str, ctx: AgentToolContext) -> list:
    return _BUILDERS[profile](ctx)
```
- [ ] Commit `feat(ai): profile→tool-pack registry`.

### Task B.4: Generalize `AgentSessionState` + service (`subject_id`, `channel`, `ingest_path`)
- [ ] **Step 1:** in `service.py`, change `AgentSessionState`:
```python
@dataclass
class AgentSessionState:
    agent_session_id: int
    profile_name: str
    subject_id: int          # Reverb routing key (was design_session_id)
    channel: str             # full "private-<domain>.<subject>.{id}" from Laravel
    ingest_path: str         # absolute "/api/v1/.../ingest" path Laravel gave us
    tool_context: AgentToolContext
    anthropic_session_id: Optional[str] = None
    last_idempotency_key: Optional[str] = None
```
- [ ] **Step 2:** `_options` → `build_tool_pack(state.profile_name, state.tool_context)` (import from `tool_packs`). Keep lockdown verbatim.
- [ ] **Step 3:** `run_turn` emit uses the channel: `self._publisher.publish(channel=state.channel, event=event, data=data)`.
- [ ] **Step 4:** `LaravelPersister.persist` POSTs to the path Laravel supplied:
```python
url = f"{settings.agency_api_base_url.rstrip('/')}{state.ingest_path}"
```
  (Laravel sends a fully-formed `ingest_path` per feature — the persister no longer knows feature URL structure.)
- [ ] **Step 5:** update `ai/tests/test_agent_service.py` for the new state fields + `publish(channel=...)`. GREEN. Commit `refactor(ai): generalize AgentSessionState (subject_id/channel/ingest_path)`.

### Task B.5: Generalize `ReverbPublisher.publish(channel=...)`
- [ ] Change signature to `publish(self, *, channel: str, event: str, data: dict)`; `client.trigger(channel, event, data)`. Drop `channel_for_session`/`_CHANNEL_PREFIX` (or keep a deprecated shim only if other callers exist — there are none). Fail-open unchanged.
- [ ] Update `ai/tests/test_reverb_publisher.py` to pass `channel="private-study-design.session.5"`. GREEN. Commit `refactor(ai): ReverbPublisher takes full channel name`.

### Task B.6: Generic `/agent` router (replaces `study_designer.py`)
- [ ] **Step 1 (test):** `ai/tests/test_agent_router.py` — POST `/agent/sessions` registers state with the right profile/subject/channel/ingest_path/context; `/agent/sessions/{id}/turn` returns 202 and 429 when `turn_slot().locked()`; unknown session → 404. (Mirror `test_study_designer_router.py`.)
- [ ] **Step 2:** `ai/app/routers/agent.py`:
```python
class CreateSessionRequest(BaseModel):
    profile: str
    agent_session_id: int
    subject_id: int
    channel: str
    ingest_path: str
    scoped_token: str
    context: dict = Field(default_factory=dict)

class TurnRequest(BaseModel):
    text: str = Field(min_length=1, max_length=8000)
    idempotency_key: str

@router.post("/sessions")
async def create_session(body: CreateSessionRequest) -> dict:
    ctx = AgentToolContext(auth_token=body.scoped_token, context=body.context)
    state = AgentSessionState(
        agent_session_id=body.agent_session_id, profile_name=body.profile,
        subject_id=body.subject_id, channel=body.channel,
        ingest_path=body.ingest_path, tool_context=ctx,
    )
    registry.put(state)
    return {"agent_session_id": body.agent_session_id, "channel": body.channel}
# _run + turn: identical to study_designer.py (per-session lock → idempotency dedup → semaphore)
```
- [ ] **Step 3:** `ai/app/main.py` — add `("app.routers.agent", {"prefix": "/agent", "tags": ["agent"]})` to `OPTIONAL_ROUTERS`; delete the `study_designer` entry. `git rm ai/app/routers/study_designer.py`.
- [ ] GREEN; `git rm ai/tests/test_study_designer_router.py`. Commit `refactor(ai): generic /agent router, drop study_designer router`.

## 2B.2 — Laravel: generic `agent_sessions` table + model

### Task B.7: `agent_sessions` migration + lineage doc (+ migrate & drop SD table)
- [ ] **Step 1:** `docs/lineage/2026-05-25-agent-sessions-table.md` (purpose, columns, supersedes `study_design_agent_sessions`, rollback note).
- [ ] **Step 2:** migration `<ts>_create_agent_sessions_table.php`:
  - columns: `id`, `profile` (string, index), `subject_type` (string), `subject_id` (unsignedBigInteger), `user_id` (FK users), `anthropic_session_id` (nullable string), `status` (string, default `active`), `cost_usd` (decimal(10,4), default 0), `tokens_in`/`tokens_out` (unsignedBigInteger, default 0), `token_id` (nullable unsignedBigInteger), `context_json` (jsonb nullable), `last_active_at` (nullable timestamp), timestamps. Composite index `(profile, subject_type, subject_id)`.
  - **Data migration in `up()` after createTable:** if `study_design_agent_sessions` exists, copy rows → `agent_sessions` (`profile='study_design'`, `subject_type='study_design_session'`, `subject_id=study_design_session_id`, `context_json={"version_id": study_design_version_id}`), then `Schema::dropIfExists('study_design_agent_sessions')`. (SD just merged — table is empty in practice; the copy is a safety net.)
  - `down()`: recreate `study_design_agent_sessions` (mirror the original migration) and drop `agent_sessions`.
- [ ] **Step 3:** run `php artisan migrate --path=database/migrations/<file>` (as parthenon_migrator; host PG17). Verify `\d agent_sessions`.
- [ ] **Step 4:** Pint; commit migration + lineage doc together `feat(db): generic agent_sessions table (supersedes study_design_agent_sessions)`.

### Task B.8: `AgentSession` model; delete `StudyDesignAgentSession`
- [ ] `backend/app/Models/App/AgentSession.php` — `$fillable = ['profile','subject_type','subject_id','user_id','anthropic_session_id','status','cost_usd','tokens_in','tokens_out','token_id','context_json','last_active_at']`; casts `cost_usd`=`decimal:4`, `context_json`=`array`, `last_active_at`=`datetime`. Scope `forSubject($profile,$type,$id)`. **Never `$guarded=[]`** (HIGHSEC §3.1).
- [ ] Commit `feat(models): AgentSession`.

### Task B.9: Repoint `StudyDesignAgentController` to the generic model + `/agent` router
- [ ] `start()`: create `AgentSession::create(['profile'=>'study_design','subject_type'=>'study_design_session','subject_id'=>$session->id,'user_id'=>...,'status'=>'active','context_json'=>['study_slug'=>$study->slug,'design_session_id'=>$session->id,'version_id'=>$validated['version_id']??null],'last_active_at'=>now()])`.
  - mint token (unchanged abilities `['studies.view','studies.create']`), set `token_id`.
  - POST to `{ai}/agent/sessions` with `profile`, `agent_session_id`, `subject_id=$session->id`, `channel="private-study-design.session.{$session->id}"`, `ingest_path="/api/v1/studies/{$study->slug}/design-sessions/{$session->id}/agent/sessions/{$agentSession->id}/ingest"`, `scoped_token`, `context` (the same id bag).
  - on fail: revoke token, null `token_id`, status `error`, 503 (playbook Bug #2).
- [ ] `message()`: POST `{ai}/agent/sessions/{id}/turn`.
- [ ] `snapshot()`/`ingest()`: operate on `AgentSession` (ingest still **increments** cost/tokens — Laravel owns the running total, playbook Bug #1).
- [ ] Update `StudyDesignAgentSessionTest.php` to assert on `agent_sessions`/`AgentSession`. Run Pest + PHPStan(8) + Pint. `git rm StudyDesignAgentSession.php`.
- [ ] **Step:** rebuild python image only if Dockerfile changed (it didn't). `docker compose up -d python-ai` to pick up the router rename. Commit `refactor(studies): study-design agent uses generic AgentSession + /agent router`.

### Task B.10: Phase-B regression gate
- [ ] Full agent turn on `main`+B branch (repeat Task A.4) — SD still works end-to-end through the generalized core. **Do not start Phase C until this passes.**

---

# PHASE C — Publish assistant, Phase 1 (read-only)

**Goal:** the agent researches a study and drafts IMRAD sections grounded in real analyses, streamed into a copilot panel on `PublishPage`. Nothing is saved. TDD; commit per task; §9 checks before each commit.

## 3C.1 — Laravel

### Task C.1: `private-publish.draft.{draft}` channel
- [ ] **Step 1 (test):** `backend/tests/Feature/Broadcasting/PublishChannelAuthTest.php` — via `/api/broadcasting/auth`: owner of a draft authorizes; a stranger is rejected; study-visibility draft authorizes a study member. (Mirror `StudyDesignChannelAuthTest`.)
- [ ] **Step 2:** `backend/routes/channels.php`:
```php
use App\Models\App\PublicationDraft;
use App\Policies\PublicationDraftPolicy;

Broadcast::channel('publish.draft.{draft}', function ($user, int $draft) {
    $d = PublicationDraft::find($draft);
    return $d !== null && (new PublicationDraftPolicy)->view($user, $d);
});
```
- [ ] GREEN; Pint; commit `feat(publish): private agent channel auth`.

### Task C.2: `PublishAgentController` — `start`/`message`/`snapshot`/`ingest`
- [ ] **Step 1 (test):** `backend/tests/Feature/Api/V1/PublishAgentSessionTest.php` — `start` creates an `AgentSession` (profile `publish`, subject_type `publication_draft`), mints a token, forwards to python (mock `Http::fake`); **on python failure the token is revoked + `token_id` null + 503** (Bug #2); a non-owner gets 403/404; `message` validates `text`+`idempotency_key`→202; `snapshot` returns the row; `ingest` **increments** cost/tokens.
- [ ] **Step 2:** `PublishAgentController` (clone `StudyDesignAgentController`, swap subject):
  - `authorizeAccess(Request, PublicationDraft)`: `abort_unless((new PublicationDraftPolicy)->view($user,$draft), 404)`.
  - `AGENT_ABILITIES = ['publications.view','publications.update']` (custom strings — enforced in Phase D; documented C3 gap until then).
  - `start()`: `AgentSession::create([... 'profile'=>'publish','subject_type'=>'publication_draft','subject_id'=>$draft->id,'context_json'=>['draft_id'=>$draft->id,'study_id'=>$draft->study_id]])`; channel `"private-publish.draft.{$draft->id}"`; `ingest_path="/api/v1/publish/drafts/{$draft->id}/agent/sessions/{$agentSession->id}/ingest"`; revoke-on-fail.
  - `message`/`snapshot`/`ingest`: identical shape to SD, bound to `{draft}`+`{agentSession}`, `abort_unless((int)$agentSession->subject_id===(int)$draft->id, 404)` and `$agentSession->profile==='publish'`.
- [ ] **Step 3:** routes in `backend/routes/api.php` (in the `auth:sanctum` group, near the publish block — **NO `permission:`**, policy-based + throttled):
```php
Route::post('publish/drafts/{draft}/agent/sessions', [PublishAgentController::class, 'start'])->middleware('throttle:20,1');
Route::post('publish/drafts/{draft}/agent/sessions/{agentSession}/messages', [PublishAgentController::class, 'message'])->middleware('throttle:30,1');
Route::get('publish/drafts/{draft}/agent/sessions/{agentSession}/snapshot', [PublishAgentController::class, 'snapshot']);
Route::post('publish/drafts/{draft}/agent/sessions/{agentSession}/ingest', [PublishAgentController::class, 'ingest'])->middleware('throttle:120,1');
```
  Confirm route-model-binding: `{draft}`→`PublicationDraft`, `{agentSession}`→`AgentSession`.
- [ ] GREEN; Pest + PHPStan(8) + Pint; commit `feat(publish): agent session controller + routes (read-only)`.

## 3C.2 — Python

### Task C.3: `publish_tools.py` — 4 read tools
- [ ] **Step 1 (test):** `ai/tests/test_publish_tools.py` (respx-mock Laravel) — assert each tool calls the right URL/method and shapes `{content:[{type:text,text}]}`; `get_study_analyses` guards a missing `study_id` (returns `is_error`, no HTTP — Bug C); `draft_narrative_section` posts the `section_type`+`context`.
- [ ] **Step 2:** `ai/app/agents/publish_tools.py`:
```python
from __future__ import annotations
from typing import Any
from claude_agent_sdk import tool
from app.agents.tool_base import AgentToolContext, request, error_result

def build_tool_pack(ctx: AgentToolContext) -> list:
    @tool("list_studies_for_publish",
          "List studies available to publish (with their analyses). Use to find the study to write about.",
          {})
    async def list_studies_for_publish(args: dict[str, Any]) -> dict[str, Any]:
        return await request(ctx, "GET", "studies", params={"per_page": 100, "include": "analyses"})

    @tool("get_study_analyses",
          "Get a study and its analyses/results to ground the manuscript. Pass the study_id from list_studies_for_publish.",
          {"study_id": int})
    async def get_study_analyses(args: dict[str, Any]) -> dict[str, Any]:
        sid = args.get("study_id")
        if not sid:
            return error_result("study_id is required. Call list_studies_for_publish first and pass a study_id.")
        return await request(ctx, "GET", f"studies/{int(sid)}")

    @tool("get_draft",
          "Read the current publication draft (title, template, document sections).",
          {})
    async def get_draft(args: dict[str, Any]) -> dict[str, Any]:
        draft_id = ctx.context.get("draft_id")
        if not draft_id:
            return error_result("No publication draft is selected.")
        return await request(ctx, "GET", f"publish/drafts/{int(draft_id)}")

    @tool("draft_narrative_section",
          "Draft one IMRAD manuscript section grounded ONLY in the provided analysis context. "
          "section_type is one of methods|results|discussion|caption. This is a PROPOSAL the author edits; nothing is saved.",
          {"section_type": str, "context": dict, "analysis_id": int, "execution_id": int})
    async def draft_narrative_section(args: dict[str, Any]) -> dict[str, Any]:
        st = args.get("section_type")
        if st not in {"methods", "results", "discussion", "caption"}:
            return error_result("section_type must be one of methods|results|discussion|caption.")
        body: dict[str, Any] = {"section_type": st, "context": args.get("context", {})}
        if args.get("analysis_id"):
            body["analysis_id"] = int(args["analysis_id"])
        if args.get("execution_id"):
            body["execution_id"] = int(args["execution_id"])
        return await request(ctx, "POST", "publish/narrative", json_body=body)

    return [list_studies_for_publish, get_study_analyses, get_draft, draft_narrative_section]
```
- [ ] GREEN; commit `feat(ai): publish read tools`.

### Task C.4: `publish` profile + register builder
- [ ] **Step 1 (test):** extend `ai/tests/test_agent_profiles.py` — `get_profile("publish")` returns model `claude-opus-4-7`, effort from settings, a prompt mentioning IMRAD + "never invent statistics" + "no filesystem/shell/web".
- [ ] **Step 2:** `profiles.py` add:
```python
_PUBLISH_SYSTEM_PROMPT = """You are the Publication assistant for Parthenon, an OHDSI outcomes-research platform on OMOP CDM v5.4.

You help an author draft a manuscript for an observational study. You can pull the study's analyses and draft IMRAD sections (Methods, Results, Discussion) and figure captions grounded ONLY in the study's actual analysis results.

Rules:
- Use the tools to fetch real studies and analyses. NEVER invent statistics, p-values, confidence intervals, cohort sizes, or citations. Every number must come from get_study_analyses.
- Cite figures/tables by the ids present in the analysis data.
- Drafting produces PROPOSALS the author edits; you do not save, snapshot, or export anything (those require explicit approval and are not available yet).
- Write formal academic prose (past tense, hedged causal language). Output plain text — no markdown, no section headings (the template provides them).
- You cannot read the filesystem, run shell commands, or browse the web. Your only capabilities are the publish tools provided.
"""

PUBLISH = AgentProfile(name="publish", system_prompt=_PUBLISH_SYSTEM_PROMPT,
                       model=settings.agent_model, effort=settings.agent_effort)
_PROFILES = {STUDY_DESIGN.name: STUDY_DESIGN, PUBLISH.name: PUBLISH}
```
- [ ] **Step 3:** in `tool_packs.py` register `publish` → `publish_tools.build_tool_pack` (import + `register("publish", ...)` or add to `_BUILDERS`).
- [ ] GREEN; `docker compose up -d python-ai`; commit `feat(ai): publish agent profile + tool-pack registration`.

## 3C.3 — Frontend

### Task C.5: `publishAgentApi.ts` (axios + Zod event schemas)
- [ ] Clone `studies/api/agentApi.ts`. `base = (draftId) => \`/publish/drafts/${draftId}/agent/sessions\``. `startAgentSession(draftId)` (no version), `sendAgentMessage(draftId, agentSessionId, text)` with `idempotency_key: crypto.randomUUID()`. **Reuse the same event schemas** (`agentTextDelta/agentToolStart/agentTurnDone/agentError`) and `AgentEvent` union — they're transport-generic. (Bug 7: `agentTurnDone` numbers are coerced server-side; keep `z.number()`.)
- [ ] Commit `feat(publish): agent api client + event schemas`.

### Task C.6: `publishAgentStore.ts` (Zustand)
- [ ] **Step 1 (test):** `stores/publishAgentStore.test.ts` — `pushUserMessage` starts streaming; `applyEvent({type:'text'})` appends to an assistant turn; `{type:'tool'}` records a tool; `{type:'done'}` stops streaming + sets `lastCostUsd`; `{type:'error'}` sets `errorMessage`; `reset()` clears. (Clone `studyDesignerAgentStore.test.ts`.)
- [ ] **Step 2:** clone `studyDesignerAgentStore.ts` verbatim → `publishAgentStore.ts` (rename hook `usePublishAgentStore`). Immutable reducers.
- [ ] GREEN (Vitest); commit `feat(publish): agent zustand store`.

### Task C.7: `usePublishAgent.ts` (start mutation + Echo subscription)
- [ ] Clone `useStudyDesignerAgent.ts`. **CRITICAL (Bug A):** select only the primitive `channelName` + stable actions; `getState()` inside listeners; effect deps `[channelName, draftId, qc]` — NEVER the whole store. Listen with **leading dots** (`.agent.text.delta` …). On `.agent.turn.done`, invalidate the draft query keys (`["publish","study",studyId]`, `usePublicationDraft` key) so refreshed analyses/draft show.
- [ ] Params: `{ draftId: number | null }`. `start` → `startAgentSession(draftId!)`; `send(text)`.
- [ ] Commit `feat(publish): usePublishAgent hook (Echo wiring)`.

### Task C.8: `AgentCopilotPanel` + `AgentTranscript` (publish copy)
- [ ] **Step 1 (test):** `components/agent/AgentCopilotPanel.test.tsx` — renders transcript; auto-start fires **once** even under strict-mode double-invoke (Bug B: one-shot `useRef`, reset on `draftId` change); input disabled while streaming.
- [ ] **Step 2:** clone `AgentTranscript.tsx` (transcript prop type from `publishAgentStore`). Clone `AgentCopilotPanel.tsx`: props `{ draftId: number | null }`; title `t("publish.agent.title","Publication Assistant")`; one-shot start guard resets on `[draftId]`. Dark-clinical theme classes already match.
- [ ] GREEN; commit `feat(publish): copilot panel + transcript`.

### Task C.9: Mount in `PublishPage.tsx`
- [ ] Mount `<AgentCopilotPanel draftId={draftId} />` (the existing `draftId` from `:draftId` param) — render it only when `draftId !== null` (the agent needs a subject). Place beside the document area without breaking the existing step layout (an `aside` flex column; or a toggle button to show/hide so it doesn't crowd the new-draft flow).
- [ ] i18n: use `t("key","fallback")` inline; only add keys to `resources.ts` **if that file has no unrelated uncommitted changes** (playbook §5.13).
- [ ] **Step:** `npx tsc --noEmit && npx vite build && npx vitest run src/features/publish && npx eslint <files> --max-warnings=0`; `./deploy.sh --frontend`. Commit `feat(publish): mount agent copilot on PublishPage`.

### Task C.10: Phase-C live gate
- [ ] Open a draft, open the copilot, ask "Draft a Methods section for study X." Confirm streamed text + a `get_study_analyses` tool row + `draft_narrative_section` output, non-zero cost on `turn.done`, `agent_sessions` row accumulating. Nothing written to the draft (read-only).

---

# PHASE D — Publish Phase 2 (approval gate + write tools + abilities)

**Goal:** write tools (`update_draft`, `create_snapshot`, `export`) run only after explicit human approval; close C3 by enforcing token abilities on the agent-reachable write routes.

### Task D.1: `can_use_tool` approval gate in the service
- [ ] **Step 1 (test):** `ai/tests/test_agent_service.py` — a write tool triggers `can_use_tool`, emits `agent.approval.request {tool_use_id, tool, input}`, and **blocks** on an `asyncio.Future`; resolving approve → tool runs; reject → tool denied + `agent.approval.denied`.
- [ ] **Step 2:** add to `ParthenonAgentService`:
  - `self._pending: dict[str, asyncio.Future] = {}` keyed by `tool_use_id`.
  - `async def _can_use_tool(tool_name, input, context)`: if `tool_name` not in the profile's write set → allow; else emit `agent.approval.request`, create a Future, `await` it (with `settings.agent_approval_timeout_seconds` timeout → deny on timeout), return allow/deny.
  - `def resolve_approval(tool_use_id, approved: bool)`: set the Future result.
  - Wire `can_use_tool=self._can_use_tool` into `ClaudeAgentOptions` (playbook §7 lists `can_use_tool` as a supported kwarg — verify in-container first).
- [ ] Define the per-profile write-tool set (e.g. `{"update_draft","create_snapshot","export_document","export_report_bundle"}`).
- [ ] GREEN; commit `feat(ai): can_use_tool approval gate`.

### Task D.2: Approve endpoint (`/agent/sessions/{id}/approve`) + Laravel forward
- [ ] python `ai/app/routers/agent.py`: `POST /sessions/{id}/approve {tool_use_id, approved}` → `service.resolve_approval(...)`; 404 if no session/pending.
- [ ] Laravel `PublishAgentController::approve` (+ route, throttled, policy `update`): validate `{tool_use_id, approved:bool}`, forward to `{ai}/agent/sessions/{id}/approve`. Mirror in `StudyDesignAgentController` if desired (optional).
- [ ] Tests both layers. Commit `feat(publish): approval forward endpoint`.

### Task D.3: Write tools in `publish_tools.py`
- [ ] Add (Phase 2 tools), each a thin client; the gate (D.1) blocks them until approved:
  - `update_draft` → `PATCH publish/drafts/{draft_id}` with `If-Unmodified-Since` (fetch current `updated_at` via `get_draft` first, or accept an `if_unmodified_since` arg) — playbook §6 table; ETag-aware.
  - `create_snapshot` → `POST publish/drafts/{draft_id}/snapshots` `{label, comment?, idempotency_key}`.
  - `export_document` → `POST publish/export`; `export_report_bundle` → `POST publish/report-bundles/export`. (Export returns a stream; the tool reports success + download metadata, doesn't pipe bytes through the agent.)
- [ ] Update the profile prompt: writes require approval; describe what each does.
- [ ] respx tests. Commit `feat(ai): publish write tools (approval-gated)`.

### Task D.4: Close C3 — enforce `abilities:` on agent-reachable write routes
- [ ] Add Sanctum `abilities:` middleware to the publish **write** routes the agent calls: `PATCH publish/drafts/{draft}` → `abilities:publications.update`; `POST publish/drafts/{draft}/snapshots` → `abilities:publications.update`; `POST publish/report-bundles/export` → `abilities:publications.view` (or `.update`).
  - **Regular users are unaffected:** default Sanctum tokens carry `['*']`, which satisfies any `abilities:` check. Only the **agent's scoped token** (minted with `['publications.view','publications.update']`) is constrained — so the agent literally cannot exceed its grant. Verify a Pest test: a token minted WITHOUT `publications.update` is 403'd on the PATCH; a `['*']` user token passes.
- [ ] Update `PublishAgentController::AGENT_ABILITIES` to match the ability strings used in the middleware.
- [ ] Tests; PHPStan; Pint. Commit `fix(publish): enforce token abilities on agent-reachable write routes (closes C3 for publish)`.

### Task D.5: Frontend approval cards
- [ ] `publishAgentApi.ts`: add `approveTool(draftId, agentSessionId, toolUseId, approved)` + Zod `agentApprovalRequest` ({tool_use_id, tool, input}) and `agentApprovalDenied`.
- [ ] Store: track `pendingApprovals[]`; `applyEvent` handles `approval.request`/`approval.denied`.
- [ ] Hook: listen `.agent.approval.request`/`.agent.approval.denied`.
- [ ] Panel: render an approval card (tool + input summary) with Accept/Reject → `approveTool`; on accept of `draft_narrative_section`/`update_draft`, also reconcile the editor via the existing `updatePublicationDraft` flow / invalidate draft query.
- [ ] Vitest; `tsc`+`vite build`+`eslint`; `./deploy.sh --frontend`. Commit `feat(publish): approval cards in copilot`.

### Task D.6: Phase-D live gate
- [ ] Ask the agent to "update the draft Methods with the section you wrote." Confirm: `approval.request` card → Accept → `update_draft` runs → draft updates (ETag respected) → `turn.done`. Reject path denies cleanly. Confirm a manually-minted token lacking `publications.update` is 403'd (C3 enforced).

---

## Security checklist (playbook §8 — verify before each phase's PR)

- [ ] Lockdown verbatim: `tools=[]`, `setting_sources=[]`, `strict_mcp_config=True`, `permission_mode="dontAsk"`, `allowed_tools=["mcp__parthenon__*"]`. (Inherited from the generic service — confirm Phase B didn't loosen it.)
- [ ] Scoped token minted per session, **revoked on start failure** (Bug #2); revoked on close (Phase 4 backlog).
- [ ] Agent routes: `auth:sanctum` + throttle + `PublicationDraftPolicy` ownership; **no public path**; python-ai internal-only.
- [ ] Channel auth verifies draft ownership (both legs tested via `/api/broadcasting/auth`).
- [ ] PHI: tools return study/analysis definitional data + aggregate results, never patient rows. (Verify `GET /studies/{id}` payload carries no row-level PHI.)
- [ ] Cost: `max_budget_usd` per turn + per-turn cost persisted (incremented in `ingest`).
- [ ] Models use `$fillable` (`AgentSession`); no `$guarded=[]`.
- [ ] C3: documented in Phase 1; **enforced in Phase D** via `abilities:` on write routes.
- [ ] No secrets in commits/logs; `.env` gitignored + mode 600.

## Verification commands (playbook §9 — run in-container, before every commit)

```bash
docker compose run --rm --entrypoint sh python-ai -lc "cd /app && python -m pytest tests/ -q"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/PublishAgentSessionTest.php tests/Feature/Broadcasting/PublishChannelAuthTest.php"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint <files>"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse"   # level 8
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit && npx vite build"
docker compose exec -T node sh -c "cd /app && npx vitest run src/features/publish"
docker compose exec -T node sh -c "cd /app && npx eslint <files> --max-warnings=0"
docker compose config --quiet
```
Pre-commit hook runs all of these on staged files. Never `--no-verify` without flagging.

## Gotchas to NOT repeat (playbook §10, applied to Publish)

- **Bug A:** `usePublishAgent` must select the primitive `channelName` only; `getState()` in listeners; deps `[channelName, draftId, qc]`.
- **Bug B:** one-shot `useRef` auto-start guard, reset on `draftId` change.
- **Bug 7:** keep server-side `int(... or 0)` coercion for token counts; `z.number()` rejects JSON `null`.
- **Bug #2:** revoke the scoped token on python-ai start failure.
- **Bug #3:** per-session `asyncio.Lock` before the global semaphore; honor `idempotency_key` (inherited from generic router — don't regress).
- **Bug #1:** Laravel `ingest` owns the running total (increment); Python sends per-turn deltas only.
- **Bug C:** guard tools whose URL interpolates an optional id (`get_study_analyses` without `study_id`, `get_draft`/`update_draft` without `draft_id`) — return `is_error`, make no HTTP call.
- **Env:** `ANTHROPIC_API_KEY` (valid + credited), `REVERB_*` in **repo-root** `.env`; `docker compose up -d python-ai` after any env/compose/Dockerfile change (NOT `restart`).
- **Git hygiene:** review/explore subagents read-only (no `checkout`/`switch`/`stash`/`reset`); `git add` only your paths; rebase onto `main` before merge; `git log main..HEAD --diff-filter=D` to confirm no stray deletions. Never `composer install`/docker-compose from a `/tmp` worktree.

## Process (playbook §11)

Subagent-driven: a fresh implementer per task (or tight same-file batch), RED→GREEN→commit with the project checks before returning. Coordinator verifies. Adversarial Opus review over the whole diff pre-merge **and** a second bug-hunt after fixes (both read-only). Then rebase → push → PR with a test plan + the known-pending items (token-revoke-on-close, registry idle-eviction, real admission control — playbook §10 "Deferred").

## After this ships

Update playbook §4 (generic core now exists — document `AgentToolContext`/`tool_packs`/`agent_sessions`/`/agent` router as the reusable surface) and §13 (generic file manifest). Link this plan and the Publish PR from the playbook footer.
