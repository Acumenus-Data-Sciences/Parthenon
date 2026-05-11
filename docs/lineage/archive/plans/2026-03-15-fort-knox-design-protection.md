# Fort Knox Design Protection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-layer system ensuring cohort definitions, concept sets, and analyses can never be permanently lost — via soft-delete completion, an immutable audit log, and git-tracked JSON fixture export/import.

**Architecture:** A PostgreSQL-level immutability trigger guards a new `design_audit_log` table; Eloquent model observers write to it on every create/update/delete/restore; a `DesignFixtureExporter` service writes JSON files to `backend/database/fixtures/designs/` (bind-mounted, visible to the host); and `deploy.sh` runs git add/commit on the host after every export.

**Tech Stack:** Laravel 11, PHP 8.4, PostgreSQL 16 (Docker), Eloquent Observers, Pest PHP tests, Bash (deploy.sh)

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `backend/database/migrations/2026_03_15_200001_add_soft_deletes_to_heor_analyses.php` | Add `deleted_at` to `heor_analyses` |
| `backend/database/migrations/2026_03_15_200002_create_design_audit_log_table.php` | Create `design_audit_log` with immutability trigger |
| `backend/app/Models/App/DesignAuditLog.php` | Eloquent model for audit log; overrides update/delete to throw |
| `backend/app/Observers/DesignProtection/DesignAuditObserver.php` | Abstract base — capture old/new JSON, write audit row, call fixture exporter |
| `backend/app/Observers/DesignProtection/CohortDefinitionProtectionObserver.php` | Concrete — entityType = 'cohort_definition' |
| `backend/app/Observers/DesignProtection/ConceptSetProtectionObserver.php` | Concrete — entityType = 'concept_set' |
| `backend/app/Observers/DesignProtection/CharacterizationProtectionObserver.php` | Concrete — entityType = 'characterization' |
| `backend/app/Observers/DesignProtection/EstimationAnalysisProtectionObserver.php` | Concrete — entityType = 'estimation_analysis' |
| `backend/app/Observers/DesignProtection/PredictionAnalysisProtectionObserver.php` | Concrete — entityType = 'prediction_analysis' |
| `backend/app/Observers/DesignProtection/SccsAnalysisProtectionObserver.php` | Concrete — entityType = 'sccs_analysis' |
| `backend/app/Observers/DesignProtection/IncidenceRateAnalysisProtectionObserver.php` | Concrete — entityType = 'incidence_rate_analysis' |
| `backend/app/Observers/DesignProtection/PathwayAnalysisProtectionObserver.php` | Concrete — entityType = 'pathway_analysis' |
| `backend/app/Observers/DesignProtection/EvidenceSynthesisAnalysisProtectionObserver.php` | Concrete — entityType = 'evidence_synthesis_analysis' |
| `backend/app/Observers/DesignProtection/HeorAnalysisProtectionObserver.php` | Concrete — entityType = 'heor_analysis' |
| `backend/app/Services/DesignProtection/ExportSummary.php` | Readonly value object — written/deleted/errors counts |
| `backend/app/Services/DesignProtection/DesignFixtureExporter.php` | Write/delete JSON fixture files; `exportAll()` |
| `backend/app/Console/Commands/ExportDesigns.php` | `parthenon:export-designs` artisan command |
| `backend/app/Console/Commands/ImportDesigns.php` | `parthenon:import-designs` artisan command |
| `backend/database/fixtures/designs/.gitkeep` | Keep directories in git before first export |
| `backend/tests/Feature/DesignAuditLogTest.php` | Tests for observer → audit log writes |
| `backend/tests/Feature/DesignFixtureExportTest.php` | Tests for fixture file creation/update/delete |
| `backend/tests/Feature/DesignFixtureImportTest.php` | Tests for import idempotency, author remap, concept_set_items |

### Modified files
| File | Change |
|------|--------|
| `backend/app/Models/App/HeorAnalysis.php` | Add `use SoftDeletes;` |
| `backend/app/Providers/AppServiceProvider.php` | Register 10 DesignProtection observers in `boot()` |
| `deploy.sh` | Add fixture export + host-side git commit inside `$DO_DB` block, before migrate |

---

## Chunk 1: Migrations and Models

### Task 1: Migration — add `deleted_at` to `heor_analyses`

**Files:**
- Create: `backend/database/migrations/2026_03_15_200001_add_soft_deletes_to_heor_analyses.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('heor_analyses', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('heor_analyses', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
docker compose exec php php artisan migrate
```

Expected output: `Migrating: 2026_03_15_200001_add_soft_deletes_to_heor_analyses` then `Migrated`.

- [ ] **Step 3: Verify in psql**

```bash
docker compose exec postgres psql -U parthenon -d parthenon -c "\d app.heor_analyses" | grep deleted_at
```

