---
doc_type: lineage
status: historical
date: 2026-05-21
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_05_21_000000_create_study_design_agent_sessions_table.php
  - backend/app/Models/App/StudyDesignAgentSession.php
related_prs: []
---
# 2026-05-21 — study_design_agent_sessions table + model (Agent SDK Task 1.1)

Adds the `study_design_agent_sessions` table to track Anthropic agent
conversations bound to a study-design session.

## Schema

New table `app.study_design_agent_sessions`:

| Column | Type | Notes |
|---|---|---|
| `study_design_session_id` | FK → study_design_sessions | CASCADE DELETE |
| `study_design_version_id` | FK → study_design_versions (nullable) | NULL ON DELETE |
| `user_id` | FK → users | CASCADE DELETE |
| `anthropic_session_id` | varchar, nullable | Anthropic session id for resume |
| `status` | varchar(32) | active \| closed \| error |
| `cost_usd` | decimal(10,4) | Cumulative cost of the conversation |
| `tokens_in` / `tokens_out` | unsigned bigint | Cumulative token counts |
| `token_id` | unsigned bigint, nullable | personal_access_tokens.id of scoped Sanctum token (for revocation) |
| `last_active_at` | timestamp, nullable | Last activity timestamp |

Index on `(study_design_session_id, status)` for efficient active-session lookups.

## Model

`App\Models\App\StudyDesignAgentSession` — consistent namespace with all other
study-design models. Typed `BelongsTo` relations to `StudyDesignSession`,
`StudyDesignVersion`, and `User`. `$fillable` list enforced (no `$guarded = []`
per HIGHSEC). `casts()` method returns typed array per Laravel 11 convention.

## Migration notes

Run as `parthenon_migrator` (DDL role, member of `parthenon_owner`) per project
convention. Both FK targets (`study_design_sessions`, `study_design_versions`,
`users`) were verified in existing migrations before writing.

## Downstream

Tasks 1.2 (controller) and 1.3 (channel auth) depend on this table.
Ownership checks use `StudyDesignSession.created_by` (FK to users) and
`Study.teamMembers()` / `Study.scopeAccessibleBy()`.
