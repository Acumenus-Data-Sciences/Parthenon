# Design Data Protection — Fort Knox System

**Date:** 2026-03-15
**Status:** Approved (rev 2 — reviewer issues resolved 2026-03-15)
**Author:** Dr. Sanjay Udoshi, Acumenus Data Sciences

---

## Context

Parthenon is a Laravel 11 / React 19 / PostgreSQL healthcare research platform. Users build OHDSI-style cohort definitions, concept sets, and analyses (estimation, prediction, SCCS, characterization, incidence rate, pathways, evidence synthesis, HEOR) through a UI. The data for these user-created designs lives in Docker PostgreSQL (the `parthenon` database, `app` schema).

Twice in two days the database was wiped and user-created designs were lost. This spec defines a three-layer protection system (referred to as the Fort Knox system) that ensures no design artifact can be permanently destroyed by a database operation, a bad migration, a `migrate:fresh`, or an accidental `db:seed`.

---

## What Already Exists — Do Not Redesign

The following protections are already in place and are outside the scope of this spec:

- **Soft deletes** are already implemented on all core design tables:
  - `app.cohort_definitions`
  - `app.concept_sets`
  - `app.characterizations`
  - `app.estimation_analyses`
  - `app.prediction_analyses`
  - `app.sccs_analyses`
  - `app.incidence_rate_analyses`
  - `app.pathway_analyses`
  - `app.evidence_synthesis_analyses`
  - `app.feature_analyses`
- **Hourly database backup script** at `scripts/backup-app-db.sh` dumps Docker PostgreSQL to `backups/` every hour via cron.
- **Pre-migration backup** in `deploy.sh` runs before any migration step.

This spec adds what is missing on top of these existing protections.

---

## What Is Missing — Scope of This Spec

1. `app.heor_analyses` has no `deleted_at` column yet.
2. No immutable audit log exists — there is no record of who changed what and when.
3. No git-tracked JSON fixture export exists — there is no way to restore designs from source control after a complete database wipe.

---

## Layer 1 — Soft Delete Completion

### Problem

`heor_analyses` is the only design table without soft delete protection. A `DELETE` query against this table permanently removes rows. Every other design table already has `deleted_at`, making this an inconsistency that creates a silent vulnerability.

### Solution

Add a single migration that adds `deleted_at` to `heor_analyses`, and add the `SoftDeletes` trait to the `HeorAnalysis` Eloquent model. Nothing else changes.

### Migration

Note: all Parthenon migrations use bare table names and rely on `search_path=app,public` on the connection. Do NOT use `app.heor_analyses` — use `heor_analyses`.

```php
// database/migrations/2026_03_15_000001_add_soft_deletes_to_heor_analyses.php

Schema::table('heor_analyses', function (Blueprint $table) {
    $table->softDeletes();
});
```

### Model Change

Add `use SoftDeletes;` to `app/Models/App/HeorAnalysis.php`. The model already exists — this is a one-line addition.

### Scope Boundary

No other table is touched. No other model is changed. This layer is purely additive.

---

## Layer 2 — Immutable Design Audit Log

### Problem

Even with soft deletes, there is no record of who made what change and when. If a record is soft-deleted, restored, or modified, there is no audit trail. There is no way to know what the entity looked like before a change, or to reconstruct state from a sequence of events.

### Solution

Create a new `app.design_audit_log` table. This table is INSERT-only by convention. No row is ever updated or deleted. Model observers on all 10 design models write a row on every create, update, delete, and restore event.

### Table Schema

```sql
CREATE TABLE app.design_audit_log (
    id            bigserial PRIMARY KEY,
    entity_type   varchar(50)  NOT NULL,
    entity_id     bigint       NOT NULL,
    entity_name   varchar(500) NOT NULL,
    action        varchar(20)  NOT NULL,
    actor_id      bigint       NULL REFERENCES app.users(id) ON DELETE SET NULL,
    actor_email   varchar(255) NULL,
    old_json      jsonb        NULL,
    new_json      jsonb        NULL,
    changed_fields jsonb       NULL,
    ip_address    varchar(45)  NULL,
    created_at    timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX design_audit_log_entity_idx ON app.design_audit_log (entity_type, entity_id);
CREATE INDEX design_audit_log_actor_idx  ON app.design_audit_log (actor_id);
CREATE INDEX design_audit_log_action_idx ON app.design_audit_log (action);
CREATE INDEX design_audit_log_created_idx ON app.design_audit_log (created_at);
```

