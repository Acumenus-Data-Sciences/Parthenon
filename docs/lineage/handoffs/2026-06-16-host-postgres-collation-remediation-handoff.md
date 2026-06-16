---
doc_type: handoff
status: shipped
date: 2026-06-16
owner: acumenus
module: operations
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Host PostgreSQL Remaining Collation Remediation Handoff

**Audience:** agent continuing host PostgreSQL maintenance on
`/home/smudoshi/Github/Parthenon`

**Goal:** fix the remaining host PostgreSQL collation-version mismatches after
the Parthenon databases were remediated.

## Closeout Results

Completed on 2026-06-16 against the host PostgreSQL 17 cluster at
`127.0.0.1:5432` as `smudoshi`.

Preflight and final host state:

```text
PostgreSQL 17 main: 5432 online
PostgreSQL 16 main: 5433 down
Host access path: 127.0.0.1:5432 as smudoshi
/var/lib/postgresql filesystem: 3.6T size, 2.4T used, 1.1T available, 69% used
```

Reindex actions completed:

| Database | Strategy | Scope | Sessions Before Touch | Result |
|---|---|---:|---:|---|
| `docuseal` | `REINDEX DATABASE CONCURRENTLY` | full database | 0 | `2.43` recorded / `2.43` actual |
| `aurora` | `REINDEX DATABASE CONCURRENTLY` | full database | 0 | `2.43` recorded / `2.43` actual |
| `hive_networks` | `REINDEX DATABASE CONCURRENTLY` | full database | 0 | `2.43` recorded / `2.43` actual |
| `mattermost` | `REINDEX DATABASE CONCURRENTLY` | full database | 6 idle `mmuser` sessions, no open transaction age | `2.43` recorded / `2.43` actual |
| `zephyrus` | targeted `REINDEX INDEX CONCURRENTLY` | 114 default-collation indexes, 838 MB total | 0 | `2.43` recorded / `2.43` actual |
| `medicosts` | targeted `REINDEX INDEX CONCURRENTLY` | 145 default-collation indexes, 3425 MB total | 0 | `2.43` recorded / `2.43` actual |

Final mismatch query output:

```text
<no rows>
```

Direct database connection smoke checks:

```text
docuseal|1
aurora|1
hive_networks|1
mattermost|1
zephyrus|1
medicosts|1
```

No direct connection emitted a collation-version mismatch warning after the
repair. No application-specific HTTP smoke checks were run; verification was
limited to host PostgreSQL catalog and direct-connection checks.

Concurrent rebuild artifact and index-health verification:

```text
docuseal: no ccnew/ccold artifacts; invalid=0; not_ready=0
aurora: no ccnew/ccold artifacts; invalid=0; not_ready=0
hive_networks: no ccnew/ccold artifacts; invalid=0; not_ready=0
mattermost: no ccnew/ccold artifacts; invalid=0; not_ready=0
zephyrus: no ccnew/ccold artifacts; invalid=0; not_ready=0
medicosts: no ccnew/ccold artifacts; invalid=0; not_ready=0
```

## Incoming State

The stale list below is the incoming handoff state, retained for history.

The container PostgreSQL cluster used by `docker compose` was checked and did
not have this issue. The stale collation metadata is on the host PostgreSQL 17
cluster:

```bash
pg_lsclusters
pg_isready -h 127.0.0.1 -p 5432
```

Observed state at handoff:

```text
PostgreSQL 17 main: 5432 online
PostgreSQL 16 main: 5433 down
Host access path: 127.0.0.1:5432 as smudoshi
Recorded collation: 2.42
Actual OS collation: 2.43
```

The `parthenon`, `parthenon_testing`, and `parthenon_testing_test_*` databases
have already been repaired and verified. Do not repeat that work unless a fresh
catalog query shows new drift.

Incoming stale databases from the final handoff query:

| Database | Size | Sessions | Recorded | Actual |
|---|---:|---:|---:|---:|
| `medicosts` | 70 GB | 0 | 2.42 | 2.43 |
| `zephyrus` | 49 GB | 0 | 2.42 | 2.43 |
| `hive_networks` | 73 MB | 0 | 2.42 | 2.43 |
| `mattermost` | 26 MB | 5 | 2.42 | 2.43 |
| `aurora` | 19 MB | 0 | 2.42 | 2.43 |
| `docuseal` | 12 MB | 0 | 2.42 | 2.43 |

