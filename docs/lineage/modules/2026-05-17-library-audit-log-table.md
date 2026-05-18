---
doc_type: lineage
status: historical
date: 2026-05-17
owner: acumenus
module: studies
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_05_17_205700_create_audit_log_table.php
  - backend/app/Http/Controllers/Api/V1/Admin/LibraryController.php
  - backend/app/Http/Requests/Admin/Library/BulkDeleteRequest.php
  - backend/tests/Feature/Api/V1/Admin/LibraryBulkDeleteTest.php
related_prs: []
---
# 2026-05-17 — Generic audit_log + admin library bulk-delete (Phase D, Task D4)

Part of the library-lifecycle Phase D admin surface work. Creates the
`app.audit_log` table (generic actor/action/subject sink) and wires the
super-admin endpoint `POST /api/v1/admin/library/bulk-delete` that uses it.

## Why a new table (not user_audit_logs)

`app.user_audit_logs` is the HMAC-chained signed sink for authentication and
account-lifecycle events — it has cryptographic invariants (event_hash,
prev_event_hash) that make appending unrelated administrative actions
expensive and semantically muddled. `app.audit_log` is a separate,
non-chained table for general admin actions on data objects:

| Column         | Type        | Notes                                       |
|----------------|-------------|---------------------------------------------|
| id             | bigserial   | PK                                          |
| actor_id       | bigint NULL | FK app.users(id) ON DELETE SET NULL         |
| action         | varchar(100)| e.g. `library.hard_delete`, `library.reassign` |
| subject_type   | varchar(100)| e.g. `concept_set`, `cohort_definition`     |
| subject_id     | bigint      |                                             |
| snapshot       | jsonb NULL  | Full row JSON at time of action             |
| created_at     | timestamp   | DEFAULT now()                               |

Indexes: `(subject_type, subject_id)`, `(actor_id, created_at)`,
`(action, created_at)`.

## Bulk-delete preflight

`bulkDelete()` accepts `items: [{ type, id }]` and for each entry:

1. Verifies the item exists (bypassing `LibraryDefaultScope` to see archived /
   other-user rows).
2. Verifies `status = 'archived'` (cannot hard-delete active or draft items).
3. Checks Study attachments via three pivots:
   - `concept_set` → `study_cohorts.concept_set_ids @> jsonb_build_array(id)`
   - `cohort_definition` → `study_cohorts.cohort_definition_id = id`
   - any `*_analysis` type → `study_analyses` where `(analysis_type, analysis_id)` match
4. If any blocked items remain, returns HTTP 422 with `blocked: [{id, type, attached_to: [{study_id, study_title}]}]`.
5. Otherwise wraps each soft-delete in a transaction with the audit_log insert.

## Ownership / grants

PostgreSQL `pg_default_acl` only fires when the table owner is
`parthenon_owner` (or the bootstrap user). Tables created by
`parthenon_migrator` don't get the auto-grants, so the runtime
`parthenon_app` role can't write to them. The migration therefore reassigns
ownership and explicitly grants `SELECT, INSERT, UPDATE, DELETE` on the
table plus `USAGE, SELECT, UPDATE` on the sequence to `parthenon_app`.

The ownership block is wrapped in a SAVEPOINT (Laravel
`DB::transaction(...)` inside the outer migration transaction) so that
test/local databases lacking the role hierarchy don't poison the migration
transaction (PG SQLSTATE 25P02) and roll back the `CREATE TABLE`.

Also backfilled identical grants on `app.library_cleanup_suggestions` (Phase
C, 2026-05-13) which had the same latent runtime-write bug — the cleanup
suggestions cache write would have failed in production.

## Tests

`backend/tests/Feature/Api/V1/Admin/LibraryBulkDeleteTest.php` covers:
- non-super-admin rejection
- archived-only precondition
- all three attachment-block paths (concept_set, cohort_definition, analysis)
- success path with audit_log assertion
- payload validation (empty items, unknown type)