Expected: `deleted_at | timestamp(0) without time zone | nullable`

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_15_200001_add_soft_deletes_to_heor_analyses.php
git commit -m "feat: add soft deletes to heor_analyses"
```

---

### Task 2: Migration — create `design_audit_log` table

**Files:**
- Create: `backend/database/migrations/2026_03_15_200002_create_design_audit_log_table.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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

        // Indexes
        DB::statement('CREATE INDEX dal_entity_idx  ON app.design_audit_log (entity_type, entity_id)');
        DB::statement('CREATE INDEX dal_actor_idx   ON app.design_audit_log (actor_id)');
        DB::statement('CREATE INDEX dal_action_idx  ON app.design_audit_log (action)');
        DB::statement('CREATE INDEX dal_created_idx ON app.design_audit_log (created_at)');

        // FK to users (nullable for seeder/system changes)
        DB::statement('ALTER TABLE app.design_audit_log ADD CONSTRAINT fk_dal_actor
            FOREIGN KEY (actor_id) REFERENCES app.users(id) ON DELETE SET NULL');

        // Immutability trigger — any UPDATE or DELETE raises an exception at DB level
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
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS design_audit_log_no_update_delete ON app.design_audit_log');
        DB::statement('DROP FUNCTION IF EXISTS app.design_audit_log_immutable()');
        Schema::dropIfExists('design_audit_log');
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
docker compose exec php php artisan migrate
```

Expected: `Migrating: 2026_03_15_200002_create_design_audit_log_table` then `Migrated`.

- [ ] **Step 3: Verify immutability trigger works**

```bash
docker compose exec postgres psql -U parthenon -d parthenon -c "
  INSERT INTO app.design_audit_log (entity_type, entity_id, entity_name, action, created_at)
  VALUES ('cohort_definition', 1, 'test', 'created', now());
  UPDATE app.design_audit_log SET action = 'hacked' WHERE entity_name = 'test';
"
```

Expected: INSERT succeeds, UPDATE raises `ERROR: design_audit_log rows are immutable`. Then clean up: `DELETE FROM app.design_audit_log WHERE entity_name = 'test';` — this will also raise the error, which is correct. Clean up via: `TRUNCATE app.design_audit_log;` (TRUNCATE is not blocked by a row-level trigger — that's acceptable for a test).

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_15_200002_create_design_audit_log_table.php
git commit -m "feat: create design_audit_log table with immutability trigger"
```

---

### Task 3: Models — `SoftDeletes` on `HeorAnalysis` + `DesignAuditLog` model

**Files:**
- Modify: `backend/app/Models/App/HeorAnalysis.php`
- Create: `backend/app/Models/App/DesignAuditLog.php`

- [ ] **Step 1: Write a failing test for HeorAnalysis soft delete**

Add to a new file `backend/tests/Feature/HeorAnalysisSoftDeleteTest.php`:

```php
<?php

use App\Models\App\HeorAnalysis;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('soft-deletes a heor analysis instead of hard-deleting', function () {
    $user = User::factory()->create();
    $analysis = HeorAnalysis::create([
        'created_by'    => $user->id,
        'name'          => 'Test HEOR',
        'analysis_type' => 'cost_effectiveness',
        'status'        => 'draft',
    ]);

    $analysis->delete();

    // Row still in DB with deleted_at set
    $this->assertDatabaseHas('heor_analyses', ['id' => $analysis->id]);
    $this->assertNotNull(HeorAnalysis::withTrashed()->find($analysis->id)?->deleted_at);

    // Not returned by default query
    $this->assertNull(HeorAnalysis::find($analysis->id));
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && vendor/bin/pest tests/Feature/HeorAnalysisSoftDeleteTest.php -v
```

Expected: FAIL — `deleted_at column does not exist` or similar, because the trait is not on the model yet.

- [ ] **Step 3: Add `SoftDeletes` to `HeorAnalysis`**

In `backend/app/Models/App/HeorAnalysis.php`, add the import and trait:

```php
use Illuminate\Database\Eloquent\SoftDeletes;

class HeorAnalysis extends Model
{
    use SoftDeletes;
    // ... existing code unchanged
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd backend && vendor/bin/pest tests/Feature/HeorAnalysisSoftDeleteTest.php -v
```

Expected: PASS.

- [ ] **Step 5: Create `DesignAuditLog` model**

Create `backend/app/Models/App/DesignAuditLog.php`:

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Immutable audit log for design entities.
 * Rows are INSERT-only. Never update or delete.
 *
 * @property int    $id
 * @property string $entity_type
 * @property int    $entity_id
 * @property string $entity_name
 * @property string $action
 * @property int|null $actor_id
 * @property string|null $actor_email
 * @property array|null $old_json
 * @property array|null $new_json
 * @property array|null $changed_fields
 * @property string|null $ip_address
 * @property \Carbon\Carbon $created_at
 */
class DesignAuditLog extends Model
{
    public $timestamps = false; // only created_at, set by DB default

    protected $table = 'design_audit_log';

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'old_json'       => 'array',
            'new_json'       => 'array',
            'changed_fields' => 'array',
            'created_at'     => 'datetime',
        ];
    }

    /** @throws \RuntimeException always */
    public function delete(): bool|null
    {
        throw new \RuntimeException('Design audit log is immutable');
    }

    /** @throws \RuntimeException always */
    public function update(array $attributes = [], array $options = []): bool
    {
        throw new \RuntimeException('Design audit log is immutable');
    }

    /**
     * Lower-level hook used by Eloquent internally — belt-and-suspenders.
     *
     * @throws \RuntimeException always
     */
    protected function performUpdate(Builder $query): bool
    {
        throw new \RuntimeException('Design audit log is immutable');
    }
}
```

- [ ] **Step 6: Run full test suite to check nothing broken**

```bash
cd backend && vendor/bin/pest --passthrough-exceptions 2>&1 | tail -20
```

Expected: all previously passing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Models/App/HeorAnalysis.php \
        backend/app/Models/App/DesignAuditLog.php \
        backend/tests/Feature/HeorAnalysisSoftDeleteTest.php
git commit -m "feat: add SoftDeletes to HeorAnalysis and create DesignAuditLog model"
```

---

## Chunk 2: Observer System

### Task 4: Abstract `DesignAuditObserver` base class

**Files:**
- Create: `backend/app/Observers/DesignProtection/DesignAuditObserver.php`

> Note: The existing `backend/app/Observers/CohortDefinitionObserver.php` handles Solr indexing only — do NOT touch it. The new protection observers live in the `DesignProtection/` subdirectory and are registered separately.

- [ ] **Step 1: Write a failing test for the observer**

Create `backend/tests/Feature/DesignAuditLogTest.php`:

```php
<?php

use App\Models\App\CohortDefinition;
use App\Models\App\DesignAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('logs a created action when a cohort definition is made', function () {
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name'            => 'T2DM Cohort',
        'description'     => 'Type 2 diabetes patients',
        'expression_json' => ['PrimaryCriteria' => []],
        'author_id'       => $user->id,
        'is_public'       => false,
    ]);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'created')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->old_json)->toBeNull()
        ->and($log->new_json['name'])->toBe('T2DM Cohort')
        ->and($log->entity_name)->toBe('T2DM Cohort');
});

it('logs an updated action with before/after state', function () {
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name'            => 'Original Name',
        'description'     => 'desc',
        'expression_json' => [],
        'author_id'       => $user->id,
        'is_public'       => false,
    ]);

    $cohort->update(['name' => 'Updated Name']);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'updated')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->old_json['name'])->toBe('Original Name')
        ->and($log->new_json['name'])->toBe('Updated Name')
        ->and($log->changed_fields)->toContain('name');
});

it('logs a deleted action when a cohort is soft-deleted', function () {
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name'            => 'To Delete',
        'expression_json' => [],
        'author_id'       => $user->id,
        'is_public'       => false,
    ]);

    $cohort->delete();

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'deleted')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->old_json['name'])->toBe('To Delete')
        ->and($log->new_json)->toBeNull();
});

it('captures actor when authenticated', function () {
    $user = User::factory()->create(['email' => 'researcher@example.com']);

    $this->actingAs($user);

    $cohort = CohortDefinition::create([
        'name'            => 'Authenticated Cohort',
        'expression_json' => [],
        'author_id'       => $user->id,
        'is_public'       => false,
    ]);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'created')
        ->first();

    expect($log->actor_id)->toBe($user->id)
        ->and($log->actor_email)->toBe('researcher@example.com');
});

it('sets actor to null for seeder/system creates', function () {
    // No actingAs() — simulates seeder context
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name'            => 'Seeded Cohort',
        'expression_json' => [],
        'author_id'       => $user->id,
        'is_public'       => false,
    ]);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'created')
        ->first();

    expect($log->actor_id)->toBeNull()
        ->and($log->actor_email)->toBeNull();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && vendor/bin/pest tests/Feature/DesignAuditLogTest.php -v
```

