---
doc_type: plan
status: open
date: 2026-06-26
owner: acumenus
module: abby-ai
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - ai/app/agents/service.py
  - backend/app/Services/AI/AbbyProviderPolicyService.php
related_docs:
  - docs/lineage/plans/closed/2026-06-25-abby-provider-entitlements-and-local-fallback-plan.md
  - docs/lineage/modules/abby-ai/provider-entitlements-and-fallback.md
related_prs: []
---

# Abby External Assistant App / MCP Surface Plan

## Why this is a separate plan

This plan carries forward **Section 7 and Phase 4** of the closed
[Abby Provider Entitlements plan](../closed/2026-06-25-abby-provider-entitlements-and-local-fallback-plan.md).
Those items describe a net-new, network-exposed, OAuth-secured, RBAC-mapped,
audited MCP/app server that lets an **external** assistant (ChatGPT/Claude apps)
call approved read-only Parthenon tools from the user's own subscription surface.

It was **explicitly de-scoped** from the entitlements plan for three reasons,
recorded here so the boundary is not lost:

1. **Product-gated by its own wording.** The original items read "if product
   strategy wants a ChatGPT-side Abby experience" / "if product strategy approves."
   It is a product decision, not a fix to ship under the entitlements work.
2. **Orthogonal, multi-week effort.** A real external MCP surface needs its own
   network endpoint, OAuth/token-scoped auth, per-tool RBAC mapped to Laravel
   policies, and an external-call audit trail — independent of the chat/RAG
   provider router and local fallback that the entitlements plan delivered.
3. **The only part needed to keep the rest honest already shipped.** The
   subscription/API boundary guardrail is enforced today: `external_subscription_app`
   profiles are catalogable but rejected from backend-routed surface policies
   (`AbbyProviderPolicyService` → `external_subscription_app_not_backend_routable`;
   Python `provider_profiles` transport enum), and the boundary is documented in
   the user-facing AI Providers docs and the dev module doc.

## Carried-forward backlog (was §7 / Phase 4)

- [ ] Define a read-only MCP/app capability map (read study state, search concepts,
  read gate status, read manuscript/provenance, propose non-mutating next steps).
- [ ] Exclude all mutation tools initially (evaluate gates, reproject, build
  package, open in publisher).
- [ ] Add OAuth or token-scoped auth for external tool callers.
- [ ] Add per-tool RBAC ability checks matching existing Laravel policies.
- [ ] Add audit records for external assistant tool calls (tool, user, subject,
  request/response hash, external client/app id).
- [ ] Build a first OpenAI ChatGPT app / MCP server profile (if product approves).
- [ ] Evaluate Claude-side MCP/client options separately (no assumption that
  Claude Pro/Max can run Parthenon server-side agent turns).
- [ ] Acceptance: an external assistant can inspect approved Parthenon study state
  through read-only tools without Parthenon paying model API tokens, and cannot
  silently mutate study state without explicit future approval work.

## Closure trigger

Move to `../closed/` when an external read-only MCP/app surface ships with scoped
auth + RBAC + audit, or when product strategy records a decision not to build it.
