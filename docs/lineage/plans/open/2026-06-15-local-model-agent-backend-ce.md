---
doc_type: plan
status: shipped
date: 2026-06-15
owner: acumenus
module: abby-ai
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: [365]
---

# Plan: Local-model agent backend for Parthenon-CE

**Status:** SHIPPED — merged via #365 and deployed 2026-06-16
**Date:** 2026-06-15
**Owner:** Studies / Abby-AI
**Related:** `project_parthenon_agent_copilots` (Claude Agent SDK copilots), `2026-06-11-study-results-projection`

---

## Problem

The Studies/Publish/Abby copilots run on the **Claude Agent SDK** inside `python-ai`
(`ai/app/agents/service.py`), which drives the `claude` CLI binary against the Anthropic
cloud API via `ANTHROPIC_API_KEY`. Nothing in the code gates this by edition — it is
"EE-only" purely because it depends on a funded Anthropic key. CE deployments need the
same omnipresent Abby experience without a cloud dependency.

The agent loop (9-tool in-process MCP server, `can_use_tool` approval gating, Reverb
streaming, HIGHSEC lockdown) is **model-agnostic** — it lives in our code, not Anthropic's.
So "support CE" = "let the same loop target a local model," changing only *where the CLI
sends requests* and *which tools are auto-enabled*.

## Design principle

Provider is a **runtime config decision, not a code branch.** EE keeps Opus; CE runs a
local model via an Anthropic-compatible proxy. Write-actions are **independently flag-gated**
so CE ships omnipresent Abby on day one (reads/chat) and unlocks gated writes per-deployment
once an operator selects a model whose tool-calling is reliable.

## Key seam (verified)

`claude_agent_sdk.ClaudeAgentOptions` exposes an **`env`** field (also `fallback_model`,
`cli_path`, `settings`). Injecting `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` via
`kwargs["env"]` in `_options()` redirects the CLI subprocess to a local proxy with **no**
subprocess hacking and **no** change to the tool/approval/streaming logic.

---

## Phases

### Phase 1 — Config surface (`ai/app/config.py`)
Defaults preserve current EE behavior.

| Setting | Default | Purpose |
|---|---|---|
| `agent_provider` | `"anthropic"` | `anthropic` \| `local` |
| `agent_local_base_url` | `"http://claude-router:8787"` | Anthropic-shaped proxy endpoint |
| `agent_local_model` | `"qwen2.5-coder:32b"` | tool-calling model (NOT MedGemma) |
| `agent_local_auth_token` | `"local"` | dummy bearer the proxy accepts |
| `agent_local_actions_enabled` | `False` | gate write tools on local provider |
| `agent_local_effort` | `"medium"` | local models choke on `xhigh` thinking |

Add a resolver `resolve_agent_provider(profile_provider) -> (provider, model, base_url,
auth_token, effort, actions_enabled)` so resolution lives in one place.

### Phase 2 — Profile provider resolution (`ai/app/agents/profiles.py`)
- Add optional `provider: str | None = None` to `AgentProfile` (None = inherit global).
- Profiles keep referencing `settings.agent_model`/`effort` for the anthropic path; local
  values come from Phase-1 settings at option-build time (no per-profile duplication).

### Phase 3 — Env injection (`ai/app/agents/service.py::_options`)
Only `service.py` change. After building `kwargs`, when provider resolves to `local`:
override `model`/`effort`, set `kwargs["env"]` with `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`,
set `fallback_model`, and when `agent_local_actions_enabled` is false, empty `writes` so
`has_writes` is false → `permission_mode="dontAsk"`, reads auto-approved, no action cards.
Everything else (MCP server, `tools=[]`, `strict_mcp_config`, streaming, persistence) untouched.

### Phase 4 — Proxy sidecar (`docker-compose.yml`)
Anthropic→Ollama translation service. **Recommendation: `claude-code-router`** (purpose-built
for pointing Claude Code CLI at non-Anthropic backends; handles Messages-API request-shape
quirks). Alternative: LiteLLM `/v1/messages` passthrough.
- Service `claude-router`, internal network only (no host port), `env_file: backend/.env`.
- **HIGHSEC 4.1:** custom `docker/claude-router/Dockerfile` with non-root `USER` directive.
- Routes to `host.docker.internal:11434` (same Ollama as the RAG path).
- python-ai `depends_on` for the local provider.

### Phase 5 — Capability exposed to UI (Laravel + frontend)
- python-ai session-create response (`/agent/sessions`) adds `actions_enabled: bool` +
  `provider: str` from settings.
- Laravel passes through; `abbyDockStore` stores it; `AbbyCopilotPanel` hides the
  pending-approval badge / action prompts when `actions_enabled === false`. Reads/chat unchanged.

### Phase 6 — Tests
- **Python** (`test_agent_service.py`): `_options()` injects `env`/local model when
  `agent_provider=local`; `writes` empties (+ `permission_mode=dontAsk`) when actions disabled;
  anthropic path unchanged when provider=anthropic. Client mocked — no live model needed.
- **PHP**: session-create response carries `actions_enabled`/`provider`.
- **Frontend** (vitest): panel hides approval UI when `actions_enabled=false`.
- No new live-model dependency in CI (all mocked).

### Phase 7 — Docs + deploy
- Devlog under `docs/lineage/modules/abby-ai/` with the EE/CE matrix.
- `.env.example`: add the six settings with EE-preserving defaults.
- `./deploy.sh`; `docker compose up -d python-ai claude-router` (env_file loads at creation).

---

## EE / CE behavior matrix

| | EE (`anthropic`) | CE (`local`, actions off) | CE (`local`, actions on) |
|---|---|---|---|
| Model | Opus 4.7/4.8 | Qwen2.5-Coder-32B (local) | same |
| Omnipresent dock | ✅ | ✅ | ✅ |
| Inline "Ask Abby" + reads | ✅ | ✅ | ✅ |
| Gated write actions | ✅ | ❌ (hidden) | ✅ (model-dependent) |
| External API cost | yes | $0 | $0 |

## Risks / open decisions

1. **Local tool-calling reliability** — the real risk. Mitigated by CE actions-off default;
   operators opt in per-model. Recommend Qwen2.5-Coder-32B / Llama-3.3-70B / Hermes-3 —
   explicitly **not** MedGemma (RAG model, weak function-calling).
2. **`effort`/thinking** — local models ignore/break on `xhigh`; Phase 1 forces `medium`.
3. **Proxy choice** — claude-code-router (CLI-faithful) vs LiteLLM (standard infra).
4. **Edition packaging** — pure env flag, independent of any EE/CE build marker. Installers
   set `AGENT_PROVIDER`'s default per edition.

## Sequencing

Phases 1–3 + 6 are the core and are **verifiable today** without GPU or credit (tests mock the
client). Phases 4–5 are integration; Phase 7 the wrap.