Expected: all 5 FAIL — `DesignAuditLog table has no rows` (observer not wired yet).

- [ ] **Step 3: Create the abstract `DesignAuditObserver`**

Create `backend/app/Observers/DesignProtection/DesignAuditObserver.php`:

```php
<?php

namespace App\Observers\DesignProtection;

use App\Models\App\DesignAuditLog;
use App\Services\DesignProtection\DesignFixtureExporter;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

abstract class DesignAuditObserver
{
    /**
     * Returns the entity_type string for the audit log.
     * e.g. 'cohort_definition', 'concept_set', 'estimation_analysis'
     */
    abstract protected function entityType(): string;

    // Stash old state before the UPDATE so it's available in updated().
    // Keyed on "ClassName:id" to avoid collisions between entity types sharing the same integer id.
    private array $pendingOld = [];

    // ──────────────────────────────────────────────────────────────────────────
    // Create
    // ──────────────────────────────────────────────────────────────────────────

    public function created(Model $model): void
    {
        $this->writeAuditRow($model, 'created', null, $model->toArray());
        $this->exportFixture($model);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Update
    // ──────────────────────────────────────────────────────────────────────────

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

        $this->writeAuditRow($model, 'updated', $old, $model->toArray());
        $this->exportFixture($model);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Delete (soft or hard)
    // ──────────────────────────────────────────────────────────────────────────

    public function deleting(Model $model): void
    {
        // Capture state BEFORE deletion (important for soft deletes — after
        // deletion, deleted_at is set on the model but the original state is what matters)
        $key = get_class($model) . ':' . $model->getKey();
        $this->pendingOld[$key] = $model->getOriginal();
    }

    public function deleted(Model $model): void
    {
        $key = get_class($model) . ':' . $model->getKey();
        $old = $this->pendingOld[$key] ?? $model->toArray();
        unset($this->pendingOld[$key]);

        $this->writeAuditRow($model, 'deleted', $old, null);
        // Soft-delete: update the fixture file to reflect deleted_at being set.
        // Hard-delete: remove the fixture file entirely.
        if (method_exists($model, 'trashed') && $model->trashed()) {
            $this->exportFixture($model);
        } else {
            $this->deleteFixture($model);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Restore
    // ──────────────────────────────────────────────────────────────────────────

    public function restored(Model $model): void
    {
        $this->writeAuditRow($model, 'restored', null, $model->fresh()?->toArray());
        $this->exportFixture($model);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function writeAuditRow(Model $model, string $action, ?array $old, ?array $new): void
    {
        try {
            $actor = $this->captureActor();

            DesignAuditLog::insert([
                'entity_type'   => $this->entityType(),
                'entity_id'     => $model->getKey(),
                'entity_name'   => $model->getAttribute('name') ?? $this->entityType() . '-' . $model->getKey(),
                'action'        => $action,
                'actor_id'      => $actor['actor_id'],
                'actor_email'   => $actor['actor_email'],
                'old_json'      => $old !== null ? json_encode($old) : null,
                'new_json'      => $new !== null ? json_encode($new) : null,
                'changed_fields'=> (($cf = $this->computeChangedFields($old, $new)) !== null)
                    ? json_encode($cf)
                    : null,
                'ip_address'    => $this->captureIp(),
                'created_at'    => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('DesignAuditObserver: failed to write audit row', [
                'entity_type' => $this->entityType(),
                'entity_id'   => $model->getKey(),
                'action'      => $action,
                'error'       => $e->getMessage(),
            ]);
        }
    }

    private function exportFixture(Model $model): void
    {
        try {
            app(DesignFixtureExporter::class)->exportEntity($this->entityType(), (int) $model->getKey());
        } catch (\Throwable $e) {
            Log::warning('DesignAuditObserver: fixture export failed (DB write succeeded)', [
                'entity_type' => $this->entityType(),
                'entity_id'   => $model->getKey(),
                'error'       => $e->getMessage(),
            ]);
        }
    }

    private function deleteFixture(Model $model): void
    {
        try {
            app(DesignFixtureExporter::class)->deleteEntityFile($this->entityType(), (int) $model->getKey());
        } catch (\Throwable $e) {
            Log::warning('DesignAuditObserver: fixture delete failed', [
                'entity_type' => $this->entityType(),
                'entity_id'   => $model->getKey(),
                'error'       => $e->getMessage(),
            ]);
        }
    }

    /** @return array{actor_id: int|null, actor_email: string|null} */
    private function captureActor(): array
    {
        $user = auth()->user();
        return [
            'actor_id'    => $user?->id,
            'actor_email' => $user?->email,
        ];
    }

    private function captureIp(): ?string
    {
        if (app()->runningInConsole()) {
            return null;
        }
        return request()->ip();
    }

    /** @return list<string>|null */
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
}
```

- [ ] **Step 4: Create the 10 concrete observer classes**

Each is identical — only `entityType()` differs. Create these 10 files:

**`backend/app/Observers/DesignProtection/CohortDefinitionProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class CohortDefinitionProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'cohort_definition'; }
}
```

**`backend/app/Observers/DesignProtection/ConceptSetProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class ConceptSetProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'concept_set'; }
}
```

**`backend/app/Observers/DesignProtection/CharacterizationProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class CharacterizationProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'characterization'; }
}
```

**`backend/app/Observers/DesignProtection/EstimationAnalysisProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class EstimationAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'estimation_analysis'; }
}
```

**`backend/app/Observers/DesignProtection/PredictionAnalysisProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class PredictionAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'prediction_analysis'; }
}
```

**`backend/app/Observers/DesignProtection/SccsAnalysisProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class SccsAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'sccs_analysis'; }
}
```

**`backend/app/Observers/DesignProtection/IncidenceRateAnalysisProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class IncidenceRateAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'incidence_rate_analysis'; }
}
```

**`backend/app/Observers/DesignProtection/PathwayAnalysisProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class PathwayAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'pathway_analysis'; }
}
```

**`backend/app/Observers/DesignProtection/EvidenceSynthesisAnalysisProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class EvidenceSynthesisAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'evidence_synthesis_analysis'; }
}
```