### Column Definitions

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint PK | Auto-increment, never reused |
| `entity_type` | varchar(50) | One of the 10 values listed below |
| `entity_id` | bigint | The ID of the changed entity |
| `entity_name` | varchar(500) | Denormalized name — readable even after entity deletion |
| `action` | varchar(20) | One of: `created`, `updated`, `deleted`, `restored` |
| `actor_id` | bigint nullable | FK to `app.users`. Null for seeder/system/CLI changes |
| `actor_email` | varchar(255) nullable | Denormalized — readable even after user deletion |
| `old_json` | jsonb nullable | Full entity state before the change. Null for `created`. |
| `new_json` | jsonb nullable | Full entity state after the change. Null for `deleted`. |
| `changed_fields` | jsonb nullable | Array of field names where old and new values differ. Null for `created` and `deleted`. |
| `ip_address` | varchar(45) nullable | IPv4 or IPv6. Null for CLI/queue/system changes. |
| `created_at` | timestamp | Row creation time. Set once, never changed. |

**There is no `updated_at` column.** Rows are immutable. The absence of `updated_at` is intentional and enforced at the application level.

### Valid `entity_type` Values

```
cohort_definition
concept_set
estimation_analysis
characterization
incidence_rate_analysis
pathway_analysis
prediction_analysis
sccs_analysis
evidence_synthesis_analysis
heor_analysis
```

### Valid `action` Values

```
created
updated
deleted
restored
```

### Immutability Rules

- Rows are **INSERT-only**. Application code must never call `UPDATE` or `DELETE` on this table.
- The table has **no `deleted_at` column** — it cannot be soft-deleted.
- No `TRUNCATE` is permitted on this table in any migration or script.
- The Laravel model for `DesignAuditLog` must override `delete()` and `update()` to throw a `\RuntimeException` with the message `"Design audit log is immutable"`. This is a belt-and-suspenders guard against accidental misuse.
- Database-level enforcement: consider a PostgreSQL trigger that raises an exception on any `UPDATE` or `DELETE` against this table. Include this trigger in the migration.

### Migration

```php
// database/migrations/2026_03_15_000002_create_design_audit_log_table.php
// Note: use bare table name, rely on search_path=app,public

Schema::create('design_audit_log', function (Blueprint $table) {
    $table->id();
    $table->string('entity_type', 50);
    $table->unsignedBigInteger('entity_id');
    $table->string('entity_name', 500);
    $table->string('action', 20);
    $table->unsignedBigInteger('actor_id')->nullable();
    $table->string('actor_email', 255)->nullable();
    $table->jsonb('old_json')->nullable();
    $table->jsonb('new_json')->nullable();
    $table->jsonb('changed_fields')->nullable();
    $table->string('ip_address', 45)->nullable();
    $table->timestamp('created_at')->useCurrent();
    // NO updated_at — this table is immutable
});

// Add FK (uses search_path so schema prefix not needed)
DB::statement('ALTER TABLE app.design_audit_log ADD CONSTRAINT fk_dal_actor
    FOREIGN KEY (actor_id) REFERENCES app.users(id) ON DELETE SET NULL');

// Immutability trigger (schema-qualified function name to avoid search_path ambiguity)
DB::statement("
    CREATE OR REPLACE FUNCTION app.design_audit_log_immutable()
    RETURNS trigger LANGUAGE plpgsql AS \$\$
    BEGIN
        RAISE EXCEPTION 'design_audit_log rows are immutable';
    END;
    \$\$
");
DB::statement("
    CREATE TRIGGER design_audit_log_no_update_delete
    BEFORE UPDATE OR DELETE ON app.design_audit_log
    FOR EACH ROW EXECUTE FUNCTION app.design_audit_log_immutable()
");

// Indexes
DB::statement('CREATE INDEX design_audit_log_entity_idx  ON app.design_audit_log (entity_type, entity_id)');
DB::statement('CREATE INDEX design_audit_log_actor_idx   ON app.design_audit_log (actor_id)');
DB::statement('CREATE INDEX design_audit_log_action_idx  ON app.design_audit_log (action)');
DB::statement('CREATE INDEX design_audit_log_created_idx ON app.design_audit_log (created_at)');
```

### Observer Architecture

A shared abstract base observer (`DesignAuditObserver`) handles the common logic. Each of the 10 design models gets its own concrete observer class that extends the base and provides the `entityType()` string.

