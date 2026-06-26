---
doc_type: lineage
status: shipped
date: 2026-06-26
owner: acumenus
module: abby-ai
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - ai/app/routing/provider_profiles.py
  - ai/app/routing/cloud_safety.py
  - ai/app/routing/cost_tracker.py
  - ai/app/routers/abby.py
  - ai/app/agents/service.py
  - backend/app/Services/AI/AbbyProviderPolicyService.php
  - backend/app/Http/Controllers/Api/V1/Admin/AiProviderController.php
related_prs: []
---

# Abby Provider Entitlements, Cloud Safety, and Local Fallback

**Plan:** `docs/lineage/plans/closed/2026-06-25-abby-provider-entitlements-and-local-fallback-plan.md`
**Related:** `local-model-agent-backend-ce`, `admin-copilot-provider-switch`,
the CE/EE edition differentiation strategy.

## Two Abby paths (do not conflate)

Abby has two runtime paths that share branding but not architecture:

| Path | Route | Default | Provider model |
|---|---|---|---|
| **Chat / RAG** | `/api/v1/abby/chat` → Laravel → `python-ai` `ai/app/routers/abby.py` | **local** (Ollama/MedGemma) unless `ABBY_CLOUD_ROUTING_ENABLED=true` | `provider_profiles.decide_abby_chat_route()` |
| **Study orchestrator / copilot agent** | `AbbyAgentController` → `python-ai` agent router → Claude Agent SDK loop | **cloud** (Anthropic) with a local proxy mode | `AgentProviderResolver` / `resolve_agent_provider` |

## Chat/RAG provider router

`decide_abby_chat_route()` is the single decision point shared by streaming and
non-streaming chat. It is **capability-driven**: callers pass `surface`,
`required_capabilities`, `requires_streaming`, `allows_cloud`, and
`allows_patient_level_context`. A cloud profile that cannot satisfy those
constraints is rejected and the turn falls back local with reason
`unsupported_capability` — Abby never silently routes to a model that lacks a
required capability.

**Routing strategies** (`abby_chat_provider_mode` / `AbbySurfacePolicy.provider_mode`):
`local_only`, `cloud_only`, `local_first`, `cloud_first`, `auto_by_complexity`,
`auto_by_budget`, `disabled`.

**Route reasons** preserved for consumers: `local_ollama_required`,
`budget_exhausted`, `claude_unavailable`, `phi_blocked`, `claude_error`,
`grounded_definition`; plus `provider_disabled`, `api_key_missing`,
`provider_rate_limited`, `provider_quota_exhausted`, `cloud_safety_blocked`,
`unsupported_capability`, `local_fallback_unavailable`.

Every response carries provider-neutral `routing` metadata (`provider`,
`transport`, `model`, `reason`, `stage`, `fallback_used`, `cloud_safety_applied`,
`cloud_safety_blocked`, `cloud_safety_policy_version`) while preserving the legacy
`model`/`reason`/`stage` keys. The frontend maps this into a Local / Cloud /
Fallback / Cloud-blocked badge (`AbbyResponseCard`, `abbyRouteBadgeKind`).

## Provider adapters

`ai/app/routing/chat_adapters.py` exposes one sync+streaming adapter interface
with error classification (invalid key, insufficient credit, rate limit, timeout,
model unavailable, safety refusal):

- `OllamaChatAdapter` — local chat, cold-start aware (longer first timeout,
  keep-alive). A 1-token health probe lives in
  `ai/app/services/ollama_client.probe_ollama_model()`.
- `AnthropicMessagesAdapter` — Anthropic Messages API.
- OpenAI Responses + OpenAI-compatible adapters — selectable only with explicit
  capability metadata and a configured base URL.

Pricing lives in provider profile metadata (`limits.input_price_per_mtok` /
`output_price_per_mtok`), the declarative source for budget estimation.

## Cloud safety and PHI

`CloudSafetyFilter.filter_for_cloud()` runs before any non-local provider call
(`_apply_cloud_safety_filter`), stripping individual-level CDM context (blocked
sources + content patterns: `person_id`, `visit_occurrence_id`, `measurement_id`,
`birth_datetime`, `raw.*`/`staging.*`, etc.). The ruleset is version-stamped
(`cloud_safety.POLICY_VERSION`) and recorded in the usage audit. Independently,
the user message+history is PHI-scanned for every cloud-bound turn regardless of
provider; on PHI detection with `PHI_BLOCK_ON_DETECTION=true` the turn falls back
local (`phi_blocked`) and the cloud adapter is never constructed.

## Local fallback

The default local profile (`local-medgemma`, MedGemma 27B) falls back within the
local tier to `local-medgemma-4b` (MedGemma 4B) before exhausting. Model aliases
(`abby_model_aliases`, e.g. `medgemma:27b=puyangwang/medgemma-27b-it:q4_0`) let
operators use friendly tags. Verify locally with
`python -m scripts.check_abby_local`. A local-only deployment answers chat with no
`CLAUDE_API_KEY`/`ANTHROPIC_API_KEY`.

## Cost / quota / audit

`CostTracker` writes a provider-neutral `app.abby_cloud_usage` row for every turn,
including zero-cost `routed_local` / `fallback_local` decisions (so local and
disabled-provider routing are visible). Budget scope filters: provider, profile,
surface, **entitlement_type**, and **department** (chargeback). `record_route_decision`
captures the decision even when no paid call occurs.

## Agent path (study orchestrator / copilot)

The Claude Agent SDK loop is model-agnostic; only the model/effort and the CLI's
request target change between editions.

| Mode | Meaning |
|---|---|
| `cloud` | Anthropic Claude Agent SDK (EE default) |
| `local` | Anthropic-compatible proxy (`claude-router`) → tool-calling local model |
| `auto` | local only when the active local provider is proxy-frontable |

`AGENT_LOCAL_ACTIONS_ENABLED=false` by default. On the local provider with actions
disabled, approval-gated **write tools are removed from the MCP server entirely**
(not merely un-gated) so a CE reads-only agent cannot reach or auto-approve a
write. Operators opt into actions only after a local model proves it can drive the
tool-use + approval loop.

### Candidate agent-model compatibility matrix

MedGemma is a RAG/chat model with weak function-calling — **not** an action-taking
agent model. Agent profiles must declare `agent_loop=true` + `tool_calling=true`.

| Model | Tool use | Streaming | Context | JSON args | Approval loop | Action policy |
|---|---|---|---|---|---|---|
| `qwen2.5-coder:32b` (default local agent) | good | yes | 32k | reliable | validated path | reads-only until enabled |
| Llama 3.3 70B | good | yes | 128k | good | candidate | reads-only until enabled |
| Hermes 3 | good | yes | varies | good | candidate | reads-only until enabled |
| MedGemma 27B/4B | weak | yes | 8k | unreliable | not recommended | chat/RAG only |

Local agent mode requires `claude-router` (`--profile ce`). Verify the proxy is
reachable before relying on local agents; see the operations runbook.

## Subscription vs API boundary

Consumer subscriptions (ChatGPT Plus/Pro, Claude Pro/Max, Google AI Pro) **cannot**
be consumed as backend API quota. Server-side Abby supports three honest modes:
local (operator hardware), API cloud (org/user/Acumenus API key), and an external
assistant **app/MCP surface** initiated from the assistant's own subscription —
which is a separate read-only surface, not backend Abby capacity. The external
MCP surface is tracked in the successor plan
`2026-06-26-abby-external-assistant-mcp-surface-plan.md`.
