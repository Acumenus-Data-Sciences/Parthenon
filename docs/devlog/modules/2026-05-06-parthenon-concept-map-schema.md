# 2026-05-06 — `app.parthenon_concept_map` schema

Phase 3 Plan 6 Task 10 (T-024A). Lands the persistent home for
reviewer-approved or auto-approved concept mappings produced by the
commercial-tier ``ai_assisted_mapping`` backend.

## Schema

`backend/database/migrations/2026_05_06_120000_create_parthenon_concept_map_table.php`

```sql
CREATE TABLE app.parthenon_concept_map (
    map_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_code            TEXT NOT NULL,
    source_vocab           TEXT NOT NULL,
    source_text            TEXT,
    omop_concept_id        BIGINT NOT NULL REFERENCES vocab.concept(concept_id),
    confidence             NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    reviewer_id            BIGINT REFERENCES app.users(id),
    reviewed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_version          TEXT NOT NULL,
    candidate_ranking_json JSONB NOT NULL,
    UNIQUE (source_code, source_vocab)
);
```

## Why `app.*` and not `commercial.*`

The mapping table is read by downstream community-tier templates
(e.g. when ``lis_lab_to_omop`` re-runs and finds a previously-mapped
local code, it can short-circuit to the approved ``omop_concept_id``)
and by the Plan 7 Laravel reviewer UI. Putting it in ``app.*`` keeps
it in the same Laravel migration runner that owns Spatie permissions
and ``app.users``, so the reviewer FK works without cross-schema
gymnastics.

The Plan 5 best-effort decision (queue lives in ``${source_schema}``,
not ``${app_schema}``) still holds for the queue side — the queue is
templates-owned ETL output. The mapping table is the human-curated
final form, which is application-tier data.

## Consumed by

- ``MappingReviewQueueNode`` (Task 11) — write path.
- Plan 7 ``MappingReviewQueuePage`` + ``MappingReviewDetailPage`` —
  read + write path.
- Future template iterations of Plan 5 / 3 / etc. — read-only join
  to short-circuit unmapped queues for already-approved codes.

## 2026-05-07 — Pint cosmetic fix

Applied `vendor/bin/pint` autofix on the migration file: anonymous class
definition switched from `new class ()` to `new class` with the brace on a
new line (Pint rules: `new_with_parentheses`, `class_definition`,
`braces_position`). No schema change.

## 2026-05-07 — drop FK to vocab.concept

Dropped the `REFERENCES vocab.concept(concept_id)` clause on
`omop_concept_id`. The hard FK was breaking 36 unrelated `StudyDesignTest`
cases that `TRUNCATE vocab.concept` between runs (PG refuses to truncate
a table with referencing FKs). Project convention treats `vocab.*` as
shared/read-only with full-table reseeding, so app-level FKs to it are
the wrong contract. Validation moved to the application layer
(`MappingReviewQueueNode` + `AriadneController::saveMappings`).