**File location:** `app/Observers/` — one file per observer.

**Abstract base: `app/Observers/DesignAuditObserver.php`**

The base observer implements:

- `creating(Model $model)` — captures nothing (entity does not exist yet)
- `created(Model $model)` — writes a `created` row with `old_json=null`, `new_json=full entity`
- `updating(Model $model)` — captures `old_json` from `$model->getOriginal()` before the write
- `updated(Model $model)` — writes an `updated` row with `old_json` (captured in `updating`), `new_json=full entity`, `changed_fields=computed diff`
- `deleting(Model $model)` — captures `old_json` if soft delete
- `deleted(Model $model)` — writes a `deleted` row with `old_json=full entity`, `new_json=null`
- `restoring(Model $model)` — captures state before restore
- `restored(Model $model)` — writes a `restored` row

**Capturing old state across the updating/updated boundary:**

The observer must stash `old_json` during `updating` so it is available during `updated`. Key the stash on the class AND primary key to avoid collisions between different entity types that share the same integer ID. Use a finally-block to clean up even on rollback:

```php
private array $pendingOld = [];

public function updating(Model $model): void
{
    $key = get_class($model) . ':' . $model->getKey();
    $this->pendingOld[$key] = $model->getOriginal();
}

public function updated(Model $model): void
{
    $key = get_class($model) . ':' . $model->getKey();
    $old = $this->pendingOld[$key] ?? null;
    unset($this->pendingOld[$key]);
    // compute changed_fields, write audit row
}
```

Note: do NOT register observers as singletons. The standard `Model::observe(ClassName::class)` registration in `AppServiceProvider::boot()` is correct. Singleton registration would cause `$pendingOld` to leak across requests.

**Computing `changed_fields`:**

```php
private function computeChangedFields(?array $old, ?array $new): ?array
{
    if ($old === null || $new === null) {
        return null;
    }
    $allKeys = array_unique(array_merge(array_keys($old), array_keys($new)));
    $changed = [];
    foreach ($allKeys as $key) {
        if (($old[$key] ?? null) !== ($new[$key] ?? null)) {
            $changed[] = $key;
        }
    }
    return $changed ?: null;
}
```

**Capturing actor:**

```php
private function captureActor(): array
{
    $user = auth()->user();
    return [
        'actor_id'    => $user?->id,
        'actor_email' => $user?->email,
    ];
}
```

**Capturing IP address:**

```php
private function captureIp(): ?string
{
    if (app()->runningInConsole()) {
        return null;
    }
    return request()->ip();
}
```

**Concrete observer example — `CohortDefinitionObserver`:**

```php
class CohortDefinitionObserver extends DesignAuditObserver
{
    protected function entityType(): string
    {
        return 'cohort_definition';
    }
}
```

**Observer registration** in `app/Providers/AppServiceProvider.php`:

```php
CohortDefinition::observe(CohortDefinitionObserver::class);
ConceptSet::observe(ConceptSetObserver::class);
Characterization::observe(CharacterizationObserver::class);
EstimationAnalysis::observe(EstimationAnalysisObserver::class);
PredictionAnalysis::observe(PredictionAnalysisObserver::class);
SccsAnalysis::observe(SccsAnalysisObserver::class);
IncidenceRateAnalysis::observe(IncidenceRateAnalysisObserver::class);
PathwayAnalysis::observe(PathwayAnalysisObserver::class);
EvidenceSynthesisAnalysis::observe(EvidenceSynthesisAnalysisObserver::class);
HeorAnalysis::observe(HeorAnalysisObserver::class);
```

### DesignAuditLog Eloquent Model

Located at `app/Models/App/DesignAuditLog.php`.

```php
class DesignAuditLog extends Model
{
    public $timestamps = false; // only created_at, set by DB default
    protected $table = 'app.design_audit_log';
    protected $guarded = [];

    protected $casts = [
        'old_json'       => 'array',
        'new_json'       => 'array',
        'changed_fields' => 'array',
        'created_at'     => 'datetime',
    ];

    public function delete(): bool|null
    {
        throw new \RuntimeException('Design audit log is immutable');
    }

    public function update(array $attributes = [], array $options = []): bool
    {
        throw new \RuntimeException('Design audit log is immutable');
    }

    /** Override lower-level hook used by Eloquent internally */
    protected function performUpdate(Builder $query): bool
    {
        throw new \RuntimeException('Design audit log is immutable');
    }
}
```

