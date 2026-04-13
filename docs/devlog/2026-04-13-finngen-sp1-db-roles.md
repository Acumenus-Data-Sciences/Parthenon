# FinnGen SP1 — Postgres Roles (Task A2)

**Date:** 2026-04-13
**Branch:** `feature/finngen-sp1-runtime-foundation`
**Related spec:** `docs/superpowers/specs/2026-04-12-finngen-runtime-foundation-design.md`
**Related plan:** `docs/superpowers/plans/2026-04-12-finngen-runtime-foundation.md` (Part A, Task A2)

## What shipped

Migration `2026_04_13_014502_create_finngen_db_roles.php` creates two
least-privilege Postgres login roles used by the FinnGen Runtime Foundation
(Darkstar sync pull + async sidecar writes):

- **`parthenon_finngen_ro`** — `USAGE` + `SELECT` on `omop`, `synpuf`, `irsf`,
  `pancreas`, `eunomia`, `inpatient`, `vocab`, and all `*_results` schemas that
  exist on the target environment. Plus matching `ALTER DEFAULT PRIVILEGES`
  so future tables inherit SELECT.
- **`parthenon_finngen_rw`** — same RO grants on CDM/vocab, plus
  `SELECT/INSERT/UPDATE/DELETE` and `USAGE, CREATE` on each `*_results`
  schema. Used for pipeline sidecar tables during async runs.

The migration is idempotent: it checks `pg_roles` before `CREATE ROLE` and
`pg_namespace` before each `GRANT`, so re-runs are safe and environments
missing optional schemas (e.g. `inpatient`, `eunomia`) don't blow up.

The `down()` is intentionally a no-op. Project rule: never drop production
roles without explicit authorization. Manual cleanup instructions belong in a
runbook, not in an auto-revertible migration.

## Why a separate migration (and separate execution path)

Per `project_parthenon_pg_roles`, the regular runtime user
(`parthenon_app`) has **no DDL**, and the standard migration user
(`parthenon_migrator`) deliberately lacks `CREATEROLE`. Role creation is a
superuser concern. This migration therefore runs **once, out of band**, as a
role with `CREATEROLE` (for Parthenon: `claude_dev` on host PG17). The
standard `./deploy.sh --db` path will skip it because `parthenon_migrator`
cannot execute `CREATE ROLE` — and it's idempotent enough that re-running
under the elevated role is a no-op.

Runbook (one-liner used during SP1 foundation work):

```bash
CLAUDE_PW=$(grep '^localhost:5432:\*:claude_dev:' ~/.pgpass | head -1 | cut -d: -f5)
docker compose exec -T -e DB_USERNAME=claude_dev -e DB_PASSWORD="$CLAUDE_PW" php \
  sh -c 'cd /var/www/html && php artisan migrate \
    --path=database/migrations/2026_04_13_014502_create_finngen_db_roles.php --force'
```

## Config + env wiring

- New file: `backend/config/finngen.php` — binds all SP1 knobs
  (`FINNGEN_PG_RO_PASSWORD`, `FINNGEN_PG_RW_PASSWORD`, Darkstar URL and
  three timeouts, artifacts path + stream threshold, GC retention,
  idempotency TTL, sync cache TTL, dispatch pause flag, cancel ceiling).
- `.env.example` — appends the FinnGen block with placeholder values.
- `backend/.env` + root `.env` — both now contain
  `FINNGEN_PG_RO_PASSWORD` / `FINNGEN_PG_RW_PASSWORD` (generated with
  `openssl rand -base64` then stripped of `/+=!` per
  `feedback_no_exclamation_passwords`). Both files remain `chmod 600`.

## Verification (captured during Task A2 execution)

```
$ psql -h localhost -U claude_dev -d parthenon -c \
    "SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname LIKE 'parthenon_finngen%';"
       rolname        | rolcanlogin
----------------------+-------------
 parthenon_finngen_ro | t
 parthenon_finngen_rw | t

# RO login + read works on CDM:
PGPASSWORD=*** psql -h localhost -U parthenon_finngen_ro -d parthenon \
  -c "SELECT count(*) FROM omop.person;" → 1005788

# RW has CREATE on results:
has_schema_privilege('parthenon_finngen_rw','results','CREATE') → true
has_schema_privilege('parthenon_finngen_rw','results','USAGE')  → true
```

## Follow-ups

- Task A3: remove the deprecated `finngen-runner` container + related source
  (Docker volume / dead Laravel code).
- When new CDM sources come online, extend the `$cdmSchemas` / `$resultsSchemas`
  arrays in a follow-up migration rather than editing this one in place.
