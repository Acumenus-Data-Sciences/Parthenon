---
doc_type: spec
status: active
date: 2026-05-21
owner: acumenus
module: studies
lineage_anchor: false
supersedes: []
superseded_by: null
related_code: []
related_prs:
  - 343
---

# Claude Agent SDK for Assistive Tasks — Study Designer (Design)

**Date:** 2026-05-21
**Author:** Sanjay Udoshi (with Claude Code)
**Status:** Approved design — pending implementation plan
**Scope of this spec:** The first assistive surface — the **Study Designer** wizard. The agent service is built to be **reusable** so later assistive features (Abby, etc.) become additional *profiles*, but only the `study_design` profile is in scope here.

---

## 1. Goal & motivation

Adopt the **Claude Agent SDK** (Python) to make the Study Designer an **autonomous, multi-turn, tool-using assistant** rather than the current one-shot structured-output calls.

Today the Study Designer's AI lives in Laravel: `StudyDesignClaudeClient` + `StudyDesignStructuredOutputSchemas` + `StudyDesignContextBuilder` + `StudyDesignCritiqueService` + `StudyIntentService` + `StudyDesignToolRunner` (~18 services under `backend/app/Services/StudyDesign/`), calling the **Anthropic *Client* SDK** for single-shot, schema-constrained responses.

The Agent SDK is a *different, higher-level* tool — the same agent loop that powers Claude Code, with built-in tool orchestration, sessions, subagents, hooks, and permissions. It runs only in **Python/TypeScript (not PHP)**. Adopting it therefore moves the *agentic orchestration* into the existing **`python-ai` FastAPI service**; **PHP remains the source of truth** for every domain write.

**What the Agent SDK buys us here:** an agent that iteratively decides which domain tools to call (search vocab → draft concept sets → validate cohort logic → check feasibility → propose analysis plan), converses across wizard steps, and proposes commits the human accepts — instead of fixed, hand-orchestrated single calls.

### Decisions locked during brainstorming
| Decision | Choice |
|---|---|
| Primary goal | **Autonomous tool-using agent** in `python-ai`; PHP becomes a thin proxy |
| Tool boundary | **Thin wrappers over existing Laravel API** (reuse RBAC, validation, audit; all DB writes stay in PHP) |
| Agent UX | **Copilot side-panel + inline per-step actions**, sharing one session |
| Transport | **Reverb WebSocket fan-out** (Python publishes events; browser subscribes to a private channel) |
| Model | **`claude-opus-4-7`, `effort="xhigh"`** for default *and* critique; `fallback_model` = Opus |

---

## 2. Existing system (verified)

- **`anthropic>=0.42.0`** already in `ai/requirements.txt`. `claude-agent-sdk` is **not** present yet.
- **Python AI service** (`ai/app/`) has `routing/claude_client.py`, `routing/rule_router.py` (local-Ollama vs cloud-Claude), `routing/cost_tracker.py`, `routing/cloud_safety.py`, `routing/phi_sanitizer.py`. Powers `routers/abby.py`.
- **Laravel → python-ai** is the established server-to-server path: `config('services.ai.url')` = `http://python-ai:8000`. The **browser only talks to Laravel**; `python-ai` is internal-only.
- **Study Designer frontend**: `frontend/src/features/studies/components/v2/` — `StudyDesignerWizard.tsx`, `StudyDesignerStepper.tsx`, `WizardFooter.tsx`, `wizardValidation.ts`, store `stores/studyDesignerWizardStore.ts`, deterministic helpers `studyDesignGuidance.ts` / `studyDesignIntentAssistance.ts` / `studyDesignCompatibilityAssistance.ts`.
- **Existing Study Designer endpoints** (`backend/routes/api.php`, under `study-design-sessions/{session}`, all with `permission:studies.*` + throttle) map ~1:1 onto the agent's tools:
  - `POST {session}/intent`, `.../versions/{v}/phenotypes/recommend`, `.../critique`
  - `.../concept-sets/draft`, `.../concept-sets/verify`, `.../assets/{asset}/concept-sets/materialize`
  - `.../cohorts/draft`, `.../cohorts/readiness`, `.../assets/{asset}/cohorts/materialize`, `.../link-to-study`
  - `.../feasibility/run`, `.../analysis-plans/draft`, `.../assets/{asset}/analysis-plans/materialize`
  - `GET .../guidance`, `GET .../lock-readiness`, `POST .../lock`
