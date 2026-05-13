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
  - backend/database/migrations/2026_05_13_190004_create_library_cleanup_suggestions_table.php
  - backend/app/Models/App/LibraryCleanupSuggestion.php
related_prs: []
---
# 2026-05-13 — Library cleanup suggestions cache table (Phase A, Task A5)

Part of the publish-library-phase-1 feature branch. Creates the
`app.library_cleanup_suggestions` table and its corresponding Eloquent model,
which together serve as the denormalized cache backing the Cleanup Suggestions
UI page.

## Purpose

The Cleanup Suggestions page surfaces library items (cohort definitions, concept
sets, analyses) that have gone stale — i.e. have not been used or modified in a
configurable threshold period. Computing staleness on-the-fly at page load would
require scanning all 10 lifecycle-aware tables across potentially millions of
rows. Instead, `SuggestLibraryCleanupJob` runs nightly via the scheduler,
evaluates each item, and writes one row per (user, item_type, item_id) triplet
into this cache. The UI reads from the cache directly — O(1) per user.

## Schema — `app.library_cleanup_suggestions` (new table)

`backend/database/migrations/2026_05_13_190004_create_library_cleanup_suggestions_table.php`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `user_id` | `bigint unsigned` | no | FK → `app.users(id)` ON DELETE CASCADE |
| `item_type` | `varchar(64)` | no | Discriminator: `cohort_definition`, `concept_set`, `analysis`, etc. |
| `item_id` | `bigint unsigned` | no | PK of the referenced item in its own table |
| `last_activity_at` | `timestamp` | yes | Latest of: promoted_at, last_run_at, updated_at for the item |
| `computed_at` | `timestamp` | no | When `SuggestLibraryCleanupJob` wrote this row; indexed |

### Primary key

The table uses a **composite primary key** `(user_id, item_type, item_id)`. This
choice encodes the conceptual identity of each suggestion — a given item can
produce at most one suggestion row per user — and gives upsert semantics for
free: `INSERT ... ON CONFLICT DO UPDATE` (or the Laravel equivalent) can refresh
`last_activity_at` and `computed_at` without separate DELETE/INSERT logic.

There is no surrogate `id` column. `Model::$incrementing = false` and
`Model::$primaryKey = null` are set accordingly; Eloquent's `create()` still
works because it delegates to a raw INSERT, and the table's uniqueness
constraint is enforced at the database level.

### Indexes

- `PRIMARY (user_id, item_type, item_id)` — identity + uniqueness
- `INDEX (computed_at)` — allows the nightly job to age-out stale cache rows
  efficiently: `DELETE WHERE computed_at < now() - interval '2 days'`

### Foreign key

`user_id` references `app.users(id)` with `ON DELETE CASCADE`. When a user
account is removed, all their cleanup suggestions are automatically purged —
consistent with the rest of the `app.*` user-scoped tables.

## Eloquent model

`backend/app/Models/App/LibraryCleanupSuggestion.php`

- `$timestamps = false` — the table has no `created_at`/`updated_at`; staleness
  is tracked via `computed_at` instead.
- `$fillable` lists all five columns explicitly (no `$guarded = []`).
- `$casts` maps both timestamp columns to `datetime` for Carbon interop.

## Test coverage

`backend/tests/Unit/Models/LibraryCleanupSuggestionTest.php` — two tests written
RED before the migration existed (TDD):

1. `test_can_persist_and_read` — verifies `create()` works and scalar attributes
   round-trip correctly.
2. `test_composite_primary_key_enforced` — verifies the database rejects a
   duplicate `(user_id, item_type, item_id)` triplet with `QueryException`.
