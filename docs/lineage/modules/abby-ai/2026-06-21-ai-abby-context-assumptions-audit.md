---
doc_type: lineage
status: historical
date: 2026-06-21
owner: acumenus
module: abby
lineage_anchor: false
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - backend/app/Http/Controllers/Api/V1/DataInterrogationController.php
  - backend/app/Http/Controllers/Api/V1/StudyOrchestratorController.php
  - frontend/src/features/commons/components/chat/AskAbbyChannel.tsx
  - backend/app/Services/AI/DataInterrogationService.php
  - ai/app/orchestrator/guards.py
---

# AI / Abby Context-Assumptions Audit (2026-06-21)

Closes the Phase 5 completion-plan item "Audit all AI/Abby features for implicit
assumptions about default source, active project, active cohort, and current user
permissions." This audit **identifies** assumptions and flags gaps; it does not
fix them (each gap below is either already sound or recorded as follow-up).

## Surfaces audited

| Surface | Source context | Project/cohort context | Permission | Verdict |
|---|---|---|---|---|
| `DataInterrogationController::ask` (`/data-interrogation/ask`) | **Explicit** `source_id` (required, `exists:sources,id`); no implicit default | n/a | `permission:analyses.view`; ownership via the source's visibility scope | **Sound** — the prior hard-coded `source_id:1` was removed; backend contract tested (`DataInterrogationTest`). |
| Abby `/data` channel (`AskAbbyChannel.tsx`) | `activeSourceId ?? defaultSourceId`; **blocks** with an inline error if neither is set | n/a | gated behind the authenticated app | **Sound** — no silent default; FE tests cover the no-source guard. |
| Abby source-card navigation (`AbbySourceAttribution`) | Routes to `/data-explorer/{sourceId}` or an external URL | n/a | client-side nav only | **Sound** — bound to the cited source, not a global default. |
| Study orchestrator (`StudyOrchestratorController` → python-ai) | Operates on an explicit `study` (route-model-bound); per-study scoped Sanctum token (`studies.view`,`studies.execute`) | **Explicit study**; gate ledger is per-study | `permission:studies.execute` + `Study::accessibleBy` | **Sound** — no ambient project/cohort; gates resolved from the study's own ledger. |
| Orchestrator guards (`ai/app/orchestrator/guards.py`) | n/a | Reads the study's gate ledger; halts at first non-clearing gate | mirrors `StudyGateService` clearing statuses | **Sound** — deterministic, study-scoped. |
| Abby conversations (`AbbyConversationController`) | User-scoped persistence | n/a | `auth:sanctum`, owner-scoped | **Sound**. |
| Manuscript composer (`ManuscriptComposer`) | Pulls numbers only from a study's execution `result_json` | **Explicit study** | invoked within study context | **Sound** — blinding + fabrication guard tested. |

## Gaps / follow-ups (not fixed here)

1. **Broader action-taking Abby (write actions).** The omnipresent
   action-taking Abby (per `project_parthenon_agent_copilots`) uses
   `can_use_tool` approval gating and scoped tokens, but a systematic
   per-write-action permission audit (cohort create/edit, analysis run) is not
   yet captured as a test matrix. Recommend a contract test per tool the copilot
   can invoke, asserting the scoped token's abilities gate each write.
2. **Active-project / active-cohort assumptions in future Abby flows.** No
   current surface assumes an ambient active project or cohort (all are
   explicit), but new Abby flows should continue to pass the project/cohort
   explicitly rather than reading a global store server-side.

## Conclusion

Every **shipped** AI/Abby surface resolves source, study, project, and cohort
context **explicitly** (no silent global default), and each is behind an
authenticated, permission-checked route. The only open work is a forward-looking
per-tool write-action permission test matrix for the action-taking copilot — a
follow-up, not a defect in current behavior.
