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
  - backend/database/migrations/2026_05_13_190001_add_library_lifecycle_columns_to_concept_sets.php
related_prs: []
---
# 2026-05-13 — Library lifecycle columns on concept_sets (Phase A, Task A2)

Part of the publish-library-phase-1 feature branch. Adds four columns to
`app.concept_sets` to support the concept-set library lifecycle workflow:

## Schema — `app.concept_sets` (additive)

`backend/database/migrations/2026_05_13_190001_add_library_lifecycle_columns_to_concept_sets.php`

| Column | Type | Default | Notes |
|---|---|---|---|
| `status` | `varchar(16)` | `'active'` | Indexed. Values from `LibraryStatus` enum: draft, active, archived |
| `archived_at` | `timestamp` | `null` | Set when status transitions to archived |
| `archived_by` | `bigint` | `null` | FK → `app.users(id)` ON DELETE SET NULL |
| `promoted_at` | `timestamp` | `null` | Set when a draft is promoted to active |

The migration is fully reversible: `down()` drops the FK constraint before
dropping the columns.

## Test coverage

`backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php` — two
assertions: schema presence and status default value. Written RED before the
migration existed (TDD).