---

## Layer 3 — Git-Tracked JSON Fixture Export

### Problem

Even with soft deletes and an audit log, a complete database wipe (e.g., `migrate:fresh`, Docker volume deletion, accidental `DROP SCHEMA app CASCADE`) destroys all data. Backups exist but require DBA-level access to restore. Researchers need a path to recovery that any developer can execute from the git repository alone.

### Solution

Export all design entities to versioned JSON files committed into the git repository. The files live in `backend/database/fixtures/designs/`. If the database is wiped, one artisan command restores everything from these files.

### Directory Structure

```
backend/database/fixtures/designs/
  cohort_definitions/
    type-2-diabetes-mellitus.json
    essential-hypertension-with-antihypertensive-therapy.json
    acute-myocardial-infarction-first-occurrence.json
    ...
  concept_sets/
    type-2-diabetes-conditions.json
    antihypertensive-medications.json
    ...
  characterizations/
    t2dm-patient-characterization.json
    ...
  estimation_analyses/
    warfarin-vs-dabigatran-gi-bleed-risk.json
    ...
  prediction_analyses/
    30-day-readmission-after-ami.json
    ...
  sccs_analyses/
    influenza-vaccine-and-gi-events.json
    ...
  incidence_rate_analyses/
    t2dm-incidence-2010-2020.json
    ...
  pathway_analyses/
    treatment-pathways-type-2-diabetes.json
    ...
  evidence_synthesis_analyses/
    meta-analysis-ace-inhibitors-renal-outcomes.json
    ...
  heor_analyses/
    cost-effectiveness-glp1-vs-sglt2.json
    ...
```

### File Naming Convention

The filename is the slug of the entity name: lowercase, spaces replaced with hyphens, non-alphanumeric characters removed, truncated to 100 characters, `.json` extension appended.

Collision safety: if two entities produce the same slug (e.g., two cohorts both named "Type 2 Diabetes"), the second file appends `-{id}` before the extension: `type-2-diabetes-{id}.json`. The first file (lower ID) is never renamed.

Slugging function:

```php
private function slugify(string $name, int $id, string $entityType, int $maxLength = 100): string
{
    // Guard: blank or whitespace-only name
    $name = trim($name);
    if ($name === '') {
        return "{$entityType}-{$id}";
    }

    $slug = strtolower($name);
    $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
    $slug = preg_replace('/[\s-]+/', '-', $slug);
    $slug = trim($slug, '-');
    $slug = substr($slug, 0, $maxLength);

    // Guard: slug became empty after stripping (e.g. name was all special chars)
    if ($slug === '') {
        return "{$entityType}-{$id}";
    }

    return $slug;
}
```

### File Contents

Each JSON file contains the full entity as a single JSON object (all columns). The following entity types include additional nested data:

**heor_analyses** — the top-level `heor_analyses` row is exported. Child rows (`heor_scenarios`, `heor_cost_parameters`, `heor_results`, `heor_value_contracts`) are NOT included. A HEOR fixture restores a shell (name, type, configuration) but not the cost parameters or scenario results. Full HEOR recovery requires the hourly database backup. This is a known gap documented in the Known Gaps section.

**concept_sets** — include related `concept_set_items` rows as a nested array under the key `"items"`:
```json
{
  "id": 42,
  "name": "Type 2 Diabetes Conditions",
  "description": "...",
  "expression_json": {...},
  "created_at": "...",
  "updated_at": "...",
  "deleted_at": null,
  "items": [
    { "id": 101, "concept_set_id": 42, "concept_id": 201826, "is_excluded": false, ... },
    ...
  ]
}
```

**cohort_definitions** — `expression_json` is already a column on the table; no special handling needed. It is included inline as a JSON object (not a string).

**All analysis types** — `design_json` is already a column on each analysis table; it is included inline as a JSON object.

### Service: `DesignFixtureExporter`

Located at `app/Services/DesignProtection/DesignFixtureExporter.php`.

Responsibilities:
- Write a fixture file for a given entity after create or update.
- Delete a fixture file for a given entity after hard delete (soft delete does NOT remove the file — the file remains and reflects the entity with `deleted_at` set).
- Resolve the correct filename for an entity (with collision detection).
- Provide a `exportAll()` method that iterates every design table and writes all files.

The service is injected into the model observers and into the export artisan command.

