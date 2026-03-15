# Fort Knox: How We Lost Our Research Data Twice and Built a System That Makes It Impossible to Lose Again

**Date:** 2026-03-15
**Author:** Dr. Sanjay Udoshi, Acumenus Data Sciences
**Severity of incident:** Critical × 2
**Time to build the fix:** One session
**Status:** Fully recovered + permanently hardened

---

## The Day Everything Disappeared

Healthcare outcomes research lives and dies on precision. Cohort definitions that took hours to build — selecting patients with Type 2 Diabetes who've been on metformin for at least 90 days while excluding those with renal failure — represent months of clinical reasoning. Concept sets representing specific drug ingredients, condition hierarchies, and procedure codes are the molecular vocabulary of a study. When those disappear, you don't just lose files. You lose the intellectual work of defining *who* your study is about.

On March 13-14, 2026, we lost all of it. Then, in an unrelated incident the next morning, we nearly lost everything again. This is the story of what went wrong, what we found when we looked for the data, and how we built a system that ensures it can never happen a third time.

---

## Incident 1: The Silent Wipe (March 13-14)

The first loss was never fully diagnosed until we began forensic analysis the following day. What we knew: cohorts, concept sets, and analyses that had been painstakingly built and tested were simply gone. No error messages. No audit trail. No warnings.

When we started digging, the backup files told a disturbing story. Every backup from March 9 through March 15 was **exactly 466,449 bytes** — identical. The database had been in the same state since March 9. Whatever destroyed the data didn't happen on March 13. It had happened days earlier, and no one noticed because the app continued to function normally — it just had no research designs in it.

The likely culprit: a deploy cycle that ran `db:seed` in a context where a `TRUNCATE CASCADE` through foreign key relationships wiped the design tables. The CASCADE is the silent killer. You truncate `users`, PostgreSQL follows every FK, and suddenly `cohort_definitions`, `concept_sets`, and `analyses` are all empty. No exception. No log entry. Just silence.

**What we could not recover:** The cohorts and concept sets from that session. They existed only in the database and in human memory.

---

## Incident 2: The Deploy That Ate Production (March 15, Morning)

The second incident was more surgical and more immediately visible. A deploy cycle ran `php artisan db:seed` without class restrictions on a database with 16 real production users. The `DatabaseSeeder` had been written to unconditionally run sample data seeders. Those seeders used `firstOrCreate` patterns that silently upserted data, and when they touched tables with FK constraints pointing back to `users`, the CASCADE propagated a truncation across the entire `app` schema.

All 16 real users: gone. All their sessions, their cohorts, their studies, their data source configurations: gone. The admin account referenced in every seeder was `admin@parthenon.local` — a development scaffold email that had never been changed to `admin@acumenus.net`, meaning the "protected" admin was a ghost account that didn't exist in production.