- **study-agent/** submodule = upstream OHDSI Study Design Assistant (R/ACP), proxied via `ai/app/routers/study_agent.py`. Out of scope; left intact.

---

## 3. Architecture

```
┌─────────── Browser (React) ───────────┐
│  StudyDesignerWizard                   │
│   ├─ AgentCopilotPanel (chat + tool    │   ① POST start / message / approve
│   │   transcript + propose/accept)     │──────────────┐
│   └─ inline "Help with this step"      │              │
│  Laravel Echo ⇄ private channel ◄──────┼──④ events    │
└────────────────────────────────────────┘  (Reverb)    ▼
                          ┌───────── Laravel (Sanctum + RBAC) ──────────┐
                          │  StudyDesignAgentController                  │
                          │   • mints short-lived RBAC-scoped token      │
                          │   • /broadcasting/auth (channel authz)       │
                          │   • existing study-design-sessions routes ◄──┼─┐ ③ tool callbacks
                          └──────────────────────────────────────────────┘ │  (Bearer = scoped token,
                                      │ ② start / turn (HTTP, internal)     │   agent acts AS the user)
                                      ▼                                     │
                          ┌───────── python-ai (Agent SDK) ───────────────┐ │
                          │  routers/agent.py → ParthenonAgentService      │ │
                          │   • ClaudeSDKClient turn (resume=session_id)   │ │
                          │   • profile = system prompt + tool pack        │─┘
                          │   • can_use_tool → approval gate               │
                          │   • cost_tracker / phi_sanitizer / budget      │
                          │   • publishes events → Reverb (Pusher HTTP) ───┼──► ④
                          └─────────────────────────────────────────────────┘
```

**Reusable core, pluggable profiles.** `ParthenonAgentService` is generic and takes an *agent profile* = `(system_prompt, tool_pack, model, effort, permission_policy)`. First profile: `study_design`. Future assistive features add profiles; no Study-Designer-specific plumbing in the core.

---

## 4. Agent core (Python, `ai/app/agents/`)

- **SDK & mode:** `claude-agent-sdk`, using `ClaudeSDKClient` in **streaming-input mode** for an in-flight turn (required so `can_use_tool` can *block* awaiting user approval). Cross-turn continuity via `resume=<session_id>` persisted in Laravel — **no idle in-memory sessions**, only live in-flight turns in a bounded asyncio registry with timeouts.
- **Tools** (`@tool` → `create_sdk_mcp_server(name="parthenon", …)`), each a thin client to one existing Laravel route, authenticated with the scoped Bearer token:
  - *Read / draft (auto-approved):* `search_concepts`, `recommend_phenotypes`, `draft_concept_sets`, `verify_concept_sets`, `draft_cohorts`, `cohort_readiness`, `run_feasibility`, `draft_analysis_plans`, `get_guidance`, `critique_version`.
  - *Write / stateful (require approval):* `materialize_concept_set`, `materialize_cohort`, `link_cohort_to_study`, `materialize_analysis_plan`, `lock_version`.
- **Permissions = the propose→accept UX.** `can_use_tool` callback: read/draft pass automatically; write tools emit `agent.approval.request` over Reverb and **await** the user's decision. "Agent proposes, human commits" becomes a hard architectural guarantee.
- **Hard lockdown (HIPAA/HIGHSEC):** built-in `Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch` **all disabled**; `allowed_tools=["mcp__parthenon__*"]` only; `setting_sources=[]` so the dev `.claude/` (CLAUDE.md, skills, MCP servers) never bleeds into a clinical agent; custom `system_prompt` only.
- **Model & cost:** `model="claude-opus-4-7"`, `effort="xhigh"` (default + critique), `fallback_model` = Opus. Per-turn `max_turns` + `max_budget_usd`; reuse `cost_tracker` + monthly budget cutoff; `phi_sanitizer` scrubs user free-text before any cloud call. Agent path is cloud-only; on monthly budget exhaustion it **degrades to the deterministic `studyDesignGuidance` helpers** (no hard failure).

---

## 5. Transport & data flow (Reverb)

The auth callback leg is constant: Laravel mints a short-lived RBAC-scoped Sanctum token at session start; the Python agent uses it as `Authorization: Bearer` for all tool callbacks, so the agent acts *as the user* and can never exceed their permissions.

1. **Open** — `POST /api/v1/study-design-sessions/{session}/agent/sessions` (Laravel, `permission:studies.view`). Laravel: loads/creates `study_design_agent_sessions` row (persists Anthropic `session_id`, status, cumulative cost, owner); mints the scoped token (abilities `studies.view`+`studies.create`, TTL ≤ 8h, named/revocable); calls `python-ai POST /agent/sessions {profile:"study_design", design_session_id, version_id, scoped_token, channel}`; returns `{agent_session_id, channel_name}`.
2. **Subscribe** — Browser joins Echo private channel `private-study-design-agent.{agent_session_id}`; `/broadcasting/auth` authorizes via Sanctum + ownership of the design session.
3. **Message** — `POST .../agent/sessions/{id}/messages` (Laravel, `permission:studies.create`, throttled, idempotency token) → forwards to `python-ai POST /agent/sessions/{id}/turn` → **202** (turn runs as asyncio task).
4. **Stream** — python-ai runs the turn (`ClaudeSDKClient`, `resume=session_id`) and publishes typed events **directly to Reverb via the Pusher-compatible HTTP API** (HMAC-signed, app creds via env):
   `agent.text.delta`, `agent.thinking` (summarized), `agent.tool.start`, `agent.tool.result`, `agent.approval.request` (turn then **blocks**), `agent.turn.done {new_session_id, cost_usd, tokens}`, `agent.error`. On `turn.done`, Laravel persists the new `session_id` + adds cost.
5. **Approve** — Accept/Reject → `POST .../agent/sessions/{id}/approvals/{tool_use_id}` (Laravel, `permission:studies.create`) → python-ai resolves the awaiting `can_use_tool` future → write tool proceeds or is denied.
6. **Tool callbacks** — python-ai tools call the existing study-design routes with the scoped Bearer; RBAC, validation, audit, DB writes stay in Laravel exactly as today.

**Why Python→Reverb directly:** per-delta relaying Python→Laravel→Reverb would be too chatty. Python publishes straight to Reverb (Pusher protocol) with app creds via env; Laravel owns only *channel authorization*, keeping RBAC/ownership in PHP. (Exact `REVERB_APP_*` env names to be confirmed in the plan.)

---

## 6. Frontend (`features/studies/components/v2/agent/`)

- **`AgentCopilotPanel`** — chat input + streaming transcript (assistant text + collapsible tool-call rows) + **proposal cards** rendering `approval.request` with Accept/Reject. Subscribes to the Echo private channel; events feed a new `studyDesignerAgentStore` (Zustand).
- **Inline "Help with this step"** — dispatches a templated message into the *same* session (cross-step context retained) and focuses the panel.
- **State bridge** — on a successful materialize proposal, invalidate the relevant TanStack Query keys (concept sets / cohorts / analysis plans / guidance) so the wizard re-renders with the agent's committed changes.
- **New hooks** (`agentApi.ts`): `useStartAgentSession`, `useSendAgentMessage`, `useResolveApproval`; Zod schemas for every Reverb event payload.
- **Assumption to verify in plan:** `laravel-echo` + `pusher-js` are already wired (Commons real-time messaging suggests yes). If not, that's an added setup task.

---

## 7. Security (HIGHSEC / HIPAA)

- **Scoped token:** abilities `studies.view`+`studies.create` only, TTL ≤ 8h, named + revoked on session close, held only in python-ai memory (never persisted to disk, never logged).
- **Surface unchanged:** python-ai stays internal-only; Reverb publish uses the app secret via env (mode 600, not baked into the image). All `/agent/*` routes under `auth:sanctum` + `permission:` + throttle; **no public path** — satisfies the HIGHSEC route checklist.
- **Agent lockdown:** built-in fs/bash/web tools off; `allowed_tools=["mcp__parthenon__*"]`; `setting_sources=[]`. Write tools always go through the approval gate; every Laravel callback re-enforces RBAC + session ownership server-side.
- **PHI:** `phi_sanitizer` scrubs user free-text before any cloud call; tool results are definitional (concept sets, counts); feasibility returns counts only, never patient-level rows.
- **Audit & cost:** per-turn record (prompt hash, tools used, tokens, USD) → `study_design_agent_sessions` + the existing cloud-budget ledger; tool callbacks keep Laravel's existing audit logging.

---

## 8. Error handling

- **Turn failure** (SDK error / timeout / budget trip) → `agent.error` event; session stays resumable; UI shows a recoverable state.
- **Tool callback failure** (Laravel 4xx/5xx) → returned to the agent as tool-error content so it can explain/retry; shown in transcript.
- **Approval timeout** → awaiting future times out after N min → tool denied, turn concludes gracefully.
- **Reverb disconnect** → Echo auto-reconnects; on resubscribe the panel calls `GET .../agent/sessions/{id}` for an authoritative snapshot to reconcile missed events (streaming best-effort; final state from Laravel).
- **Saturation** (single uvicorn worker) → bounded in-flight-turn registry → 429 when full. Message + approval endpoints take a client idempotency token.

---

## 9. Testing (80%+ target)

- **Python (pytest):** each `@tool` with Laravel mocked (respx); `can_use_tool` approval logic; Reverb publish (mocked); session resume; PHI scrub.
- **Laravel (Pest):** `/agent/*` RBAC (viewer denied writes), ownership, scoped-token abilities, `/broadcasting/auth` authorizes only the owner, throttling — python-ai HTTP mocked.
- **Frontend (Vitest):** `studyDesignerAgentStore` reducer over scripted event sequences, accept/reject, query invalidation; `AgentCopilotPanel` against a scripted stream (Echo mocked).
- **E2E (Playwright, Phase 3+):** ask → propose concept set → approve → see it land in the wizard.

---

## 10. Phasing — thin vertical slice first

- **Phase 0 — Foundations:** add `claude-agent-sdk` to `ai/requirements.txt`; `ParthenonAgentService` + `study_design` profile skeleton; confirm Opus 4.7 xhigh runs; Python→Reverb→Echo round-trip PoC; verify Echo wired on frontend.
- **Phase 1 — Read-only vertical slice:** session start + token mint; one turn streaming over Reverb; read/draft tools only (`search_concepts`, `get_guidance`, `recommend_phenotypes`, `draft_concept_sets`); `AgentCopilotPanel` renders streaming text + tool transcript. *No writes/approvals yet.*
- **Phase 2 — Write + approval loop:** `can_use_tool` gate + `materialize_concept_set`/`materialize_cohort` + approval endpoints + proposal cards + query invalidation. Agent can propose→commit.
- **Phase 3 — Full tool pack + inline + all 8 steps:** remaining tools (cohort readiness, feasibility, analysis plans, Opus critique, lock), inline "Help with this step", reconnect reconciliation, cost display.
- **Phase 4 — Hardening + reusability:** HIGHSEC/PHI/audit review, load + cost tests, extract the generic core so a second profile (Abby, etc.) drops in; devlog.

---

## 11. Open items to confirm during planning

1. Exact Reverb env var names (`REVERB_APP_ID/KEY/SECRET/HOST/PORT/SCHEME`) and the Pusher HTTP publish path; whether a Python `pusher` client or raw HMAC over `httpx` is cleaner.
2. Whether `laravel-echo` + `pusher-js` are already installed/configured on the frontend.
3. The shape of the existing study-design draft/materialize request & response bodies (so tool input/output schemas match exactly).
4. `study_design_agent_sessions` migration: columns (id, design_session_id, version_id, owner_id, anthropic_session_id, status, cost_usd, tokens_in/out, created/last_active, revoked_at).
5. Whether to register the agent profile's system prompt as a versioned artifact (so prompt changes are auditable).
6. Idle-session / token-revocation policy and the in-flight-turn concurrency cap value.
