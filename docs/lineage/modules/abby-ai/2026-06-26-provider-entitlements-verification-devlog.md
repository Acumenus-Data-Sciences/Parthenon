---
doc_type: lineage
status: shipped
date: 2026-06-26
owner: acumenus
module: abby-ai
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - ai/app/routing/provider_profiles.py
  - ai/app/agents/service.py
  - backend/app/Http/Controllers/Api/V1/Admin/AiProviderController.php
  - backend/app/Services/AI/AbbyProviderPolicyService.php
related_prs: []
---

# Devlog: Abby Provider Entitlements — verification, corrections, and closeout

**Date:** 2026-06-26
**Plan (closed):** `docs/lineage/plans/closed/2026-06-25-abby-provider-entitlements-and-local-fallback-plan.md`

## Goal

Verify completion of every item in the Abby Provider Entitlements plan, correct
errors/omissions, and disposition all 245 checkboxes. Started at 106/245 (43%).

## How it was verified

A four-agent read-only discovery swarm mapped every unchecked item to its true
state (DONE-but-stale / PARTIAL / MISSING) with file:line evidence across Python,
Laravel, frontend, and docs/governance. Baseline test suites were run first: 43
Python + 31 Laravel Abby tests already green, confirming the prior (uncommitted)
scaffolding was real.

## Errors found and corrected

1. **HIGHSEC secret leak.** `AiProviderController` `index/show/update/activate/
   enable/disable` returned the decrypted `settings.api_key`. Added round-trip-safe
   masking (`AiProviderSetting::maskSettings/toSafeArray`) — re-submitted masked
   values never clobber a stored key — plus `AiProviderControllerTest` (5 tests) and
   a committed `scripts/security/scan-provider-secrets.sh`.
2. **Reads-only agent write-tool bug.** In CE local mode with actions disabled, the
   agent service zeroed the write-set, which moved approval-gated write tools into
   auto-approved `allowed_tools` (the tool impls perform their PATCH/POST with no
   internal guard). Now the write tools are removed from the MCP server entirely.
   Verified the tool implementations before changing; updated the stale test that
   had encoded the buggy behavior; added 3 tests.
3. **Pre-existing i18n locale-parity break** in `aiProviders.fields` (English-only
   keys across 12 locales) — fixed to parity.
4. **14 latent PHPStan errors** in never-CI'd Abby files — fixed at the root via
   model `@property` annotations.

## Shipped (tested)

- Capability-driven chat provider router (surface/capabilities, `unsupported_capability`).
- Cloud-safety policy versioning + PHI-block test + CDM-source tests.
- Adapter pricing-in-metadata, Ollama chat probe, model aliases, 4B local fallback.
- Per-entitlement / per-department budget scoping.
- Backend policy presets + per-profile readiness + ordered fallback resolution.
- Frontend routing normalization + Local/Cloud/Fallback/Cloud-blocked badge + i18n.
- Docs: dev architecture doc, ops runbook, subscription/API boundary + BYO-key user
  copy, CE/EE `ai.frontier` confirmation.

**Validation:** pytest 594 · Laravel Abby/provider 40 · vitest 27 · PHPStan ✓ ·
Pint ✓ · ESLint ✓ · secret-scan ✓ · docs content/frontmatter ✓.

## De-scoped / deferred (recorded)

- **External assistant MCP surface (§7/Phase 4)** → successor plan
  `2026-06-26-abby-external-assistant-mcp-surface-plan.md` (product-gated; boundary
  guardrail already enforced and documented).
- Admin-UX-only frontend wizards (model inventory, readiness badges, test-action
  buttons, preset selector) — backend data now exposed; presentational follow-up.
- `provider_session_id` rename deferred until a non-Anthropic agent transport exists.
- Cloud/agent hosted smokes gated on credited keys; local-only smoke proven via
  `/abby/provider-health`.

All 7 Open Decisions resolved in the closed plan's Status Reconciliation section.

## Process note

A `git stash push -- <pathspec>` that included an untracked file aborted, and the
follow-up `git stash pop` applied an unrelated pre-existing stash, conflicting 3
files. Recovered them to clean HEAD; the original stash is preserved intact and no
work was lost. Lesson: never `git stash push -- <pathspec>` with untracked paths.