## Safety Boundaries

- Do not delete databases, tables, backups, or data files.
- Do not run `ALTER DATABASE ... REFRESH COLLATION VERSION` before rebuilding
  affected indexes. That only hides the warning.
- Use `CONCURRENTLY` for reindexing to reduce disruption. It still needs brief
  lock windows and can wait behind active transactions.
- Recheck active sessions immediately before touching each database.
  `mattermost` had active idle sessions at handoff.
- Check disk headroom before large databases. Concurrent rebuilds need extra
  temporary index space.
- Treat `medicosts` and `zephyrus` as large databases. Measure their
  default-collation index footprint before choosing full-database reindexing.

## Preflight Commands

Run from `/home/smudoshi/Github/Parthenon`:

```bash
pg_lsclusters
pg_isready -h 127.0.0.1 -p 5432
df -hT /var/lib/postgresql
```

Refresh the live mismatch list:

```bash
psql -h 127.0.0.1 -p 5432 -U smudoshi -d postgres -Atc "
SELECT
  d.datname,
  pg_size_pretty(pg_database_size(d.datname)) AS size,
  COALESCE(count(a.pid) FILTER (WHERE a.pid IS NOT NULL), 0) AS sessions,
  d.datcollversion AS recorded,
  pg_database_collation_actual_version(d.oid) AS actual
FROM pg_database d
LEFT JOIN pg_stat_activity a ON a.datname = d.datname
WHERE d.datallowconn
  AND d.datcollversion IS DISTINCT FROM pg_database_collation_actual_version(d.oid)
GROUP BY d.oid, d.datname, d.datcollversion
ORDER BY pg_database_size(d.datname) DESC, d.datname;
"
```

Inspect active sessions for a target database:

```bash
DB=mattermost
psql -h 127.0.0.1 -p 5432 -U smudoshi -d postgres -At -v db="$DB" <<'SQL'
SELECT pid, usename, application_name, state, wait_event_type, wait_event,
       now() - xact_start AS xact_age,
       left(query, 160)
FROM pg_stat_activity
WHERE datname = :'db'
ORDER BY xact_start NULLS LAST, pid;
SQL
```

If a reindex appears stalled, check blockers:

```bash
psql -h 127.0.0.1 -p 5432 -U smudoshi -d postgres -Atc "
SELECT pid, datname, state, wait_event_type, wait_event,
       now() - query_start AS age,
       pg_blocking_pids(pid),
       left(query, 160)
FROM pg_stat_activity
WHERE query ILIKE 'REINDEX%'
   OR pid IN (SELECT pid FROM pg_stat_progress_create_index)
ORDER BY query_start;
"
```

## Choose the Reindex Strategy

For small databases (`docuseal`, `aurora`, `mattermost`, `hive_networks`), full
concurrent database reindexing is reasonable after confirming activity:

```bash
DB=docuseal
env PGOPTIONS='-c maintenance_work_mem=256MB -c statement_timeout=0' \
  psql -h 127.0.0.1 -p 5432 -U smudoshi -d "$DB" -v ON_ERROR_STOP=1 \
  -c "REINDEX DATABASE CONCURRENTLY \"$DB\";"

psql -h 127.0.0.1 -p 5432 -U smudoshi -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE \"$DB\" REFRESH COLLATION VERSION;"
```

For large databases (`medicosts`, `zephyrus`), first measure the index scope
that actually uses the database default collation:

```bash
DB=medicosts
psql -h 127.0.0.1 -p 5432 -U smudoshi -d "$DB" -Atc "
WITH target AS (
  SELECT i.indexrelid, i.indisvalid, i.indisready
  FROM pg_index i
  WHERE EXISTS (
    SELECT 1
    FROM unnest(i.indcollation) AS coll_oid
    JOIN pg_collation c ON c.oid = coll_oid
    WHERE c.collname = 'default'
  )
)
SELECT count(*) AS indexes,
       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS total_size,
       count(*) FILTER (WHERE NOT indisvalid) AS invalid,
       count(*) FILTER (WHERE NOT indisready) AS not_ready
FROM target;
"
```

