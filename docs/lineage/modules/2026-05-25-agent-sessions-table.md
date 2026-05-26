---
doc_type: lineage
status: active
date: 2026-05-25
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_05_25_000000_create_agent_sessions_table.php
  - backend/app/Models/App/AgentSession.php
related_prs: []
---
# 2026-05-25 — agent_sessions table + model (Agent SDK generalization, Phase B)

Adds the generic `agent_sessions` table that supersedes the per-feature
`study_design_agent_sessions` table non-destructively. Any profile (study_design,
publish, etc.) stores its agent conversations here, keyed by (profile,
subject_type, subject_id).

## Why

`study_design_agent_sessions` binds the agent infrastructure to one feature.
Generalizing to `agent_sessions` with a (profile, subject_type, subject_id)
composite key lets each new profile reuse the same table, model, and controller
pattern without another feature-specific migration.

## Schema

New table `app.agent_sessions`:

| Column | Type | Notes |
|---|---|---|
| `profile` | varchar(64) | e.g. study_design, publish |
| `subject_type` | varchar(64) | e.g. study_design_session, publication_draft |
| `subject_id` | unsigned bigint | PK of the subject row |
| `user_id` | FK → users | CASCADE DELETE |
| `anthropic_session_id` | varchar, nullable | Anthropic session id for resume |
| `status` | varchar(32) | active \| closed \| error |
| `cost_usd` | decimal(10,4) | Cumulative cost of the conversation |
| `tokens_in` / `tokens_out` | unsigned bigint | Cumulative token counts |
| `token_id` | unsigned bigint, nullable | personal_access_tokens.id of scoped Sanctum token (for revocation) |
| `context_json` | jsonb, nullable | Profile-specific context bag (version_id, study_slug, etc.) |
| `last_active_at` | timestamp, nullable | Last activity timestamp |

Composite index on `(profile, subject_type, subject_id)` for efficient per-subject lookups.

## Migration strategy (ADDITIVE — non-destructive)

The `up()` method:
1. Creates `agent_sessions`.
2. If `study_design_agent_sessions` exists, copies its rows into `agent_sessions`
   with `profile='study_design'`, `subject_type='study_design_session'`,
   `subject_id=study_design_session_id`, and `context_json={"version_id":...}`.
3. **Does NOT drop `study_design_agent_sessions`** — the old table is left in place
   (empty on prod since no new rows are written to it after this migration runs).

The `down()` method drops only `agent_sessions`. It never touches
`study_design_agent_sessions`. Any cleanup of the old table is a separate,
explicitly-confirmed migration.

## Model

`App\Models\App\AgentSession` — generic Eloquent model. `$fillable` list enforced
(no `$guarded = []` per HIGHSEC §3.1). `scopeForSubject()` filters by
(profile, subject_type, subject_id). `casts()` matches `StudyDesignAgentSession`
for compatibility (`cost_usd => float`).

## Relationship to study_design_agent_sessions

`study_design_agent_sessions` and its model `StudyDesignAgentSession` are kept
unchanged (deprecated but not deleted). `StudyDesignAgentController` now writes
to `agent_sessions` via `AgentSession`. The old table is orphaned after this
migration; removal is deferred to a future explicit cleanup.
