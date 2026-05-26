---
doc_type: reference
status: active
date: 2026-05-24
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - ai/app/agents/service.py
  - backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php
  - frontend/src/features/studies/components/v2/agent/AgentCopilotPanel.tsx
related_prs:
  - 343
---

# Claude Agent SDK Integration Playbook

**Status:** Reference / handoff guide
**First implemented:** Study Designer (PR #343, branch `feature/agent-sdk-study-designer`, May 2026)
**Audience:** Any agent/engineer adding an autonomous, tool-using Claude assistant to a Parthenon feature.
**Worked example in this doc:** the **Publish** section (`features/publish/` + `PublicationController`).

This playbook captures *exactly* how the Study Designer agent was built so the same pattern can be applied to other features. It is opinionated and prescriptive on purpose — follow it and you avoid the eight bugs and several environment traps we already hit. Read the **Gotchas catalogue (§10)** before writing any code; it is the most valuable section.

> **Companion artifacts:** design spec `docs/superpowers/specs/2026-05-21-claude-agent-sdk-study-designer-design.md`, implementation plan `docs/superpowers/plans/2026-05-21-claude-agent-sdk-study-designer.md`, PR #343.

---

## Table of contents
1. What this pattern is (and is not)
2. Architecture & invariants
3. What already exists (Phase 0 — do NOT redo)
4. Reusable core vs per-feature parts
5. Step-by-step recipe for a new agent profile
6. Worked example: the Publish assistant
7. The exact Claude Agent SDK facts (v0.2.86)
8. Security checklist (HIGHSEC / HIPAA)
9. Verification commands
10. Gotchas catalogue — the 8 bugs + environment traps
11. Process / workflow that produced this
12. Phase roadmap
13. File manifest (Study Designer — copy-template)

---

## 1. What this pattern is (and is not)

Parthenon already calls Claude two ways that are **NOT** this pattern:
- The **Anthropic *Client* SDK** (`anthropic.Anthropic`) — one-shot `messages.create`, used by `ai/app/routing/claude_client.py` (Abby) and, in PHP, by `StudyDesignClaudeClient` and `PublicationController::narrative` (`$this->llm->chat(...)`).
- These are single request→response calls with hand-built prompts. No tools, no iteration, no sessions.

**This pattern uses the Claude *Agent* SDK** (`claude-agent-sdk`) — the same autonomous agent loop that powers Claude Code, programmable in Python. The agent **decides which tools to call**, iterates (search → draft → validate → refine), keeps a session, and streams its work. It runs **only in Python** (it shells out to the Claude Code CLI), so it lives in the `python-ai` FastAPI service.

**The core idea:** the agent is the *orchestration brain*; its tools are **thin authenticated HTTP clients to existing Laravel endpoints**. PHP stays the source of truth for every write. The agent never touches the database, the filesystem, or a shell.

Use this pattern when a feature's AI needs to **do multiple steps with tools and converse**, not when a single structured-output call suffices (keep `llm->chat` for the latter).

---

## 2. Architecture & invariants

```
Browser (React copilot panel)
   │  ① POST start / message / approve         ④ Reverb events (WebSocket)
   ▼                                            ▲
Laravel (Sanctum + RBAC)                        │
   • mints short-lived RBAC-scoped token        │
   • /broadcasting/auth (channel ownership)     │
   • existing feature routes  ◄─────────────────┼── ③ tool callbacks (Bearer = scoped token)
   │  ② start/turn (internal HTTP)              │
   ▼                                            │
python-ai (Claude Agent SDK)                    │
   • ParthenonAgentService runs the turn        │
   • profile = system prompt + tool pack        │
   • in-process MCP tools → call Laravel ───────┘
   • publishes events → Reverb (Pusher HTTP) ───► ④
```

**Invariants (do not violate):**
- **PHP is the write authority.** Agent tools are thin clients; all DB writes/validation/audit/RBAC happen in Laravel.
- **`python-ai` is internal-only.** The browser never talks to it directly. Browser → Laravel only. Laravel → python-ai over `config('services.ai.url')` = `http://python-ai:8000`. python-ai → Laravel over `settings.agency_api_base_url` = `http://nginx:80`.
- **The agent has NO built-in tools.** `tools=[]` (removes Bash/Read/Edit/Write/Glob/Grep/WebSearch/WebFetch), `setting_sources=[]` (no dev `.claude/`), `strict_mcp_config=True`, `permission_mode="dontAsk"`. Only `mcp__parthenon__*` tools are reachable.
- **The agent acts AS the user.** Laravel mints a short-lived Sanctum token; the agent's tool callbacks carry it as a Bearer. The agent can never exceed the user's permissions. *(Caveat: token abilities are not yet route-enforced — see §8 C3.)*
- **Streaming is best-effort; Laravel is authoritative.** Reverb events are fire-and-forget (fail-open). Durable state (cost, tokens, session id, status) is persisted to a Laravel table via an `ingest` callback; a reconnecting client reads the authoritative `snapshot`.

---

## 3. What already exists (Phase 0 — do NOT redo)

These were built once and are reusable across features. Confirm they're present; don't rebuild.

| Capability | Where | Notes |
|---|---|---|
| `claude-agent-sdk>=0.2.86`, `pusher`, `respx` | `ai/requirements.txt`, `ai/requirements-dev.txt` | installed |
| **Node.js 20 + Claude Code CLI** in the image | `docker/python/Dockerfile` | the Python SDK shells out to the `claude` CLI; the slim image needs Node + `@anthropic-ai/claude-code` |
| Agent + Reverb settings | `ai/app/config.py` | `agent_model` (`claude-opus-4-7`), `agent_effort` (`xhigh`), `agent_max_turns`, `agent_max_budget_usd`, `agent_max_concurrent_turns`, `agent_approval_timeout_seconds`, `reverb_app_id/key/secret/host/port/scheme` |
| Reverb/agent env wired to the container | `docker-compose.yml` `python-ai.environment` | `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-${CLAUDE_API_KEY:-}}`, `REVERB_*`, `AGENT_*`, `AGENCY_API_BASE_URL` |
| **ReverbPublisher** | `ai/app/agents/reverb_publisher.py` | publishes to Reverb via the Pusher HTTP protocol; lazy client; fail-open |
| **ParthenonAgentService** | `ai/app/agents/service.py` | runs one turn, streams events, persists via `LaravelPersister` |
| **Session registry** | `ai/app/agents/registry.py` | in-memory `AgentSessionState` store + **per-session asyncio lock** + idempotency |
| **AgentProfile** | `ai/app/agents/profiles.py` | bundles (system prompt + model + effort); `study_design` is the first profile |

**Runtime prerequisites (environment, not code):**
- The agent authenticates via **`ANTHROPIC_API_KEY`** (the CLI does NOT read `CLAUDE_API_KEY`). Compose aliases it. The key must be a **valid, credited** Anthropic API key with access to the chosen model. We hit both "Invalid API key" (stale key) and "Credit balance is too low" (no credit) — both are account/billing issues, not code.
- `REVERB_APP_ID/KEY/SECRET` must exist in the **repo-root `.env`** (the file `docker compose` interpolates), not just `backend/.env`. After editing `.env`, recreate the container: `docker compose up -d python-ai` (NOT `restart` — env loads at creation).
- After any compose/Dockerfile/env change, the agent only sees it after `docker compose up -d python-ai`.

---

## 4. Reusable core vs per-feature parts

> **Important architectural note for the 2nd feature (e.g. Publish):** the current core is *named* for Study Designer in a few places (`StudyDesignToolContext`, the `/study-designer` router, `StudyDesignAgentController`, `study_design_agent_sessions`). Before building the second profile, **generalize these** rather than copy-pasting. Recommended refactor (small): rename `StudyDesignToolContext` → a generic `AgentToolContext` (it already only holds `study_slug`/`design_session_id`/`version_id`/`auth_token` — generalize to a `dict` of feature context + `auth_token`), make the router accept a `profile` and dispatch to a per-profile tool-pack builder, and use one generic `agent_sessions` table keyed by `(profile, subject_type, subject_id)` instead of one table per feature. If you're under time pressure, copying is acceptable but creates duplication — call it out in your plan.

| Generic (build once / reuse) | Per-feature (write for each profile) |
|---|---|
| `ParthenonAgentService.run_turn` (turn loop, streaming, persistence) | The **system prompt** (`AgentProfile`) |
| `ReverbPublisher` (event fan-out) | The **tool pack** (thin clients to *this feature's* Laravel routes) |
| `registry` (state, per-session lock, idempotency) | The **context object** (which ids the tools need) |
| The FastAPI router shape (`/sessions`, `/sessions/{id}/turn`) | The **channel name** (`private-<domain>.<subject>.{id}`) |
| The Laravel controller shape (start/message/snapshot/ingest + `authorizeAccess`) | The **ownership check** (how "can this user access this subject?") |
| The frontend store/hook/panel shape | The **agent_sessions row / table** (or generic table) |
| The security lockdown (`ClaudeAgentOptions`) | Which tools are **read/draft (auto)** vs **write (approval)** |

---

## 5. Step-by-step recipe for a new agent profile

Use TDD; commit per task; run the checks in §9 before every commit. The order below is the dependency order.

### Backend (Laravel)
1. **`agent_sessions` row.** Reuse a generic table if you generalized (§4); otherwise add a `<feature>_agent_sessions` migration mirroring `study_design_agent_sessions` (columns: subject FK(s), `user_id`, `anthropic_session_id`, `status`, `cost_usd` decimal(10,4), `tokens_in/out`, `token_id`, `last_active_at`). Models live in `App\Models\App\`. Use `$fillable` (never `$guarded=[]`). **A migration commit must include a lineage doc** (`docs/lineage/...`) or the pre-commit hook rejects it. Run with `--path=` (never `migrate --force`); migrations run as `parthenon_migrator`.
2. **Private channel auth** in `backend/routes/channels.php`: `Broadcast::channel('<domain>.<subject>.{id}', fn($user,$id) => /* ownership */)`. Mirror the `study-design.session.{session}` pattern; return a real bool. Use the feature's existing access check (for studies it's `Study::accessibleBy($userId)->whereKey($id)->exists()`).
3. **Controller** (`<Feature>AgentController`) with `start`, `message`, `snapshot`, `ingest`:
   - `authorizeAccess()` — `abort_unless` subject↔route binding (404) **and** the feature's access check (403). Call it in **every** method.
   - `start()` — create the session row; `createToken('<feature>-agent', [<abilities>])`; POST to python-ai `/…/sessions`; **on failure, revoke the token** (`$newToken->accessToken->delete()`) and null `token_id` before 503.
   - `message()` — validate `text` + `idempotency_key`; forward to python-ai turn endpoint; 202.
   - `ingest()` — python calls this on turn end; **increment** `cost_usd/tokens_in/tokens_out`, set `anthropic_session_id`, `status`. (Python sends per-turn deltas; Laravel accumulates.)
   - `snapshot()` — return the authoritative row for reconnect reconciliation.
4. **Routes** under the feature's auth+permission group, throttled. Confirm the route-model-binding param names match controller signatures. Study binds by **slug**; check your feature's binding key.

### Python (`ai/app/agents/`)
5. **Tool pack** (`<feature>_tools.py`): a frozen `…ToolContext` dataclass (the ids + `auth_token`); `@tool(...)`-decorated async functions that call Laravel via the shared `_request` helper (Bearer auth, `http://nginx:80/api/v1/...`, returns `{content:[{type:text,text}], is_error?}`). Read tools auto-run; write tools are deferred to the Phase-2 approval gate. **Guard any tool whose URL interpolates an optional id** (return a clear `is_error` message if the id is `None` — do not build `.../None/...`).
6. **Profile** (`profiles.py`): add an `AgentProfile(name, system_prompt, model=settings.agent_model, effort=settings.agent_effort)` and register it in `_PROFILES`. The system prompt must (a) describe the domain, (b) say "use the tools; never invent ids; confirm with search", (c) say drafting is staging only, (d) state it has no filesystem/shell/web access.
7. **Wire the profile to a tool pack.** Generalize `ParthenonAgentService._options` / `build_tool_pack` dispatch by profile name (or, if copying, a new router). Keep the **lockdown options verbatim** (§7).
8. **Router** (`/…/sessions` + `/…/sessions/{id}/turn`): `create_session` registers `AgentSessionState`; `turn` returns 202, runs `_run` as a BackgroundTask. `_run` **acquires the per-session lock, dedups the idempotency key, then the global semaphore**, then `run_turn`. `turn` returns **429 if `registry.turn_slot().locked()`**. Register the router module in `ai/app/main.py`'s `OPTIONAL_ROUTERS`.

### Frontend (`features/<feature>/`)
9. **`agentApi.ts`** — `startAgentSession`/`sendAgentMessage` (axios via `@/lib/api-client`) + **Zod schemas for every Reverb event payload** + an `AgentEvent` union.
10. **Zustand store** (`<feature>AgentStore.ts`) — transcript turns, `isStreaming`, `lastCostUsd`, `errorMessage`; `pushUserMessage`, `applyEvent`, `reset`. Immutable reducers.
11. **Hook** (`use<Feature>Agent.ts`) — start mutation + Echo subscription. **CRITICAL (see §10 Bug A):** select only the **primitive `channelName`** + stable actions; use `useStore.getState()` for actions inside listeners; depend the effect on `[channelName, …ids, qc]` — NEVER the whole store object (it churns the subscription on every event). Listen with a **leading dot** (`.event.name`) because events are published with raw names.
12. **Copilot panel** + transcript; mount in the feature page. **Auto-start needs a one-shot ref guard** (see §10 Bug B) that resets when the subject context changes. Invalidate the relevant TanStack query keys on `turn.done`.
13. **i18n** — use `t("key","fallback")` so it renders before keys are added; add keys to `resources.ts` **only if it has no unrelated uncommitted changes** (don't entangle other people's WIP in your commit).

---

## 6. Worked example: the Publish assistant

The Publish section (`frontend/src/features/publish/`, `PublicationController`) today generates narratives with a **one-shot** call (`PublicationController::narrative` → `$this->llm->chat`). The agentic version turns this into an **autonomous publication assistant**: it can pull a study's analyses, draft each manuscript section grounded in the real results, refine on feedback, and (with approval) save the draft / snapshot / export.

**Subject & channel:** keyed by the **publication draft** id → channel `private-publish.draft.{draftId}`. Ownership = whoever can access the draft (confirm `PublicationController`'s existing authorization — verify the `publish/*` routes' middleware/permission domain; the route group did not show an explicit `permission:` in the snippet, so check the parent group and add the right `permission:publications.*`/`studies.*` gate).

**Profile (`publish` in `profiles.py`):** system prompt = "You are the Publication assistant for Parthenon… draft IMRAD manuscript sections grounded ONLY in the study's actual analysis results; never invent statistics; cite figure/table ids; drafting and section text are proposals the author edits; you cannot save, snapshot, or export without explicit approval; no filesystem/shell/web access."

**Tool pack (`publish_tools.py`)** — thin wrappers over the *existing* publish endpoints:

| Tool | Wraps | Class | Notes |
|---|---|---|---|
| `list_studies_for_publish` | `GET publish/...`/studies-for-publish | read | what `useStudiesForPublish` calls |
| `get_study_analyses` | analyses endpoints | read | grounds the narrative in real results |
| `draft_narrative_section` | `POST publish/narrative` | read/draft | replaces the one-shot call; the agent calls it per section, iterating |
| `get_draft` / `list_snapshots` | `GET publish/drafts/{id}` etc. | read | |
| `update_draft` | `PATCH publish/drafts/{id}` | **write → approval** | use ETag (`updatePublicationDraftWithEtag`) |
| `create_snapshot` | `POST publish/drafts/{id}/snapshots` | **write → approval** | |
| `export_document` / `export_report_bundle` | `POST publish/export` etc. | **action → approval** | |

**Phase 1 (read-only slice) for Publish:** ship `list_studies_for_publish`, `get_study_analyses`, `draft_narrative_section`, `get_draft` — the agent can research a study and draft sections, streamed into a copilot panel in `PublishPage`, with nothing saved. **Phase 2** adds the approval gate (`can_use_tool`) + `update_draft`/`create_snapshot`/`export`.

**Surface:** mount a copilot panel in `frontend/src/features/publish/pages/PublishPage.tsx` (mirror `AgentCopilotPanel`), keyed by the active draft id. The agent's `draft_narrative_section` proposals render as accept-into-editor cards; on accept, the existing `updatePublicationDraft` flow commits (Phase 2).

This directly upgrades the current one-shot narrative into an iterative, grounded, multi-section assistant while leaving the proven PHP draft/snapshot/export machinery as the write authority.

---

## 7. The exact Claude Agent SDK facts (v0.2.86)

```python
from claude_agent_sdk import (
    query, ClaudeSDKClient, ClaudeAgentOptions,
    tool, create_sdk_mcp_server,
    AssistantMessage, ResultMessage, TextBlock, ToolUseBlock,
)
```
- **Custom tools:** `@tool(name, description, input_schema_dict)` decorates an `async def(args: dict)->dict`. It returns an **`SdkMcpTool`** object with `.name` and `.handler` (the async callable). Wrap a list of them in `create_sdk_mcp_server(name="parthenon", version="1.0.0", tools=[...])`. They're referenced as `mcp__<server>__<tool>` (e.g. `mcp__parthenon__search_concepts`). Tool return shape: `{"content":[{"type":"text","text": "..."}], "is_error": True?}`.
- **Lockdown options (copy verbatim):**
  ```python
  ClaudeAgentOptions(
      system_prompt=profile.system_prompt,
      model=profile.model,            # "claude-opus-4-7"
      effort=profile.effort,          # "xhigh"  (valid: low|medium|high|xhigh|max)
      mcp_servers={"parthenon": server},
      tools=[],                       # CLI `--tools ""` → removes ALL built-ins
      allowed_tools=allowed,          # ["mcp__parthenon__*"] — auto-approval only
      setting_sources=[],             # no dev .claude/ (CLAUDE.md, skills) bleed-in
      strict_mcp_config=True,         # no stray .mcp.json servers
      permission_mode="dontAsk",      # deny anything not pre-approved (headless)
      max_turns=settings.agent_max_turns,
      max_budget_usd=settings.agent_max_budget_usd,
      resume=state.anthropic_session_id,  # cross-turn continuity (None on first)
  )
  ```
  Verified: `tools=[]` removes built-ins but **MCP tools (via `mcp_servers`) remain** — they ride separate CLI args (`--mcp-config` + `--allowedTools`), not `--tools`.
- **Turn loop:** `async with ClaudeSDKClient(options=...) as client: await client.query(text); async for m in client.receive_response(): ...`. Handle `AssistantMessage` (iterate `.content` for `TextBlock`/`ToolUseBlock`) and `ResultMessage` (`.total_cost_usd`, `.usage` `{input_tokens, output_tokens}`, `.session_id`).
- **CLI dependency:** the Python SDK launches the `claude` CLI subprocess over stdio — the container needs Node.js + `@anthropic-ai/claude-code` and a writable `HOME` (we use `/tmp`).
- **Auth:** env `ANTHROPIC_API_KEY` (valid + credited). Not `CLAUDE_API_KEY`.

---

## 8. Security checklist (HIGHSEC / HIPAA)

- [ ] `tools=[]`, `setting_sources=[]`, `strict_mcp_config=True`, `permission_mode="dontAsk"`, `allowed_tools` limited to `mcp__parthenon__*`. (No filesystem/shell/web.)
- [ ] Scoped Sanctum token minted per session with minimal abilities; **revoked on start failure** and (Phase 4) on session close.
- [ ] **C3 — known gap:** token abilities are **not** enforced by the routes (Spatie `permission:` checks the *user*, not the *token*). The agent runs with the user's full permission set. To truly scope, add `abilities:<perm>` middleware (or `$token->can(...)`) to agent-reachable routes. Document until done.
- [ ] Every agent route under `auth:sanctum` + `permission:` + throttle; **no public path**; `python-ai` stays internal-only.
- [ ] Channel auth verifies subject ownership; rejects strangers (test both legs via `/api/broadcasting/auth`).
- [ ] PHI: scrub free-text before the cloud call where applicable (`phi_sanitizer`); tools return definitional data / counts, never patient rows.
- [ ] Cost: `max_budget_usd` per turn + the monthly cutoff (`cost_tracker`); per-turn cost persisted for audit.
- [ ] Models use `$fillable`; no `$guarded=[]`.
- [ ] No secrets in commits or logs; `.env` files stay gitignored + mode 600.

---

## 9. Verification commands

```bash
# Python (run IN the container — it has the deps + CLI)
docker compose run --rm --entrypoint sh python-ai -lc "cd /app && python -m pytest tests/ -q"

# Laravel
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/<Feature>AgentSessionTest.php"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint <files>"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse"   # level 8

# Frontend (vite build is STRICTER than tsc — run both)
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
docker compose exec -T node sh -c "cd /app && npx vite build"
docker compose exec -T node sh -c "cd /app && npx vitest run src/features/<feature>"
docker compose exec -T node sh -c "cd /app && npx eslint <files> --max-warnings=0"

# Compose
docker compose config --quiet

# Live transport smoke test (after REVERB_* in root .env + up -d python-ai)
docker compose exec -T python-ai python -c "from app.agents.reverb_publisher import ReverbPublisher; ReverbPublisher().publish(session_id=999, event='agent.text.delta', data={'text':'ok'}); print('PUBLISH-OK')"
```
The pre-commit hook runs Pint + PHPStan + tsc + ESLint + Vitest + vite build + Python syntax on staged files. Never `--no-verify` without flagging.

---

## 10. Gotchas catalogue — the 8 bugs + environment traps

These were all found and fixed during the Study Designer build. **Do not repeat them.**

### Frontend runtime (invisible to static review — reason about React/Zustand)
- **Bug A — Echo subscription churn (HIGH).** A hook effect that depends on the **whole Zustand store** re-runs on *every streamed event*; its cleanup `echo.leave()`s and re-subscribes → events drop mid-turn. **Fix:** select only the primitive `channelName` + stable actions; use `getState()` inside listeners; effect deps = `[channelName, …ids, qc]`.
- **Bug B — double-start (MED).** Auto-starting the session on `agentSessionId == null` with no guard lets React 19 strict-mode double-invoke create **duplicate sessions + live tokens**. **Fix:** one-shot `useRef` guard, reset when the subject context changes.
- **Bug 7 — Zod throws on null counts.** Emitting `usage.get("input_tokens", 0)` forwards JSON `null` if the SDK sets it null → `z.number()` rejects → the listener throws. **Fix:** coerce in the emit dict (`int(... or 0)`), matching the persist path.

### Backend / Python
- **Bug #2 — orphan token (SECURITY).** `start()` minted a live 8h token but didn't revoke it when the python-ai call failed → leaked credential. **Fix:** `$newToken->accessToken->delete()` + null `token_id` on the failure branch.
- **Bug #3 — concurrency (MED-HIGH).** `idempotency_key` was required but **ignored**, and turns shared a **global** semaphore (not per-session) → a double-submit interleaved events and raced `anthropic_session_id`. **Fix:** **per-session `asyncio.Lock`** + idempotency dedup in `_run`; acquire the lock *before* the global semaphore.
- **Bug #1 — cost double-count trap.** The service kept an in-memory `state.cost_usd += cost` running total that nothing read, while the persister sent per-turn deltas and Laravel `ingest` incremented. Harmless today, but a trap: if anyone "fixes" the persister to send `state.cost_usd`, Laravel doubles it. **Fix:** delete the dead in-memory accumulators; Laravel owns the running total; Python sends per-turn deltas only.
- **Bug C — `versions/None` URLs.** A tool that interpolates an optional id built `.../versions/None` (404, opaque) when the id was null. **Fix:** guard the tool, return a clear `is_error` message, make no HTTP call.
- **Bug #8 / #9 (MINOR).** `AGENCY_API_BASE_URL` relied on an implicit config default (made explicit in compose); a dead `_busy` field (removed).
- **Deferred (Phase 2/4, tracked):** real admission control (the 429 gate is a soft check — the semaphore is still acquired inside the background task); registry idle-eviction + token-revoke-on-close (registry grows unbounded; `drop()` exists but isn't called on a lifecycle event); `abilities:` route enforcement (C3).

### Environment & process traps
- **Auth env:** the CLI reads `ANTHROPIC_API_KEY`, not `CLAUDE_API_KEY`. Compose aliases it. The key must be **valid AND credited** with model access — we saw `Invalid API key` (stale) then `Credit balance is too low` (no credit); both are account issues, not code.
- **Reverb creds location:** `REVERB_APP_*` must be in the **repo-root `.env`** (compose interpolation source), not just `backend/.env`. `frontend/.env` is Vite-only (`VITE_*`) and is NOT read by python-ai.
- **Env reload:** `docker compose restart` does NOT reload env/`env_file`; use `docker compose up -d <svc>` (env loads at container creation).
- **DB location:** the app uses **host PG17** via `host.docker.internal:5432` (where `vocab` etc. live), NOT the docker `postgres` container on 5480. Don't validate data against the wrong DB.
- **Laravel specifics:** models are in `App\Models\App\` (not `App\Models\StudyDesign\`); `Study` binds by **slug**; there are **no factories** for `StudyDesignSession`/`Version` (build via relations: `$study->designSessions()->create([...])`, `$session->versions()->create(['version_number'=>1,'status'=>'draft'])`); the version→session FK is `session_id`; study access = `Study::accessibleBy($userId)`. A migration commit needs a **lineage doc** in the same commit.
- **Concurrent git / worktrees:** a long-running review subagent left the working tree on `main`, and a concurrent session committed unrelated WIP on `main` during the window. **Rules:** review/explore subagents must be **read-only with NO `git checkout`/`switch`/`stash`/`reset`**; rebase your feature branch onto `main` before merge and verify no unexpected deletions (`git log main..HEAD --diff-filter=D`); only ever `git add` your specific paths so you never sweep someone's WIP into your commit. Prefer sequential commits on `main` over long-lived worktrees (and never `composer install`/run docker-compose from a `/tmp` worktree — the containers bind-mount the main repo path).
- **SDK API drift:** pin against the **actually-published** version (we found `claude-agent-sdk` 0.2.86, not the doc's `0.1.0`); verify the import surface and `ClaudeAgentOptions` kwargs (`effort`, `max_budget_usd`, `can_use_tool`, `setting_sources`, `strict_mcp_config`) in the container before relying on them.

---

## 11. Process / workflow that produced this

1. **Brainstorm → design spec** (superpowers brainstorming): clarify goal, tool boundary, UX surface, transport; write `docs/superpowers/specs/…`, get approval.
2. **Implementation plan** (superpowers writing-plans): bite-sized TDD tasks with exact code + file paths; `docs/superpowers/plans/…`.
3. **Subagent-driven execution:** fresh implementer subagent per task (or small coherent batch), each doing RED→GREEN→commit with the project checks; coordinator verifies. Combine only tightly-coupled same-file tasks.
4. **Adversarial review:** an Opus reviewer over the whole diff (pre-merge) **and** a second adversarial bug-hunt after fixes — fresh eyes catch what the builder can't. Both **read-only**.
5. **Fix → re-verify → PR.** Rebase onto `main`, push, open a PR with a test plan and the known-pending items.
6. **"Verify live"** end-to-end where possible (Reverb round-trip, a real tool callback, a real agent turn) — unit tests mock the SDK client and will NOT catch auth/credit/CLI integration issues.

---

## 12. Phase roadmap (per feature)

- **Phase 0 — foundations:** shared (done). deps, Node+CLI, config, Reverb wiring, ReverbPublisher, service, registry, profiles.
- **Phase 1 — read-only slice:** session start + scoped token + channel; one streaming turn; read/draft tools only; copilot panel renders transcript + tool rows. No materialization, no approval gate.
- **Phase 2 — write + approval loop:** `can_use_tool` blocks on write tools, emits an `agent.approval.request` event the panel renders as accept/reject; on accept the write tool runs (materialize/update/snapshot/export). Add `abilities:` route enforcement (C3).
- **Phase 3 — full tool pack + inline + all steps:** remaining tools, inline "help with this step", reconnect snapshot reconciliation, cost display.
- **Phase 4 — hardening + reusability:** token revocation on close, registry idle-eviction/TTL, real admission control (429 at the boundary), PHI/audit review, load+cost tests, generalize the core for the next profile.

---

## 13. File manifest (Study Designer — copy-template)

Backend:
- `backend/database/migrations/2026_05_21_000000_create_study_design_agent_sessions_table.php`
- `backend/app/Models/App/StudyDesignAgentSession.php`
- `backend/app/Http/Controllers/Api/V1/StudyDesignAgentController.php` (start/message/snapshot/ingest)
- `backend/routes/api.php` (agent routes), `backend/routes/channels.php` (channel auth)
- `backend/tests/Feature/Api/V1/StudyDesignAgentSessionTest.php`, `backend/tests/Feature/Broadcasting/StudyDesignChannelAuthTest.php`

Python (`ai/app/agents/`): `reverb_publisher.py`, `study_design_tools.py`, `profiles.py`, `service.py` (`ParthenonAgentService` + `LaravelPersister`), `registry.py`; router `ai/app/routers/study_designer.py`; registered in `ai/app/main.py`. Tests: `ai/tests/test_reverb_publisher.py`, `test_study_design_tools.py`, `test_agent_profiles.py`, `test_agent_service.py`, `test_study_designer_router.py`, `test_agent_config.py`.

Frontend (`frontend/src/features/studies/`): `api/agentApi.ts`, `stores/studyDesignerAgentStore.ts`, `hooks/useStudyDesignerAgent.ts`, `components/v2/agent/AgentCopilotPanel.tsx`, `components/v2/agent/AgentTranscript.tsx`; mounted in `components/v2/StudyDesignerWizard.tsx`. Tests: `stores/studyDesignerAgentStore.test.ts`, `components/v2/agent/AgentCopilotPanel.test.tsx`.

Infra: `docker/python/Dockerfile` (Node+CLI), `ai/requirements.txt`/`requirements-dev.txt`, `ai/app/config.py`, `docker-compose.yml` (python-ai env).

---

*Maintenance: when you build the next profile (e.g. Publish), update §4's generalization note and §13 with the generic core, and link your feature's spec/plan here.*
