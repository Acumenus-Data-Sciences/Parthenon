---
slug: fort-knox-data-protection
title: "Fort Knox: How We Lost Our Research Data Twice and Built a System That Makes It Impossible to Lose Again"
authors: [mudoshi, claude]
tags: [development, data-protection, postgresql, laravel, audit-log, disaster-recovery, incident]
date: 2026-03-15
---

Healthcare outcomes research lives and dies on precision. Cohort definitions that took hours to build — selecting patients with Type 2 Diabetes on metformin for 90+ days while excluding those with renal failure — represent months of clinical reasoning. Concept sets encoding specific drug ingredients, condition hierarchies, and procedure codes are the molecular vocabulary of a study. When those disappear, you don't just lose files. You lose the intellectual work of defining *who* your study is about.

On March 13–14, 2026, we lost all of it. Then, in an unrelated incident the next morning, we nearly lost everything again.

<!-- truncate -->

<div style={{borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem'}}>
  <img src="/docs/img/acumenus.png" alt="Acumenus Data Sciences" style={{width: '100%', display: 'block'}} />
</div>

This is the story of what went wrong, what we found when we looked for the data, and how we built a system that ensures it can never happen a third time.

---

## Incident 1: The Silent Wipe (March 13–14)

The first loss was never fully diagnosed until we began forensic analysis the following day. What we knew: cohorts, concept sets, and analyses that had been painstakingly built and tested were simply gone. No error messages. No audit trail. No warnings.

When we started digging, the backup files told a disturbing story. Every backup from March 9 through March 15 was **exactly 466,449 bytes** — identical. The database had been in the same state since March 9. Whatever destroyed the data didn't happen on March 13. It had happened days earlier, and no one noticed because the app continued to function normally — it just had no research designs in it.

The likely culprit: a deploy cycle that ran `db:seed` in a context where a `TRUNCATE CASCADE` through foreign key relationships silently wiped the design tables. The CASCADE is the silent killer. You truncate `users`, PostgreSQL follows every FK, and suddenly `cohort_definitions`, `concept_sets`, and `analyses` are all empty. No exception. No log entry. Just silence.

**What we could not recover:** The cohorts and concept sets from that session. They existed only in the database and in human memory.

---

## Incident 2: The Deploy That Ate Production (March 15, Morning)

The second incident was more surgical and more immediately visible. A deploy cycle ran `php artisan db:seed` without class restrictions on a database with 16 real production users. The `DatabaseSeeder` had been written to unconditionally run sample data seeders. Those seeders used `firstOrCreate` patterns that silently upserted data, and when they touched tables with FK constraints pointing back to `users`, the CASCADE propagated a truncation across the entire `app` schema.

All 16 real users: gone. All their sessions, cohorts, studies, and data source configurations: gone. The admin account referenced in every seeder was `admin@parthenon.local` — a development scaffold email that had never been changed to `admin@acumenus.net`, meaning the "protected" admin was a ghost account that didn't exist in production.

**Recovery took 45 minutes:**
1. Located the compressed daily backup (`backups/app-schema-20260314-180001.sql.gz`)
2. Truncated the corrupted fake data
3. Restored from backup via `zcat | psql`
4. Manually fixed the admin password (the restored hash didn't match)
5. Re-seeded all secondary data: Solr indexes, data sources, Commons demo data, QueryLibrary

**Immediate fixes:**
- All 5 seeders corrected to use `admin@acumenus.net` (commit `3b8b79b4`)
- `DatabaseSeeder` now counts real users before running sample data — if real users exist, sample seeders are skipped (commit `4bc94351`)

But fixing the seeder was defensive medicine, not surgery. The underlying disease was still there: **design data had no protection layer at all**. Any accidental truncation, migration gone wrong, or careless `db:seed` could destroy months of clinical work — and the only recovery path was a daily backup that might be 23 hours stale.

---

## The Forensic Deep-Dive

Before building anything, we needed to understand the full scope of what had and hadn't been lost.

### Backup Integrity

Every backup file in `backups/` was identical — 466,449 bytes. The database had been in the same state since at least March 9. The "missing cohorts" from March 13 were not in any backup because they had been destroyed before the first backup ran after the incident.

### Database Schema Inventory

A full inventory of the `parthenon` database revealed 104 application tables. Of the design-critical tables:

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

Nine of ten design tables already had soft deletes via the Eloquent `SoftDeletes` trait. Only `heor_analyses` was missing it — an oversight that had gone unnoticed because HEOR analyses are a newer addition. We had soft deletes on nine tables and still lost everything. That told us the problem was bigger than just a missing trait.

---

## Designing Fort Knox

After two incidents and a forensic inventory, we had a clear picture of what was needed. The existing daily backup was necessary but insufficient. We needed three layers, each catching what the others miss:

```
Layer 1: Soft Deletes
  → No design entity can be permanently deleted through normal app use
  → Soft-deleted records remain in the DB with a deleted_at timestamp
  → Does NOT protect against TRUNCATE, direct SQL, or migration side effects

Layer 2: Immutable Audit Log
  → Every create/update/delete/restore on every design entity is recorded
  → PostgreSQL trigger blocks UPDATE or DELETE on the audit log itself
  → Even a DBA with direct DB access cannot quietly modify history
  → Captures who did what, when, from where, with before/after state

Layer 3: Git-Tracked JSON Fixtures
  → Every design entity serialized to a JSON file after every mutation
  → Files live in backend/database/fixtures/designs/ (bind-mounted to host)
  → deploy.sh exports and git-commits these files before every migration
  → A single artisan command restores everything in seconds
```

Layer 3 is the one that survives a complete database destruction. Layers 1 and 2 require the database to be intact. But if someone drops the database entirely, the fixture files are in git history and can be reimported into a blank database.

---

## What We Built

### Migration 1: Completing Soft Deletes

One targeted migration added `deleted_at` to `heor_analyses` and the model received the `SoftDeletes` trait. Simple — but now `HeorAnalysis::delete()` issues an `UPDATE` setting `deleted_at` rather than a `DELETE` statement. A soft-deleted HEOR analysis is invisible to normal queries but recoverable at any time via `restore()`.

### Migration 2: The Immutable Audit Log

The `design_audit_log` table needed to be INSERT-only — not just in application logic, but enforced at the database level so that even a direct psql session cannot alter audit history.

```sql
CREATE TRIGGER design_audit_log_no_update_delete
BEFORE UPDATE OR DELETE ON app.design_audit_log
FOR EACH ROW EXECUTE FUNCTION app.design_audit_log_immutable()
```

Where `design_audit_log_immutable()` does exactly one thing:

```sql
RAISE EXCEPTION 'design_audit_log rows are immutable';
```

We verified the trigger works:

```
INSERT: ✅ succeeds
UPDATE: ❌ ERROR: design_audit_log rows are immutable
DELETE: ❌ ERROR: design_audit_log rows are immutable
```

The table schema captures complete audit context: entity type and ID, entity name (denormalized for readability after deletion), action (created/updated/deleted/restored), actor ID and email (nullable for seeder/system writes), full `old_json` and `new_json` JSONB snapshots, a `changed_fields` list, request IP, and a DB-defaulted `created_at` timestamp. No `updated_at` column — that would be an oxymoron on an immutable table.

The `DesignAuditLog` Eloquent model adds application-level enforcement mirroring the DB trigger — overriding `delete()`, `update()`, and `performUpdate()` to throw `RuntimeException`. Belt and suspenders.

### The Observer System: 10 Entities, One Base Class

With 10 different design entity types to protect, we needed an observer architecture that didn't require 10 copies of the same logic. The solution: an abstract `DesignAuditObserver` base class with a single abstract method `entityType()`, and 10 minimal concrete subclasses.

```php
abstract class DesignAuditObserver
{
    abstract protected function entityType(): string;

    protected static array $pendingOld = [];  // ← must be static — see below

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
    // created, deleting, deleted, restored ...
}
```

The `static` modifier on `$pendingOld` was discovered during implementation to be non-negotiable. **Laravel's observer system resolves a new instance of the observer class for each event method call.** If `$pendingOld` were a plain instance property, the state captured in `updating()` would be on one object, and `updated()` would fire on a different object where `$pendingOld` is empty. The before-state would always be null — making the audit log useless for tracking what actually changed.

The key for `$pendingOld` is `ClassName:id` rather than just `id` — this prevents collisions between, say, a `CohortDefinition` with id=5 and an `EstimationAnalysis` with id=5 modified in the same request.

Each concrete observer is four lines:

```php
class CohortDefinitionProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'cohort_definition'; }
}
```

### Git-Tracked Fixtures: JSON as Recovery State

The `DesignFixtureExporter` service translates every design entity to a JSON file on the filesystem at `backend/database/fixtures/designs/`. The directory is bind-mounted to the host in Docker, so it's accessible outside the PHP container.

Concept sets include a nested `items` array:

```json
{
  "id": 12,
  "name": "Metformin and Metabolites",
  "items": [
    { "concept_id": 1503297, "is_excluded": false, "include_descendants": true, "include_mapped": false },
    { "concept_id": 1510202, "is_excluded": false, "include_descendants": true, "include_mapped": false }
  ]
}
```

Soft-delete detection uses `class_uses_recursive()` to handle trait composition correctly without requiring changes to existing models:

```php
$model = in_array(SoftDeletes::class, class_uses_recursive($modelClass))
    ? $modelClass::withTrashed()->find($entityId)
    : $modelClass::find($entityId);
```

### The Recovery Commands

```bash
# Restore all design entities from fixtures (disaster recovery)
docker compose exec php php artisan parthenon:import-designs

# Preview what would change without writing
docker compose exec php php artisan parthenon:import-designs --dry-run

# Re-export current state to fixtures
docker compose exec php php artisan parthenon:export-designs
```

The import command is designed for safety: it requires `admin@acumenus.net` to exist (fails fast if not), wraps everything in a DB transaction, is idempotent (running twice doesn't duplicate rows), remaps missing authors to admin rather than failing on FK violations, and handles concept set items via delete-then-reinsert.

### deploy.sh: Automatic Git Snapshots

The most important piece of the system is the one that runs without anyone thinking about it. Inside the `$DO_DB` block of `deploy.sh`, before migrations:

```bash
echo "── DB: exporting design fixtures to git ──"
if docker compose exec -T php php artisan parthenon:export-designs; then
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

The PHP container can't access `.git` (it mounts `./backend`, not the repo root), so the artisan command writes fixture files to the bind-mounted directory and the host shell picks them up and commits them. Clean separation. The `[skip ci]` tag prevents fixture commits from triggering redundant CI runs.

---

## The Recovery Drill

We proved the system works by deliberately destroying a cohort and restoring it:

```bash
# Hard-delete directly via SQL — bypasses Eloquent soft deletes entirely
DELETE FROM app.cohort_definitions WHERE id = 65;

# Confirm it's gone
SELECT COUNT(*) FROM app.cohort_definitions WHERE id = 65;
-- 0

# Restore from fixtures
docker compose exec php php artisan parthenon:import-designs

# Confirm it's back
SELECT name FROM app.cohort_definitions WHERE name = 'Type 2 Diabetes Mellitus';
-- Type 2 Diabetes Mellitus
```

Total import time: under 3 seconds for 110 entities. The audit log accumulated 110 entries during the restore — a complete trace of the recovery event.

---

## What the Code Reviewer Found

We ran PHPStan Level 8 and a dedicated code review agent on every new file. Two issues came back as blocking:

**`private static` access via `static::`**

The first draft declared `$pendingOld` as `private static`. PHPStan Level 8 flagged this — accessing a `private` property via `static::` is unsafe because late static binding implies subclass access, which requires at minimum `protected` visibility. The fix was one character. Without it, the CI lint gate would fail on every build.

**`$guarded = []` on an immutable model**

The `DesignAuditLog` model used `protected $guarded = []` — every column mass-assignable, including `id` and `created_at`. On an audit log that's supposed to be tamper-resistant, this is contradictory. A developer could call `DesignAuditLog::create(['id' => 1, 'created_at' => '2020-01-01', ...])` and forge a backdated entry.

The fix: replace `$guarded = []` with an explicit `$fillable` listing exactly the 10 columns that callers legitimately provide, excluding `id` and `created_at`. Since audit rows are written via `DesignAuditLog::insert()` (which bypasses fillable entirely), this changed nothing functionally — it just closed a door that should never have been open.

---

## Lessons Learned

**1. Soft deletes are not enough.** We had them on nine of ten design tables and still lost everything. Soft deletes only protect against application-level deletions routed through Eloquent. They don't protect against `TRUNCATE CASCADE`, direct SQL, or migration side effects.

**2. The backup is always yesterday.** A daily backup at 3:17 AM means you can lose up to 23 hours and 16 minutes of work. For research data that takes days to build, that's unacceptable. The fixture system gives you a snapshot at every deploy.

**3. Cascades are silent.** PostgreSQL's `CASCADE` on `ON DELETE` doesn't log anything in the application layer. A `TRUNCATE app.users CASCADE` produces no Laravel exception, no log entry, no HTTP 500. Any system that relies on application-layer protection against data loss will fail when the database speaks directly.

**4. Observer state in Laravel requires `static`.** Laravel resolves a new observer instance per event method. If your observer needs to pass state between `updating()` and `updated()`, that state must be `static`. This is not documented prominently and would have silently caused all `updated` audit entries to have null `old_json`.

**5. Audit logs need database-level protection.** Application code can be bypassed. A trigger cannot. If the audit log is worth having, it's worth protecting with `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`.

**6. Test the recovery path.** We actually deleted a real cohort and restored it during this session. If we hadn't done that drill, we wouldn't know whether the restore works until we actually needed it — the worst possible time to find out it doesn't.

---

## Current State

| Protection | What it covers | Recovery time |
|-----------|---------------|--------------|
| Daily backup (3:17 AM) | Full database | Up to 23h stale |
| Soft deletes on all 10 design tables | Normal app deletions | Instant (`restore()`) |
| Immutable audit log | All mutations | Forensic reference |
| Git-tracked JSON fixtures | All design entities | < 10 seconds |

The fixture directory currently holds **204 JSON files** across 10 subdirectories. Every future deploy will automatically update this snapshot. Every mutation through the application will trigger an observer that both audits the change and writes an updated fixture file.

---

*This post is part of the Parthenon development diary — a running log of what we build, what breaks, and what we learn building a next-generation OHDSI outcomes research platform on top of real clinical data.*
