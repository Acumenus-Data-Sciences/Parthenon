# 2026-05-07 — Harmonia reviewer queue backend (Plan 7 Section A, Tasks 1-4)

Phase 3 Plan 7 (T-024B). Backend half of the concept-mapping reviewer UI
that the Plan 6 Harmonia pipeline feeds. Closes the read/write loop:
ConceptMappingSuggesterNode (Plan 6 Python) → queue table → reviewer UI →
HarmoniaReviewController → `app.parthenon_concept_map`.

## Schema — `app.parthenon_mapping_review_queue`

`backend/database/migrations/2026_05_07_120000_create_parthenon_mapping_review_queue_table.php`

```sql
CREATE TABLE app.parthenon_mapping_review_queue (
    queue_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_code              TEXT NOT NULL,
    source_vocab             TEXT NOT NULL,
    source_text              TEXT,
    seen_count               INTEGER NOT NULL DEFAULT 1,
    candidate_ranking_json   JSONB NOT NULL,
    top1_confidence          NUMERIC(5, 4) NOT NULL,
    model_version            TEXT NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','escalated')),
    approved_concept_id      BIGINT,
    approved_map_id          BIGINT,
    rejection_reason         TEXT,
    reviewer_id              BIGINT REFERENCES app.users(id),
    reviewed_at              TIMESTAMPTZ,
    escalated_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_code, source_vocab)
);
```

Indexes on (status), (source_vocab), (top1_confidence), (reviewer_id) WHERE not null,
and a partial (created_at) WHERE status='pending' for the oldest-first queue page.

Like Plan 6's `parthenon_concept_map`, no DB-level FK to `vocab.concept` —
vocab is reseeded via TRUNCATE; FKs would block the reseed pipeline.
Standard-concept validation lives in `HarmoniaApproveMappingRequest`
(`standard_concept = 'S'` AND `invalid_reason IS NULL`).

## API — `/api/v1/mapping-review/*`

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/queue` | `mapping.review` | Paginated; filters by status, source_vocab, q, sort_by |
| GET | `/queue/stats` | `mapping.review` | Counts by status (pending/approved/rejected/escalated) |
| GET | `/queue/{queueId}` | `mapping.review` | Detail with hydrated concepts (concept_still_valid flag) |
| POST | `/queue/{queueId}/approve` | `mapping.approve` | Writes to `parthenon_concept_map`; idempotent re-approve |
| POST | `/queue/{queueId}/reject` | `mapping.approve` | Requires `rejection_reason` |
| POST | `/queue/{queueId}/escalate` | `mapping.approve` | Requires `note`; sets `escalated_at` |

Distinct from the legacy `MappingReviewController` ingestion-job-scoped
routes (`/api/v1/ingestion/jobs/{job}/mappings/*`) — those work on
the legacy `concept_mappings` table from the Ariadne ETL flow. This
controller works on the corpus-wide Harmonia queue.

## RBAC

`mapping.review` and `mapping.approve` are seeded by `RolePermissionSeeder`.
The `mapping-reviewer` role has both. `data-steward` has both. `viewer`
has neither.

Approve refuses any `concept_id` that isn't in the queue row's candidate
list (off-list approvals → 422). It also re-validates `standard_concept = 'S'`
against `vocab.concept` at write time so a vocab refresh that demotes a
concept doesn't silently produce a non-standard mapping.

## Tests

`backend/tests/Feature/Api/V1/HarmoniaReviewControllerTest.php` — 12 it()
cases covering pagination, filters, stats, detail with hydration, approve
happy-path + off-list refusal + non-standard refusal, reject preservation,
escalate `escalated_at`, RBAC denial for viewer-role + readonly-mapping
sub-role, unauthenticated rejection.