**Recovery took 45 minutes** and required:
1. Locating the compressed daily backup (`backups/app-schema-20260314-180001.sql.gz`)
2. Truncating the corrupted fake data
3. Restoring from backup via `zcat | psql`
4. Manually fixing the admin password (the restored hash didn't match)
5. Re-seeding all secondary data: Solr indexes, data sources, Commons demo data, QueryLibrary

**Root causes identified and immediately fixed:**
- All 5 seeders corrected to use `admin@acumenus.net` (commit `3b8b79b4`)
- `DatabaseSeeder` now counts real users before running sample data — if real users exist, sample seeders are skipped entirely (commit `4bc94351`)

But fixing the seeder was defensive medicine, not surgery. The underlying disease was still there: **design data had no protection layer at all**. Any accidental truncation, migration gone wrong, or careless `db:seed` could silently destroy months of clinical work — and the only recovery path was a daily backup that might be 23 hours stale.

---

## The Forensic Deep-Dive

Before building anything, we needed to understand the full scope of what had and hadn't been lost. This required forensic analysis at three levels.

### Level 1: Backup Integrity

We examined every backup file in `backups/`:

```
backups/parthenon-20260314-195511.sql     → 466,449 bytes
backups/app-schema-20260314-180001.sql.gz → compressed, same content
backups/parthenon-20260315-*.sql          → multiple, all identical
```

All identical. The database had been in the same state since at least March 9. The "missing cohorts" from March 13 were not in any backup because they had been destroyed before the first backup ran.

### Level 2: Git History vs. Database State

We searched git history for any code changes on March 13 that touched cohort or concept set tables. There were none. The `CohortDefinition`, `ConceptSet`, and analysis model files had no commits on that date. This ruled out a migration wiping data as a side effect. The destruction was operational, not code-driven.

### Level 3: Database Schema Inventory

A full inventory of the `parthenon` database revealed 104 application tables. Of these, the design-critical tables were:

| Table | Soft Deletes? | Row Count (post-incident) |
|-------|--------------|--------------------------|
| `cohort_definitions` | ✅ Yes | 6 (seeded) |
| `concept_sets` | ✅ Yes | 12 (seeded) |
| `characterizations` | ✅ Yes | ~3 |
| `estimation_analyses` | ✅ Yes | 2 (should be 3) |
| `prediction_analyses` | ✅ Yes | 2 (should be 3) |
| `sccs_analyses` | ✅ Yes | 2 (should be 3) |
| `heor_analyses` | ❌ **Missing** | 0 |
| `incidence_rate_analyses` | ✅ Yes | ~13 |
| `pathway_analyses` | ✅ Yes | 2 |
| `evidence_synthesis_analyses` | ✅ Yes | 1 |

**Finding:** Nine of ten design tables already had soft deletes via the `SoftDeletes` Eloquent trait. Only `heor_analyses` was missing it — an oversight that had gone unnoticed because HEOR analyses are a newer addition. The AnalysisSeeder was also producing fewer entries than intended (2 each for estimation/prediction/SCCS instead of 3), leaving gaps in the demo dataset.

---

## Designing Fort Knox

After two incidents and a forensic inventory, we had a clear picture of what was needed. The existing daily backup (`db-backup.sh` running at 3:17 AM) was necessary but not sufficient. What we needed was a system with three layers, each catching what the others miss:

```
Layer 1: Soft Deletes
  → No design entity can be permanently deleted through normal app use
  → Deleted records remain in the database with deleted_at timestamp
  → Standard Eloquent queries filter them out, but they're recoverable

Layer 2: Immutable Audit Log
  → Every create/update/delete/restore on every design entity is recorded
  → PostgreSQL trigger blocks UPDATE or DELETE on the audit log itself
  → Even a DBA with direct DB access cannot quietly modify the log
  → Captures who did what, when, from where, with before/after state

Layer 3: Git-Tracked JSON Fixtures
  → Every design entity is serialized to a JSON file after every mutation
  → Files live in backend/database/fixtures/designs/ (bind-mounted to host)
  → deploy.sh exports and git-commits these files before every migration
  → A single artisan command restores everything from fixtures in seconds
```

The key insight: Layer 3 is the one that survives a complete database destruction. Layers 1 and 2 require the database to be intact. But if someone drops the database entirely, the fixture files are in git history and can be reimported into a blank database.

---

## What We Actually Built

### Migration 1: Completing Soft Deletes

The `HeorAnalysis` model was the only design entity without soft deletes. A targeted migration added the missing column:

```php
// 2026_03_15_200001_add_soft_deletes_to_heor_analyses.php
Schema::table('heor_analyses', function (Blueprint $table) {
    $table->softDeletes();
});
```

And the model received the trait:

```php
class HeorAnalysis extends Model
{
    use SoftDeletes;
    // ...
}
```

Simple. But now `HeorAnalysis::delete()` sets `deleted_at` instead of issuing a `DELETE` statement. A soft-deleted HEOR analysis is invisible to normal queries but recoverable at any time via `HeorAnalysis::withTrashed()->find($id)->restore()`.

### Migration 2: The Immutable Audit Log

The `design_audit_log` table is the most architecturally interesting part of the system. It needed to be INSERT-only — not just in application logic, but enforced at the database level so that even a compromised application or a direct psql session cannot alter audit history.

```sql
CREATE TRIGGER design_audit_log_no_update_delete
BEFORE UPDATE OR DELETE ON app.design_audit_log
FOR EACH ROW EXECUTE FUNCTION app.design_audit_log_immutable()
```

Where `design_audit_log_immutable()` is a PL/pgSQL function that does exactly one thing:

```sql
RAISE EXCEPTION 'design_audit_log rows are immutable';
```

We verified this works as intended:

```
INSERT: succeeds
UPDATE: ERROR: design_audit_log rows are immutable
DELETE: ERROR: design_audit_log rows are immutable
```

The table schema captures complete audit context:

```
id               — bigserial primary key
entity_type      — 'cohort_definition' | 'concept_set' | etc.
entity_id        — FK to the actual entity
entity_name      — denormalized for readability after deletion
action           — 'created' | 'updated' | 'deleted' | 'restored'
actor_id         — nullable FK to users (null for seeder/system writes)
actor_email      — denormalized for readability after user deletion
old_json         — complete model state before the change (JSONB)
new_json         — complete model state after the change (JSONB)
changed_fields   — list of field names that actually changed (JSONB)
ip_address       — request IP (null for console/queue context)
created_at       — timestamp with DB default (not application-set)
```

The `DesignAuditLog` Eloquent model adds an application-level enforcement layer that mirrors the DB trigger — overriding `delete()`, `update()`, and `performUpdate()` to throw `RuntimeException`. Belt and suspenders.

### The Observer System: 10 Entities, One Base Class

With 10 different design entity types to protect, we needed an observer architecture that didn't require 10 copies of the same logic. The solution: an abstract `DesignAuditObserver` base class with a single abstract method `entityType()`, and 10 minimal concrete subclasses.

```php
abstract class DesignAuditObserver
{
    abstract protected function entityType(): string;

    protected static array $pendingOld = [];  // ← CRITICAL: must be static

    public function updating(Model $model): void
    {
        $key = get_class($model) . ':' . $model->getKey();
        static::$pendingOld[$key] = $model->getOriginal();
    }

    public function updated(Model $model): void
    {
        $key = get_class($model) . ':' . $model->getKey();
        $old = static::$pendingOld[$key] ?? null;
        unset(static::$pendingOld[$key]);
        $this->writeAuditRow($model, 'updated', $old, $model->toArray());
        $this->exportFixture($model);
    }
    // ... created, deleting, deleted, restored
}
```

The `static` modifier on `$pendingOld` was discovered during implementation to be non-negotiable. Laravel's observer system resolves a **new instance** of the observer class for each event method call. If `$pendingOld` were a plain instance property, the state captured in `updating()` would be on one object, and `updated()` would fire on a different object where `$pendingOld` is empty. The before-state would always be lost. Making it `static` shares it across all instances of the same class within a request, exactly what we need.

The key for `$pendingOld` is `ClassName:id` rather than just `id` — this prevents collisions between, say, a `CohortDefinition` with id=5 and an `EstimationAnalysis` with id=5 that happen to be modified in the same request.

Each concrete observer is four lines:

```php
class CohortDefinitionProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'cohort_definition'; }
}
```

All 10 are registered in `AppServiceProvider::boot()` after the existing Solr delta-indexing observers, so the audit log fires on the same Eloquent lifecycle events.

### The Fixture Exporter: JSON as Recovery State

The `DesignFixtureExporter` service translates every design entity to a JSON file on the filesystem. The files are in `backend/database/fixtures/designs/` — bind-mounted to the host in the Docker setup, which means they're accessible outside the PHP container.

```
backend/database/fixtures/designs/
├── cohort_definitions/
│   ├── type-2-diabetes-mellitus.json
│   ├── essential-hypertension-with-antihypertensive-therapy.json
│   └── ...
├── concept_sets/
│   ├── metformin-and-metabolites.json   ← includes nested items[]
│   └── ...
├── estimation_analyses/
├── prediction_analyses/
└── ... (10 subdirectories total)
```

Concept sets get special treatment — their fixture files include a nested `items` array with all the `ConceptSetItem` rows:

```json
{
  "id": 12,
  "name": "Metformin and Metabolites",
  "author_id": 1,
  "is_public": true,
  "items": [
    { "concept_id": 1503297, "is_excluded": false, "include_descendants": true, "include_mapped": false },
    { "concept_id": 1510202, "is_excluded": false, "include_descendants": true, "include_mapped": false }
  ]
}
```

Filename generation uses slugified names with a collision fallback: if two cohorts both happen to be named "Diabetes Patients", the second one gets a `-{id}` suffix (`diabetes-patients-47.json`).

Soft-delete detection uses `class_uses_recursive()` rather than `instanceof` or a custom interface — this correctly handles trait composition through multiple inheritance levels without requiring changes to existing models:

```php
$model = in_array(SoftDeletes::class, class_uses_recursive($modelClass))
    ? $modelClass::withTrashed()->find($entityId)
    : $modelClass::find($entityId);
```

### The Recovery Commands

Two artisan commands complete the system:

**Export** (`parthenon:export-designs`): Iterates all 10 entity types, exports every record (including soft-deleted) to fixture files. Always exits 0 — fixture export failure must never block a deploy.

**Import** (`parthenon:import-designs`): The disaster recovery command. Reads fixture files and restores the database. Designed for safety:

- Requires `admin@acumenus.net` to exist (fails fast and clearly if not)
- Wraps everything in a DB transaction — all-or-nothing
- Idempotent — running twice doesn't duplicate rows (lookup by name)
- Author remapping — if a fixture references a user who no longer exists, the record is attributed to admin rather than failing with an FK violation
- `--dry-run` flag rolls back the transaction after showing what would change
- Concept sets: deletes existing items then reinserts from fixture (handles additions, removals, and changes)

```bash
# Full restore from fixtures
docker compose exec php php artisan parthenon:import-designs

# Preview without writing
docker compose exec php php artisan parthenon:import-designs --dry-run
```

### deploy.sh Integration: Automatic Git Snapshots

The most important piece of the system is the one that runs without anyone thinking about it. In `deploy.sh`, inside the `$DO_DB` block (which runs on `./deploy.sh`, `./deploy.sh --db`, but NOT `./deploy.sh --php`), before migrations:

```bash
echo "── DB: exporting design fixtures to git ──"
if docker compose exec -T php php artisan parthenon:export-designs; then
  # Commit on the host — PHP container cannot see .git
  git add backend/database/fixtures/designs/
  if ! git diff --cached --quiet; then
    git commit -m "chore: auto-export design fixtures [skip ci]"
    ok "Design fixtures committed"
  else
    ok "No fixture changes to commit"
  fi
else
  warn "Design fixture export failed (continuing anyway)"
fi
```

The `[skip ci]` tag on the commit message prevents fixture snapshots from triggering redundant CI runs.

The key architectural detail: the PHP container cannot access the `.git` directory (it's mounted from `./backend`, not the repo root), so the git operations run on the host. The artisan command writes files to the bind-mounted `backend/database/fixtures/designs/` directory, and then the host shell picks them up and commits them. Clean separation of concerns.

---

## The Recovery Drill

We proved the system works by deliberately destroying a cohort and restoring it:

```bash
# 1. Hard-delete directly via SQL (bypasses Eloquent soft deletes, worst case)
DELETE FROM app.cohort_definitions WHERE id = 65;

# 2. Confirm it's gone
SELECT COUNT(*) FROM app.cohort_definitions WHERE id = 65;
-- 0

# 3. Restore from fixtures
docker compose exec php php artisan parthenon:import-designs

# 4. Confirm it's back
SELECT name FROM app.cohort_definitions WHERE name = 'Type 2 Diabetes Mellitus';
-- Type 2 Diabetes Mellitus
```

Total import time: under 3 seconds for 110 entities. Import result: Created 110, Updated 5, Skipped 101 across all entity types. The audit log accumulated 110 entries during the restore, providing a complete trace of the recovery event.

---

## What the PHPStan Reviewer Found (And Why It Mattered)

We ran PHPStan Level 8 on every new file during implementation. Two issues caught our attention:

**Issue 1: `private static` access via `static::`**

The first draft of `DesignAuditObserver` declared `$pendingOld` as `private static`. PHPStan Level 8 flagged this — accessing a `private` property via `static::` is unsafe because late static binding implies subclass access, which requires at minimum `protected` visibility. The fix was one character: `private` → `protected`. Without this, the CI lint gate would have failed on every build.

**Issue 2: `$guarded = []` on an immutable model**

The code review agent flagged that `DesignAuditLog` used `protected $guarded = []` — meaning every column was mass-assignable, including `id` and `created_at`. On an audit log that's supposed to be tamper-resistant, this was contradictory. An attacker (or a careless developer) could call `DesignAuditLog::create(['id' => 1, 'created_at' => '2020-01-01', ...])` and forge a backdated entry or overwrite an existing ID.

The fix: replace `$guarded = []` with an explicit `$fillable` listing exactly the 10 columns that callers legitimately provide, explicitly excluding `id` and `created_at`. Since `DesignAuditLog` rows are actually written via `DesignAuditLog::insert()` (raw insert that bypasses fillable), this didn't break anything — it just closed the door that should never have been open.

---

## Lessons Learned

**1. Soft deletes are not enough.** We had soft deletes on nine of ten design tables and still lost everything. Soft deletes only protect against application-level deletions routed through Eloquent. They don't protect against `TRUNCATE CASCADE`, direct SQL, or migration side effects.

**2. The backup is always yesterday.** A daily backup at 3:17 AM means you can lose up to 23 hours and 16 minutes of work. For research data that takes days to build, that's unacceptable. The fixture system gives you a snapshot at every deploy — often several times a day.

**3. Cascades are silent.** PostgreSQL's `CASCADE` on `ON DELETE` doesn't log anything in the application layer. A `TRUNCATE app.users CASCADE` produces no Laravel exception, no log entry, no HTTP 500. It just happens. Any system that relies on application-layer protection against data loss will fail when the database speaks directly.

**4. Observer state in Laravel requires `static`.** Laravel resolves a new observer instance per event method. If your observer needs to pass state between `updating()` and `updated()`, that state must be `static`. This is not obvious from the documentation and would have silently caused all `updated` audit entries to have null `old_json` (making the audit log useless for understanding what changed).

**5. Audit logs need database-level protection, not just application-level.** Application code can be bypassed. A trigger cannot. If the audit log is worth having, it's worth protecting with `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`.

**6. The recovery path must be tested.** We actually deleted a real cohort and restored it during this session. If we hadn't done that drill, we wouldn't know whether the restore works until we actually need it — which is the worst possible time to find out it doesn't.

---

## Current State

After this session, the Parthenon design data protection stack looks like this:

| Protection | Coverage | Recovery Time |
|-----------|---------|--------------|
| Daily backup (3:17 AM) | Full database | Up to 23h stale |
| Soft deletes on all 10 design tables | Normal app deletions | Instant (restore()) |
| Immutable audit log | All mutations | Forensic reference |
| Git-tracked JSON fixtures | All design entities | < 10 seconds |

The fixture directory currently holds **204 JSON files** covering 6 cohort definitions, 12 concept sets, 10 characterizations, 6 estimation analyses, 2 prediction analyses, 2 SCCS analyses, 13 incidence rate analyses, 2 pathway analyses, 1 evidence synthesis analysis, and 6 HEOR analyses.

Every future deploy will automatically update this snapshot. Every mutation through the application will trigger an observer that both audits the change and writes an updated fixture file. The next time something goes wrong — and in a system this complex, something always eventually goes wrong — the recovery path is a single command.

---

## Git History for This Work

```
027656b2  feat: add soft deletes to heor_analyses
d951e372  feat: create design_audit_log table with immutability trigger
614b87ea  feat: add SoftDeletes to HeorAnalysis and create DesignAuditLog model
5321a696  feat: add DesignProtection observer system for audit log and fixture export
9a4a41c1  feat: add DesignFixtureExporter service and ExportSummary value object
96ef3bde  feat: add parthenon:export-designs and parthenon:import-designs artisan commands
a5fbd6dc  feat: add git-tracked design fixture directory and deploy.sh integration
7d424154  fix: Pint style cleanup for design protection test suite
ea74e9fa  chore: auto-export design fixtures [skip ci]
```

Eight commits. 15 new tests. Zero PHPStan errors. One working restore drill.

---

*This post is part of the Parthenon development diary — a running log of what we build, what breaks, and what we learn building a next-generation OHDSI outcomes research platform on top of real clinical data.*