**`backend/app/Observers/DesignProtection/HeorAnalysisProtectionObserver.php`:**
```php
<?php
namespace App\Observers\DesignProtection;

class HeorAnalysisProtectionObserver extends DesignAuditObserver
{
    protected function entityType(): string { return 'heor_analysis'; }
}
```

- [ ] **Step 5: Register all 10 observers in `AppServiceProvider::boot()`**

Open `backend/app/Providers/AppServiceProvider.php`. Find the existing observer registration block (around line 150):

```php
// Model observers — activity logging + Solr delta indexing
CohortDefinition::observe(CohortDefinitionObserver::class);
```

Add AFTER the existing observer registrations:

```php
// Design Protection observers — audit log + fixture export for all 10 design entity types
CohortDefinition::observe(\App\Observers\DesignProtection\CohortDefinitionProtectionObserver::class);
ConceptSet::observe(\App\Observers\DesignProtection\ConceptSetProtectionObserver::class);
Characterization::observe(\App\Observers\DesignProtection\CharacterizationProtectionObserver::class);
EstimationAnalysis::observe(\App\Observers\DesignProtection\EstimationAnalysisProtectionObserver::class);
PredictionAnalysis::observe(\App\Observers\DesignProtection\PredictionAnalysisProtectionObserver::class);
SccsAnalysis::observe(\App\Observers\DesignProtection\SccsAnalysisProtectionObserver::class);
IncidenceRateAnalysis::observe(\App\Observers\DesignProtection\IncidenceRateAnalysisProtectionObserver::class);
PathwayAnalysis::observe(\App\Observers\DesignProtection\PathwayAnalysisProtectionObserver::class);
EvidenceSynthesisAnalysis::observe(\App\Observers\DesignProtection\EvidenceSynthesisAnalysisProtectionObserver::class);
HeorAnalysis::observe(\App\Observers\DesignProtection\HeorAnalysisProtectionObserver::class);
```

Add the missing `use` imports at the top for any models not already imported:
```php
use App\Models\App\Characterization;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\HeorAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
```

- [ ] **Step 6: Run the audit log tests — expect them to FAIL (fixture exporter not built yet)**

```bash
cd backend && vendor/bin/pest tests/Feature/DesignAuditLogTest.php -v
```

Expected: tests fail with something like `Class DesignFixtureExporter not found` or file-write errors. The observer is wired but the exporter doesn't exist. That's expected — proceed to Task 5.

- [ ] **Step 7: Commit observers only**

```bash
git add backend/app/Observers/DesignProtection/ \
        backend/app/Providers/AppServiceProvider.php
git commit -m "feat: add DesignProtection observer system for audit log and fixture export"
```

---

## Chunk 3: Service and Commands

### Task 5: `ExportSummary` and `DesignFixtureExporter` service

**Files:**
- Create: `backend/app/Services/DesignProtection/ExportSummary.php`
- Create: `backend/app/Services/DesignProtection/DesignFixtureExporter.php`

- [ ] **Step 1: Write failing fixture export test**

Create `backend/tests/Feature/DesignFixtureExportTest.php`:

```php
<?php

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\User;
use App\Services\DesignProtection\DesignFixtureExporter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Point exporter to a temp directory for tests
    config(['design_fixtures.path' => sys_get_temp_dir() . '/parthenon-fixtures-test-' . uniqid()]);
    mkdir(config('design_fixtures.path'), 0755, true);
});

afterEach(function () {
    // Clean up temp dir
    $path = config('design_fixtures.path');
    if (is_dir($path)) {
        array_map('unlink', glob("$path/**/*.json") ?: []);
        array_map('rmdir', glob("$path/*") ?: []);
        rmdir($path);
    }
});

it('creates a fixture file when a cohort is exported', function () {
    $user = User::factory()->create();
    $cohort = CohortDefinition::create([
        'name'            => 'NSAID Users',
        'expression_json' => ['PrimaryCriteria' => []],
        'author_id'       => $user->id,
        'is_public'       => false,
    ]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('cohort_definition', $cohort->id);

    $path = config('design_fixtures.path') . '/cohort_definitions/nsaid-users.json';
    expect(file_exists($path))->toBeTrue();

    $data = json_decode(file_get_contents($path), true);
    expect($data['name'])->toBe('NSAID Users')
        ->and($data['id'])->toBe($cohort->id);
});

it('includes concept_set_items in concept set fixtures', function () {
    $user = User::factory()->create();
    $cs = ConceptSet::create([
        'name'      => 'Diabetes Drugs',
        'author_id' => $user->id,
        'is_public' => false,
    ]);
    ConceptSetItem::create([
        'concept_set_id'      => $cs->id,
        'concept_id'          => 1567956,
        'is_excluded'         => false,
        'include_descendants' => true,
        'include_mapped'      => false,
    ]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('concept_set', $cs->id);

    $path = config('design_fixtures.path') . '/concept_sets/diabetes-drugs.json';
    $data = json_decode(file_get_contents($path), true);

    expect($data['items'])->toHaveCount(1)
        ->and($data['items'][0]['concept_id'])->toBe(1567956);
});

it('handles name collision by appending id to filename', function () {
    $user = User::factory()->create();

    $c1 = CohortDefinition::create(['name' => 'Same Name', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);
    $c2 = CohortDefinition::create(['name' => 'Same Name', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);

    $exporter = app(DesignFixtureExporter::class);
    $exporter->exportEntity('cohort_definition', $c1->id);
    $exporter->exportEntity('cohort_definition', $c2->id);

    expect(file_exists(config('design_fixtures.path') . '/cohort_definitions/same-name.json'))->toBeTrue();
    expect(file_exists(config('design_fixtures.path') . '/cohort_definitions/same-name-' . $c2->id . '.json'))->toBeTrue();
});

it('exportAll returns correct written count', function () {
    $user = User::factory()->create();
    CohortDefinition::create(['name' => 'A', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);
    CohortDefinition::create(['name' => 'B', 'expression_json' => [], 'author_id' => $user->id, 'is_public' => false]);

    $exporter = app(DesignFixtureExporter::class);
    $summary = $exporter->exportAll();

    expect($summary->written)->toBeGreaterThanOrEqual(2)
        ->and($summary->errors)->toBeEmpty();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && vendor/bin/pest tests/Feature/DesignFixtureExportTest.php -v
```

Expected: FAIL — `DesignFixtureExporter class not found`.

- [ ] **Step 3: Create `ExportSummary`**

Create `backend/app/Services/DesignProtection/ExportSummary.php`:

