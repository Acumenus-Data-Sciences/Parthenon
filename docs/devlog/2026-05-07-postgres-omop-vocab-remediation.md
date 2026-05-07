# 2026-05-07 — PostgreSQL 17 OMOP/vocab remediation

## Summary

Reviewed and remediated the local PostgreSQL 17 `parthenon` database used by
the Acumenus OHDSI source (`omop`, `vocab`, `results`). The work focused on
live database safety and high-value warehouse reliability: invalid indexes,
memory guardrails, query observability, planner statistics, and backup
free-space protection.

## Database Changes Executed

### Invalid OMOP index repaired

`omop.idx_omop_device_person` was invalid. It was dropped and rebuilt
concurrently:

```sql
DROP INDEX CONCURRENTLY IF EXISTS omop.idx_omop_device_person;
CREATE INDEX CONCURRENTLY idx_omop_device_person
    ON omop.device_exposure (person_id);
```

Verification showed `0` invalid/not-ready indexes across `omop` and `vocab`.

### Broad memory risk reduced

The broad `parthenon` database default had `work_mem=256MB`, which was useful
for analytics but too risky for every app/API session.

Applied:

```sql
ALTER DATABASE parthenon SET work_mem = '64MB';
ALTER DATABASE parthenon SET hash_mem_multiplier = 4;
ALTER ROLE smudoshi IN DATABASE parthenon SET work_mem = '256MB';
ALTER ROLE smudoshi IN DATABASE parthenon SET hash_mem_multiplier = 4;
ALTER ROLE parthenon_app IN DATABASE parthenon SET work_mem = '64MB';
ALTER ROLE parthenon_app IN DATABASE parthenon SET hash_mem_multiplier = 4;
ALTER ROLE parthenon_app IN DATABASE parthenon SET idle_in_transaction_session_timeout = '5min';
ALTER ROLE parthenon_app IN DATABASE parthenon SET temp_file_limit = '32GB';
```

Result: analyst/admin sessions keep high memory, while app sessions have safer
defaults and guardrails.

### Query observability enabled

Enabled query-level and IO observability:

```sql
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_io_timing = 'on';
ALTER SYSTEM SET track_wal_io_timing = 'on';
```

PostgreSQL was restarted and verified active under systemd. During restart,
`huge_pages=on` failed startup after `pg_stat_statements` increased shared
memory requirements, so `huge_pages` was changed to `try` for durable startup
safety.

```sql
ALTER SYSTEM SET huge_pages = 'try';
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

### `visit_detail` primary key restored

The live `omop.visit_detail` table had no primary key despite the Laravel model
and migration expecting `visit_detail_id` as the key. Verified:

- `26,293,435` rows
- `0` null `visit_detail_id` values
- `0` duplicate `visit_detail_id` values

Then created the unique index concurrently and attached it as the primary key:

```sql
CREATE UNIQUE INDEX CONCURRENTLY idx_visit_detail_id_unique
    ON omop.visit_detail (visit_detail_id);

ALTER TABLE omop.visit_detail
    ADD CONSTRAINT visit_detail_pkey
    PRIMARY KEY USING INDEX idx_visit_detail_id_unique;
```

PostgreSQL renamed the index to `visit_detail_pkey`.

### Planner statistics refreshed

Ran targeted `ANALYZE` on large `omop` and `vocab` tables:

- `omop.measurement`
- `omop.observation`
- `omop.note`
- `omop.procedure_occurrence`
- `omop.drug_exposure`
- `omop.visit_occurrence`
- `omop.all_visits`
- `omop.assign_all_visit_ids`
- `omop.visit_detail`
- `omop.final_visit_ids`
- `omop.condition_occurrence`
- `omop.device_exposure`
- `vocab.concept`
- `vocab.concept_ancestor`
- `vocab.concept_relationship`
- `vocab.concept_embedding_bge`

## Backup Hardening

`/mnt/md0` remained tight at about `91%` used, with about `346GB` free. The
existing prune script safely found nothing eligible to delete because two base
backups are retained and no WAL was older than the PITR cutoff.

Hardened `scripts/pg-host-basebackup.sh` so future base backups fail before
filling the disk:

- Refuse to start below `300GB` free (`PG_BASEBACKUP_MIN_FREE_GB`).
- Estimate latest retained base backup size.
- Refuse to start if projected free space during the next backup would fall
  below `100GB` (`PG_BASEBACKUP_MIN_POST_FREE_GB`).
- Run `pg-host-prune-backups.sh` after a successful base backup.

Updated `docs/ops/postgres-host-backups.md` to document the new guardrails.

## Report

Wrote a detailed operational report:

- `docs/ops/postgres-17-omop-vocab-optimization-report-2026-05-07.md`

The report captures parameter tuning, schema sizes, index/key inventory, risk
register, remediation status, and remaining follow-up items.

## Verification

Live checks after remediation:

| Check | Result |
| --- | --- |
| PostgreSQL service | `postgresql@17-main` active |
| Local readiness | `pg_isready -h 127.0.0.1 -p 5432` accepts connections |
| PostgreSQL version | `17.9` |
| `pg_stat_statements` | loaded and returning rows |
| IO timing | `track_io_timing=on`, `track_wal_io_timing=on` |
| Huge pages | `huge_pages=try` |
| Invalid `omop`/`vocab` indexes | `0` |
| `visit_detail` primary key | `visit_detail_pkey PRIMARY KEY (visit_detail_id)` |
| Backup scripts | `bash -n` passed |
| Graphify | `graphify update .` completed |

## Deferred

- Let `pg_stat_statements` collect representative app/cohort/profile/data
  explorer workload before pruning any large zero-scan indexes.
- Keep `omop.assign_all_visit_ids` heap-only unless real workload evidence
  shows interactive reads.
- Decide whether `/mnt/md0` should get more capacity, stricter retention, or
  off-host movement of older artifacts; current pruning cannot safely free more
  under the two-base-backup policy.