**Key method signatures:**

```php
public function exportEntity(string $entityType, int $entityId): void;
public function deleteEntityFile(string $entityType, int $entityId): void;
public function exportAll(): ExportSummary;
```

**`ExportSummary`** is a readonly value object (immutable per project coding standards):

```php
final class ExportSummary
{
    public function __construct(
        public readonly int $written,
        public readonly int $deleted,
        public readonly array $errors,
    ) {}

    public function withWritten(int $written): self
    {
        return new self($written, $this->deleted, $this->errors);
    }

    public function withDeleted(int $deleted): self
    {
        return new self($this->written, $deleted, $this->errors);
    }

    public function withError(string $error): self
    {
        return new self($this->written, $this->deleted, [...$this->errors, $error]);
    }
}
```

**Error handling in the observer context:**

When the fixture exporter is called from an observer (synchronous, in the middle of a DB transaction), any exception thrown by the exporter must NOT cause the DB write to fail. The observer wraps the exporter call in a try/catch and logs a warning on failure:

```php
try {
    $this->exporter->exportEntity($this->entityType(), $model->getKey());
} catch (\Throwable $e) {
    Log::warning('DesignFixtureExporter failed', [
        'entity_type' => $this->entityType(),
        'entity_id'   => $model->getKey(),
        'error'       => $e->getMessage(),
    ]);
}
```

The DB write always succeeds. The fixture export is best-effort from the observer.

### Command: `parthenon:export-designs`

Located at `app/Console/Commands/ExportDesigns.php`.

**Signature:** `parthenon:export-designs`

**Behavior:**
1. Calls `DesignFixtureExporter::exportAll()`.
2. Prints a summary: `Exported N files (X written, Y deleted, Z errors)`.
3. Exits 0 always (defensive — export failure should never break a deploy).

**No `--commit` flag.** The artisan command only writes files. It does NOT run git. The PHP container does not have access to the `.git` directory (only `./backend` is mounted), so git operations would always fail with `fatal: not a git repository`. The git commit step belongs in `deploy.sh` on the host, as described below.

**Safe to run anytime.** Running it repeatedly is idempotent — files are overwritten with current state.

### Command: `parthenon:import-designs`

Located at `app/Console/Commands/ImportDesigns.php`.

**Signature:** `parthenon:import-designs {--dry-run : Show what would be imported without writing}`

**Behavior:**
1. Verifies that `admin@acumenus.net` exists in `app.users`. If not, exits with a clear message: `Admin user admin@acumenus.net not found. Run: php artisan admin:seed`. Captures this user's `id` as `$adminId` for author remapping (see below).
2. Wraps all DB writes in a single transaction. If any entity fails mid-import, the entire import is rolled back and the command exits with an error. The database is never left in a partially-restored state.
3. Iterates every JSON file in `backend/database/fixtures/designs/` in directory order (entity type, then filename).
4. For each file:
   - Reads the JSON.
   - Determines the entity type from the subdirectory name.
   - **Author remapping:** If `author_id` (or `created_by`) in the fixture refers to a user ID that does not exist in the current `app.users` table, substitute `$adminId`. This prevents FK violations when original researchers' accounts don't exist after a wipe.
   - **Upsert by name:** Uses `Model::where('name', $data['name'])->first()` to check existence. If found, updates the row. If not found, creates a new row. Does NOT force the original `id` — new IDs are assigned by sequence.
   - **Concept sets only:** After upserting the concept set row, delete all existing items for the new `concept_set_id`, then re-insert the `"items"` array fresh. This is simpler and more reliable than per-row upsert against a column pair without a unique index.
   - Tracks: created, updated, skipped (unchanged) per entity type.
5. Prints a summary table:

```
Entity Type                  Created  Updated  Skipped
cohort_definitions                 5        0        0
concept_sets                       3        0        0
characterizations                  2        0        0
estimation_analyses                1        0        0
...
Total                             11        0        0
```

6. If `--dry-run` is passed, the transaction is opened and all reads/comparisons run, but a `DB::rollBack()` is called at the end regardless. The summary shows what would have happened.

**Idempotency guarantee:** Running `parthenon:import-designs` multiple times produces the same result. The second run finds all entities by name and updates them with identical data — net change zero.

