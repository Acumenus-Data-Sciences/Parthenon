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
  - ai/scripts/check_abby_local.py
  - ai/app/routers/abby.py
  - backend/app/Http/Controllers/Api/V1/Admin/AiProviderController.php
related_prs: []
---

# Runbook: Abby Provider Operations

Operational procedures for the Abby chat/RAG and agent provider stack. Companion
to `docs/lineage/modules/abby-ai/provider-entitlements-and-fallback.md`.

## Rotate a provider API key

1. Admin → AI Providers → select provider → paste the **new** key → Save.
   (Read endpoints return only a masked value; re-saving the masked placeholder
   never overwrites the stored key — type a real key to rotate.)
2. Or set the env var (`CLAUDE_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`)
   and `docker compose up -d python-ai` (compose `env_file` loads at container
   creation — `restart` does NOT reload).
3. Verify: `curl -s localhost:8002/abby/provider-health | jq '.chat.cloud'`
   should show `key_configured: true`.
4. After any suspected exposure, run `scripts/security/scan-provider-secrets.sh`.

## Disable cloud entirely (force local)

- Fast: set `ABBY_CLOUD_ROUTING_ENABLED=false` and `docker compose up -d python-ai`.
- Per-surface: Admin → AI Providers → Abby Behavior → set the surface
  `provider_mode` to `local_only` (or `disabled`). No redeploy needed.
- Confirm `/abby/provider-health` reports `default_route: local`,
  `cloud_routing_enabled: false`.

## Force local fallback for one surface

Admin → Abby Behavior → surface → `provider_mode: local_first` (cloud only when
local is overloaded) or `local_only`. The route simulator previews the decision
without calling a paid provider.

## Verify the local Ollama model

```bash
# in the python-ai container (or any host with the venv)
python -m scripts.check_abby_local            # 3-step preflight: tags + present + 1-token probe
# manual equivalents:
ollama list
curl -s "$ABBY_OLLAMA_BASE_URL/api/tags" | jq '.models[].name'
```

Default tag `puyangwang/medgemma-27b-it:q4_0`; low-resource fallback
`MedAIBase/MedGemma1.5:4b`; alias `medgemma:27b` resolves to the installed tag.
Note: a 27B q4 model can take 30–90s to cold-load on first generation; this is
hardware latency, not a routing failure. Set `ABBY_WARMUP_ON_STARTUP=true` to
pre-load on service start.

## Diagnose "credit exhausted" / cloud failures

1. `/abby/provider-health` → `chat.cloud.status` and `last_error_class`
   (`insufficient_credit`, `invalid_key`, `rate_limit`, `model_unavailable`).
2. Cloud failures degrade to local automatically (reason `provider_quota_exhausted`
   / `claude_error`), never a silent spinner. Check `app.abby_cloud_usage` for
   `status=fallback_local` rows with `fallback_reason`.
3. Budget cutoff: a provider/profile/entitlement that hit its monthly cap routes
   local until reset or a super-admin raises the cap. Inspect with the admin budget
   diagnostics (per-provider / per-profile / per-entitlement / per-department spend).

## Agent (study orchestrator) local mode

- `AGENT_PROVIDER=local` + `claude-router` (`--profile ce`) running. Verify the
  proxy is reachable (`claude-router:8787`) before relying on local agents.
- `AGENT_LOCAL_ACTIONS_ENABLED=false` keeps write tools removed from the MCP
  server (reads-only). Enable only after validating a tool-calling local model.

## Rollback levers (fastest first)

1. `ABBY_CLOUD_ROUTING_ENABLED=false` → all chat local.
2. Surface `provider_mode=local_only` / `disabled` (no redeploy).
3. `AGENT_PROVIDER=local` / `cloud` to flip the agent path.
4. Revert the provider router by restoring the prior `provider_profiles.py`.
