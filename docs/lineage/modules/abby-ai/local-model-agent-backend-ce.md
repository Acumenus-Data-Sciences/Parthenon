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
related_prs: [365]
---

# Local-model agent backend (EE / CE provider switch)

**Date:** 2026-06-15
**Plan:** `docs/lineage/plans/open/2026-06-15-local-model-agent-backend-ce.md`
**Related:** `project_parthenon_agent_copilots`, `2026-06-11-study-results-projection`

## Why

The Studies/Publish/Abby copilots run on the **Claude Agent SDK** in `python-ai`
(`ai/app/agents/service.py`), which drives the `claude` CLI against the Anthropic
cloud API. Nothing gated it by edition — it was "EE-only" purely because it needed a
funded `ANTHROPIC_API_KEY`. CE deployments need the same omnipresent Abby without a
cloud dependency.

The agent loop (9-tool in-process MCP server, `can_use_tool` approval gating, Reverb
streaming, HIGHSEC lockdown) is **model-agnostic** — it lives in our code, not
Anthropic's. So supporting CE meant letting the same loop target a **local model**,
changing only *where the CLI sends requests* and *which tools are auto-enabled*.

## Design

Provider is a **runtime config decision, not a code branch.** One agent codebase;
EE-vs-CE is config. Write-actions are **independently flag-gated** so CE ships
omnipresent Abby on day one (reads/chat) and unlocks gated writes per-deployment once
an operator picks a model with reliable tool-calling.

Key seam: `claude_agent_sdk.ClaudeAgentOptions` exposes an **`env`** field. Injecting
`ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` there redirects the CLI subprocess to a
local Anthropic-compatible proxy with **no** change to the tool/approval/streaming logic.

## What changed

| Area | File | Change |
|---|---|---|
| Config | `ai/app/config.py` | 6 settings + `resolve_agent_provider()` → `ResolvedAgentProvider` |
| Profile | `ai/app/agents/profiles.py` | optional `provider` override (inherits global) |
| Service | `ai/app/agents/service.py` | `_options()` resolves provider, injects `env` for local, withdraws write tools when local actions off |
| Router | `ai/app/routers/agent.py` | create-session response returns `provider` + `actions_enabled` |
| Proxy | `docker-compose.yml`, `docker/claude-router/*` | `claude-code-router` sidecar gated behind `profiles: ["ce"]` (non-root, HIGHSEC 4.1) |
| Laravel | `AbbyAgentController::start()` | passes `provider`/`actions_enabled` through to the SPA |
| Frontend | `abbyAgentApi`, `abbyAgentStore`, `useAbbyAgent`, `AbbyCopilotPanel` | store the flags; dock shows a reads-only note when actions are disabled |

## Settings (env vars; defaults preserve EE behavior)

| Var | Default | Meaning |
|---|---|---|
| `AGENT_PROVIDER` | `anthropic` | `anthropic` (EE) \| `local` (CE) |
| `AGENT_LOCAL_BASE_URL` | `http://claude-router:8787` | Anthropic-compatible proxy endpoint |
| `AGENT_LOCAL_MODEL` | `qwen2.5-coder:32b` | tool-calling model (**NOT** MedGemma) |
| `AGENT_LOCAL_AUTH_TOKEN` | `local` | dummy bearer the proxy accepts |
| `AGENT_LOCAL_ACTIONS_ENABLED` | `false` | gate approval-gated WRITE tools on local |
| `AGENT_LOCAL_EFFORT` | `medium` | local models break on `xhigh` thinking |

(These are wired into `docker-compose.yml` with `${VAR:-default}` interpolation, so no
`.env` entry is required to keep EE behavior; set them in the root `.env` to switch a
deployment to CE.)

## EE / CE matrix

| | EE (`anthropic`) | CE (`local`, actions off) | CE (`local`, actions on) |
|---|---|---|---|
| Model | Opus 4.7/4.8 | Qwen2.5-Coder-32B (local) | same |
| Omnipresent dock + reads | ✅ | ✅ | ✅ |
| Gated write actions | ✅ | ❌ (hidden) | ✅ (model-dependent) |
| External API cost | yes | $0 | $0 |

## Verification

- Python: `test_agent_router.py` + `test_agent_service.py` + `test_agent_config.py` +
  `test_agent_profiles.py` + `test_abby_tools.py` → **41 passed**; `mypy` clean on
  config/service/profiles/router.
- PHP: `AbbyAgentControllerTest` → **5 passed**; Pint + PHPStan clean.
- Frontend: `abbyAgentStore` + `abbyDockStore` → **9 passed**; `tsc --noEmit` clean.
- Compose: `docker compose config` valid; `claude-router` correctly **inert** in the
  default stack (present only under `--profile ce`); entrypoint valid sh, renders valid JSON.

The EE path is provably unchanged — the first service test asserts cloud model + gated
writes when the provider defaults to `anthropic`. The entire backend core is verifiable
with **no GPU and no Anthropic credit** because the SDK client is mocked.

## NOT verified in this session (operator action required)

The `claude-router` **image build + live boot + a real local agent turn** were **not**
exercised here — they need a host with Ollama and `AGENT_LOCAL_MODEL` pulled, plus a GPU.
Operator smoke for a CE box:

1. `ollama pull qwen2.5-coder:32b`
2. set `AGENT_PROVIDER=local` in root `.env`
3. `docker compose --profile ce up -d claude-router python-ai` (env_file loads at
   container **creation** — a plain `restart` won't pick it up)
4. start an Abby session in a study; confirm a turn streams from the local model
5. only after the read loop is reliable, set `AGENT_LOCAL_ACTIONS_ENABLED=true` and
   re-verify the approval-card path

`claude-code-router`'s config schema can drift across upstream versions; pin the image's
`@musistudio/claude-code-router` version once validated on the target box.
