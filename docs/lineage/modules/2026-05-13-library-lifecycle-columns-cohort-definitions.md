---
doc_type: lineage
status: historical
date: 2026-05-13
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_05_13_190002_add_library_lifecycle_columns_to_cohort_definitions.php
related_prs: []
---
# 2026-05-13 — Library lifecycle columns on cohort_definitions (Phase A, Task A3)

Part of the publish-library-phase-1 feature branch. Adds four columns to
`app.cohort_definitions` to support the cohort library lifecycle workflow,
mirroring the same schema added to `app.concept_sets` in Task A2.

## Schema — `app.cohort_definitions` (additive)

`backend/database/migrations/2026_05_13_190002_add_library_lifecycle_columns_to_cohort_definitions.php`

| Column | Type | Default | Notes |
|---|---|---|---|
| `status` | `varchar(16)` | `'active'` | Indexed. Values from `LibraryStatus` enum: draft, active, archived |
| `archived_at` | `timestamp` | `null` | Set when status transitions to archived |
| `archived_by` | `bigint` | `null` | FK → `app.users(id)` ON DELETE SET NULL |
| `promoted_at` | `timestamp` | `null` | Set when a draft is promoted to active |

The migration also folds any existing `deprecated_at` rows into the new
`archived` status by copying `deprecated_at` → `archived_at` and setting
`status = 'archived'` for all rows where `deprecated_at IS NOT NULL`. The fold
is guarded by `Schema::hasColumn` so it is safe to run on databases where the
prior deprecation migration (`2026_04_10_210853`) was never applied. The
`deprecated_at` column itself is not dropped here; that cleanup belongs to a
separate squash migration once all consumers are migrated.

The migration is fully reversible: `down()` drops the FK constraint before
dropping the four new columns. It does NOT attempt to reverse the data fold,
as un-folding would require knowing which rows were folded versus originally
archived — that detail is not preserved and is unnecessary given the `down()`
path is only used in test teardown.

## Test coverage

`backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php` — schema
presence assertion written RED before the migration existed (TDD). The data-fold
path is verified via the Task D8 backfill command which runs against real data
with known `deprecated_at` values.
