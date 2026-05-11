# Single-Database Migration Plan

**Goal:** Unify Parthenon to one `parthenon` database with schema isolation, eliminating the multi-DB confusion that has caused repeated data-loss incidents.

**Date:** 2026-03-19

## Target Architecture

```
parthenon (single database, every environment)
├── app.*              — users, roles, cohorts, sources, studies, analyses
├── omop.*             — CDM + vocabulary (OHDSI standard name)
├── results.*          — Achilles/DQD output
├── gis.*              — geospatial tables
├── eunomia.*          — demo dataset
├── eunomia_results.*  — demo Achilles results
└── public.*           — Laravel internals (migrations, jobs, cache)
```

## Connection Strategy

**5 named connections, all same DB** (down from 7 across 2 DBs):

| Connection | Search Path | Used By |
|---|---|---|
| `pgsql` (default) | `app,public` | App models, auth, Spatie RBAC |
| `omop` | `omop,public` | CdmModel, VocabularyModel, AbbyAI, DQD |
| `results` | `results,public` | ResultsModel, AchillesResultReaderService |
| `gis` | `gis,omop,public` | GIS services |
| `eunomia` | `eunomia,public` | Eunomia demo queries |

All connections share: `DB_HOST`, `DB_PORT`, `DB_DATABASE=parthenon`, `DB_USERNAME`, `DB_PASSWORD`.

**Eliminated:** `cdm` (merged into `omop`), `vocab` (merged into `omop`), `docker_pg` (no longer needed).

## .env Simplification

```env
# Before (confusing — 15+ DB vars)
DB_HOST=pgsql.acumenus.net
DB_DATABASE=ohdsi
DB_SEARCH_PATH=app,public
CDM_DB_HOST=pgsql.acumenus.net
CDM_DB_DATABASE=ohdsi
CDM_DB_SEARCH_PATH=omop,public
VOCAB_DB_HOST=pgsql.acumenus.net
VOCAB_DB_SEARCH_PATH=omop,public
RESULTS_DB_SEARCH_PATH=achilles_results,public
GIS_DB_SEARCH_PATH=gis,omop,public,app
# ... etc

# After (clear — 5 vars)
DB_HOST=pgsql.acumenus.net
DB_PORT=5432
DB_DATABASE=parthenon
DB_USERNAME=smudoshi
DB_PASSWORD=acumenus
```