```php
<?php

namespace App\Services\DesignProtection;

final class ExportSummary
{
    public function __construct(
        public readonly int $written,
        public readonly int $deleted,
        public readonly array $errors,
    ) {}

    public static function empty(): self
    {
        return new self(0, 0, []);
    }

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

    public function addWritten(int $count = 1): self
    {
        return $this->withWritten($this->written + $count);
    }

    public function addDeleted(int $count = 1): self
    {
        return $this->withDeleted($this->deleted + $count);
    }
}
```

- [ ] **Step 4: Create `DesignFixtureExporter`**

Create `backend/app/Services/DesignProtection/DesignFixtureExporter.php`:

```php
<?php

namespace App\Services\DesignProtection;

use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\HeorAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;

class DesignFixtureExporter
{
    /** Map entity_type → Eloquent model class */
    private const ENTITY_MAP = [
        'cohort_definition'            => CohortDefinition::class,
        'concept_set'                  => ConceptSet::class,
        'characterization'             => Characterization::class,
        'estimation_analysis'          => EstimationAnalysis::class,
        'prediction_analysis'          => PredictionAnalysis::class,
        'sccs_analysis'                => SccsAnalysis::class,
        'incidence_rate_analysis'      => IncidenceRateAnalysis::class,
        'pathway_analysis'             => PathwayAnalysis::class,
        'evidence_synthesis_analysis'  => EvidenceSynthesisAnalysis::class,
        'heor_analysis'                => HeorAnalysis::class,
    ];

    /** Map entity_type → fixtures subdirectory name */
    private const DIR_MAP = [
        'cohort_definition'            => 'cohort_definitions',
        'concept_set'                  => 'concept_sets',
        'characterization'             => 'characterizations',
        'estimation_analysis'          => 'estimation_analyses',
        'prediction_analysis'          => 'prediction_analyses',
        'sccs_analysis'                => 'sccs_analyses',
        'incidence_rate_analysis'      => 'incidence_rate_analyses',
        'pathway_analysis'             => 'pathway_analyses',
        'evidence_synthesis_analysis'  => 'evidence_synthesis_analyses',
        'heor_analysis'                => 'heor_analyses',
    ];

    private string $basePath;

    public function __construct()
    {
        // Allow tests to override via config('design_fixtures.path')
        $this->basePath = config('design_fixtures.path')
            ?? base_path('database/fixtures/designs');
    }

    /** Export a single entity to its fixture file. */
    public function exportEntity(string $entityType, int $entityId): void
    {
        $modelClass = self::ENTITY_MAP[$entityType] ?? null;
        if ($modelClass === null) {
            Log::warning("DesignFixtureExporter: unknown entity_type '{$entityType}'");
            return;
        }

        // Load with soft-deleted rows too (we export deleted_at state as-is)
        /** @var Model $model */
        $model = in_array(SoftDeletes::class, class_uses_recursive($modelClass))
            ? $modelClass::withTrashed()->find($entityId)
            : $modelClass::find($entityId);

        if ($model === null) {
            return;
        }

        $data = $model->toArray();

        // Special case: concept_set gets nested items
        if ($entityType === 'concept_set') {
            $data['items'] = $model->items()->get()->toArray();
        }

        $dir = $this->ensureDir($entityType);
        $filename = $this->resolveFilename($entityType, $entityId, $model->getAttribute('name') ?? '');
        $path = $dir . '/' . $filename;

        file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /** Remove the fixture file for a hard-deleted entity. */
    public function deleteEntityFile(string $entityType, int $entityId): void
    {
        $dir = $this->basePath . '/' . (self::DIR_MAP[$entityType] ?? $entityType);
        if (! is_dir($dir)) {
            return;
        }

        // Find all files that match *-{id}.json or exactly the slug
        foreach (glob($dir . '/*.json') as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (isset($data['id']) && $data['id'] === $entityId) {
                unlink($file);
                return;
            }
        }
    }

    /** Export all entities of all types. Returns a summary. */
    public function exportAll(): ExportSummary
    {
        $summary = ExportSummary::empty();

        foreach (self::ENTITY_MAP as $entityType => $modelClass) {
            try {
                $models = in_array(SoftDeletes::class, class_uses_recursive($modelClass))
                    ? $modelClass::withTrashed()->get()
                    : $modelClass::all();

                foreach ($models as $model) {
                    try {
                        $this->exportEntity($entityType, (int) $model->getKey());
                        $summary = $summary->addWritten();
                    } catch (\Throwable $e) {
                        $summary = $summary->withError("{$entityType}#{$model->getKey()}: {$e->getMessage()}");
                    }
                }
            } catch (\Throwable $e) {
                $summary = $summary->withError("{$entityType}: {$e->getMessage()}");
            }
        }

        return $summary;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    private function ensureDir(string $entityType): string
    {
        $dir = $this->basePath . '/' . (self::DIR_MAP[$entityType] ?? $entityType);
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir;
    }

    /**
     * Returns the filename (not path) for an entity fixture.
     * If the slug collides with an existing file owned by a different id, appends -{id}.
     */
    private function resolveFilename(string $entityType, int $entityId, string $name): string
    {
        $dir = $this->basePath . '/' . (self::DIR_MAP[$entityType] ?? $entityType);
        $slug = $this->slugify($name, $entityId, $entityType);
        $candidate = $slug . '.json';

        // If the candidate file already exists, check if it belongs to this entity
        $existing = $dir . '/' . $candidate;
        if (file_exists($existing)) {
            $existingData = json_decode(file_get_contents($existing), true);
            if (isset($existingData['id']) && $existingData['id'] !== $entityId) {
                // Collision: use slug-{id}.json
                $candidate = $slug . '-' . $entityId . '.json';
            }
        }

        return $candidate;
    }

    private function slugify(string $name, int $id, string $entityType, int $maxLength = 100): string
    {
        $name = trim($name);
        if ($name === '') {
            return "{$entityType}-{$id}";
        }

        $slug = strtolower($name);
        $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
        $slug = preg_replace('/[\s-]+/', '-', $slug);
        $slug = trim($slug, '-');
        $slug = substr($slug, 0, $maxLength);

        if ($slug === '') {
            return "{$entityType}-{$id}";
        }

        return $slug;
    }
}
```

- [ ] **Step 5: Run fixture export tests — expect PASS**

```bash
cd backend && vendor/bin/pest tests/Feature/DesignFixtureExportTest.php -v
```

Expected: all 4 PASS.

- [ ] **Step 6: Run audit log tests now — expect PASS** (fixture exporter now exists)

```bash
cd backend && vendor/bin/pest tests/Feature/DesignAuditLogTest.php -v
```

Expected: all 5 PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Services/DesignProtection/ \
        backend/tests/Feature/DesignFixtureExportTest.php
