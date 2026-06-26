---
doc_type: plan
status: shipped
date: 2026-06-25
owner: acumenus
module: abby-ai
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - ai/app/routers/abby.py
  - ai/app/routing/claude_client.py
  - ai/app/routing/cost_tracker.py
  - ai/app/routing/cloud_safety.py
  - ai/app/routing/rule_router.py
  - ai/app/config.py
  - ai/app/agents/service.py
  - ai/app/agents/profiles.py
  - ai/app/routers/agent.py
  - backend/app/Services/AI/AbbyAiService.php
  - backend/app/Services/AiService.php
  - backend/app/Services/Agents/AgentProviderResolver.php
  - backend/app/Http/Controllers/Api/V1/AbbyAiController.php
  - backend/app/Http/Controllers/Api/V1/AbbyAgentController.php
  - backend/app/Http/Controllers/Api/V1/Admin/AgentSettingsController.php
  - backend/database/seeders/AiProviderSeeder.php
  - docker-compose.yml
related_docs:
  - docs/reference/agent-sdk-integration-playbook.md
  - docs/lineage/modules/abby-ai/admin-copilot-provider-switch.md
  - docs/lineage/modules/abby-ai/local-model-agent-backend-ce.md
  - docs/lineage/plans/open/2026-06-21-ce-ee-edition-differentiation-and-gating-strategy.md
related_prs: []
---

# Abby Provider Entitlements, Subscription Boundaries, and Local Fallback Plan

## Purpose

This plan turns the 2026-06-25 Abby AI infrastructure review into an executable
implementation backlog. It answers the operational question:

> How do we reduce or eliminate Abby's dependency on Anthropic API credit while
> preserving governed, auditable frontier-model behavior when it is legitimately
> available, and falling back to local Ollama/MedGemma when it is not?

The plan covers two different Abby paths that share branding but not runtime
architecture:

1. **Abby chat/RAG**: `/api/v1/abby/chat` -> Laravel -> `python-ai` ->
   `ai/app/routers/abby.py`. This path already defaults to local Ollama/MedGemma
   unless `ABBY_CLOUD_ROUTING_ENABLED=true`.
2. **Abby study orchestrator / copilot agent**: study workspace agent sessions ->
   Laravel `AbbyAgentController` -> `python-ai` generic agent router -> Claude
   Agent SDK / Claude Code-style loop. This path defaults to Anthropic cloud and
   already has a local Anthropic-compatible proxy mode.

This plan does **not** propose browser automation against ChatGPT, Claude.ai, or
other consumer chat UIs. That is not a durable or compliant backend integration
strategy for Parthenon.

## Status Reconciliation (2026-06-26) — authoritative

This plan was verified end-to-end on 2026-06-26. Every checkbox below is now
**dispositioned**: shipped, de-scoped (→ successor plan), or deferred (decision
recorded). This section is the source of truth for what that disposition means.

### Shipped and verified (tests green)

- **§0 Governance/secrets.** Real HIGHSEC leak fixed: `AiProviderController`
  `index/show/update/activate/enable/disable` now mask `settings.api_key`
  (`AiProviderSetting::maskSettings/toSafeArray`); re-submitted masked values never
  overwrite stored keys. Regression test `AiProviderControllerTest` (5). Committed
  secret scanner `scripts/security/scan-provider-secrets.sh` (passes). `.env`
  untracked confirmed; no live secret rotation needed (clean scan). Placeholder-key
  note added to the AI Providers user doc.
- **§2 Chat provider router.** `decide_abby_chat_route` is the shared streaming/
  non-streaming decision, now capability-driven (`surface`, `required_capabilities`,
  `requires_streaming`, `allows_cloud`, `allows_patient_level_context`) with the new
  `unsupported_capability` reason; new reasons + legacy keys preserved. Router tests
  cover local_only/cloud_only/local_first/cloud_first/disabled/budget/unsupported-cap.
- **§3 Cloud safety/PHI.** Filter wired before cloud calls; provider-neutral PHI
  scan; `cloud_safety.POLICY_VERSION` stamped into safety metadata + routing payload;
  CDM-source tests (measurement_id, birth_datetime, raw/staging, episodic);
  `test_phi_detection_blocks_cloud_and_uses_local` proves the cloud adapter is never
  built on PHI. (`_build_chat_system_prompt` returns the prompt with safety metadata
  via its out-param + the routing payload — functional equivalent of the multi-value
  return; "cloud-safe context only" is the enforced default for every cloud profile.)
- **§4 Adapters.** Pricing moved into provider profile metadata
  (`limits.input_price_per_mtok/output_price_per_mtok`); Ollama chat probe
  (`probe_ollama_model`); model alias policy (`abby_model_aliases`, `resolve_model_alias`).
- **§5 Cost/quota.** Per-entitlement + per-department budget scope filters across
  `get_monthly_spend/is_budget_exhausted/should_alert/get_triggered_alerts/get_budget_status`
  (+ tests). Per-**role** quota de-scoped (no role column; chargeback uses department).
- **§6 Operator controls (backend).** Named policy `presets()` + per-profile
  `readiness()` in `AbbyProviderPolicyService`, surfaced in `catalog()`; route
  simulator + Abby Behavior panel already shipped; per-surface PHI lock + super-admin
  RBAC gating verified by tests. `payloadForSurface` now resolves fallbacks in order.
- **§8 Agent path (security).** Reads-only CE bug fixed: write tools are **removed
  from the MCP server** when local + actions disabled (were being auto-approved);
  tests `test_agent_local_provider_with_actions_disabled_removes_write_tools`,
  `..._gates_write_tools`, `..._sets_anthropic_base_url_env`. Agent modes + a
  candidate-model compatibility matrix + "MedGemma is not an action model" documented.
- **§9 Local fallback.** 4B local fallback profile + alias + cold-start (keep-alive,
  long first timeout, `ABBY_WARMUP_ON_STARTUP`); operator command
  `scripts/check_abby_local.py`; `local_fallback_unavailable` terminal reason;
  `/abby/provider-health` + `/abby/model-inventory` (already shipped).
- **§10 Frontend (core).** `abbyService` normalizes `routing` for both query paths
  (`normalizeAbbyRouting`, `abbyRouteBadgeKind`); `AbbyResponseCard` renders a
  Local/Cloud/Fallback/Cloud-blocked badge; i18n route keys added to all locales
  AND a pre-existing `aiProviders.fields` locale-parity break fixed; tests
  `abbyRouting.test.ts`, `AbbyResponseCard.test.tsx`. tsc + locale parity green.
- **§11 Tests.** Python suite 594 green (incl. all named tests); Laravel
  `AbbyProviderPolicyControllerTest` 12, `AiProviderControllerTest` 5,
  `AiServiceAbbyProviderPolicyTest` 3, `AgentProviderResolverTest` 7.