**ID handling:** The command does NOT attempt to preserve original ID values. After a DB wipe and `migrate:fresh`, sequences are reset to 1. Forcing old IDs risks sequence corruption. The `name`-keyed lookup assigns new IDs from the sequence. This means any foreign-key references between design tables (e.g., a characterization referencing a cohort by ID in its `design_json`) are stored as denormalized data within the JSON blob and are not affected by ID remapping at the DB level. This is a known limitation, documented in the Known Gaps section.

---

## Restore Procedure (After a Complete DB Wipe)

These commands must be run in this exact order after a complete DB wipe (e.g., `docker compose down -v`, Docker volume deletion, or `migrate:fresh`):

```bash
# 1. Run all migrations to recreate the schema
#    (migrate:fresh already does this; if using fresh: skip and go to step 2)
php artisan migrate

# 2. Recreate the admin user (required before import — import needs admin@acumenus.net)
php artisan admin:seed

# 3. Recreate data sources (Acumenus CDM + Eunomia demo connections)
php artisan acumenus:seed-source

# 4. Restore all user-created designs from git fixtures
php artisan parthenon:import-designs

# 5. Only if fixtures/designs/ is empty (first install before any export has run)
php artisan db:seed --class=AnalysisSeeder
```

**Result:** All cohort definitions, concept sets, and analyses restored from git. No manual recreation needed. The audit log starts fresh (it cannot be restored from fixtures by design — it is a historical record, not a source of truth for current state).

---

## deploy.sh Integration

Add the following block **inside the `if $DO_DB; then` conditional, immediately before the `php artisan migrate` call**. It must be inside `$DO_DB` so it only runs when `./deploy.sh`, `./deploy.sh --db`, or `./deploy.sh` (full) is invoked — NOT on `./deploy.sh --php` or `./deploy.sh --frontend` (which have no reason to export designs).

```bash
# Export design fixtures BEFORE any migration (captures state before potentially destructive schema changes)
echo "→ Exporting design fixtures..."
docker compose exec -T php php artisan parthenon:export-designs
# Commit exported files on the HOST (not inside the container — .git is not mounted there)
git add backend/database/fixtures/designs/
if ! git diff --cached --quiet; then
    git commit -m "chore: auto-export design fixtures [skip ci]"
    echo "  ✓ Fixture changes committed"
else
    echo "  ✓ No fixture changes"
fi
```

This placement is critical. The export runs against the current database state before any migration touches the schema. If a migration is destructive (e.g., drops a column or table), the fixtures captured the data beforehand.

**Why git runs on the host, not inside the container:** The PHP container mounts only `./backend` to `/var/www/html`. The `.git` directory is at the repo root and is NOT mounted into the container. Running `git` inside the container always fails with `fatal: not a git repository`. The artisan command writes files to the bind-mounted `./backend/database/fixtures/designs/`, which is visible on the host immediately. The host then runs `git add/commit`.

**Why `git add` only the fixtures directory:** Scoping the `git add` to `backend/database/fixtures/designs/` prevents any developer-staged or modified files from accidentally being swept into the auto-commit. Only fixture files change in this commit.

---

## What This Does NOT Protect

These known gaps are acknowledged and documented here. They are addressed (where possible) by the existing hourly backup in `scripts/backup-app-db.sh`.

**Analysis execution results** — The 16+ R-runtime analysis runs are stored as `result_json` in `app.analysis_executions`. These rows can be large (megabytes of JSON per run) and are not exported to fixtures. Recovery of execution results requires the hourly database backup in `backups/`. These are reproducible by re-running the analysis against the CDM, though re-running may take hours.

**In-flight queue jobs** — If a Horizon worker is killed mid-analysis, the result is lost. The job will be retried according to the queue retry policy, but partial computation is not recoverable. This is not addressed by this spec.

**Fixture export failure from observer** — The fixture export triggered from an Eloquent observer is synchronous. If the disk is full, the git workspace is read-only, or the `fixtures/designs/` directory is not writable, the export silently fails. A `Log::warning()` is emitted but the database write succeeds. The next `deploy.sh` run will catch up any missed exports via the full `parthenon:export-designs` sweep.

**Large expression_json / design_json** — Some cohort definitions and analysis designs contain very large JSON blobs. These are committed to git in full. Over time the repository may grow significantly. This is accepted as the cost of git-based recovery. Consider `.gitattributes` LFS configuration for files over 1MB in a future iteration.

