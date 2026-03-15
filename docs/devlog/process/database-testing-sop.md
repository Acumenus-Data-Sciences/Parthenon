# Database Testing SOP — Parthenon

**Last updated:** 2026-03-15

---

## Database Inventory

| Database | Host | Owner | Purpose |
|----------|------|-------|---------|
| `ohdsi` | `pgsql.acumenus.net:5432` | smudoshi | Production — OMOP CDM, vocabulary, Achilles results |
| `parthenon` | Docker `postgres:5432` (host port 5480) | parthenon | App tables — users, roles, cohorts, sources, migrations |
| `parthenon_testing` | `pgsql.acumenus.net:5432` | smudoshi | Backend PHP test suite (Pest) |

**Never mix these up.** Production clinical data lives in `ohdsi`. App state lives in Docker `parthenon`. Tests run against `parthenon_testing`.

---

## Running Tests

### Standard (non-parallel) — preferred for development

```bash
# Inside Docker
docker compose exec php vendor/bin/pest

# From host (uses .env.testing automatically)
cd backend && vendor/bin/pest
```

### Parallel — CI only

```bash
vendor/bin/pest --parallel
```

**Warning:** Parallel mode creates per-worker databases named `{DB_DATABASE}_test_{N}`.
With `DB_DATABASE=parthenon_testing`, workers produce `parthenon_testing_test_1`, `parthenon_testing_test_2`, etc.
Pest drops them on clean exit, but orphans accumulate if the run is killed mid-flight.

**Never set `DB_DATABASE` to a name ending in `_test`** (e.g., `parthenon_test`). Laravel appends `_test_{N}`, producing `parthenon_test_test_N` — confusing double-test names.

---

## Orphan Detection & Cleanup

Run this any time the test database list looks messy:

```bash
# List all parthenon-related databases
psql -U smudoshi -d postgres -c "\l" | grep parthenon

# List orphaned parallel worker DBs specifically
psql -U smudoshi -d postgres -c "
  SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size
  FROM pg_database
  WHERE datname ~ '^parthenon_testing_test_\d+$'
  ORDER BY datname;
"

# Drop all orphaned workers (SAFE — these are throwaway test DBs)
psql -U smudoshi -d postgres -t -c "
  SELECT 'DROP DATABASE \"' || datname || '\";'
  FROM pg_database
  WHERE datname ~ '^parthenon_testing_test_\d+$';
" | psql -U smudoshi -d postgres
```

If a database has active connections (e.g., DBeaver is browsing it), terminate them first:

```bash
psql -U smudoshi -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'parthenon_testing_test_12';
"
```

---

## Rebuilding the Test Database

If `parthenon_testing` is corrupt or out of sync with migrations:

```bash
# Option A: From host
cd backend
php artisan migrate:fresh --env=testing

# Option B: Drop and recreate manually
psql -U smudoshi -d postgres -c "DROP DATABASE parthenon_testing;"
psql -U smudoshi -d postgres -c "CREATE DATABASE parthenon_testing OWNER smudoshi;"
cd backend && php artisan migrate --env=testing
```

---

## Rules

1. **Never run `migrate:fresh` or `db:seed` against `ohdsi`** — that's production clinical data.
2. **Never run seeders on any database with real users.** The 2026-03-15 incident wiped 16 real user accounts by running `db:seed` in `deploy.sh`. See [feedback_never_run_seeders_in_deploy.md](../../../.claude/projects/-home-smudoshi-Github-Parthenon/memory/feedback_never_run_seeders_in_deploy.md).
3. **`DB_DATABASE` in `.env.testing` must not end in `_test`** — causes double-`_test` naming in parallel mode.
4. **Check for orphaned test DBs monthly** or after any killed parallel test run.
5. **Parallel tests only in CI** — non-parallel is sufficient and cleaner for local development.
6. **DBeaver connections block DROP** — close or terminate before dropping test databases.

---

## `.env.testing` Reference

```dotenv
DB_CONNECTION=pgsql
DB_HOST=pgsql.acumenus.net
DB_PORT=5432
DB_DATABASE=parthenon_testing   # NOT parthenon_test
DB_USERNAME=smudoshi
DB_PASSWORD=acumenus
DB_SEARCH_PATH=app,public
```

---

## Backup Before Dangerous Operations

Before any `migrate:fresh`, schema change on `ohdsi`, or unknown operation:

```bash
./scripts/db-backup.sh          # backs up Docker parthenon DB
pg_dump -U smudoshi ohdsi > backups/ohdsi-$(date +%Y%m%d).sql   # local ohdsi backup
```

Recovery seeds (Docker `parthenon` DB only):

```bash
php artisan admin:seed              # super-admin account
php artisan acumenus:seed-source    # Acumenus CDM data source
php artisan eunomia:seed-source     # Eunomia demo source
```
