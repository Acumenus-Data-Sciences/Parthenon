---
doc_type: lineage
status: historical
date: 2026-05-14
owner: acumenus
module: vocab
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_03_01_150011_repair_vocabulary_schema_bootstrap.php
related_prs: []
---
# 2026-05-14 — Vocab bootstrap migration hardened against permission and ownership state

The `2026_03_01_150011_repair_vocabulary_schema_bootstrap` migration was failing in production with two distinct errors when run as the migrator role:

1. `SELECT count(*) FROM omop.vocabulary` raised `SQLSTATE[42501] permission denied` because the migrator lacked SELECT on the `omop` schema, where 11 residual vocabulary tables still lived alongside the canonical `vocab.*` tables.
2. After the residual tables were cleaned up, `CREATE INDEX IF NOT EXISTS idx_concept_tree_child ON vocab.concept_tree (...)` raised `must be owner of table concept_tree` because `vocab.concept_tree` was owned by a role outside the migrator's grant chain (legacy `smudoshi` ownership).

## Changes

- `rowCount()` now wraps the count query in a `try`/`catch`. On `permission denied`, throws a `RuntimeException` with an actionable remediation message (drop the residual table as superuser after confirming its rows are mirrored in `vocab.*`).
- `ensureConceptTreeTable()` now uses `pg_indexes` lookup before issuing `CREATE INDEX`, making the operation idempotent against existing-but-unowned tables. The wrapping `CREATE TABLE IF NOT EXISTS` is split into a `relationExists` precheck for symmetry.
- Added `ensureIndex(string $indexName, string $createSql)` helper.

## Operational cleanup performed in production

Before re-running the migration, the 11 duplicate `omop.*` vocabulary tables were dropped as superuser in a single transaction, after a LEFT JOIN gate verified that every row in each `omop.*` table was already mirrored in the corresponding `vocab.*` table.

## Outcome

`./deploy.sh --db` completes cleanly; the legacy migration is now applied; future fresh databases that hit the same permission/ownership state will surface a useful error instead of a raw SQL exception.