**ID-referenced cross-entity relationships in import** — The import command keys on `name`, not `id`. If entity A references entity B by integer ID (e.g., a characterization references a cohort by ID), the restored IDs will differ from the original. The import command does not resolve these cross-references. This is a known limitation and must be addressed if the data model adds explicit foreign keys between design tables.

**HEOR child rows not in fixtures** — `heor_scenarios`, `heor_cost_parameters`, `heor_results`, and `heor_value_contracts` are not exported. HEOR fixture recovery restores only the top-level analysis shell. Full HEOR recovery requires the hourly database backup.

---

## Implementation Order

Complete these steps in order. Each step is independently deployable except where noted.

1. **Migration:** Add `deleted_at` to `heor_analyses` (`2026_03_15_000001`).
2. **Migration:** Create `design_audit_log` table with immutability trigger (`2026_03_15_000002`).
3. **Model:** Add `SoftDeletes` trait to `app/Models/App/HeorAnalysis.php`.
4. **Model:** Create `app/Models/App/DesignAuditLog.php` with delete/update guards.
5. **Observers:** Create `app/Observers/DesignAuditObserver.php` (abstract base). Create the 10 concrete observer classes. Register all observers in `AppServiceProvider`.
6. **Service:** Create `app/Services/DesignProtection/DesignFixtureExporter.php`.
7. **Command:** Create `app/Console/Commands/ExportDesigns.php` (`parthenon:export-designs`).
8. **Command:** Create `app/Console/Commands/ImportDesigns.php` (`parthenon:import-designs`).
9. **deploy.sh:** Add `parthenon:export-designs --commit` before the migration step.
10. **Initial export:** Run `php artisan parthenon:export-designs --commit` to seed the fixture files into git for the first time.

Steps 1–4 can be deployed as a single PR. Steps 5–10 should follow as a second PR after the first is confirmed working.

---

## Decision Log

### Why Layer 1 (Soft Deletes on heor_analyses)?

**Failure mode protected:** A developer or admin runs a direct `DELETE FROM app.heor_analyses` or a Laravel `HeorAnalysis::destroy()` call. Without soft deletes, the row is gone permanently. With soft deletes, `deleted_at` is set and the row is recoverable with `withTrashed()`.

**Why not redesign existing soft deletes?** They already work correctly on 9 of 10 design tables. Adding `heor_analyses` closes the last gap without touching anything that works.

### Why Layer 2 (Immutable Audit Log)?

**Failure mode protected:** A user edits a cohort definition and then disputes the change, or a regression is introduced and we need to know exactly what changed and when. Soft deletes tell us a row was deleted but not by whom or from what state. The audit log captures full before/after state, actor identity, and IP address for every mutation.

**Why immutable?** The audit log is only valuable if it cannot be tampered with after the fact. An UPDATE or DELETE capability on audit rows would allow an actor to cover their tracks. The PostgreSQL trigger enforces this at the database level, not just at the application level.

**Why denormalize entity_name, actor_email?** Because the entities they reference can be soft-deleted or hard-deleted. Without denormalization, a query against the audit log for a deleted user's actions would show null email. The denormalized values are captured at write time and remain readable regardless of subsequent deletions.

**Why Eloquent observers rather than a middleware or a trait?** Observers are the standard Laravel mechanism for this. They attach to the model lifecycle events (`creating`, `created`, `updating`, `updated`, `deleting`, `deleted`, `restoring`, `restored`), which means every write path (controllers, artisan commands, seeders, queue jobs) is covered automatically.

### Why Layer 3 (Git-Tracked Fixtures)?

**Failure mode protected:** A `migrate:fresh`, `DROP SCHEMA app CASCADE`, Docker volume deletion, or accidental `db:seed` that wipes all app tables. Hourly database backups exist but require DBA access and a manual restore procedure. Git fixtures give every developer a restore path that requires only `php artisan parthenon:import-designs`.

**Why git rather than S3 or another external store?** Git is already the source of truth for everything else in this project. Design definitions are effectively code — they describe research protocols. Committing them to git means every design state is versioned, diffable, and code-reviewable. It also means offline restore is possible: a developer with only the git clone and a fresh database can restore all designs without any external service access.

**Why export before each migration in deploy.sh?** Because migrations are the most common source of data loss in this project's history. Exporting and committing before the migration means the pre-migration state is always in git, even if the migration is destructive.

**Why key the import on `name` rather than `id`?** After a `migrate:fresh`, PostgreSQL sequences reset to 1. Forcing old `id` values risks corrupting the sequence and breaking future inserts. Keying on `name` is safe and idempotent across resets. The tradeoff (cross-entity ID references not preserved) is accepted and documented.

