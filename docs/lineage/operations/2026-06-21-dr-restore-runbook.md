---
doc_type: runbook
status: active
date: 2026-06-21
owner: acumenus
module: infrastructure
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - scripts/pg-host-logical-backup.sh
  - scripts/pg-host-basebackup.sh
  - scripts/db-restore.sh
  - docs/compliance/disaster-recovery-plan.md
---

# PostgreSQL Backup & Restore Runbook (DR drill verified 2026-06-21)

This runbook records a **non-destructive disaster-recovery drill** run against the
host PostgreSQL 17 instance on 2026-06-21 and the verified restore procedures it
produced. It supplements `docs/compliance/disaster-recovery-plan.md` and corrects
several stale facts in it (see [Corrections](#corrections-to-the-dr-plan)).

The drill touched **no production data**: every restore went into a throwaway
`parthenon_dr_drill` database that was dropped afterward.

## Backup architecture (as actually scheduled in cron)

| Tier | Script | Cadence (cron) | Scope | Destination |
|---|---|---|---|---|
| **Physical basebackup** | `pg-host-basebackup.sh` | **Daily 02:23** | Full cluster + WAL | `/mnt/md0/postgres-backups/` |
| **Logical (per-schema)** | `pg-host-logical-backup.sh` | **3×/day 06:17, 14:17, 22:17** | `app` schema only (`PG_LOGICAL_SCHEMAS`) | `/mnt/md0/postgres-backups/logical/` |
| **WAL retention** | `pg-wal-retention.sh --purge` | Daily 06:30 | WAL segment pruning | — |
| **Prune** | `pg-host-prune-backups.sh` | Daily 06:00 | Retention enforcement | — |

The legacy `scripts/db-backup.sh` / `scripts/db-restore.sh` pair targets the
**Docker** Postgres and is not the production path; `db-restore.sh` restores
**over** the live `parthenon` database and must never be pointed at production
during a drill.

## Two recovery scenarios

### A. Full-instance / full-corruption DR — use the physical basebackup
The physical basebackup is the authoritative full-cluster recovery path: it
contains every schema (`app`, `vocab`, `omop`, all CDM sources), all extensions,
roles, and WAL for point-in-time recovery. This is the only tier that restores a
**fresh** instance with no prerequisites. (Size: ~1.27 TB; restore is an
infrastructure operation, not drilled inline here.)

### B. Schema-level recovery of `app` — use the logical dump INTO an existing cluster
`latest-app.sql.gz` (~5.2 GB gzipped) restores the `app` schema into a cluster
that **already has** the `vocab` schema and the required extensions present
(i.e., over the existing `parthenon` DB, or a basebackup-restored instance). It
is **not** standalone-restorable into an empty database — see the drill findings.

## Drill findings (2026-06-21)

Restoring `latest-app.sql.gz` into an **empty** database failed three times, each
exposing an undocumented prerequisite:

1. `ERROR: type "public.geometry" does not exist` — `app.gis_admin_boundaries.geom`
   needs **PostGIS**, which a `--schema=app` dump does not create.
2. `ERROR: type "public.vector" does not exist` — `*.embedding` columns need
   **pgvector**, likewise not created by the schema dump.
3. `ERROR: relation "vocab.concept" does not exist` — the `app` schema has
   **cross-schema foreign keys into `vocab`**, which is not part of the `app`
   logical backup (vocab lives in the basebackup).

**Fix applied:** `pg-host-logical-backup.sh` now prepends
`CREATE EXTENSION IF NOT EXISTS postgis | vector | pg_trgm` to every dump, so the
extension class of failure (1 and 2) is gone for future backups. The `vocab`
cross-schema dependency (3) is **by design** — the logical `app` dump is a
schema-restore tool for an existing cluster, not a standalone DR artifact.

**Data integrity verified:** with extensions present and a real `vocab` schema,
`app.analysis_executions` (173 rows) and `app.cohort_definitions` (164 rows)
restored **byte-exact to production**, and the dump was confirmed to contain the
full `COPY app.users / app.studies / app.sources` data blocks. The backup is
complete and faithful.

## Verified restore procedure (schema-level, into a throwaway for drills)

```bash
# 1. Create an isolated target — NEVER restore into the live parthenon DB during a drill
psql "host=127.0.0.1 port=5432 dbname=postgres user=claude_dev" \
  -c "CREATE DATABASE parthenon_dr_drill OWNER claude_dev;"

# 2. Provide the prerequisites the app schema depends on
psql "host=127.0.0.1 port=5432 dbname=parthenon_dr_drill user=claude_dev" -c "
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;"
#    For a FULL standalone restore you must also restore the vocab schema first
#    (from the basebackup); for an in-cluster restore vocab is already present.

# 3. Restore
zcat /mnt/md0/postgres-backups/logical/latest-app.sql.gz \
  | psql "host=127.0.0.1 port=5432 dbname=parthenon_dr_drill user=claude_dev" -v ON_ERROR_STOP=1

# 4. Verify row counts against production, then drop the throwaway
psql "host=127.0.0.1 port=5432 dbname=postgres user=claude_dev" \
  -c "DROP DATABASE IF EXISTS parthenon_dr_drill WITH (FORCE);"
```

A clean run (post-fix, full vocab present) completes with `ON_ERROR_STOP=1` and
matching row counts. A degraded environment (stub vocab) will partially restore —
that is expected and not a backup defect.

## Corrections to the DR plan

`docs/compliance/disaster-recovery-plan.md` was written before this drill and
states: basebackup "Weekly", logical "On demand", destination `backups/`. The
**actual** cadence is basebackup daily and logical 3×/day, both writing to
`/mnt/md0/postgres-backups/`. Its selective-schema restore section also omitted
the extension + vocab prerequisites. Those entries are corrected in that file with
a pointer here.

## Open items (not addressed by this drill)

- A scheduled **physical basebackup restore** rehearsal (Scenario A) into a spare
  instance to validate full-instance RTO end-to-end.
- A **backup-failure alert**: cron success is currently observable only via the
  `/tmp/parthenon-pg-*.log` files; no Prometheus alert fires if a backup stops
  running (see the observability gap noted in the Gate B5 review).