git commit -m "feat: add DesignFixtureExporter service and ExportSummary value object"
```

---

### Task 6: `parthenon:export-designs` command

**Files:**
- Create: `backend/app/Console/Commands/ExportDesigns.php`

- [ ] **Step 1: Create the command**

```php
<?php

namespace App\Console\Commands;

use App\Services\DesignProtection\DesignFixtureExporter;
use Illuminate\Console\Command;

class ExportDesigns extends Command
{
    protected $signature = 'parthenon:export-designs';

    protected $description = 'Export all design entities (cohorts, concept sets, analyses) to git-tracked JSON fixture files';

    public function handle(DesignFixtureExporter $exporter): int
    {
        $this->info('Exporting design fixtures...');

        $summary = $exporter->exportAll();

        $this->info("Exported {$summary->written} files, deleted {$summary->deleted} files.");

        if (! empty($summary->errors)) {
            foreach ($summary->errors as $error) {
                $this->warn("  Error: {$error}");
            }
        }

        // Always exit 0 — export failure must not break a deploy
        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Register the command in `bootstrap/app.php` (or `Console/Kernel.php` if it exists)**

Check if there's a `Kernel.php`:
```bash
ls backend/app/Console/
```

If `Kernel.php` exists, add to the `$commands` array:
```php
\App\Console\Commands\ExportDesigns::class,
```

If not (Laravel 11 bootstrap style), the command auto-discovers via the `Commands/` directory — no registration needed.

- [ ] **Step 3: Test the command manually**

```bash
docker compose exec php php artisan parthenon:export-designs
```

Expected output: `Exporting design fixtures...` then `Exported N files, deleted 0 files.`

Verify files created:
```bash
ls backend/database/fixtures/designs/cohort_definitions/
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Console/Commands/ExportDesigns.php
git commit -m "feat: add parthenon:export-designs artisan command"
```

---

### Task 7: `parthenon:import-designs` command

**Files:**
- Create: `backend/app/Console/Commands/ImportDesigns.php`
- Create: `backend/tests/Feature/DesignFixtureImportTest.php`

- [ ] **Step 1: Write failing import tests**

Create `backend/tests/Feature/DesignFixtureImportTest.php`:

```php
<?php

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\User;
use App\Services\DesignProtection\DesignFixtureExporter;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['design_fixtures.path' => sys_get_temp_dir() . '/parthenon-import-test-' . uniqid()]);
    mkdir(config('design_fixtures.path'), 0755, true);
    mkdir(config('design_fixtures.path') . '/cohort_definitions', 0755, true);
    mkdir(config('design_fixtures.path') . '/concept_sets', 0755, true);
});

afterEach(function () {
    $path = config('design_fixtures.path');
    if (is_dir($path)) {
        $it = new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS);
        $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($path);
    }
});

function writeFixture(string $entityType, array $data): void
{
    $dir = config('design_fixtures.path') . "/{$entityType}";
    if (! is_dir($dir)) mkdir($dir, 0755, true);
    $slug = strtolower(preg_replace('/[^a-z0-9]/i', '-', $data['name']));
    file_put_contents("{$dir}/{$slug}.json", json_encode($data));
}

it('imports a cohort definition from fixture files', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('cohort_definitions', [
        'id'             => 99,
        'name'           => 'Imported Cohort',
        'description'    => 'Imported from fixture',
        'expression_json'=> ['PrimaryCriteria' => []],
        'author_id'      => $admin->id,
        'is_public'      => true,
        'version'        => 1,
        'tags'           => ['imported'],
        'deleted_at'     => null,
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();

    $this->assertDatabaseHas('cohort_definitions', ['name' => 'Imported Cohort']);
});

it('is idempotent — running twice does not duplicate rows', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('cohort_definitions', [
        'id'             => 99,
        'name'           => 'Idempotent Cohort',
        'expression_json'=> [],
        'author_id'      => $admin->id,
        'is_public'      => false,
        'version'        => 1,
        'tags'           => null,
        'deleted_at'     => null,
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();
    $this->artisan('parthenon:import-designs')->assertSuccessful();

    expect(CohortDefinition::where('name', 'Idempotent Cohort')->count())->toBe(1);
});

it('remaps author_id to admin when original author is missing', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('cohort_definitions', [
        'id'             => 99,
        'name'           => 'Orphaned Cohort',
        'expression_json'=> [],
        'author_id'      => 99999, // non-existent user
        'is_public'      => false,
        'version'        => 1,
        'tags'           => null,
        'deleted_at'     => null,
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();

    $cohort = CohortDefinition::where('name', 'Orphaned Cohort')->first();
    expect($cohort)->not->toBeNull()
        ->and($cohort->author_id)->toBe($admin->id);
});

it('imports concept set items from nested items array', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    writeFixture('concept_sets', [
        'id'          => 50,
        'name'        => 'Metformin Drugs',
        'description' => 'Metformin ingredients',
        'author_id'   => $admin->id,
        'is_public'   => true,
        'tags'        => null,
        'deleted_at'  => null,
        'items'       => [
            ['concept_id' => 1503297, 'is_excluded' => false, 'include_descendants' => true, 'include_mapped' => false],
        ],
    ]);

    $this->artisan('parthenon:import-designs')->assertSuccessful();

    $cs = ConceptSet::where('name', 'Metformin Drugs')->first();
    expect($cs)->not->toBeNull();
    expect(ConceptSetItem::where('concept_set_id', $cs->id)->count())->toBe(1);
    expect(ConceptSetItem::where('concept_set_id', $cs->id)->first()->concept_id)->toBe(1503297);
});

it('fails with clear message when admin user is missing', function () {
    // No admin@acumenus.net user created

    writeFixture('cohort_definitions', [
        'id' => 1, 'name' => 'Test', 'expression_json' => [], 'author_id' => 1,
        'is_public' => false, 'version' => 1, 'tags' => null, 'deleted_at' => null,
    ]);

    $this->artisan('parthenon:import-designs')
        ->expectsOutputToContain('Admin user admin@acumenus.net not found')
        ->assertFailed();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && vendor/bin/pest tests/Feature/DesignFixtureImportTest.php -v
```

Expected: all 5 FAIL — command doesn't exist.

- [ ] **Step 3: Create the import command**

Create `backend/app/Console/Commands/ImportDesigns.php`:

```php
<?php

namespace App\Console\Commands;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\HeorAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportDesigns extends Command
{
    protected $signature = 'parthenon:import-designs {--dry-run : Show what would be imported without writing to the database}';

    protected $description = 'Restore all design entities (cohorts, concept sets, analyses) from git-tracked JSON fixture files';

    /** Map subdirectory name → [model class, author column] */
    private const ENTITY_CONFIG = [
        'cohort_definitions'           => ['model' => CohortDefinition::class,           'author_col' => 'author_id'],
        'concept_sets'                 => ['model' => ConceptSet::class,                 'author_col' => 'author_id'],
        'characterizations'            => ['model' => Characterization::class,           'author_col' => 'author_id'],
        'estimation_analyses'          => ['model' => EstimationAnalysis::class,         'author_col' => 'author_id'],
        'prediction_analyses'          => ['model' => PredictionAnalysis::class,         'author_col' => 'author_id'],
        'sccs_analyses'                => ['model' => SccsAnalysis::class,               'author_col' => 'author_id'],
        'incidence_rate_analyses'      => ['model' => IncidenceRateAnalysis::class,      'author_col' => 'author_id'],
        'pathway_analyses'             => ['model' => PathwayAnalysis::class,            'author_col' => 'author_id'],
        'evidence_synthesis_analyses'  => ['model' => EvidenceSynthesisAnalysis::class,  'author_col' => 'author_id'],
        'heor_analyses'                => ['model' => HeorAnalysis::class,               'author_col' => 'created_by'],
    ];

    public function handle(): int
    {
        $admin = User::where('email', 'admin@acumenus.net')->first();
        if ($admin === null) {
            $this->error('Admin user admin@acumenus.net not found. Run: php artisan admin:seed');
            return self::FAILURE;
        }

        $dryRun = $this->option('dry-run');
        $basePath = config('design_fixtures.path') ?? base_path('database/fixtures/designs');

        if (! is_dir($basePath)) {
            $this->warn("Fixtures directory not found: {$basePath}");
            $this->warn("Run: php artisan parthenon:export-designs to generate fixtures first.");
            return self::SUCCESS;
        }

        $totals = ['created' => 0, 'updated' => 0, 'skipped' => 0];

        try {
            DB::beginTransaction();

            foreach (self::ENTITY_CONFIG as $dirName => $config) {
                $dir = $basePath . '/' . $dirName;
                if (! is_dir($dir)) {
                    continue;
                }

                $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0];
                $modelClass = $config['model'];
                $authorCol = $config['author_col'];

                foreach (glob($dir . '/*.json') as $file) {
                    $data = json_decode(file_get_contents($file), true);
                    if ($data === null) {
                        $this->warn("  Skipping malformed JSON: {$file}");
                        continue;
                    }

                    // Remap author to admin if original user doesn't exist
                    if (isset($data[$authorCol])) {
                        if (! User::where('id', $data[$authorCol])->exists()) {
                            $data[$authorCol] = $admin->id;
                        }
                    }

                    // Strip id and timestamps — let the DB assign them
                    $lookupKey = ['name' => $data['name']];
                    $fillable = $this->prepareFillable($data, $dirName);

                    $existing = in_array(\Illuminate\Database\Eloquent\SoftDeletes::class, class_uses_recursive($modelClass))
                        ? $modelClass::withTrashed()->where('name', $data['name'])->first()
                        : $modelClass::where('name', $data['name'])->first();

                    if ($existing === null) {
                        if (! $dryRun) {
                            $modelClass::create($fillable);
                        }
                        $counts['created']++;
                    } else {
                        $candidate = array_intersect_key($fillable, array_flip($existing->getFillable()));
                        $dirty = collect($candidate)->filter(function ($v, $k) use ($existing) {
                            return $existing->getAttribute($k) != $v;
                        })->isNotEmpty();

                        if ($dirty) {
                            if (! $dryRun) {
                                $existing->update($fillable);
                            }
                            $counts['updated']++;
                        } else {
                            $counts['skipped']++;
                        }
                    }

                    // concept_sets: replace items
                    if ($dirName === 'concept_sets' && isset($data['items']) && ! $dryRun) {
                        $cs = ConceptSet::where('name', $data['name'])->first();
                        if ($cs !== null) {
                            ConceptSetItem::where('concept_set_id', $cs->id)->delete();
                            foreach ($data['items'] as $item) {
                                ConceptSetItem::create([
                                    'concept_set_id'      => $cs->id,
                                    'concept_id'          => $item['concept_id'],
                                    'is_excluded'         => $item['is_excluded'] ?? false,
                                    'include_descendants' => $item['include_descendants'] ?? false,
                                    'include_mapped'      => $item['include_mapped'] ?? false,
                                ]);
                            }
                        }
                    }
                }

                $this->line(sprintf(
                    '  %-35s created: %d  updated: %d  skipped: %d',
                    $dirName, $counts['created'], $counts['updated'], $counts['skipped']
                ));

                $totals['created'] += $counts['created'];
                $totals['updated'] += $counts['updated'];
                $totals['skipped'] += $counts['skipped'];
            }

            if ($dryRun) {
                DB::rollBack();
                $this->info('[DRY RUN] No changes written.');
            } else {
                DB::commit();
            }

        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error("Import failed: {$e->getMessage()}");
            return self::FAILURE;
        }

        $this->info("Import complete. Created: {$totals['created']}, Updated: {$totals['updated']}, Skipped: {$totals['skipped']}");

        return self::SUCCESS;
    }

    /**
     * Prepare the fillable data for create/update — strip id, created_at, updated_at.
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function prepareFillable(array $data, string $dirName): array
    {
        $strip = ['id', 'created_at', 'updated_at'];
        // Don't strip deleted_at — restore deleted state from fixture
        foreach ($strip as $key) {
            unset($data[$key]);
        }
        // Remove nested items — handled separately
        unset($data['items']);
        return $data;
    }
}
```


- [ ] **Step 4: Run import tests — expect PASS**

```bash
cd backend && vendor/bin/pest tests/Feature/DesignFixtureImportTest.php -v
```

Expected: all 5 PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && vendor/bin/pest --passthrough-exceptions 2>&1 | tail -20
```

Expected: all previously passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Console/Commands/ExportDesigns.php \
        backend/app/Console/Commands/ImportDesigns.php \
        backend/tests/Feature/DesignFixtureImportTest.php
git commit -m "feat: add parthenon:import-designs artisan command"
```

---

## Chunk 4: Integration and Deploy

### Task 8: Fixtures directory structure and `deploy.sh` integration

**Files:**
- Create: `backend/database/fixtures/designs/.gitkeep` (+ subdirs)
- Modify: `deploy.sh`

- [ ] **Step 1: Create fixture directories with `.gitkeep` files**

```bash
mkdir -p backend/database/fixtures/designs/{cohort_definitions,concept_sets,characterizations,estimation_analyses,prediction_analyses,sccs_analyses,incidence_rate_analyses,pathway_analyses,evidence_synthesis_analyses,heor_analyses}
touch backend/database/fixtures/designs/{cohort_definitions,concept_sets,characterizations,estimation_analyses,prediction_analyses,sccs_analyses,incidence_rate_analyses,pathway_analyses,evidence_synthesis_analyses,heor_analyses}/.gitkeep
```

- [ ] **Step 2: Run the initial export to populate fixtures**

```bash
docker compose exec php php artisan parthenon:export-designs
```

Expected: `Exported N files, deleted 0 files.`

Verify files were created:
```bash
ls backend/database/fixtures/designs/cohort_definitions/
```

Expected: `type-2-diabetes-mellitus.json`, `essential-hypertension-with-antihypertensive-therapy.json`, etc.

- [ ] **Step 3: Check a fixture file looks correct**

```bash
cat backend/database/fixtures/designs/cohort_definitions/type-2-diabetes-mellitus.json | python3 -m json.tool | head -30
```

Expected: valid JSON with `id`, `name`, `expression_json`, etc.

- [ ] **Step 4: Modify `deploy.sh` — add fixture export inside `$DO_DB` block**

Open `deploy.sh`. Find this block (around line 148):

```bash
if $DO_DB; then
  echo ""
  echo "── DB: pre-migration backup ──"
```

Add the fixture export block **AFTER the pre-migration backup step and BEFORE the migration step**:

```bash
if $DO_DB; then
  echo ""
  echo "── DB: pre-migration backup ──"
  if bash "$( cd "$(dirname "${BASH_SOURCE[0]}")" && pwd )/scripts/db-backup.sh"; then
    ok "Pre-migration backup saved"
  else
    warn "Pre-migration backup failed (continuing anyway)"
  fi

  echo ""
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

  echo ""
  echo "── DB: running migrations ──"
  # ... existing migration code
```

- [ ] **Step 5: Test deploy.sh integration**

Make a trivial change to a cohort via psql, then run deploy:
```bash
docker compose exec postgres psql -U parthenon -d parthenon -c \
  "UPDATE app.cohort_definitions SET description='Updated description for deploy test' WHERE id = (SELECT MIN(id) FROM app.cohort_definitions);"
./deploy.sh --db
```

Expected output includes:
```
── DB: exporting design fixtures to git ──
  ✓ Design fixtures committed
```

Run `git log --oneline -3` — confirm `chore: auto-export design fixtures [skip ci]` commit appears.

- [ ] **Step 6: Verify `./deploy.sh --php` does NOT trigger fixture export**

```bash
./deploy.sh --php 2>&1 | grep -i fixture
```

Expected: no output (fixture export block skipped).

- [ ] **Step 7: Commit all fixture files + deploy.sh change**

```bash
git add backend/database/fixtures/designs/ deploy.sh
git commit -m "feat: add git-tracked design fixture directory and deploy.sh integration"
```

---

### Task 9: PHP linting + static analysis + full test run

- [ ] **Step 1: Run Pint (PHP style)**

```bash
cd backend && vendor/bin/pint
```

Fix any style issues it reports (it auto-fixes most of them).

- [ ] **Step 2: Run PHPStan (static analysis)**

```bash
cd backend && vendor/bin/phpstan analyse app/Models/App/DesignAuditLog.php \
  app/Observers/DesignProtection/ \
  app/Services/DesignProtection/ \
  app/Console/Commands/ExportDesigns.php \
  app/Console/Commands/ImportDesigns.php
```

Fix any Level 8 errors. If PHPStan errors are in pre-existing code (not your changes), add to `phpstan-baseline.neon` — do NOT fix pre-existing issues.

- [ ] **Step 3: Run full Pest test suite**

```bash
cd backend && vendor/bin/pest 2>&1 | tail -30
```

Expected: all tests pass. Fix any regressions introduced by the new observers (some existing tests may create design entities without expecting audit log writes — these should still pass because the audit log write is fire-and-forget; any failures are likely a fixture directory not existing in the test environment).

If tests fail because the `database/fixtures/designs` path doesn't exist in the test environment, add this to `phpunit.xml` or `Pest.php` setup:

```php
// In TestCase or Pest.php beforeAll
config(['design_fixtures.path' => storage_path('app/test-fixtures')]);
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -p  # stage only the lint/analysis fixes
git commit -m "fix: PHPStan and Pint cleanup for design protection system"
```

---

### Task 10: End-to-end smoke test + final commit

- [ ] **Step 1: Create a cohort through the UI**

Log in at http://localhost:8082 as `admin@acumenus.net`. Navigate to Cohort Definitions → New. Create a cohort named `"Fort Knox Test Cohort"`.

- [ ] **Step 2: Verify fixture file was created**

```bash
ls backend/database/fixtures/designs/cohort_definitions/ | grep fort-knox
```

Expected: `fort-knox-test-cohort.json` exists.

- [ ] **Step 3: Verify audit log entry**

```bash
docker compose exec postgres psql -U parthenon -d parthenon -c \
  "SELECT entity_type, entity_name, action, actor_email FROM app.design_audit_log ORDER BY created_at DESC LIMIT 3;"
```

Expected: row with `action=created`, `entity_name=Fort Knox Test Cohort`.

- [ ] **Step 4: Simulate a wipe and restore from fixtures**

```bash
# Delete the row directly (bypassing soft delete to simulate a wipe scenario)
docker compose exec postgres psql -U parthenon -d parthenon -c \
  "DELETE FROM app.cohort_definitions WHERE name = 'Fort Knox Test Cohort';"

# Verify it's gone
docker compose exec postgres psql -U parthenon -d parthenon -c \
  "SELECT COUNT(*) FROM app.cohort_definitions WHERE name = 'Fort Knox Test Cohort';"

# Restore from fixture
docker compose exec php php artisan parthenon:import-designs

# Verify it's back
docker compose exec postgres psql -U parthenon -d parthenon -c \
  "SELECT name, description FROM app.cohort_definitions WHERE name = 'Fort Knox Test Cohort';"
```

Expected: cohort restored.

- [ ] **Step 5: Run full AnalysisSeeder to restore missing analyses**

```bash
docker compose exec php php artisan db:seed --class=AnalysisSeeder
```

Expected: creates the missing estimation, prediction, and SCCS entries, adds HEOR analyses.

- [ ] **Step 6: Commit all remaining work**

```bash
git add -A
git commit -m "feat: Fort Knox design protection system — audit log, fixture export/import, deploy.sh integration"
```

- [ ] **Step 7: Run deploy**

```bash
./deploy.sh
```

Expected: clean deploy with fixture export step running, all migrations applied, all tests green.

---

*End of plan.*
