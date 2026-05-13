---
doc_type: lineage
status: historical
date: 2026-05-13
owner: acumenus
module: analyses
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_05_13_190003_add_library_lifecycle_columns_to_analyses.php
related_prs: []
---
# 2026-05-13 — Library lifecycle columns on 8 analyses tables (Phase A, Task A4)

Part of the publish-library-phase-1 feature branch. Adds four lifecycle columns
to all eight OHDSI analysis tables in the `app` schema, completing the schema
phase of the library publish workflow for analyses.

## Affected tables

- `incidence_rate_analyses`
- `pathway_analyses`
- `estimation_analyses`
- `prediction_analyses`
- `feature_analyses`
- `sccs_analyses`
- `evidence_synthesis_analyses`
- `self_controlled_cohort_analyses`

## Schema — additive columns (all 8 tables)

`backend/database/migrations/2026_05_13_190003_add_library_lifecycle_columns_to_analyses.php`

| Column | Type | Default | Notes |
|---|---|---|---|
| `status` | `varchar(16)` | `'active'` | Indexed. Values from `LibraryStatus` enum: draft, active, archived |
| `archived_at` | `timestamp` | `null` | Set when status transitions to archived |
| `archived_by` | `bigint` | `null` | FK → `app.users(id)` ON DELETE SET NULL |
| `promoted_at` | `timestamp` | `null` | Set when a draft is promoted to active |

The migration loops over all eight tables in a single class, applying identical
column additions to each. The `down()` path drops the FK constraint before
dropping the four columns, in the same loop. No data fold is required — none
of these tables had a prior deprecation column.

The migration is fully reversible and safe to run on a fresh database or any
database where these tables already exist without lifecycle columns.

## Test coverage

`backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php` —
`test_all_analyses_tables_have_lifecycle_columns()` written RED before the
migration existed (TDD), then turned GREEN after the migration was applied.