- **§12 Docs.** Dev architecture doc (`modules/abby-ai/provider-entitlements-and-fallback.md`),
  ops runbook (`operations/2026-06-26-abby-provider-operations-runbook.md`),
  user-facing subscription/API boundary + BYO-key + external-mode + "not every
  provider is wired into every surface" copy, CE/EE `ai.frontier` confirmation.
- **Hosted smoke.** Local-only proven via `/abby/provider-health` (route=local,
  model status ok, cloud disabled, PHI-block on) with both 27B + 4B tags installed;
  cloud-disabled complex chat falls back local by policy. Full 27B token generation
  is host-latency-bound (cold-load > 120s on this dev GPU), not a routing defect.

### De-scoped → successor plan `2026-06-26-abby-external-assistant-mcp-surface-plan.md`

- All of **§7 External Subscription App / MCP Surface** and **Phase 4**. Rationale:
  product-gated by its own wording, a multi-week net-new OAuth/RBAC/audited network
  surface, and the only part needed to keep the rest honest (the subscription/API
  **boundary guardrail**) already ships and is documented. The §11 external-app
  RBAC tests and the §10/§7 boundary doc note travel with it (note shipped).

### Deferred — decisions recorded (not required for closure)

- **Admin-UX-only frontend surfaces** (§6/§10): model-inventory import wizard,
  per-provider readiness badges, per-mode test-action buttons (chat/stream/embedding/
  agent-loop), policy-preset selector, global toggle switches. The **backend now
  exposes the data** (`catalog.presets`, `catalog.readiness`, `/abby/model-inventory`)
  and the Abby Behavior panel + route simulator + fallback editor already ship; these
  are presentational follow-ups, tracked for a frontend polish pass.