If the target set is manageable and has no invalid/not-ready indexes, reindex
only the default-collation indexes, largest first:

```bash
DB=medicosts
env PGOPTIONS='-c maintenance_work_mem=1GB -c statement_timeout=0' \
  psql -h 127.0.0.1 -p 5432 -U smudoshi -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
\timing on
WITH target AS (
  SELECT i.indexrelid,
         n.nspname,
         c.relname,
         pg_relation_size(i.indexrelid) AS bytes
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'i'
    AND EXISTS (
      SELECT 1
      FROM unnest(i.indcollation) AS coll_oid
      JOIN pg_collation col ON col.oid = coll_oid
      WHERE col.collname = 'default'
    )
)
SELECT format('REINDEX INDEX CONCURRENTLY %I.%I;', nspname, relname)
FROM target
ORDER BY bytes DESC, nspname, relname;
\gexec
SQL

psql -h 127.0.0.1 -p 5432 -U smudoshi -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER DATABASE \"$DB\" REFRESH COLLATION VERSION;"
```

If the target set contains invalid indexes, inventory them before repair:

```bash
DB=medicosts
psql -h 127.0.0.1 -p 5432 -U smudoshi -d "$DB" -Atc "
SELECT n.nspname || '.' || c.relname,
       pg_size_pretty(pg_relation_size(c.oid)),
       i.indisvalid,
       i.indisready
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE NOT i.indisvalid OR NOT i.indisready
ORDER BY pg_relation_size(c.oid) DESC;
"
```

Do not drop invalid indexes blindly. Confirm whether each index is a failed
concurrent rebuild artifact, an application-owned index, or historical schema
drift.

## Recommended Order

1. `docuseal`
2. `aurora`
3. `hive_networks`
4. `mattermost`, after checking or coordinating active sessions
5. `zephyrus`, after measuring default-collation index scope
6. `medicosts`, after measuring default-collation index scope

This order validates the small-database flow first and leaves the larger
databases for explicit measurement.

## Verification

After each database:

```bash
DB=docuseal
psql -h 127.0.0.1 -p 5432 -U smudoshi -d postgres -At -v db="$DB" <<'SQL'
SELECT datname, datcollversion, pg_database_collation_actual_version(oid)
FROM pg_database
WHERE datname = :'db';
SQL

psql -h 127.0.0.1 -p 5432 -U smudoshi -d "$DB" -Atc "SELECT current_database(), 1;"
```

The direct connection should not print the collation mismatch warning.

Check for leftover concurrent rebuild artifacts:

```bash
DB=docuseal
psql -h 127.0.0.1 -p 5432 -U smudoshi -d "$DB" -Atc "
SELECT n.nspname || '.' || c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_index i ON i.indexrelid = c.oid
WHERE c.relname ~ '(ccnew|ccold)$'
ORDER BY 1;
"
```

Final success condition:

```bash
psql -h 127.0.0.1 -p 5432 -U smudoshi -d postgres -Atc "
SELECT datname, datcollversion, pg_database_collation_actual_version(oid)
FROM pg_database
WHERE datallowconn
  AND datcollversion IS DISTINCT FROM pg_database_collation_actual_version(oid)
ORDER BY datname;
"
```

This should return no rows.

## Known Non-Blocking Findings

During the Parthenon repair, five pre-existing invalid `synpuf` indexes were
seen in `parthenon`. They were not caused by the collation repair and are not
part of this handoff unless a future task explicitly asks to remediate invalid
Parthenon indexes.

## Closeout Checklist

- Status was updated to `shipped`.
- Final mismatch query output was recorded above.
- Smoke checks and artifact checks were recorded above.
- Lineage documentation checks were run after changing this document:
  - `python3 scripts/docs/catalog_lineage_docs.py --write-catalog`: passed.
  - `python3 scripts/docs/catalog_lineage_docs.py --check-frontmatter`: failed
    on unrelated docs (`docs/devlog/2026-06-11-studies-publish-coordination.md`
    and `docs/research/hypertension-v4/*`).
  - `sh docs/site/scripts/check-content-tree.sh`: passed.
  - `sh docs/site/scripts/check-public-docs-current.sh`: passed.
