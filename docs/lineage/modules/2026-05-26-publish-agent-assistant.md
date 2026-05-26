---
doc_type: lineage
status: active
date: 2026-05-26
owner: acumenus
module: publish
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - ai/app/agents/service.py
  - ai/app/agents/tool_packs.py
  - ai/app/agents/publish_tools.py
  - ai/app/routers/agent.py
  - backend/app/Http/Controllers/Api/V1/PublishAgentController.php
  - backend/app/Models/App/AgentSession.php
  - frontend/src/features/publish/components/agent/AgentCopilotPanel.tsx
related_prs:
  - 343
  - 346
  - 347
---

# 2026-05-26 — Claude Agent SDK: Study Designer foundation → generic core → Publication assistant

Devlog for the Claude Agent SDK rollout across three merged PRs. Pattern reference:
`docs/reference/agent-sdk-integration-playbook.md`. Design/plan: `docs/superpowers/plans/2026-05-25-claude-agent-sdk-publish-assistant.md`.

## What shipped

| PR | Title | Result |
|----|-------|--------|
| #343 | Agent SDK → Study Designer (Phase 0+1, read-only) | Reusable agent core (FastAPI `python-ai`) + Study Designer copilot |
| #346 | Generalize agent core for multi-profile use | Profile-agnostic core so a 2nd profile plugs in |
| #347 | Publication agent assistant (Phase 1 + Phase 2) | Publish copilot, ships dark behind a feature flag |

## Architecture (unchanged from the playbook)

The agent is the orchestration brain in `python-ai`; its tools are thin authenticated HTTP clients to existing Laravel routes. PHP stays the write authority. Browser → Laravel → `python-ai`; the agent's tool callbacks carry a short-lived RBAC-scoped Sanctum token. Streaming is best-effort over Reverb; Laravel persists durable state (cost/tokens/status) via an `ingest` callback.

## #346 — generic core (non-destructive)

Generalized the Study-Designer-specific core:
- `StudyDesignToolContext` → generic `AgentToolContext` (scoped token + a feature id-bag) in `tool_base.py`.
- `tool_packs.py` profile→builder registry; the `/study-designer` router became a generic `/agent` router (Laravel supplies `channel` + `ingest_path`, so `python-ai` has no domain knowledge).
- `AgentSessionState` gained `subject_id` / `channel` / `ingest_path`; `ReverbPublisher.publish(channel=…)`.
- New generic `agent_sessions` table keyed by `(profile, subject_type, subject_id)` + `AgentSession` model. **Non-destructive:** the migration CREATEs + copies; the old `study_design_agent_sessions` table is left orphaned, never dropped. The SD controller repointed onto `AgentSession`.

## #347 — Publication assistant

**Phase 1 (read-only):** `PublishAgentController` on the generic `AgentSession` (profile=`publish`, subject=`publication_draft`); channel `private-publish.draft.{id}` authorized by `PublicationDraftPolicy`. Python `publish_tools` read tools: `list_studies_for_publish`, `get_study_analyses`, `get_draft`, `draft_narrative_section` (wraps the existing one-shot `/publish/narrative`, now called per IMRAD section). `publish` profile: draft sections grounded ONLY in real analysis results, never invent statistics.

**Phase 2 (write + approval):**
- **Approval gate** (generic, in the shared `service.py`): write tools are excluded from `allowed_tools` and routed through a `can_use_tool` callback that publishes `agent.approval.request`, blocks on a per-session `asyncio.Future` (timeout `agent_approval_timeout_seconds`), and returns `PermissionResultAllow`/`Deny`. `permission_mode="default"` **only** for profiles that have write tools — `study_design` is untouched (`dontAsk`, all tools auto-approved). Unknown tools fail closed. `POST /agent/sessions/{id}/approve` resolves the future.
- **Write tools:** `update_draft`, `create_snapshot` (export stays a UI action — a binary download doesn't fit an agent flow).
- **Frontend:** Approve/Reject cards in the copilot panel.
- **C3 closed:** `abilities:publications.update` middleware on the agent-reachable write routes (`PATCH publish/drafts/{draft}`, `POST .../snapshots`). Real users are unaffected — login tokens carry `['*']` (Sanctum `createToken` default) — but the agent's scoped token (`publications.view`+`update`) is now enforced. Registered the Sanctum `abilities` middleware alias.

**Ships dark:** the copilot is gated by the `publish.agent` feature flag (`PUBLISH_AGENT_ENABLED`, default OFF), so it is invisible on prod until enabled.

## Verification

Per-layer, all green at merge: Python **480 pytest** + mypy clean; Laravel **44 Pest** (publish agent + abilities + existing publication suites); frontend tsc + vite build + eslint clean + **78 vitest**. CI green on every PR.

## Known limitation — live verification pending Anthropic credit

The account behind `ANTHROPIC_API_KEY` is out of credit. The full pipeline runs (CLI subprocess, auth, session creation, Reverb), but the model can't *generate* ("Credit balance is too low"). The one piece not unit-testable against the real SDK — the `can_use_tool` ↔ `permission_mode="default"` interaction (whether the CLI actually routes write tools to the callback) — is **not yet live-verified**. Add credit, set `PUBLISH_AGENT_ENABLED=true`, and exercise a real `update_draft` approval round-trip to confirm.

## Notes / gotchas (this rollout)

- **Sanctum `actingAs` default:** `Sanctum::actingAs($user)` defaults to **empty** abilities, not `['*']`; tests for the `abilities:` middleware must pass `['*']` explicitly to model a real login token.
- **CI broadcaster:** channel-auth tests are non-deterministic through `/broadcasting/auth` (the `null` test broadcaster doesn't enforce channel callbacks); assert the authorization predicate directly instead.
- **Working-tree branch switches:** a concurrent process silently switched the tree to `main` mid-task; verify the branch before every commit, and on apparent "lost work" check `git reflog` + `git ls-tree <commit>` before recreating anything.
