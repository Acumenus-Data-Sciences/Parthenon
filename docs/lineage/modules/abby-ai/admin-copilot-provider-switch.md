---
doc_type: lineage
status: shipped
date: 2026-06-15
owner: acumenus
module: abby-ai
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: [366]
---

# Admin-switchable copilot provider (cloud ↔ local)

**Date:** 2026-06-15
**Builds on:** `local-model-agent-backend-ce` (the env-driven EE/CE provider switch)
**Related:** `project_parthenon_agent_copilots`

## Why

The previous change made the action-taking Claude Agent SDK copilots
(Studies/Publish/Abby) able to run on a local model, but only via the
`AGENT_PROVIDER` **env** var — switching required editing `.env` and recreating
`python-ai`. Parthenon already has an **Admin → AI Providers** page that lets a
super-admin pick the active provider (anthropic/ollama/...) for the *chat/RAG*
path. This wires that same admin surface to the **copilots**, so the provider can
be switched at runtime with no redeploy.

Key gap closed: `python-ai` never read `ai_provider_settings`; the copilots only
listened to env. Now **Laravel is authoritative** and passes a per-session
provider override into the session-create call.

## Design

A new system setting `agents.provider_mode` (super-admin controlled):

- `cloud` (**default**) — copilots use Anthropic (Claude). Preserves EE.
- `local` — copilots use the local model via the claude-router proxy.
- `auto` — local IF the active `ai_provider_settings` row is a proxy-frontable
  local type (`ollama`) AND enabled; otherwise cloud.

**Default is `cloud` deliberately:** the `AiProviderSeeder` makes `ollama` the
*active* provider for chat, so an `auto`-by-default would flip the copilots to a
proxy that may not be running and break a cloud deployment.

Precedence in `python-ai`: **request override (Laravel) > profile provider > env
default**. Model/transport/actions for the local path still come from `python-ai`
env (the proxy is deployment config); Laravel only decides *which provider*.

## What changed

| Layer | File | Change |
|---|---|---|
| Resolver | `backend/app/Services/Agents/AgentProviderResolver.php` | maps `agents.provider_mode` (+ active provider) → `anthropic`\|`local` |
| Admin API | `AgentSettingsController` | show returns `provider_mode`+`local_ready`; update accepts `provider_mode` (cloud/local/auto), `required_without` enabled |
| Controllers | `AbbyAgentController`, `StudyDesignAgentController`, `PublishAgentController` | pass `provider => resolver->resolveProvider()` into the `/agent/sessions` payload |
| python-ai | `routers/agent.py`, `agents/service.py`, `config.py` | `CreateSessionRequest.provider`; `AgentSessionState.provider_override`; `resolve_agent_provider(profile, request)` — request wins |
| Frontend | `adminApi.ts`, `useAiProviders.ts`, `AiProvidersPage.tsx` | `provider_mode`/`local_ready` types, `useSetAgentProviderMode`, a Cloud/Local/Auto segmented selector in the AI Agents card with a "no local provider active" warning |

## Behavior

- Admin → AI Providers → **AI Agents** card now has a **Copilot provider**
  selector (Cloud / Local / Auto) below the enable toggle.
- Switching to **Local** (or Auto with an active Ollama provider) makes every
  *new* copilot session run on the local proxy — no redeploy. Existing env
  (`AGENT_PROVIDER`) remains the fallback when Laravel sends nothing.
- EE default is unchanged: `provider_mode=cloud` → `anthropic`.

## Caveat (unchanged from the env-switch work)

The copilots speak the Anthropic Messages API, so "local" routes through the
**claude-router** proxy (which fronts Ollama), not raw `:11434`. The proxy must
be running (`docker compose --profile ce up -d claude-router`) and serving the
configured local model. The selector shows a warning when local/auto is chosen
but no local provider is active. The specific local model + actions-enabled
remain deployment config (`AGENT_LOCAL_*`), not per-row admin settings.

## Verification

- PHP: `AgentProviderResolverTest` (7) + `AgentSettingsControllerTest` (11, incl.
  provider_mode) + `AbbyAgentControllerTest` (5) → **23 passed**; Pint + PHPStan clean.
- Python: `test_agent_router` + `test_agent_service` + `test_agent_config` →
  **28 passed** (incl. request-override-beats-env); mypy clean.
- Frontend: `AiAgentsToggle.test.tsx` → **8 passed** (incl. selector PUT +
  not-ready warning); tsc + vite build clean.