---

## Testing

The following manual test plan confirms the system works end-to-end.

### Test 1 — Soft Delete on heor_analyses

1. Create a HEOR analysis through the UI.
2. Delete it through the UI.
3. In psql: `SELECT id, name, deleted_at FROM app.heor_analyses WHERE deleted_at IS NOT NULL;`
4. Confirm the row has a `deleted_at` timestamp and is not permanently removed.
5. In psql: `UPDATE app.heor_analyses SET deleted_at = NULL WHERE id = {id};`
6. Confirm the record reappears in the UI.

### Test 2 — Audit Log on Create

1. Create a new cohort definition through the UI.
2. In psql: `SELECT * FROM app.design_audit_log WHERE entity_type = 'cohort_definition' ORDER BY created_at DESC LIMIT 1;`
3. Confirm: `action = 'created'`, `old_json IS NULL`, `new_json` contains the full entity, `actor_email` matches the logged-in user.

### Test 3 — Audit Log on Update

1. Edit the cohort definition name.
2. In psql: query `design_audit_log` for the most recent row for this entity.
3. Confirm: `action = 'updated'`, `old_json` contains the old name, `new_json` contains the new name, `changed_fields` contains `["name"]`.

### Test 4 — Audit Log on Delete

1. Delete the cohort definition.
2. In psql: confirm a `deleted` row in `design_audit_log` with `old_json` set and `new_json IS NULL`.

### Test 5 — Audit Log Immutability

1. In psql, attempt: `UPDATE app.design_audit_log SET action = 'hacked' WHERE id = 1;`
2. Confirm: PostgreSQL raises `ERROR: design_audit_log rows are immutable`.
3. Attempt: `DELETE FROM app.design_audit_log WHERE id = 1;`
4. Confirm: same error.

### Test 6 — Export Command

1. Create or modify any design entity through the UI.
2. Run: `php artisan parthenon:export-designs`
3. Confirm: a JSON file appears or is updated in `backend/database/fixtures/designs/{entity_type}/`.
4. Open the file and confirm it contains the current entity state with correct JSON.

### Test 7 — Export and Git Commit (Host-Side)

1. Modify a cohort definition through the UI.
2. Run: `docker compose exec -T php php artisan parthenon:export-designs`
3. On the host, run: `git diff backend/database/fixtures/designs/` — confirm the modified file shows up.
4. Run: `git add backend/database/fixtures/designs/ && git commit -m "chore: auto-export design fixtures [skip ci]"`
5. Run: `git log --oneline -3` — confirm the commit appears.
6. Run `parthenon:export-designs` again without changing anything — confirm no new git diff.

### Test 8 — Wipe and Restore

1. Run `php artisan parthenon:export-designs` to ensure fixtures are current.
2. Note the name of one cohort definition.
3. In psql, run: `DELETE FROM app.cohort_definitions;` (bypasses soft delete — simulates wipe)
4. Confirm the cohort is gone from the UI.
5. Run: `php artisan parthenon:import-designs`
6. Confirm the cohort reappears in the UI with its original name and expression.

### Test 9 — Full DB Wipe and Restore (Procedure Test)

1. Run `php artisan parthenon:export-designs` + `git add/commit` to ensure all fixtures are in git.
2. Run: `php artisan migrate:fresh` (Docker postgres only — do NOT run against the local ohdsi DB). This drops and recreates all tables — `migrate` is included, no separate `migrate` call needed.
3. Run the restore procedure in order:
   ```bash
   php artisan admin:seed
   php artisan acumenus:seed-source
   php artisan parthenon:import-designs
   ```
4. Log into the UI as `admin@acumenus.net`.
5. Confirm all cohort definitions, concept sets, and analyses are visible.
6. Confirm the audit log is empty (expected — it was wiped with the DB).

### Test 10 — deploy.sh Integration

1. Make a change to a cohort definition.
2. Run `./deploy.sh` (or `./deploy.sh --db`).
3. Confirm the deploy output shows `→ Exporting design fixtures...`.
4. Run `git log --oneline -5` — confirm a `chore: auto-export design fixtures [skip ci]` commit appears before the deploy completed.
5. Confirm `./deploy.sh --php` does NOT trigger a fixture export (it skips the `$DO_DB` block entirely).

---

*End of spec.*