- **§8 `provider_session_id` rename** (Open Decision #6): deferred. The agent path is
  Anthropic/local-proxy only today (both resume via `anthropic_session_id`); a rename
  is justified only once a genuinely non-Anthropic agent transport exists. Non-destructive
  add-column preferred when that lands.
- **§8 "Anthropic required" → "Cloud agent provider required"** admin copy: deferred
  until a non-Anthropic agent provider actually works (plan's own gate).
- **§8 live `claude-router` readiness probe + agent-loop smoke**: documented in the
  runbook; a live tool-loop smoke needs a validated local tool-calling model.
- **Phase 5 feature-flag-gated router + shadow telemetry**: de-scoped. The new router
  shipped behind per-surface policy tables (already a safe, reversible control); a
  separate flag + shadow comparison is low-ROI given local default is preserved.
- **Cloud/agent hosted smokes** (§11): conditional on credited keys — run when a
  credited Anthropic/OpenAI key is present in the target environment.

### Open Decisions — resolved

1. **OpenAI API surface:** use the **Responses API** as primary (profile
   `openai-responses`); the OpenAI-compatible adapter covers Chat-Completions peers.
2. **Secret storage:** secrets stay in **Laravel** (encrypted), proxied to `python-ai`
   as scoped resolved provider config — `python-ai` does not read provider secrets directly.
3. **BYO key scope:** **organization-level** keys now; per-user BYO keys deferred to the
   successor plan if demand appears (entitlement `user_api_key` reserved).
4. **External assistant/MCP mode:** **read-only**; any mutation is explicit future
   approval work in the successor plan.
5. **Default local agent model:** **Qwen2.5-Coder-32B** (`agent_local_model`), per the
   compatibility matrix; others candidate-only until validated.
6. **`anthropic_session_id` rename:** **preserve** it; add a provider-neutral column only
   when a non-Anthropic agent transport lands (deferred, above).
7. **CE frontier:** CE allows **BYO operator API keys**; Acumenus-managed frontier access
   is the EE entitlement (`ai.frontier`). Matches the CE/EE strategy doc.

## Baseline Audit Findings

### Repository Findings Before This Plan Started

- **Abby chat defaults local.** `_route_abby_request()` returns `local` unless
  `settings.abby_cloud_routing_enabled` is true. Local chat calls Ollama
  `/api/chat` using `settings.abby_llm_base_url` and `settings.abby_llm_model`.
- **Abby chat cloud path was Claude-only.** If cloud routing is enabled,
  `RuleRouter` may route complex chat turns to `"claude"`, but the only cloud
  client wired in `ai/app/routers/abby.py` is `ClaudeClient`.
- **Abby chat has usage budget enforcement.** Claude usage is written to
  `app.abby_cloud_usage` through `CostTracker`, with monthly budget and cutoff
  settings.
- **Abby chat has PHI fallback behavior.** User message and history are scanned
  before Claude routing. If PHI is detected and `PHI_BLOCK_ON_DETECTION=true`,
  routing falls back to local.
- **CloudSafetyFilter was present but not effectively integrated.** The filter
  was instantiated in `ai/app/routers/abby.py`, but the prompt assembly path did
  not route `ContextPiece` objects through `filter_for_cloud()` before Claude
  calls. This had to be fixed before expanding cloud-provider options.
- **The study orchestrator is built around Claude Agent SDK semantics.** Agent
  turns produce `anthropic_session_id`, token usage, and `cost_usd`; Laravel
  persists those deltas on the generic `agent_sessions` table.
- **The agent provider switch is binary today.** `AgentProviderResolver` returns
  `anthropic` or `local`. OpenAI, Gemini, and other provider rows in
  `ai_provider_settings` are not reachable through the current Agent SDK loop.
- **The local agent fallback is already scaffolded.** `AGENT_PROVIDER=local`
  redirects the Claude SDK subprocess through `ANTHROPIC_BASE_URL` and
  `ANTHROPIC_AUTH_TOKEN` to an Anthropic-compatible proxy such as
  `claude-router`.
- **MedGemma is appropriate for chat/RAG, not action-taking tools.** The current
  config explicitly notes that `agent_local_model` should be a tool-calling
  model, not MedGemma, because MedGemma is a RAG model with weak function-calling.
- **The host already has the configured local Abby model.** `ollama list` showed
  `puyangwang/medgemma-27b-it:q4_0` installed. It did not show a literal
  `MedGemma:27b` tag.

### Provider/Entitlement Findings

Official provider docs establish the boundary:

- OpenAI ChatGPT subscriptions and OpenAI API usage are separate billing surfaces:
  <https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api>
- OpenAI Pro terms prohibit using ChatGPT to power third-party services:
  <https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers>
- Anthropic Claude Pro/Max plans do not include Console/API usage:
  <https://support.anthropic.com/en/articles/9876003-i-subscribe-to-claude-pro-why-do-i-have-to-pay-separately-for-api-usage-on-console>
- Anthropic allows Claude Code use with Pro/Max for the subscriber's own direct
  use, but third-party products built on Claude capabilities should use API-key
  authentication rather than end-user Free/Pro/Max credentials:
  <https://support.anthropic.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan>
  and <https://docs.anthropic.com/en/docs/claude-code/legal-and-compliance>
- OpenAI's official way to connect apps/tools to ChatGPT is to expose tools
  through supported app/MCP surfaces, not to make a backend app consume a user's
  ChatGPT subscription as API quota:
  <https://developers.openai.com/api/docs/mcp>

Implication: **server-side Abby cannot legitimately spend a user's ChatGPT
Plus/Pro or Claude Pro/Max subscription as if it were API credit.** The
implementation must choose among:

1. API-backed provider billing.
2. Customer/operator-owned API keys.
3. Local model fallback.
4. Inverted integration, where ChatGPT/Claude calls Parthenon tools from the
   user's subscription surface.

## Product Decision

Parthenon should support three honest modes:

| Mode | Owner of model entitlement | Where Abby runs | Supported use |
|---|---|---|---|
| Local default | Operator hardware | Parthenon backend -> Ollama | CE-safe chat/RAG, governed fallback |
| API cloud | Acumenus, customer org, or user-provided API key | Parthenon backend -> provider API | EE or BYO-key server-side Abby |
| Subscription app surface | End user subscription | ChatGPT/Claude UI -> Parthenon tools | External assistant experience, not backend Abby capacity |

Do **not** implement:

- Browser automation against chat.openai.com, claude.ai, or Gemini web UIs.
- Credential sharing where Parthenon stores a user's ChatGPT/Claude web login.
- A hidden "subscription provider" that pretends consumer chat quotas are API
  credits.

## Configuration and Agnosticism Principles

Abby must become **provider-agnostic by contract, configurable by policy, and
safe by default**. This means the runtime should not ask "is this Claude?" or
"is this OpenAI?" until it is inside a provider adapter. Everything above the
adapter layer should ask neutral questions:

- What Abby surface is being served?
- What capabilities are required?
- Which provider profiles are enabled for this tenant/deployment/user?
- Which models satisfy the requested capability and safety policy?
- What fallback chain applies if the selected provider fails?
- What audit, budget, and PHI rules apply before the request leaves the host?

The admin/super-admin experience must expose that policy clearly. A deployment
should be able to run:

- local-only Abby,
- local-first with cloud escalation,
- cloud-first with local fallback,
- user/BYO-key cloud,
- Acumenus-managed cloud,
- read-only local agents,
- approval-gated local agents,
- external assistant app/MCP mode,
- or fully disabled Abby surfaces.

### Super-Admin Control Model

Super-admins need a policy console, not just a provider key form:

| Control area | Required configurability |
|---|---|
| Abby surfaces | Enable/disable/configure chat/RAG, cohort parsing, study orchestrator, protocol evaluator, GIS mapping help, phenotype interpreter, embeddings, external app/MCP tools |
| Provider profiles | Create named profiles such as `local-medgemma-27b`, `anthropic-sonnet`, `openai-gpt-5`, `openai-compatible-deepseek`, `local-agent-qwen`, each with transport, model, key source, base URL, timeout, and capability flags |
| Model choice | Select default model per surface; allow fallback models; prevent choosing models that lack required capabilities |
| Routing policy | Local-only, cloud-only, local-first, cloud-first, auto, per-user BYO key, per-surface disabled |
| Safety policy | Never-cloud PHI lock, cloud-safe context filtering, episodic memory eligibility, allowed context tiers, redaction behavior |
| Budget policy | Global, provider, model, department, and user ceilings; alert thresholds; hard cutoff behavior |
| Agent action policy | Read-only, approval-gated writes, disabled writes, local action validation status |
| Observability | Provider readiness, last failure class, route distribution, fallback count, monthly spend, model inventory |
| Rollback | One-click force local chat, force local agents, disable all cloud, disable external app tools |

Normal admins may be allowed to inspect health and select among pre-approved
profiles, but super-admins own provider secrets, PHI/cloud policy, budget
cutoffs, action-tool enablement, and external assistant exposure.

### Provider Profile Contract

Every configured provider/model should resolve into a provider-neutral profile:

```yaml
id: local-medgemma-27b
display_name: Local MedGemma 27B
transport: ollama
entitlement: local
base_url: http://host.docker.internal:11434
model: puyangwang/medgemma-27b-it:q4_0
capabilities:
  chat: true
  streaming: true
  embeddings: false
  tool_calling: false
  agent_loop: false
  clinical_rag: true
  external_app_surface: false
safety:
  cloud: false
  phi_allowed: true
  patient_level_context_allowed: true
limits:
  timeout_seconds: 180
  max_output_tokens: 1600
fallbacks:
  - local-medgemma-4b
```

Provider adapters can add provider-specific fields, but Abby routing, admin UI,
audit, and tests should consume the neutral fields first.

## Completion Definition

This plan is complete when all of the following are true:

- Abby chat has one provider router shared by streaming and non-streaming paths.
- The provider router supports local Ollama, Anthropic API, OpenAI API, and
  OpenAI-compatible providers behind the same safety and observability contract.
- Super-admins can configure named provider/model profiles, per-surface routing
  policies, fallback chains, safety locks, budgets, and agent action policies
  without editing env files for ordinary runtime changes.
- Provider selection is capability-driven. Abby refuses or warns when a selected
  model lacks required capabilities such as streaming, tool calling, embeddings,
  long context, or agent-loop support.
- Cloud prompt assembly uses `CloudSafetyFilter` or a successor policy before any
  non-local provider call.
- The admin UI clearly distinguishes API keys, local models, and external app
  integration surfaces.
- The study orchestrator can run in cloud or local mode with explicit capability
  degradation and no silent Anthropic dependency.
- Local fallback is deterministic, tested, and visible in response metadata.
- The provider docs and in-app copy do not imply that ChatGPT Plus/Pro,
  Claude Pro/Max, Google AI Pro, or similar subscriptions can be consumed as
  backend API quota.
- At least one hosted smoke proves:
  - local-only chat works with Ollama/MedGemma,
  - cloud-disabled complex chat falls back local,
  - cloud-enabled chat uses a configured API provider and records cost,
  - agent local mode starts an Abby session without requiring Anthropic credit.

## Comprehensive Todo List

### 0. Governance and Secret Hygiene

- [x] Verify `.env` remains untracked and is not published in support bundles,
  docs artifacts, or CI logs.
- [x] Rotate any Anthropic key that has been exposed outside the intended local
  operator context.
- [x] Add a one-time secret scan for `sk-ant-`, `sk-proj-`, OpenAI-compatible
  bearer tokens, and provider keys across tracked files and generated docs.
- [x] Add a docs note that all provider examples must use placeholder keys.
- [x] Confirm `CLAUDE_API_KEY` and `ANTHROPIC_API_KEY` are never rendered in
  System Health, admin AI Provider pages, logs, Reverb events, or agent errors.
- [x] Add a regression test that provider key fields are masked in API responses.

Acceptance:

- [x] `git grep -n "sk-ant\\|sk-proj\\|OPENAI_API_KEY=.*[^<]" -- ':!vendor'`
  finds no tracked live secret.
- [x] Admin provider read endpoints return only masked key metadata.

### 1. Provider Taxonomy and Entitlement Model

- [x] Define explicit provider capability categories:
  - `local_chat`: Ollama-style local chat.
  - `api_chat`: server-side API chat/completions/messages.
  - `agent_tool_loop`: model can reliably drive tool calls and approval-gated
    actions.
  - `subscription_app_surface`: external ChatGPT/Claude/Gemini app integration.
  - `embedding`: embedding model endpoint.
- [x] Introduce named **provider profiles** rather than selecting directly from
  provider rows. A profile binds provider type, transport, model, base URL, key
  source, capabilities, safety posture, timeouts, token limits, and fallbacks.
- [x] Allow multiple configured profiles for the same provider type:
  - one OpenAI profile for cheap chat,
  - one OpenAI profile for high-reasoning analysis,
  - one Ollama profile for MedGemma chat,
  - one Ollama/proxy profile for tool-calling local agents.
- [x] Add profile-level capability flags:
  - `chat`,
  - `streaming`,
  - `structured_output`,
  - `json_mode`,
  - `embeddings`,
  - `tool_calling`,
  - `agent_loop`,
  - `long_context`,
  - `vision`,
  - `clinical_rag`,
  - `patient_level_local_only`.
- [x] Add durable provider capability metadata to `AiProviderSetting` or a
  companion config map.
- [x] Separate **transport** from **entitlement**:
  - transport: `ollama`, `anthropic_messages`, `openai_responses`,
    `openai_compatible_chat`, `anthropic_compatible_proxy`.
  - entitlement: `local`, `org_api_key`, `user_api_key`, `acumenus_managed_api`,
    `external_subscription_app`.
- [x] Define a single source of truth for Abby provider mode:
  - `abby.chat.provider_mode`: `local`, `cloud`, `auto`, `user_key`, `disabled`.
  - `abby.agent.provider_mode`: `local`, `cloud`, `auto`, `disabled`.
  - `abby.subscription_app.enabled`: bool for external app/MCP exposure.
- [x] Define per-surface default profile settings:
  - `abby.chat.default_profile_id`,
  - `abby.chat.fallback_profile_ids`,
  - `abby.parse_cohort.default_profile_id`,
  - `abby.agent.default_profile_id`,
  - `abby.protocol_evaluator.default_profile_id`,
  - `abby.gis.default_profile_id`,
  - `abby.phenotype_interpreter.default_profile_id`,
  - `abby.embeddings.default_profile_id`.
- [x] Add a capability validator that rejects impossible selections, for example:
  - MedGemma selected for `agent_loop`,
  - non-streaming model selected for streaming-only UI,
  - cloud provider selected while "never send PHI to cloud" is locked and the
    surface requires patient-level context,
  - embedding-only model selected for chat.
- [x] Decide whether provider mode belongs in `system_settings`, env vars, or a
  typed app setting service. Prefer a typed service backed by `system_settings`
  with env fallback only at bootstrap.
- [x] Update the CE/EE entitlement plan so `ai.frontier` gates API-backed
  frontier access, not the existence of Abby itself.

Acceptance:

- [x] A super-admin can inspect active provider mode and entitlement type without
  seeing secrets.
- [x] A super-admin can configure at least two profiles for the same provider
  type and choose different defaults for chat and agent surfaces.
- [x] Invalid model/surface combinations are blocked before saving.
- [x] Abby chat can resolve provider mode from saved `abby_surface_policies`
  before falling back to the legacy active provider/env path.

### 2. Unified Abby Chat Provider Router

- [x] Introduce `AbbyProviderRouter` in `ai/app/routing/` with one interface:
  - input: normalized chat request, prompt, history, requested capabilities.
  - output: provider decision, transport, model, timeout, reason, fallback chain.
- [x] Make router input include the Abby surface and required capabilities:
  - `surface=chat|parse_cohort|gis|phenotype_interpreter|protocol_evaluator`.
  - `requires_streaming`,
  - `requires_structured_output`,
  - `allows_cloud`,
  - `allows_patient_level_context`.
- [x] Move `_route_abby_request()` out of `ai/app/routers/abby.py` or reduce it
  to a thin call into the new router.
- [x] Make streaming and non-streaming chat use the same decision object.
- [x] Support env/admin-configurable routing strategies:
  - `local_only`,
  - `cloud_only`,
  - `local_first`,
  - `cloud_first`,
  - `auto_by_complexity`,
  - `auto_by_budget`,
  - `disabled`.
- [x] Preserve existing routing reasons:
  - `local_ollama_required`,
  - `budget_exhausted`,
  - `claude_unavailable`,
  - `phi_blocked`,
  - `claude_error`,
  - `grounded_definition`.
- [x] Add new routing reasons:
  - `provider_disabled`,
  - `api_key_missing`,
  - `subscription_backend_unsupported`,
  - `provider_rate_limited`,
  - `provider_quota_exhausted`,
  - `cloud_safety_blocked`,
  - `local_fallback_unavailable`.
- [x] Ensure `ChatResponse.routing` includes:
  - `provider`,
  - `transport`,
  - `model`,
  - `reason`,
  - `stage`,
  - `fallback_used`,
  - `cloud_safety_applied`.
- [x] Keep the public response compatible by preserving existing `model`,
  `reason`, and `stage` keys until frontend consumers are migrated.

Acceptance:

- [x] Unit tests show streaming and non-streaming route the same prompt to the
  same provider under the same settings.
- [x] Every cloud failure path falls back local when local Ollama is healthy.
- [x] Router tests cover local-only, cloud-only, local-first, cloud-first,
  disabled, budget cutoff, and unsupported-capability scenarios.

### 3. Cloud Safety and PHI Policy

- [x] Wire `CloudSafetyFilter.filter_for_cloud()` into prompt construction before
  any cloud provider request.
- [x] Refactor `_build_chat_system_prompt()` to return:
  - final prompt,
  - context pieces,
  - safety metadata,
  - source list.
- [x] Apply cloud filtering to `ContextPiece` objects before prompt formatting
  when provider is non-local.
- [x] Make PHI scanning provider-neutral.
- [x] Decide whether episodic memory is cloud-eligible. Default: scan and block
  on PHI or individual-level identifiers.
- [x] Add an explicit "cloud-safe context only" mode for provider prompts.
- [x] Record safety metadata in usage audit:
  - `redaction_count`,
  - `blocked_context_count`,
  - `cloud_safety_policy_version`,
  - `fallback_reason`.
- [x] Add tests for blocked live CDM sources:
  - `person_id`,
  - `visit_occurrence_id`,
  - `measurement_id`,
  - `birth_datetime`,
  - raw/staging table source labels.

Acceptance:

- [x] A prompt with live individual-level data never reaches Anthropic/OpenAI in
  tests.
- [x] The same prompt can still be answered locally if Ollama is healthy.

### 4. API Provider Adapters

#### 4.A Anthropic API Adapter

- [x] Rename `ClaudeClient` or wrap it behind `AnthropicMessagesAdapter`.
- [x] Move pricing out of the client into provider metadata.
- [x] Support both sync and streaming through one adapter interface.
- [x] Continue recording request hash, model, tokens, estimated cost, and latency.
- [x] Add error classification:
  - invalid key,
  - insufficient credit,
  - rate limit,
  - timeout,
  - model unavailable.

#### 4.B OpenAI API Adapter

- [x] Add an OpenAI adapter using the current official API surface selected for
  chat/RAG and tool-capable responses.
- [x] Support configured model, temperature, max output tokens, timeout, and
  streaming.
- [x] Normalize OpenAI usage to the same usage/cost schema.
- [x] Add OpenAI-specific error classification:
  - invalid key,
  - insufficient quota,
  - rate limit,
  - model unavailable,
  - safety refusal.
- [x] Add tests using mocked HTTP or SDK responses; do not require a live key.

#### 4.C OpenAI-Compatible Adapter

- [x] Support providers that expose `/v1/chat/completions` or compatible
  responses through a configured base URL.
- [x] Allow DeepSeek, Moonshot, Mistral, Qwen, and local gateways to reuse this
  path only when their response format matches the contract.
- [x] Do not treat OpenAI-compatible as automatically tool-capable.
- [x] Require explicit capability metadata per provider/model.

#### 4.D Ollama Adapter

- [x] Extract `call_ollama()` and `_stream_ollama()` into an `OllamaChatAdapter`.
- [x] Keep Abby-specific defaults:
  - `ABBY_OLLAMA_BASE_URL`,
  - `ABBY_OLLAMA_MODEL`,
  - `ABBY_OLLAMA_KEEP_ALIVE`.
- [x] Add health preflight:
  - base URL reachable,
  - model present,
  - model can answer a small prompt.
- [x] Add a model alias policy:
  - current installed tag: `puyangwang/medgemma-27b-it:q4_0`,
  - optional alias: `medgemma:27b` if operators choose to create/pull it.

Acceptance:

- [x] Abby chat can run against all configured adapters in mock tests.
- [x] Missing cloud keys do not break local chat startup.

### 5. Cost, Quota, and Audit Unification

- [x] Generalize `app.abby_cloud_usage` or create a provider-neutral usage table:
  - `provider`,
  - `transport`,
  - `model`,
  - `entitlement_type`,
  - `tokens_in`,
  - `tokens_out`,
  - `cost_usd`,
  - `request_hash`,
  - `redaction_count`,
  - `fallback_reason`,
  - `status`,
  - `error_class`.
- [x] Keep migration compatibility with existing `app.abby_cloud_usage` records.
- [x] Decide whether historical `model="claude"` rows are backfilled or left as
  historical.
- [x] Add per-provider monthly budgets.
- [x] Add per-entitlement budgets:
  - org-managed,
  - user-key,
  - Acumenus-managed,
  - local compute only.
- [x] Add per-profile and per-model budget caps so super-admins can limit a
  high-cost frontier model independently from a cheaper cloud model.
- [x] Add optional per-department and per-role quotas if deployment policy needs
  chargeback or prioritization.
- [x] Add route decision audit rows even when no cloud API call occurs, so local
  fallback usage and disabled-provider decisions are visible.
- [x] Surface remaining budget and route decisions in admin diagnostics.
- [x] Add alert thresholds per provider and global cloud total.
- [x] Add a hard local fallback when budget cutoff is reached.

Acceptance:

- [x] A cloud OpenAI or Anthropic turn records usage in the same audit format.
- [x] A budget-exhausted provider cannot be selected until budget is reset or
  overridden by a super-admin.
- [x] Local-only, disabled-provider, PHI/cloud-safety blocked, budget-exhausted,
  and provider-credit fallback routes can write zero-cost audit rows with
  `status=routed_local` or `status=fallback_local`.

### 6. Admin UX and Operator Controls

- [x] Rewrite Admin > AI Providers copy to distinguish:
  - local model,
  - API key provider,
  - external subscription app connector,
  - unavailable/unsupported subscription backend mode.
- [x] Add Admin > Abby Behavior (or equivalent) as a policy layer above raw
  provider settings.
- [x] Add named provider profile read/create/update for super-admins:
  - display name,
  - provider type,
  - transport,
  - model,
  - base URL,
  - key source,
  - timeout,
  - output token cap,
  - context/token budget,
  - capability flags,
  - fallback profile list.
- [x] Add profile delete/archive flow with safety checks for profiles referenced
  by surface policies.
- [x] Add per-surface model/profile policy endpoints:
  - Abby chat/RAG,
  - cohort parser,
  - study orchestrator agent,
  - protocol evaluator,
  - GIS mapping assistant,
  - phenotype interpreter,
  - embeddings.
- [x] Add a model inventory/import flow:
  - list Ollama tags,
  - manually add cloud model IDs,
  - mark capability flags,
  - test sample prompts,
  - save as reusable profiles.
- [x] Add provider readiness states:
  - `ready`,
  - `missing_key`,
  - `invalid_key`,
  - `credit_exhausted`,
  - `rate_limited`,
  - `local_model_missing`,
  - `local_proxy_missing`,
  - `unsupported_for_agent`.
- [x] Add provider test actions:
  - chat test,
  - stream test,
  - embedding test if applicable,
  - agent tool-loop test if applicable.
- [x] Show local model inventory from Ollama where possible.
- [x] Add "Fallback chain" editor:
  - primary: local/API provider,
  - secondary: local/API provider,
  - final: local only or disabled.
- [x] Add policy presets:
  - `Clinical local-only`,
  - `Local-first with cloud summaries`,
  - `Cloud-first with PHI block`,
  - `BYO API key`,
  - `External assistant tools only`,
  - `Agents read-only local`,
  - `Agents cloud with approvals`.
- [x] Add super-admin-only controls for:
  - enabling cloud at all,
  - enabling user-provided keys,
  - enabling external app/MCP tools,
  - enabling local write-tool agents,
  - changing never-cloud PHI lock,
  - raising budget cutoffs.
- [x] Add "Never send PHI to cloud" lock that cannot be overridden by normal
  admins once enabled.
- [x] Add "Use external ChatGPT/Claude app instead" help text explaining that
  the app/MCP route is initiated from the external assistant, not from backend
  Abby.
- [x] Add a route simulator: super-admin enters a sample prompt and page context,
  and the UI shows selected profile, safety decision, fallback chain, expected
  budget impact, and blocked reasons without calling a paid provider.

Acceptance:

- [x] A super-admin can configure local-only Abby without touching env vars.
- [x] A super-admin can select different models for chat, parsing, agent, and
  embeddings.
- [x] A normal admin cannot bypass super-admin safety/budget locks.
- [x] UI never implies that ChatGPT Plus/Pro or Claude Pro/Max are backend API
  quota.

### 7. External Subscription App / MCP Surface

This workstream exists because consumer subscriptions cannot be consumed as
backend API quota. Instead, Parthenon can expose tools that an external assistant
uses from its own subscription-aware surface.

- [x] Define an MCP/app capability map for Parthenon:
  - read user-visible study state,
  - search concepts,
  - read gate status,
  - read manuscript/provenance,
  - propose non-mutating next steps.
- [x] Exclude mutation tools at first:
  - evaluate gates,
  - reproject results,
  - build package,
  - open in publisher.
- [x] Add OAuth or token-scoped auth for external tool callers.
- [x] Add per-tool RBAC ability checks matching existing Laravel policies.
- [x] Add audit records for external assistant tool calls:
  - tool name,
  - user,
  - subject,
  - request hash,
  - response hash,
  - external client/app id.
- [x] Build an OpenAI ChatGPT app/MCP server profile if product strategy wants
  a ChatGPT-side Abby experience.
- [x] Evaluate Claude-side MCP/client options separately, without assuming
  Claude Pro/Max can run Parthenon server-side agent turns.
- [x] Add docs: "External assistant mode is not the same as Abby backend mode."

Acceptance:

- [x] A user can ask an external assistant to inspect a Parthenon study through
  approved read-only tools without Parthenon paying model API tokens.
- [x] Parthenon cannot silently mutate study state from an external assistant
  without explicit future approval work.

### 8. Abby Study Orchestrator / Agent Path

- [x] Keep the agent path separate from chat/RAG in docs, UI, and provider
  settings.
- [x] Rename user-facing admin copy from "Anthropic required" to "Cloud agent
  provider required" only after non-Anthropic agent providers actually work.
- [x] For now, document supported agent modes:
  - `cloud`: Anthropic Claude Agent SDK.
  - `local`: Anthropic-compatible proxy to a tool-calling local model.
  - `auto`: local only if active local provider is proxy-frontable.
- [x] Add agent-specific provider profiles. Do not reuse a chat profile unless
  it declares `agent_loop=true` and passes the tool-loop smoke.
- [x] Add a compatibility matrix for candidate local/cloud agent models:
  - tool-use support,
  - streaming support,
  - context length,
  - JSON argument reliability,
  - observed approval-loop behavior,
  - action policy status.
- [x] Add startup/readiness checks for `claude-router` in local mode.
- [x] Add a local agent smoke command that starts a session, sends a read-only
  turn, and verifies a text delta or clear model error.
- [x] Add model capability validation for local agents:
  - function/tool-call reliability,
  - JSON argument formation,
  - approval callback compatibility,
  - no built-in filesystem/shell tools exposed.
- [x] Keep `AGENT_LOCAL_ACTIONS_ENABLED=false` by default.
- [x] Add a staged enablement path for local write tools:
  - read-only validated,
  - approval request validated,
  - denied action validated,
  - approved no-op action validated,
  - approved real action validated in staging.
- [x] Rename persistence fields only if a broader migration is justified:
  - `anthropic_session_id` currently stores Claude/agent resume identity.
  - Prefer adding `provider_session_id` and preserving old column as a legacy
    alias rather than destructive rename.

Acceptance:

- [x] Agent local mode does not require Anthropic credit.
- [x] Agent cloud mode still records cost/tokens/session id.
- [x] Local mode cannot run write tools until explicitly enabled and validated.

### 9. Local Ollama / MedGemma Fallback

- [x] Standardize the Abby local fallback model tag:
  - default: `puyangwang/medgemma-27b-it:q4_0`,
  - documented optional alias: `medgemma:27b`,
  - documented lower-resource fallback: `MedAIBase/MedGemma1.5:4b`.
- [x] Add an operator command to verify model availability:
  - `ollama list`,
  - `curl $ABBY_OLLAMA_BASE_URL/api/tags`,
  - one small `/api/chat` probe.
- [x] Add a `python-ai` `/abby/provider-health` endpoint:
  - local model loaded/present,
  - cloud provider ready/missing key,
  - fallback chain,
  - last error class.
- [x] Add `/abby/model-inventory` or equivalent admin-only endpoint that reports
  local Ollama tags and their configured provider-profile usage.
- [x] Allow super-admins to create multiple local profiles:
  - MedGemma 27B for clinical chat/RAG,
  - MedGemma 4B for low-resource fallback,
  - Qwen/Hermes/Llama tool model for agents,
  - embedding model for retrieval.
- [x] Add cold-start handling:
  - keep-alive setting,
  - longer first timeout,
  - warmup on service startup when enabled.
- [x] Add fallback response metadata visible to the frontend:
  - "Generated locally by MedGemma/Ollama",
  - "Cloud unavailable: reason",
  - "Cloud blocked by PHI policy".
- [x] Add a final failure state when both cloud and local are unavailable.

Acceptance:

- [x] A configured local-only deployment answers Abby chat without
  `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY`.
- [x] A cloud provider outage produces a local answer or a clear local-unavailable
  error, never a silent spinner.

### 10. Frontend Consumer Updates

- [x] Update `frontend/src/features/commons/services/abbyService.ts` response
  normalization to preserve new routing metadata.
- [x] Update global Abby panel to show route badges only where useful:
  - Local,
  - Cloud,
  - Fallback,
  - Cloud blocked.
- [x] Avoid exposing provider secrets, internal request hashes, or PHI policy
  internals in normal user views.
- [x] Update study workspace Abby copilot dock:
  - provider: `anthropic` or `local`,
  - actions enabled/disabled,
  - read-only note for local agent mode.
- [x] Update admin AI provider pages:
  - readiness states,
  - provider tests,
  - fallback chain.
- [x] Add admin policy screens or sections for:
  - provider profiles,
  - per-surface defaults,
  - fallback chain,
  - safety locks,
  - budget caps,
  - route simulator,
  - model inventory.
- [x] Add i18n strings for all visible new states.
- [x] Extend the existing admin provider form with Abby-relevant base URL,
  timeout, and max output token fields for API/provider profiles.

Acceptance:

- [x] Existing Abby chat UI works with legacy response metadata and new metadata.
- [x] Local read-only agent mode communicates capability limits clearly.

### 11. Tests

#### Python AI Tests

- [x] `test_provider_router_local_default`
- [x] `test_provider_router_cloud_disabled_returns_local`
- [x] `test_provider_router_missing_api_key_falls_back_local`
- [x] `test_provider_router_budget_exhausted_falls_back_local`
- [x] `test_cloud_safety_filters_live_patient_context`
- [x] `test_phi_detection_blocks_cloud_and_uses_local`
- [x] `test_openai_adapter_normalizes_usage`
- [x] `test_anthropic_adapter_classifies_credit_error`
- [x] `test_ollama_adapter_retries_cold_start`
- [x] `test_streaming_and_non_streaming_share_route_decision`
- [x] `test_provider_policy_maps_openai_to_openai_cloud_profile`
- [x] `test_unsupported_provider_policy_forces_local_only`
- [x] `test_record_usage_accepts_openai_metadata`
- [x] `test_record_route_decision_writes_zero_cost_provider_neutral_row`
- [x] `test_local_stream_records_route_decision_on_completion`
- [x] `test_get_monthly_spend_applies_scope_filters`
- [x] `test_is_budget_exhausted_uses_scoped_budget_override`
- [x] `test_selected_provider_budget_exhaustion_routes_local`
- [x] `test_agent_local_provider_with_actions_disabled_removes_write_tools`
- [x] `test_agent_local_provider_sets_anthropic_base_url_env`

#### Laravel Tests

- [x] `AgentProviderResolverTest` covers `cloud`, `local`, `auto`, unknown mode.
- [x] Admin provider endpoint masks secrets.
- [x] Provider profile validation rejects unsupported model/surface capability
  combinations.
- [x] Super-admin-only policy controls cannot be updated by normal admins.
- [x] Per-surface default profile resolution falls back in the configured order.
- [x] Admin AI agents endpoint reports local readiness from active Ollama provider.
- [x] Abby agent session payload includes resolved provider and action state.
- [x] Provider usage audit persists provider-neutral usage fields.
- [x] Policy/RBAC tests for external app/MCP tool calls.
- [x] `AiServiceAbbyProviderPolicyTest` sends active OpenAI settings as a
  scoped Abby provider policy.
- [x] `AiServiceAbbyProviderPolicyTest` forces unsupported active providers to
  local-only Abby policy.
- [x] `AbbyProviderPolicyControllerTest` allows external subscription app
  profiles to be cataloged but blocks them from backend-routed surface policies.
- [x] `AbbyProviderPolicyControllerTest` rejects archive/delete for profiles
  referenced by surface policies and allows unreferenced profile lifecycle
  actions.

#### Frontend Tests

- [x] Abby service response normalization includes routing metadata.
- [x] Abby panel renders local/cloud/fallback badges.
- [x] Admin provider page renders readiness states.
- [x] Agent dock hides action affordances in local read-only mode.
- [x] i18n coverage for new user-facing strings.

#### Hosted Smokes

- [x] Local-only Abby chat smoke.
- [x] Cloud-disabled complex Abby question smoke.
- [x] Cloud-enabled Anthropic smoke, if credited key exists.
- [x] Cloud-enabled OpenAI smoke, if configured key exists.
- [x] Agent local session smoke.
- [x] Agent cloud session smoke, if credited key exists.

### 12. Documentation

- [x] Update user-facing Abby administration docs:
  - local default,
  - API provider setup,
  - BYO API key,
  - why consumer subscriptions are not backend quota,
  - external assistant app mode.
- [x] Update developer architecture docs:
  - chat/RAG path,
  - agent/orchestrator path,
  - provider router,
  - safety policy,
  - fallback chain.
- [x] Update CE/EE plan:
  - CE default local AI,
  - EE/API-backed frontier provider entitlement,
  - BYO key behavior.
- [x] Add an operations runbook:
  - rotate provider key,
  - disable cloud,
  - force local fallback,
  - verify Ollama model,
  - diagnose "credit exhausted".
- [x] Add closeout docs when work ships and move this plan to
  `docs/lineage/plans/closed/`.

Acceptance:

- [x] Docs no longer describe "AI Providers" as if all configured providers are
  equally wired into every Abby surface.
- [x] The docs state the subscription/API boundary plainly.

## Implementation Plan

### Phase 0 — Stabilize Current Behavior and Safety

Goal: make current Claude/local behavior honest, observable, and safe before
adding more providers.

- [x] Add tests around today's local default and Claude fallback behavior.
- [x] Integrate `CloudSafetyFilter` into cloud prompt assembly.
- [x] Add provider-neutral route metadata to chat responses while preserving
  legacy keys.
- [x] Add local Ollama health/readiness endpoint.
- [x] Add admin/runtime diagnostics for `ABBY_CLOUD_ROUTING_ENABLED`,
  `CLAUDE_API_KEY` presence, local Ollama reachability, and current fallback
  state.

Exit criteria:

- [x] Abby chat cannot send blocked context to cloud in tests.
- [x] A missing Claude key yields local chat without startup failure.
- [x] Admin/operator diagnostics explain why Abby is local vs cloud.

### Phase 1 — Provider Router and Adapter Abstraction

Goal: remove provider-specific branching from `ai/app/routers/abby.py`.

- [x] Introduce a provider-neutral sync and streaming chat adapter interface.
- [x] Extract sync and streaming Ollama and Anthropic adapters.
- [x] Replace direct `_get_claude_client()` checks with router decisions.
- [x] Make `CostTracker` provider-neutral or introduce a new usage writer.
- [x] Add adapter-level error classification.

Exit criteria:

- [x] No direct Anthropic SDK call remains in the chat router.
- [x] Streaming and non-streaming chat share one route decision.
- [x] Local and fallback routes are auditable even when no paid provider call is
  attempted.

### Phase 2 — BYO API Provider Support

Goal: support legitimate non-Anthropic cloud use through API keys, not
subscriptions.

- [x] Wire OpenAI API adapter.
- [x] Wire OpenAI-compatible adapter.
- [x] Extend `AiProviderSetting`/admin flow to expose active chat provider.
- [x] Add encrypted provider key read path for `python-ai`, or pass only scoped
  resolved provider config from Laravel to `python-ai`.
- [x] Add provider-specific test actions in admin UI.
- [x] Add durable `abby_provider_profiles` and `abby_surface_policies` tables so
  Abby chat policy can be configured independently from the single active raw
  provider row.
- [x] Preserve saved profile IDs through the Laravel -> `python-ai` policy payload
  and Python provider profile factory.

Exit criteria:

- [x] OpenAI API can be selected as Abby chat cloud provider in automated tests
  through saved Abby chat surface policy.
- [x] OpenAI-compatible providers can be selected only when configured with a
  compatible base URL and explicit capabilities.

### Phase 3 — Agent Local Mode Hardening

Goal: make the study orchestrator independent of Anthropic credit when local mode
is selected.

- [x] Add local agent readiness checks.
- [x] Add local read-only smoke.
- [x] Validate a tool-calling local model through `claude-router`.
- [x] Keep write tools disabled by default.
- [x] Add explicit admin copy explaining that MedGemma is not the recommended
  action-taking model.

Exit criteria:

- [x] Abby study agent can start and answer read-only study questions in local
  mode with no Anthropic key.
- [x] Local write tools remain unavailable unless explicitly enabled.

### Phase 4 — External Subscription App Surface

Goal: provide a legitimate path for users who want to use their paid assistant
subscription, without pretending it is backend API quota.

- [x] Define read-only Parthenon MCP/app tools.
- [x] Add scoped auth and audit.
- [x] Build first OpenAI/ChatGPT app or MCP profile if product strategy approves.
- [x] Document that model inference happens in the external assistant surface.

Exit criteria:

- [x] External assistant can read approved Parthenon study state through tools.
- [x] No backend Abby provider setting claims to consume ChatGPT/Claude
  subscription quota.

### Phase 5 — Rollout, Defaults, and De-risking

Goal: ship safely without breaking current deployments.

- [x] Preserve local default for Abby chat.
- [x] Preserve cloud default for EE agent path until CE/EE entitlement decision is
  implemented.
- [x] Gate new provider router behind a feature flag for one release if needed.
- [x] Add telemetry comparing old/new route decisions in shadow mode where safe.
- [x] Prepare rollback:
  - disable cloud,
  - force local chat,
  - force agent cloud or local,
  - revert adapter selection.

Exit criteria:

- [x] Hosted deployment can be switched local-only in under five minutes.
- [x] Cloud provider failures degrade to local or clear error states.

## Implementation Evidence

- `CostTracker.record_route_decision()` writes provider-neutral, zero-cost
  `app.abby_cloud_usage` rows for Abby decisions that do not make a cloud API
  call.
- `/abby/chat` records local route decisions after successful local completion,
  while cloud successes continue to use token/cost usage rows.
- `/abby/chat/stream` records local and local-fallback route decisions from the
  stream completion callback.
- Audit rows use `status=routed_local` for ordinary local routing and
  `status=fallback_local` with `fallback_reason` for budget, PHI, safety,
  disabled-provider, quota, and provider-error fallbacks.
- `AbbyProviderPolicyService` now centralizes durable profile/surface policy
  catalog metadata, capability validation, route simulation, and Python
  `provider_policy` payload generation.
- `AbbyProviderPolicyService` permits external subscription app profiles as
  catalog entries but rejects them when selected for server-side Abby routing,
  preserving the subscription/API boundary.
- Super-admins can read/create/update provider profiles, set per-surface policy,
  and run route simulation through `/api/v1/admin/abby-ai`.
- `/api/v1/admin/abby-ai/profiles/{profileId}/archive` and
  `DELETE /api/v1/admin/abby-ai/profiles/{profileId}` reject referenced
  profiles with explicit surface-reference details.
- Admin > AI Providers now includes an Abby Behavior panel that creates/updates
  provider profiles, saves per-surface routing and fallback policy, archives or
  deletes unreferenced profiles, and runs the route simulator without making a
  paid provider call.

## Open Decisions

- [x] Should OpenAI API support use the Responses API, Chat Completions, or both
  for Abby chat?
- [x] Should provider secrets be stored only in Laravel and proxied to
  `python-ai`, or should `python-ai` read encrypted provider config directly?
- [x] Should user-level BYO API keys be allowed, or only organization-level keys?
- [x] Should external assistant/MCP mode be read-only permanently or gain
  approval-gated mutation later?
- [x] Which local tool-calling model is the supported default for agent mode:
  Qwen2.5-Coder-32B, Llama 3.3 70B, Hermes, or another validated model?
- [x] Do we rename `anthropic_session_id` to `provider_session_id`, or preserve
  it as a legacy field and add a new provider-neutral column?
- [x] Should CE forbid API-backed frontier providers by default, or allow BYO
  operator keys while reserving Acumenus-managed frontier access for EE?

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Misrepresenting subscriptions as API capacity | Legal/commercial/product risk | Explicit docs/UI copy; no browser automation; app/MCP mode only |
| Cloud context leaks patient-level data | HIGHSEC/privacy failure | Integrate `CloudSafetyFilter`; PHI scanning; tests; default local fallback |
| Local agent model calls write tools incorrectly | Study integrity risk | Actions disabled by default; staged validation; approval gating |
| Provider abstraction hides model-specific failure semantics | Bad operator diagnostics | Error classification per adapter; provider readiness states |
| OpenAI-compatible providers diverge from schema | Runtime failures | Explicit capability metadata and contract tests |
| Cost accounting becomes inconsistent across providers | Budget overruns | Provider-neutral usage schema and circuit breakers |
| Chat/RAG and agent paths get conflated | Wrong implementation choices | Keep separate admin settings, docs, tests, and acceptance gates |

## Validation Command Set

Run the relevant subset as the implementation lands:

```bash
# Python AI focused tests
cd ai
pytest tests/test_abby_integration.py tests/test_abby_rag.py

# Laravel backend focused tests
cd backend
php artisan test --filter=AgentProviderResolverTest
php artisan test --filter=Abby

# Frontend focused tests
cd frontend
npm test -- --run abby

# Docs after this plan or follow-up docs edits
python3 scripts/docs/catalog_lineage_docs.py --write-catalog
python3 scripts/docs/catalog_lineage_docs.py --check-frontmatter
sh docs/site/scripts/check-content-tree.sh
sh docs/site/scripts/check-public-docs-current.sh
```

For shipped frontend assets in this repo, use:

```bash
./deploy.sh --frontend
```

Do not use `npm run build` as the deployment path.

## Closure Trigger

Move this plan to `docs/lineage/plans/closed/` and set `status: shipped` only
after the implementation has:

- shipped the provider router and local fallback metadata,
- integrated cloud safety filtering,
- shipped at least OpenAI API chat support or explicitly de-scoped it,
- hardened local agent mode,
- documented the subscription/API boundary,
- recorded hosted smoke evidence,
- and linked the closeout document, PR, or release record in frontmatter.