Search paths are hardcoded in `database.php` (they're structural, not per-environment). Only override via env var if a hospital has unusual schema names.

---

## Phases

### Phase 0: Backup Everything (MANDATORY FIRST)

**Do not skip this. Do not combine with other phases.**

1. Full backup of host `ohdsi` database:
   ```bash
   pg_dump -h pgsql.acumenus.net -U smudoshi -Fc ohdsi > backups/ohdsi-pre-migration-$(date +%Y%m%d).dump
   ```
2. Full backup of Docker `parthenon` database:
   ```bash
   docker compose exec postgres pg_dump -U parthenon -Fc parthenon > backups/docker-parthenon-pre-migration-$(date +%Y%m%d).dump
   ```
3. Backup current `.env` and `database.php`:
   ```bash
   cp backend/.env backups/env-pre-migration
   cp backend/config/database.php backups/database-php-pre-migration
   ```
4. **Verify backups are non-empty and restorable** before proceeding.

**Verification:** `pg_restore --list backups/ohdsi-pre-migration-*.dump | head -20` shows tables.

---

### Phase 1: Create Target Database on Host

Create the `parthenon` database on `pgsql.acumenus.net` and populate it from existing data.

1. **Create database and schemas:**
   ```sql
   -- Connect to pgsql.acumenus.net as superuser
   CREATE DATABASE parthenon OWNER smudoshi;

   -- Connect to parthenon
   \c parthenon
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS postgis;

   CREATE SCHEMA IF NOT EXISTS app;
   CREATE SCHEMA IF NOT EXISTS omop;
   CREATE SCHEMA IF NOT EXISTS results;
   CREATE SCHEMA IF NOT EXISTS gis;
   CREATE SCHEMA IF NOT EXISTS eunomia;
   CREATE SCHEMA IF NOT EXISTS eunomia_results;

   GRANT ALL ON SCHEMA app, omop, results, gis, eunomia, eunomia_results TO smudoshi;
   ```

2. **Migrate data from `ohdsi` → `parthenon`:**
   ```bash
   # Dump individual schemas from ohdsi
   pg_dump -h pgsql.acumenus.net -U smudoshi -n app ohdsi > /tmp/app_schema.sql
   pg_dump -h pgsql.acumenus.net -U smudoshi -n omop ohdsi > /tmp/omop_schema.sql
   pg_dump -h pgsql.acumenus.net -U smudoshi -n achilles_results ohdsi > /tmp/results_schema.sql
   pg_dump -h pgsql.acumenus.net -U smudoshi -n gis ohdsi > /tmp/gis_schema.sql

   # Restore into parthenon with schema renaming where needed
   psql -h pgsql.acumenus.net -U smudoshi -d parthenon < /tmp/app_schema.sql
   psql -h pgsql.acumenus.net -U smudoshi -d parthenon < /tmp/omop_schema.sql

   # achilles_results → results (schema rename)
   sed 's/achilles_results/results/g' /tmp/results_schema.sql > /tmp/results_renamed.sql
   psql -h pgsql.acumenus.net -U smudoshi -d parthenon < /tmp/results_renamed.sql

   psql -h pgsql.acumenus.net -U smudoshi -d parthenon < /tmp/gis_schema.sql
   ```

3. **Verify row counts match:**
   ```sql
   -- On ohdsi
   SELECT count(*) FROM omop.person;
   SELECT count(*) FROM omop.concept;
   SELECT count(*) FROM app.users;

   -- On parthenon (should match)
   SELECT count(*) FROM omop.person;
   SELECT count(*) FROM omop.concept;
   SELECT count(*) FROM app.users;
   ```

**Verification:** All row counts match. `parthenon` DB has all schemas with data.

---

### Phase 2: Update Laravel Configuration

Rewrite `database.php` and `.env` to point everything at `parthenon`.

**Files to change:**

1. **`backend/config/database.php`** — Rewrite connections:
   - Remove `cdm`, `vocab`, `docker_pg` connections entirely
   - Rename `pgsql` search_path from env var to hardcoded `app,public`
   - Add `omop` connection (replaces both `cdm` and `vocab`): same DB, search_path `omop,public`
   - Update `results` connection: same DB, search_path `results,public` (was `achilles_results`)
   - Update `gis` connection: same DB, search_path `gis,omop,public`
   - Update `eunomia` connection: same DB, search_path `eunomia,public`
   - All connections use same `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`

2. **`backend/.env`** — Simplify:
   ```env
   DB_CONNECTION=pgsql
   DB_HOST=pgsql.acumenus.net
   DB_PORT=5432
   DB_DATABASE=parthenon
   DB_USERNAME=smudoshi
   DB_PASSWORD=acumenus
   ```
   Remove all `CDM_DB_*`, `VOCAB_DB_*`, `RESULTS_DB_*`, `GIS_DB_*` vars.

3. **`backend/.env.example`** — Same simplification (template for new installs).

4. **`backend/.env.testing`** — Update:
   ```env
   DB_DATABASE=parthenon_testing
   ```
   (Host stays same, just database name change.)

**Verification:** `php artisan tinker` → `DB::connection()->getPdo()` succeeds. `DB::connection('omop')->select('SELECT count(*) FROM person')` returns data.

---

### Phase 3: Update All Code References

Systematic find-and-replace across the codebase. **This is the largest phase.**

#### 3a. Base Models (3 files)

| File | Change |
|---|---|
| `backend/app/Models/Cdm/CdmModel.php` | `$connection = 'cdm'` → `$connection = 'omop'` |
| `backend/app/Models/Vocabulary/VocabularyModel.php` | `$connection = 'vocab'` → `$connection = 'omop'` |
| `backend/app/Models/Results/ResultsModel.php` | No change (already `'results'`) |

#### 3b. Services (~10 files)

| File | Change |
|---|---|
| `AchillesResultReaderService.php` | `DB::connection('vocab')` → `DB::connection('omop')` |
| `DqdEngineService.php` | `DB::connection('cdm')` → `DB::connection('omop')` |
| `CdmWriterService.php` | `DB::connection('cdm')` → `DB::connection('omop')` |
| `AbbyAiService.php` | `DB::connection('vocab')` → `DB::connection('omop')` |
| `CareGapRefreshService.php` | `'cdm'` default → `'omop'` default |
| `PatientProfileService.php` | `'cdm'` default → `'omop'` default |
| `GisImportService.php` | No change (already `'gis'`) |
| `ProcessClinicalNotesJob.php` | `->table('cdm.note')` → `->table('omop.note')` or rely on search_path |

#### 3c. Controllers (~2 files)

| File | Change |
|---|---|
| `TextToSqlController.php` | `DB::connection('cdm')` → `DB::connection('omop')` |
| `HealthController.php` | No change (uses default) |

#### 3d. Artisan Commands (~3 files)

| File | Change |
|---|---|
| `SyncDatabaseCommand.php` | Remove or rewrite — `docker_pg` connection eliminated. This command may no longer be needed since there's one DB. |
| `LoadEunomiaCommand.php` | Update schema references if `vocab`/`cdm` → `omop` references exist |
| Other commands | Grep for `connection('cdm')` and `connection('vocab')` — update all to `connection('omop')` |

#### 3e. Migration Files (~35 files)

| Pattern | Change |
|---|---|
| `Schema::connection('cdm')->...` | `Schema::connection('omop')->...` |
| `Schema::connection('vocab')->...` | `Schema::connection('omop')->...` |
| `Schema::connection('results')->...` | No change |

**Approach:** `grep -rl "connection('cdm')\|connection('vocab')" backend/database/migrations/` → sed replace.

#### 3f. Dynamic Connection Factory

`AchillesResultReaderService` has dynamic `SET search_path` logic. Update:
- Static results connection search_path: `achilles_results` → `results`
- Dynamic source routing (via `connectionForSchema()`) should still work — it reads schema from `source_daimons.table_qualifier`

#### 3g. Source Daimons Data

Existing `source_daimons` rows in the database reference schema names. Update:
```sql
UPDATE app.source_daimons SET table_qualifier = 'results'
WHERE table_qualifier = 'achilles_results';
```

**Verification:**
```bash
# No remaining references to old connection/schema names
grep -r "connection('cdm')" backend/app/ backend/database/ --include="*.php" | wc -l  # should be 0
grep -r "connection('vocab')" backend/app/ backend/database/ --include="*.php" | wc -l  # should be 0
grep -r "connection('docker_pg')" backend/app/ backend/database/ --include="*.php" | wc -l  # should be 0
grep -r "'achilles_results'" backend/app/ backend/config/ --include="*.php" | wc -l  # should be 0
```

---

### Phase 4: Update Docker & Installer

#### 4a. Docker init.sql

```sql
-- docker/postgres/init.sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS omop;
CREATE SCHEMA IF NOT EXISTS results;
CREATE SCHEMA IF NOT EXISTS gis;
CREATE SCHEMA IF NOT EXISTS eunomia;
CREATE SCHEMA IF NOT EXISTS eunomia_results;

GRANT ALL ON SCHEMA app, omop, results, gis, eunomia, eunomia_results TO parthenon;
```

Note: Existing Docker volumes must be wiped for init.sql to re-run (`docker compose down -v` or delete `parthenon-pgdata`).

#### 4b. docker-compose.yml

No changes needed — database name is already `parthenon`. Just verify the postgres service config.

#### 4c. installer/bootstrap.py

Update `php artisan migrate` call — no changes needed (migrations handle schema creation). But verify the seeder references are current.

#### 4d. installer/eunomia.py

Update pg_restore target schema if it references `cdm` or `vocab`:
```python
# Was: pg_restore ... --schema=eunomia
# Still: pg_restore ... --schema=eunomia  (no change — eunomia stays eunomia)
```

#### 4e. installer/config.py

Update `.env` template to use simplified DB vars (no more CDM_DB_*, VOCAB_DB_*, etc.).

**Verification:** Fresh `docker compose down -v && docker compose up -d postgres` → schemas created correctly. `install.py` completes all phases.

---

### Phase 5: Generate DDL Snapshot

Create the "fresh install" DDL for hospitals/new environments.

1. **Use Laravel's built-in schema dump:**
   ```bash
   cd backend && php artisan schema:dump
   ```
   This creates `database/schema/pgsql-schema.sql` — a complete DDL snapshot.

2. **For multi-connection schemas**, Laravel only dumps the default connection. Generate supplemental DDL:
   ```bash
   pg_dump -h pgsql.acumenus.net -U smudoshi -s -n omop parthenon > database/schema/omop-schema.sql
   pg_dump -h pgsql.acumenus.net -U smudoshi -s -n results parthenon > database/schema/results-schema.sql
   pg_dump -h pgsql.acumenus.net -U smudoshi -s -n gis parthenon > database/schema/gis-schema.sql
   ```

3. **Update installer to use DDL snapshots** for fresh installs instead of running 100+ migrations.

**Verification:** On a clean database, `psql < pgsql-schema.sql` creates all tables. `php artisan migrate` reports nothing to migrate.

---

### Phase 6: Update deploy.sh and Verify

1. **deploy.sh changes:**
   - Update tripwire query: still `SELECT COUNT(*) FROM app.users ...` (unchanged)
   - Remove any references to `ohdsi` database
   - Backup script points to `parthenon` database

2. **scripts/db-backup.sh:**
   - Update to backup `parthenon` instead of `ohdsi`

3. **End-to-end verification:**
   - [ ] Login works (app.users accessible)
   - [ ] Vocabulary search works (omop.concept accessible)
   - [ ] Cohort generation works (omop CDM tables accessible)
   - [ ] Achilles results display (results schema accessible)
   - [ ] GIS explorer works (gis schema accessible)
   - [ ] Eunomia demo source works (eunomia schema accessible)
   - [ ] DQD runs successfully
   - [ ] Analysis execution works (R runtime can reach omop tables)
   - [ ] `php artisan migrate` on existing DB = no-op
   - [ ] Fresh Docker install completes successfully
   - [ ] `deploy.sh` completes without errors
   - [ ] `./deploy.sh --db` runs migrations cleanly

4. **Retire `ohdsi` database** (after validation period):
   - Keep `ohdsi` as read-only backup for 2 weeks
   - Then drop (or archive dump)

---

## Risk Mitigations

| Risk | Mitigation |
|---|---|
| Data loss during migration | Phase 0 backup is mandatory. Verify before proceeding. |
| Missing a code reference | Phase 3 grep verification catches stragglers. |
| Docker volume has old schemas | Must `docker compose down -v` to re-run init.sql. Document this. |
| R runtime can't find tables | R Plumber connects via JDBC — update connection string in R config. |
| Source daimons reference old schema names | SQL UPDATE in Phase 3g. |
| Hospital deployments break | Phase 5 DDL snapshot tested on clean DB. |
| Rollback needed | Restore from Phase 0 backups, revert code to pre-migration commit. |

## Execution Order

```
Phase 0 (backup) → Phase 1 (create DB + migrate data) → Phase 2 (Laravel config)
→ Phase 3 (code references) → Phase 4 (Docker/installer) → Phase 5 (DDL snapshot)
→ Phase 6 (deploy.sh + verify)
```

**Estimated scope:** ~50 files changed, ~150 line edits. Most are mechanical find-replace.

**Critical path:** Phases 0-1 are the only irreversible steps (data migration). Phases 2-6 are code changes that can be iterated.
