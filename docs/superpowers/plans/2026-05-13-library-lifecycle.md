---
doc_type: plan
status: active
date: 2026-05-13
---

# Library Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a Draft → Active → Archived lifecycle to concept sets, cohort definitions, and analyses, with auto-promote on attach, manual archive, periodic cleanup suggestions, and a superuser admin surface for global maintenance and hard-delete.

**Architecture:** Per-table `status` enum + lifecycle timestamp columns, centralized through a `HasLibraryLifecycle` trait, a `LibraryDefaultScope` global scope, per-model `LibraryLifecyclePolicy`, and a `RequiresPromotionException` that converts to a `409` JSON contract on Study/Analysis attachment endpoints. Frontend renders a 4-tab segmented control on each list page, an `AutoPromoteModal` that handles the 409, a Cleanup Suggestions page, and a `/admin/library` unified table for superusers.

**Tech Stack:** Laravel 11 / PHP 8.4 (Pest tests, Spatie RBAC, Sanctum), PostgreSQL 17, React 19 + TypeScript strict, Vite 7, Tailwind 4, TanStack Query, Zustand, Vitest, Playwright.

**Source spec:** `docs/superpowers/specs/2026-05-13-library-lifecycle-design.md`

**Out of scope (per spec §11):** Migration B (drop `cohort_definitions.deprecated_at`), Studies "archived" state (uses what already exists), notifications, bulk-promote, tags/folders.

---

## File Structure

### Backend — files to create

| File | Responsibility |
|---|---|
| `backend/app/Enums/LibraryStatus.php` | PHP enum with cases `DRAFT`, `ACTIVE`, `ARCHIVED`. |
| `backend/app/Concerns/HasLibraryLifecycle.php` | Trait: casts, transition methods (`promote`, `archive`, `restore`), local scopes, observer attachment. |
| `backend/app/Scopes/LibraryDefaultScope.php` | Global scope: filters Drafts (non-owner) + Archived from default queries; opt-in via macros. |
| `backend/app/Policies/Concerns/AuthorizesLibraryLifecycle.php` | Trait used by per-model policies for `promote`, `archive`, `restore`, `hardDelete`. |
| `backend/app/Policies/ConceptSetPolicy.php` (or extend) | Authorizes lifecycle actions on `ConceptSet`. |
| `backend/app/Policies/CohortDefinitionPolicy.php` (or extend) | Authorizes lifecycle actions on `CohortDefinition`. |
| `backend/app/Policies/AnalysisPolicy.php` (one shared, instance-checked) | Authorizes lifecycle on the 8 analysis models. |
| `backend/app/Exceptions/RequiresPromotionException.php` | Throws inside attach flows; renders as `409` JSON. |
| `backend/app/Http/Controllers/Api/V1/Library/LifecycleController.php` | Endpoints: `promote`, `archive`, `restore`, `bulkArchive`, `bulkRestore`. Routed under each entity prefix. |
| `backend/app/Http/Controllers/Api/V1/Admin/LibraryController.php` | Endpoints: `index` (unified table), `bulkDelete`, `reassignOwner`, `trash`, `purgeNow`. |
| `backend/app/Http/Requests/Library/BulkArchiveRequest.php` | Validates `ids: int[]` for bulk endpoints. |
| `backend/app/Http/Requests/Admin/Library/BulkDeleteRequest.php` | Validates `items: [{type, id}]`. |
| `backend/app/Http/Requests/Admin/Library/ReassignOwnerRequest.php` | Validates `target_email` matches a real user. |
| `backend/app/Jobs/SuggestLibraryCleanupJob.php` | Nightly job: rebuilds `library_cleanup_suggestions` cache. |
| `backend/app/Jobs/PurgeSoftDeletedLibraryItemsJob.php` | Nightly: deletes rows with `deleted_at < NOW() - 30 days`. |
| `backend/app/Models/App/LibraryCleanupSuggestion.php` | Read-model for the cache table. |
| `backend/app/Console/Commands/LibraryBackfillLifecycleCommand.php` | `library:backfill-lifecycle [--dry-run\|--apply]`. |
| `backend/database/migrations/2026_05_13_190001_add_library_lifecycle_columns_to_concept_sets.php` | Adds 4 columns to `concept_sets`. |
| `backend/database/migrations/2026_05_13_190002_add_library_lifecycle_columns_to_cohort_definitions.php` | Adds 4 columns; folds `deprecated_at` → `archived_at`. |
| `backend/database/migrations/2026_05_13_190003_add_library_lifecycle_columns_to_analyses.php` | Adds 4 columns to all 8 analysis tables in one migration. |
| `backend/database/migrations/2026_05_13_190004_create_library_cleanup_suggestions_table.php` | Creates the cache table. |
| `backend/tests/Unit/Concerns/HasLibraryLifecycleTest.php` | Trait unit tests. |
| `backend/tests/Feature/Api/V1/Library/LifecycleControllerTest.php` | Endpoint tests. |
| `backend/tests/Feature/Api/V1/Admin/LibraryControllerTest.php` | Admin endpoint tests. |
| `backend/tests/Feature/Api/V1/StudyCohortAttachAutoPromoteTest.php` | The 409 contract test. |
| `backend/tests/Feature/Console/LibraryBackfillLifecycleCommandTest.php` | Backfill classification tests. |
| `backend/tests/Feature/Jobs/SuggestLibraryCleanupJobTest.php` | Cleanup job test. |

### Backend — files to modify

| File | Change |
|---|---|
| `backend/app/Models/App/ConceptSet.php` | `use HasLibraryLifecycle;` + cast. |
| `backend/app/Models/App/CohortDefinition.php` | `use HasLibraryLifecycle;` + cast. |
| `backend/app/Models/App/IncidenceRateAnalysis.php` and 7 sibling analysis models | `use HasLibraryLifecycle;` + cast. |
| `backend/app/Providers/AuthServiceProvider.php` | Register lifecycle policies. |
| `backend/app/Http/Controllers/Api/V1/StudyCohortController.php` | Add Draft check → throw `RequiresPromotionException`. |
| `backend/app/Http/Controllers/Api/V1/StudyDesignController.php` | Same for concept-set / analysis attach paths. |
| `backend/app/Exceptions/Handler.php` | Render `RequiresPromotionException` as 409 JSON. |
| `backend/routes/api.php` | Add lifecycle endpoints + `/admin/library/*`. |
| `backend/app/Console/Kernel.php` | Schedule `SuggestLibraryCleanupJob` (daily 02:00) and `PurgeSoftDeletedLibraryItemsJob` (daily 03:00). |

### Frontend — files to create

| File | Responsibility |
|---|---|
| `frontend/src/features/library/api/lifecycleApi.ts` | TanStack Query hooks for promote/archive/restore + bulk + admin. |
| `frontend/src/features/library/types.ts` | TS types: `LibraryStatus`, `LibraryItemRow`, `CleanupSuggestion`. |
| `frontend/src/features/library/components/StatusTabs.tsx` | 4-tab segmented control with counts. |
| `frontend/src/features/library/components/BulkActionToolbar.tsx` | Toolbar visible on multi-select. |
| `frontend/src/features/library/components/AutoPromoteModal.tsx` | Catches 409, prompts user, promote-then-attach. |
| `frontend/src/features/library/components/CleanupBanner.tsx` | "You have N stale items" banner. |
| `frontend/src/features/library/pages/CleanupSuggestionsPage.tsx` | `/library/cleanup` page. |
| `frontend/src/features/library/hooks/useStatusFilter.ts` | Hook: reads `?status=` query param, defaults to `active`. |
| `frontend/src/features/library/hooks/useAutoPromoteOn409.ts` | Mutation wrapper that triggers the modal on 409. |
| `frontend/src/features/admin/library/pages/AdminLibraryPage.tsx` | `/admin/library` unified table. |
| `frontend/src/features/admin/library/components/AdminLibraryTable.tsx` | The table itself. |
| `frontend/src/features/admin/library/components/AdminLibraryFilters.tsx` | Owner / status / activity / study / created-before filters. |
| `frontend/src/features/admin/library/components/HardDeleteModal.tsx` | Preflight + confirmation. |
| `frontend/src/features/admin/library/components/ReassignOwnerModal.tsx` | Email-typing confirmation. |
| `frontend/src/features/admin/library/components/TrashTab.tsx` | Soft-deleted view. |
| `frontend/src/features/admin/library/api/adminLibraryApi.ts` | Admin endpoint hooks. |
| Vitest tests for each of the above components. | |
| `e2e/library-lifecycle.spec.ts` | Playwright golden-path E2E. |

### Frontend — files to modify

| File | Change |
|---|---|
| `frontend/src/features/concept-sets/pages/ConceptSetsListPage.tsx` (or equivalent) | Mount `StatusTabs` + `BulkActionToolbar` + `CleanupBanner`. |
| `frontend/src/features/cohort-definitions/pages/CohortDefinitionsListPage.tsx` | Same. |
| `frontend/src/features/analyses/pages/AnalysesListPage.tsx` | Same. |
| `frontend/src/features/concept-sets/api/conceptSetsApi.ts` | Add `status` query param to list hook. |
| `frontend/src/features/cohort-definitions/api/cohortDefinitionsApi.ts` | Same. |
| `frontend/src/features/analyses/api/analysesApi.ts` | Same. |
| Picker components inside `frontend/src/features/studies/components/workbench/*.tsx` | Add "Show my drafts" checkbox; route Draft attach through `useAutoPromoteOn409`. |
| `frontend/src/components/layout/Sidebar.tsx` | Add `/admin/library` superuser-only entry under Admin. |
| `frontend/src/App.tsx` (or routes file) | Register `/library/cleanup` + `/admin/library`. |
| `frontend/src/types/api.generated.ts` | Regenerated from OpenAPI after backend ships. |

---

# Phase A — Core lifecycle (backend foundation)

Ships: users can call `POST /api/v1/{entity}/{id}/promote|archive|restore` via API. List queries default to Active. No UI yet.

### Task A1: `LibraryStatus` enum

**Files:**
- Create: `backend/app/Enums/LibraryStatus.php`
- Test: `backend/tests/Unit/Enums/LibraryStatusTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Unit\Enums;

use App\Enums\LibraryStatus;
use Tests\TestCase;

class LibraryStatusTest extends TestCase
{
    public function test_has_three_cases_with_string_values(): void
    {
        $this->assertSame('draft', LibraryStatus::DRAFT->value);
        $this->assertSame('active', LibraryStatus::ACTIVE->value);
        $this->assertSame('archived', LibraryStatus::ARCHIVED->value);
    }

    public function test_values_helper_returns_all_string_values(): void
    {
        $this->assertSame(
            ['draft', 'active', 'archived'],
            LibraryStatus::values()
        );
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Enums/LibraryStatusTest.php"
```
Expected: FAIL — `Class "App\Enums\LibraryStatus" not found`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

namespace App\Enums;

enum LibraryStatus: string
{
    case DRAFT = 'draft';
    case ACTIVE = 'active';
    case ARCHIVED = 'archived';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $c) => $c->value, self::cases());
    }
}
```

- [ ] **Step 4: Run test to verify it passes + Pint**

```
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Enums/LibraryStatusTest.php && vendor/bin/pint app/Enums/LibraryStatus.php tests/Unit/Enums/LibraryStatusTest.php"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Enums/LibraryStatus.php backend/tests/Unit/Enums/LibraryStatusTest.php
git commit -m "feat(library): add LibraryStatus enum (draft/active/archived)"
```

---

### Task A2: Migration — add lifecycle columns to `concept_sets`

**Files:**
- Create: `backend/database/migrations/2026_05_13_190001_add_library_lifecycle_columns_to_concept_sets.php`
- Test: `backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Migrations;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LibraryLifecycleColumnsTest extends TestCase
{
    use RefreshDatabase;

    public function test_concept_sets_has_lifecycle_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('concept_sets', [
            'status', 'archived_at', 'archived_by', 'promoted_at',
        ]));
    }

    public function test_concept_sets_status_defaults_to_active(): void
    {
        $id = \DB::table('concept_sets')->insertGetId([
            'name' => 'test',
            'created_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->assertSame('active', \DB::table('concept_sets')->where('id', $id)->value('status'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Migrations/LibraryLifecycleColumnsTest.php --filter=concept_sets"
```
Expected: FAIL — column `status` missing.

- [ ] **Step 3: Write the migration**

```php
<?php

use App\Enums\LibraryStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('concept_sets', function (Blueprint $table) {
            $table->string('status', 16)->default(LibraryStatus::ACTIVE->value)->index();
            $table->timestamp('archived_at')->nullable();
            $table->unsignedBigInteger('archived_by')->nullable();
            $table->timestamp('promoted_at')->nullable();
            $table->foreign('archived_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('concept_sets', function (Blueprint $table) {
            $table->dropForeign(['archived_by']);
            $table->dropColumn(['status', 'archived_at', 'archived_by', 'promoted_at']);
        });
    }
};
```

- [ ] **Step 4: Run tests + Pint**

```
docker compose exec -T php sh -c "cd /var/www/html && php artisan migrate:fresh --env=testing && vendor/bin/pest tests/Feature/Migrations/LibraryLifecycleColumnsTest.php && vendor/bin/pint database/migrations/2026_05_13_190001_add_library_lifecycle_columns_to_concept_sets.php"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_05_13_190001_add_library_lifecycle_columns_to_concept_sets.php backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php
git commit -m "feat(library): add lifecycle columns to concept_sets"
```

---

### Task A3: Migration — `cohort_definitions` + fold `deprecated_at`

**Files:**
- Create: `backend/database/migrations/2026_05_13_190002_add_library_lifecycle_columns_to_cohort_definitions.php`
- Modify: `backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php` (add cases)

- [ ] **Step 1: Extend the test**

Append to `LibraryLifecycleColumnsTest.php`:

```php
public function test_cohort_definitions_has_lifecycle_columns(): void
{
    $this->assertTrue(Schema::hasColumns('cohort_definitions', [
        'status', 'archived_at', 'archived_by', 'promoted_at',
    ]));
}

public function test_cohort_definitions_deprecated_at_folded_to_archived(): void
{
    $id = \DB::table('cohort_definitions')->insertGetId([
        'name' => 'dep test',
        'expression' => '{}',
        'created_by' => 1,
        'deprecated_at' => now()->subDays(10),
        'created_at' => now()->subDays(30),
        'updated_at' => now()->subDays(10),
    ]);

    \Artisan::call('library:fold-deprecated-cohorts'); // see step 3

    $row = \DB::table('cohort_definitions')->where('id', $id)->first();
    $this->assertSame('archived', $row->status);
    $this->assertNotNull($row->archived_at);
}
```

- [ ] **Step 2: Run to confirm fail**

Same Pest command — expect failures on the new tests.

- [ ] **Step 3: Write the migration**

```php
<?php

use App\Enums\LibraryStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->string('status', 16)->default(LibraryStatus::ACTIVE->value)->index();
            $table->timestamp('archived_at')->nullable();
            $table->unsignedBigInteger('archived_by')->nullable();
            $table->timestamp('promoted_at')->nullable();
            $table->foreign('archived_by')->references('id')->on('users')->nullOnDelete();
        });

        // Fold existing deprecation into archived.
        DB::table('cohort_definitions')
            ->whereNotNull('deprecated_at')
            ->update([
                'status' => LibraryStatus::ARCHIVED->value,
                'archived_at' => DB::raw('deprecated_at'),
            ]);
    }

    public function down(): void
    {
        Schema::table('cohort_definitions', function (Blueprint $table) {
            $table->dropForeign(['archived_by']);
            $table->dropColumn(['status', 'archived_at', 'archived_by', 'promoted_at']);
        });
    }
};
```

The fold-at-migrate path replaces a separate Artisan command — drop the artisan call from the test:

Replace the `\Artisan::call(...)` line in the test with `// fold happens during migration`.

- [ ] **Step 4: Run + Pint**

```
docker compose exec -T php sh -c "cd /var/www/html && php artisan migrate:fresh --env=testing --seed && vendor/bin/pest tests/Feature/Migrations/LibraryLifecycleColumnsTest.php && vendor/bin/pint database/migrations/2026_05_13_190002_add_library_lifecycle_columns_to_cohort_definitions.php"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_05_13_190002_add_library_lifecycle_columns_to_cohort_definitions.php backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php
git commit -m "feat(library): lifecycle columns on cohort_definitions; fold deprecated_at"
```

---

### Task A4: Migration — 8 analyses tables in one migration

**Files:**
- Create: `backend/database/migrations/2026_05_13_190003_add_library_lifecycle_columns_to_analyses.php`
- Modify: `backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php`

- [ ] **Step 1: Extend the test**

```php
public function test_all_analyses_tables_have_lifecycle_columns(): void
{
    foreach ([
        'incidence_rate_analyses',
        'pathway_analyses',
        'estimation_analyses',
        'prediction_analyses',
        'feature_analyses',
        'sccs_analyses',
        'evidence_synthesis_analyses',
        'self_controlled_cohort_analyses',
    ] as $table) {
        $this->assertTrue(
            Schema::hasColumns($table, ['status', 'archived_at', 'archived_by', 'promoted_at']),
            "{$table} missing lifecycle columns"
        );
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Write the migration**

```php
<?php

use App\Enums\LibraryStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = [
        'incidence_rate_analyses',
        'pathway_analyses',
        'estimation_analyses',
        'prediction_analyses',
        'feature_analyses',
        'sccs_analyses',
        'evidence_synthesis_analyses',
        'self_controlled_cohort_analyses',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->string('status', 16)->default(LibraryStatus::ACTIVE->value)->index();
                $t->timestamp('archived_at')->nullable();
                $t->unsignedBigInteger('archived_by')->nullable();
                $t->timestamp('promoted_at')->nullable();
                $t->foreign('archived_by')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropForeign(['archived_by']);
                $t->dropColumn(['status', 'archived_at', 'archived_by', 'promoted_at']);
            });
        }
    }
};
```

- [ ] **Step 4: Run + Pint.** Same pattern as A3.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_05_13_190003_add_library_lifecycle_columns_to_analyses.php backend/tests/Feature/Migrations/LibraryLifecycleColumnsTest.php
git commit -m "feat(library): lifecycle columns on 8 analyses tables"
```

---

### Task A5: `library_cleanup_suggestions` cache table

**Files:**
- Create: `backend/database/migrations/2026_05_13_190004_create_library_cleanup_suggestions_table.php`
- Create: `backend/app/Models/App/LibraryCleanupSuggestion.php`
- Test: `backend/tests/Unit/Models/LibraryCleanupSuggestionTest.php`

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Unit\Models;

use App\Models\App\LibraryCleanupSuggestion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LibraryCleanupSuggestionTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_persist_and_read(): void
    {
        LibraryCleanupSuggestion::create([
            'user_id' => 1,
            'item_type' => 'cohort_definition',
            'item_id' => 42,
            'last_activity_at' => now()->subDays(120),
            'computed_at' => now(),
        ]);

        $row = LibraryCleanupSuggestion::first();
        $this->assertSame('cohort_definition', $row->item_type);
        $this->assertSame(42, $row->item_id);
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Migration + model**

Migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('library_cleanup_suggestions', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id');
            $table->string('item_type', 64);
            $table->unsignedBigInteger('item_id');
            $table->timestamp('last_activity_at')->nullable();
            $table->timestamp('computed_at');

            $table->primary(['user_id', 'item_type', 'item_id']);
            $table->index('computed_at');
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('library_cleanup_suggestions');
    }
};
```

Model:

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class LibraryCleanupSuggestion extends Model
{
    protected $table = 'library_cleanup_suggestions';
    public $timestamps = false;
    public $incrementing = false;
    protected $primaryKey = null;

    protected $fillable = [
        'user_id', 'item_type', 'item_id', 'last_activity_at', 'computed_at',
    ];

    protected $casts = [
        'last_activity_at' => 'datetime',
        'computed_at' => 'datetime',
    ];
}
```

- [ ] **Step 4: Run + Pint.**

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_05_13_190004_create_library_cleanup_suggestions_table.php backend/app/Models/App/LibraryCleanupSuggestion.php backend/tests/Unit/Models/LibraryCleanupSuggestionTest.php
git commit -m "feat(library): cleanup suggestions cache table + model"
```

---

### Task A6: `HasLibraryLifecycle` trait — casts + transitions

**Files:**
- Create: `backend/app/Concerns/HasLibraryLifecycle.php`
- Test: `backend/tests/Unit/Concerns/HasLibraryLifecycleTest.php`
- Modify: `backend/app/Models/App/ConceptSet.php` (apply trait — needed so the test has a real consumer)

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Unit\Concerns;

use App\Enums\LibraryStatus;
use App\Models\App\ConceptSet;
use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HasLibraryLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function makeSet(LibraryStatus $status): ConceptSet
    {
        $owner = User::factory()->create();
        return ConceptSet::factory()->create([
            'created_by' => $owner->id,
            'status' => $status->value,
        ]);
    }

    public function test_promote_marks_active_and_stamps_promoted_at(): void
    {
        $set = $this->makeSet(LibraryStatus::DRAFT);
        $actor = User::factory()->create();

        $set->promote($actor);

        $this->assertSame('active', $set->status->value);
        $this->assertNotNull($set->promoted_at);
    }

    public function test_archive_stamps_archived_at_and_archived_by(): void
    {
        $set = $this->makeSet(LibraryStatus::ACTIVE);
        $actor = User::factory()->create();

        $set->archive($actor);

        $this->assertSame('archived', $set->status->value);
        $this->assertSame($actor->id, $set->archived_by);
        $this->assertNotNull($set->archived_at);
    }

    public function test_restore_from_archived_clears_archive_stamps(): void
    {
        $set = $this->makeSet(LibraryStatus::ARCHIVED);
        $set->forceFill(['archived_at' => now(), 'archived_by' => 1])->save();

        $set->restore_lifecycle(User::factory()->create());

        $this->assertSame('active', $set->status->value);
        $this->assertNull($set->archived_at);
        $this->assertNull($set->archived_by);
    }

    public function test_promote_on_already_active_is_noop(): void
    {
        $set = $this->makeSet(LibraryStatus::ACTIVE);
        $originalPromotedAt = $set->promoted_at;

        $set->promote(User::factory()->create());

        $this->assertSame('active', $set->status->value);
        $this->assertEquals($originalPromotedAt, $set->fresh()->promoted_at);
    }
}
```

(Method name is `restore_lifecycle` to avoid colliding with SoftDeletes `restore()`.)

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Concerns;

use App\Enums\LibraryStatus;
use App\Models\App\User;
use App\Scopes\LibraryDefaultScope;

trait HasLibraryLifecycle
{
    public static function bootHasLibraryLifecycle(): void
    {
        static::addGlobalScope(new LibraryDefaultScope());
    }

    public function initializeHasLibraryLifecycle(): void
    {
        $this->mergeCasts(['status' => LibraryStatus::class]);
        $this->mergeCasts(['archived_at' => 'datetime', 'promoted_at' => 'datetime']);
    }

    public function promote(User $actor): self
    {
        if ($this->status === LibraryStatus::ACTIVE) {
            return $this;
        }
        $this->status = LibraryStatus::ACTIVE;
        if ($this->promoted_at === null) {
            $this->promoted_at = now();
        }
        $this->archived_at = null;
        $this->archived_by = null;
        $this->save();
        return $this;
    }

    public function archive(User $actor): self
    {
        if ($this->status === LibraryStatus::ARCHIVED) {
            return $this;
        }
        $this->status = LibraryStatus::ARCHIVED;
        $this->archived_at = now();
        $this->archived_by = $actor->id;
        $this->save();
        return $this;
    }

    public function restore_lifecycle(User $actor): self
    {
        if ($this->status !== LibraryStatus::ARCHIVED) {
            return $this;
        }
        $this->status = LibraryStatus::ACTIVE;
        $this->archived_at = null;
        $this->archived_by = null;
        $this->save();
        return $this;
    }

    public function scopeActive($query)
    {
        return $query->where($this->getTable().'.status', LibraryStatus::ACTIVE->value);
    }

    public function scopeDraft($query)
    {
        return $query->where($this->getTable().'.status', LibraryStatus::DRAFT->value);
    }

    public function scopeArchived($query)
    {
        return $query->where($this->getTable().'.status', LibraryStatus::ARCHIVED->value);
    }

    public function scopeOwnedBy($query, User $user)
    {
        return $query->where($this->getTable().'.created_by', $user->id);
    }
}
```

Apply to `ConceptSet`:

```php
// backend/app/Models/App/ConceptSet.php — class body
use \App\Concerns\HasLibraryLifecycle;
```

And add `LibraryDefaultScope` as a no-op for now (we wire it up properly in A7):

```php
<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class LibraryDefaultScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        // Default behavior wired in Task A7.
    }
}
```

- [ ] **Step 4: Run + Pint + PHPStan**

```
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Concerns/HasLibraryLifecycleTest.php && vendor/bin/pint app/Concerns app/Scopes app/Models/App/ConceptSet.php && vendor/bin/phpstan analyse app/Concerns app/Scopes --memory-limit=512M"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Concerns/HasLibraryLifecycle.php backend/app/Scopes/LibraryDefaultScope.php backend/app/Models/App/ConceptSet.php backend/tests/Unit/Concerns/HasLibraryLifecycleTest.php
git commit -m "feat(library): HasLibraryLifecycle trait + transitions"
```

---

### Task A7: `LibraryDefaultScope` — hide Drafts (non-owner) + Archived

**Files:**
- Modify: `backend/app/Scopes/LibraryDefaultScope.php`
- Test: `backend/tests/Unit/Scopes/LibraryDefaultScopeTest.php`

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Unit\Scopes;

use App\Enums\LibraryStatus;
use App\Models\App\ConceptSet;
use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LibraryDefaultScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_query_returns_active_owned_drafts_and_others_active_only(): void
    {
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        ConceptSet::factory()->create(['created_by' => $alice->id, 'status' => 'active']);
        ConceptSet::factory()->create(['created_by' => $alice->id, 'status' => 'draft']);
        ConceptSet::factory()->create(['created_by' => $alice->id, 'status' => 'archived']);
        ConceptSet::factory()->create(['created_by' => $bob->id, 'status' => 'active']);
        ConceptSet::factory()->create(['created_by' => $bob->id, 'status' => 'draft']);

        $this->actingAs($alice);

        $rows = ConceptSet::query()->get();

        // Alice sees: her active + her draft + Bob's active.  NOT her archived, NOT Bob's draft.
        $this->assertCount(3, $rows);
    }

    public function test_with_archived_includes_archived(): void
    {
        $alice = User::factory()->create();
        $this->actingAs($alice);
        ConceptSet::factory()->create(['created_by' => $alice->id, 'status' => 'archived']);

        $this->assertCount(1, ConceptSet::query()->withArchived()->get());
        $this->assertCount(0, ConceptSet::query()->get());
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Scopes;

use App\Enums\LibraryStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

class LibraryDefaultScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $userId = Auth::id();
        $table = $model->getTable();

        // Hide archived by default.
        $builder->where(function (Builder $q) use ($table, $userId) {
            $q->where("{$table}.status", LibraryStatus::ACTIVE->value);
            if ($userId !== null) {
                // Owner sees their own drafts too.
                $q->orWhere(function (Builder $sub) use ($table, $userId) {
                    $sub->where("{$table}.status", LibraryStatus::DRAFT->value)
                        ->where("{$table}.created_by", $userId);
                });
            }
        });
    }

    public function extend(Builder $builder): void
    {
        $builder->macro('withAnyStatus', fn (Builder $b) => $b->withoutGlobalScope(self::class));
        $builder->macro('withArchived', function (Builder $b) {
            return $b->withoutGlobalScope(self::class);
        });
        $builder->macro('withDrafts', function (Builder $b) {
            return $b->withoutGlobalScope(self::class);
        });
        $builder->macro('asSuperUser', fn (Builder $b) => $b->withoutGlobalScope(self::class));
    }
}
```

- [ ] **Step 4: Run + Pint.**

- [ ] **Step 5: Commit**

```bash
git add backend/app/Scopes/LibraryDefaultScope.php backend/tests/Unit/Scopes/LibraryDefaultScopeTest.php
git commit -m "feat(library): default scope hides drafts (non-owner) + archived"
```

---

### Task A8: Apply trait to `CohortDefinition` + 8 analyses

**Files:**
- Modify: `backend/app/Models/App/CohortDefinition.php`
- Modify: `backend/app/Models/App/IncidenceRateAnalysis.php`
- Modify: `backend/app/Models/App/PathwayAnalysis.php`
- Modify: `backend/app/Models/App/EstimationAnalysis.php`
- Modify: `backend/app/Models/App/PredictionAnalysis.php`
- Modify: `backend/app/Models/App/FeatureAnalysis.php`
- Modify: `backend/app/Models/App/SccsAnalysis.php`
- Modify: `backend/app/Models/App/EvidenceSynthesisAnalysis.php`
- Modify: `backend/app/Models/App/SelfControlledCohortAnalysis.php`
- Test: `backend/tests/Unit/Concerns/HasLibraryLifecycleTraitAppliedTest.php`

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Unit\Concerns;

use App\Concerns\HasLibraryLifecycle;
use Tests\TestCase;

class HasLibraryLifecycleTraitAppliedTest extends TestCase
{
    /**
     * @dataProvider models
     */
    public function test_model_uses_trait(string $class): void
    {
        $traits = class_uses_recursive($class);
        $this->assertContains(HasLibraryLifecycle::class, $traits, "{$class} missing HasLibraryLifecycle");
    }

    public static function models(): array
    {
        return [
            [\App\Models\App\ConceptSet::class],
            [\App\Models\App\CohortDefinition::class],
            [\App\Models\App\IncidenceRateAnalysis::class],
            [\App\Models\App\PathwayAnalysis::class],
            [\App\Models\App\EstimationAnalysis::class],
            [\App\Models\App\PredictionAnalysis::class],
            [\App\Models\App\FeatureAnalysis::class],
            [\App\Models\App\SccsAnalysis::class],
            [\App\Models\App\EvidenceSynthesisAnalysis::class],
            [\App\Models\App\SelfControlledCohortAnalysis::class],
        ];
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Apply trait to each model**

In each model class body, add:

```php
use \App\Concerns\HasLibraryLifecycle;
```

- [ ] **Step 4: Run + Pint + PHPStan**

```
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Concerns/HasLibraryLifecycleTraitAppliedTest.php && vendor/bin/pint app/Models/App && vendor/bin/phpstan analyse app/Models/App --memory-limit=512M"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Models/App/ backend/tests/Unit/Concerns/HasLibraryLifecycleTraitAppliedTest.php
git commit -m "feat(library): apply HasLibraryLifecycle to CohortDefinition + 8 analyses"
```

---

### Task A9: `LibraryLifecyclePolicy` trait + per-model policies

**Files:**
- Create: `backend/app/Policies/Concerns/AuthorizesLibraryLifecycle.php`
- Modify: `backend/app/Policies/ConceptSetPolicy.php`
- Modify: `backend/app/Policies/CohortDefinitionPolicy.php`
- Create: `backend/app/Policies/AnalysisPolicy.php` (if not present; otherwise modify the existing)
- Modify: `backend/app/Providers/AuthServiceProvider.php`
- Test: `backend/tests/Unit/Policies/LibraryLifecyclePolicyTest.php`

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Unit\Policies;

use App\Enums\LibraryStatus;
use App\Models\App\ConceptSet;
use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LibraryLifecyclePolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_promote_archive_restore_own_item(): void
    {
        $owner = User::factory()->create();
        $set = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'draft']);

        $this->assertTrue($owner->can('promote', $set));
        $this->assertTrue($owner->can('archive', $set));
    }

    public function test_non_owner_cannot_promote_others_item(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $set = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'draft']);

        $this->assertFalse($stranger->can('promote', $set));
    }

    public function test_super_admin_can_hard_delete_archived_with_no_attachments(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $owner = User::factory()->create();
        $set = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'archived']);

        $this->assertTrue($super->can('hardDelete', $set));
    }

    public function test_super_admin_cannot_hard_delete_non_archived(): void
    {
        $super = User::factory()->create();
        $super->assignRole('super-admin');
        $set = ConceptSet::factory()->create(['status' => 'active']);

        $this->assertFalse($super->can('hardDelete', $set));
    }

    public function test_regular_user_cannot_hard_delete_even_own_archived(): void
    {
        $owner = User::factory()->create();
        $set = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'archived']);

        $this->assertFalse($owner->can('hardDelete', $set));
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implement trait + policies**

`AuthorizesLibraryLifecycle.php`:

```php
<?php

namespace App\Policies\Concerns;

use App\Enums\LibraryStatus;
use App\Models\App\User;
use Illuminate\Database\Eloquent\Model;

trait AuthorizesLibraryLifecycle
{
    public function promote(User $user, Model $item): bool
    {
        return $this->isOwner($user, $item) || $user->hasRole('super-admin');
    }

    public function archive(User $user, Model $item): bool
    {
        return $this->isOwner($user, $item) || $user->hasRole('super-admin');
    }

    public function restoreLifecycle(User $user, Model $item): bool
    {
        return $this->isOwner($user, $item) || $user->hasRole('super-admin');
    }

    public function hardDelete(User $user, Model $item): bool
    {
        if (! $user->hasRole('super-admin')) {
            return false;
        }
        return $item->status === LibraryStatus::ARCHIVED;
        // Attachment-count check is enforced in the controller pre-flight (data-dependent).
    }

    private function isOwner(User $user, Model $item): bool
    {
        return (int) $item->created_by === (int) $user->id;
    }
}
```

In each of `ConceptSetPolicy`, `CohortDefinitionPolicy`, `AnalysisPolicy` (one shared, used by all 8 models — register in AuthServiceProvider):

```php
use \App\Policies\Concerns\AuthorizesLibraryLifecycle;
```

Register policies in `AuthServiceProvider::boot()`:

```php
protected $policies = [
    \App\Models\App\ConceptSet::class => \App\Policies\ConceptSetPolicy::class,
    \App\Models\App\CohortDefinition::class => \App\Policies\CohortDefinitionPolicy::class,
    \App\Models\App\IncidenceRateAnalysis::class => \App\Policies\AnalysisPolicy::class,
    \App\Models\App\PathwayAnalysis::class => \App\Policies\AnalysisPolicy::class,
    \App\Models\App\EstimationAnalysis::class => \App\Policies\AnalysisPolicy::class,
    \App\Models\App\PredictionAnalysis::class => \App\Policies\AnalysisPolicy::class,
    \App\Models\App\FeatureAnalysis::class => \App\Policies\AnalysisPolicy::class,
    \App\Models\App\SccsAnalysis::class => \App\Policies\AnalysisPolicy::class,
    \App\Models\App\EvidenceSynthesisAnalysis::class => \App\Policies\AnalysisPolicy::class,
    \App\Models\App\SelfControlledCohortAnalysis::class => \App\Policies\AnalysisPolicy::class,
];
```

(Add or merge — do not replace any existing `$policies` entries.)

Map the controller's `restore` action to policy method `restoreLifecycle` via explicit `$this->authorize('restoreLifecycle', $item)`.

- [ ] **Step 4: Run + Pint + PHPStan.**

- [ ] **Step 5: Commit**

```bash
git add backend/app/Policies backend/app/Providers/AuthServiceProvider.php backend/tests/Unit/Policies/LibraryLifecyclePolicyTest.php
git commit -m "feat(library): lifecycle policies for owner + super-admin"
```

---

### Task A10: `LifecycleController` — single-item endpoints

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/Library/LifecycleController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/Library/LifecycleControllerTest.php`

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Feature\Api\V1\Library;

use App\Models\App\ConceptSet;
use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LifecycleControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_promote_draft_concept_set(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');
        $set = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'draft']);
        Sanctum::actingAs($owner);

        $resp = $this->postJson("/api/v1/concept-sets/{$set->id}/promote");

        $resp->assertOk();
        $this->assertSame('active', $set->fresh()->status->value);
    }

    public function test_non_owner_promote_returns_403(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $other->givePermissionTo('concept-sets.edit');
        $set = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'draft']);
        Sanctum::actingAs($other);

        $this->postJson("/api/v1/concept-sets/{$set->id}/promote")->assertForbidden();
    }

    public function test_archive_then_restore(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo('concept-sets.edit');
        $set = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'active']);
        Sanctum::actingAs($owner);

        $this->postJson("/api/v1/concept-sets/{$set->id}/archive")->assertOk();
        $this->assertSame('archived', $set->fresh()->status->value);

        $this->postJson("/api/v1/concept-sets/{$set->id}/restore")->assertOk();
        $this->assertSame('active', $set->fresh()->status->value);
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Controller + routes**

Controller:

```php
<?php

namespace App\Http\Controllers\Api\V1\Library;

use App\Http\Controllers\Controller;
use App\Models\App\ConceptSet;
use App\Models\App\CohortDefinition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LifecycleController extends Controller
{
    public function promote(Request $request, string $entity, int $id): JsonResponse
    {
        $item = $this->resolve($entity, $id);
        $this->authorize('promote', $item);
        $item->promote($request->user());
        return response()->json(['id' => $item->id, 'status' => $item->status->value]);
    }

    public function archive(Request $request, string $entity, int $id): JsonResponse
    {
        $item = $this->resolve($entity, $id);
        $this->authorize('archive', $item);
        $item->archive($request->user());
        return response()->json(['id' => $item->id, 'status' => $item->status->value]);
    }

    public function restore(Request $request, string $entity, int $id): JsonResponse
    {
        $item = $this->resolve($entity, $id);
        $this->authorize('restoreLifecycle', $item);
        $item->restore_lifecycle($request->user());
        return response()->json(['id' => $item->id, 'status' => $item->status->value]);
    }

    private function resolve(string $entity, int $id): Model
    {
        $map = [
            'concept-sets' => ConceptSet::class,
            'cohort-definitions' => CohortDefinition::class,
            'incidence-rate-analyses' => \App\Models\App\IncidenceRateAnalysis::class,
            'pathway-analyses' => \App\Models\App\PathwayAnalysis::class,
            'estimation-analyses' => \App\Models\App\EstimationAnalysis::class,
            'prediction-analyses' => \App\Models\App\PredictionAnalysis::class,
            'feature-analyses' => \App\Models\App\FeatureAnalysis::class,
            'sccs-analyses' => \App\Models\App\SccsAnalysis::class,
            'evidence-synthesis-analyses' => \App\Models\App\EvidenceSynthesisAnalysis::class,
            'self-controlled-cohort-analyses' => \App\Models\App\SelfControlledCohortAnalysis::class,
        ];
        abort_unless(isset($map[$entity]), 404);
        return $map[$entity]::query()->withAnyStatus()->findOrFail($id);
    }
}
```

Routes (`backend/routes/api.php`) inside the `auth:sanctum` v1 group:

```php
use App\Http\Controllers\Api\V1\Library\LifecycleController;

foreach ([
    'concept-sets' => 'concept-sets',
    'cohort-definitions' => 'cohorts',
    'incidence-rate-analyses' => 'analyses',
    'pathway-analyses' => 'analyses',
    'estimation-analyses' => 'analyses',
    'prediction-analyses' => 'analyses',
    'feature-analyses' => 'analyses',
    'sccs-analyses' => 'analyses',
    'evidence-synthesis-analyses' => 'analyses',
    'self-controlled-cohort-analyses' => 'analyses',
] as $entity => $permDomain) {
    Route::middleware("permission:{$permDomain}.edit")->group(function () use ($entity) {
        Route::post("/{$entity}/{id}/promote", [LifecycleController::class, 'promote'])->whereNumber('id');
        Route::post("/{$entity}/{id}/archive", [LifecycleController::class, 'archive'])->whereNumber('id');
        Route::post("/{$entity}/{id}/restore", [LifecycleController::class, 'restore'])->whereNumber('id');
    });
}
```

- [ ] **Step 4: Run + Pint + PHPStan.**

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Library backend/routes/api.php backend/tests/Feature/Api/V1/Library/LifecycleControllerTest.php
git commit -m "feat(library): promote/archive/restore endpoints for all lifecycle entities"
```

---

### Task A11: Bulk endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Library/LifecycleController.php`
- Create: `backend/app/Http/Requests/Library/BulkArchiveRequest.php`
- Modify: `backend/routes/api.php`
- Test: extend `LifecycleControllerTest.php`

- [ ] **Step 1: Add tests for bulk archive (ids array, per-id policy enforcement, partial-failure behavior)**

```php
public function test_bulk_archive_archives_only_authorized_ids(): void
{
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $owner->givePermissionTo('concept-sets.edit');

    $mine = ConceptSet::factory()->create(['created_by' => $owner->id, 'status' => 'active']);
    $theirs = ConceptSet::factory()->create(['created_by' => $other->id, 'status' => 'active']);

    Sanctum::actingAs($owner);

    $resp = $this->postJson('/api/v1/concept-sets/bulk-archive', [
        'ids' => [$mine->id, $theirs->id],
    ]);

    $resp->assertOk()->assertJson([
        'archived' => [$mine->id],
        'skipped' => [$theirs->id],
    ]);
    $this->assertSame('archived', $mine->fresh()->status->value);
    $this->assertSame('active', $theirs->fresh()->status->value);
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

Form Request:

```php
<?php

namespace App\Http\Requests\Library;

use Illuminate\Foundation\Http\FormRequest;

class BulkArchiveRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1|max:500',
            'ids.*' => 'integer',
        ];
    }
}
```

Controller methods:

```php
public function bulkArchive(BulkArchiveRequest $request, string $entity): JsonResponse
{
    return $this->bulk($request, $entity, 'archive', fn ($i, $u) => $i->archive($u));
}

public function bulkRestore(BulkArchiveRequest $request, string $entity): JsonResponse
{
    return $this->bulk($request, $entity, 'restoreLifecycle', fn ($i, $u) => $i->restore_lifecycle($u));
}

private function bulk(BulkArchiveRequest $request, string $entity, string $ability, \Closure $action): JsonResponse
{
    $modelClass = $this->resolveClass($entity);
    $items = $modelClass::query()->withAnyStatus()->whereIn('id', $request->input('ids'))->get();
    $done = []; $skipped = [];

    foreach ($items as $item) {
        if ($request->user()->can($ability, $item)) {
            $action($item, $request->user());
            $done[] = $item->id;
        } else {
            $skipped[] = $item->id;
        }
    }

    return response()->json(['archived' => $done, 'skipped' => $skipped]);
}
```

(The response key is `archived` for both — frontend reads `done` semantics. If preferred, rename to `done` / `skipped`.)

Refactor `resolve()` so `resolveClass(string): string` returns just the class.

Routes — add to each of the 10 entity groups:

```php
Route::post("/{$entity}/bulk-archive", [LifecycleController::class, 'bulkArchive']);
Route::post("/{$entity}/bulk-restore", [LifecycleController::class, 'bulkRestore']);
```

- [ ] **Step 4: Run + Pint.**

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Library backend/app/Http/Requests/Library backend/routes/api.php backend/tests/Feature/Api/V1/Library/LifecycleControllerTest.php
git commit -m "feat(library): bulk-archive and bulk-restore endpoints"
```

---

### Task A12: Phase A wrap — deploy preflight

- [ ] Run all backend checks:

```
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test && vendor/bin/phpstan analyse --memory-limit=512M && vendor/bin/pest --parallel"
```

- [ ] If green: deploy backend changes with `./deploy.sh --php`.

- [ ] Manual smoke test (via curl with a real Sanctum token):

```bash
curl -X POST -H "Authorization: Bearer <token>" https://parthenon.acumenus.net/api/v1/concept-sets/<some-id>/archive
```

Expect `200 OK {"id":<id>,"status":"archived"}`.

---

# Phase B — User UI + auto-promote (frontend + 409 contract)

Ships: users see Draft/Active/Archived tabs on `/concept-sets`, `/cohort-definitions`, `/analyses`; can bulk-archive; auto-promote modal works when attaching Drafts to Studies.

### Task B1: `RequiresPromotionException` + handler rendering

**Files:**
- Create: `backend/app/Exceptions/RequiresPromotionException.php`
- Modify: `backend/app/Exceptions/Handler.php`
- Test: `backend/tests/Unit/Exceptions/RequiresPromotionExceptionTest.php`

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Unit\Exceptions;

use App\Exceptions\RequiresPromotionException;
use Tests\TestCase;

class RequiresPromotionExceptionTest extends TestCase
{
    public function test_renders_409_with_contract_body(): void
    {
        $exc = new RequiresPromotionException(itemType: 'cohort_definition', itemId: 42, itemName: 'CHF v3');
        $response = $exc->render(request());

        $this->assertSame(409, $response->status());
        $payload = $response->getData(true);
        $this->assertTrue($payload['requires_promotion']);
        $this->assertSame('cohort_definition', $payload['item_type']);
        $this->assertSame(42, $payload['item_id']);
        $this->assertSame('CHF v3', $payload['item_name']);
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class RequiresPromotionException extends RuntimeException
{
    public function __construct(
        public readonly string $itemType,
        public readonly int $itemId,
        public readonly string $itemName,
    ) {
        parent::__construct("Draft item {$itemType}#{$itemId} requires promotion before attach.");
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json([
            'requires_promotion' => true,
            'item_type' => $this->itemType,
            'item_id' => $this->itemId,
            'item_name' => $this->itemName,
            'message' => 'This draft must be promoted to Active before it can be attached.',
        ], 409);
    }
}
```

Laravel auto-detects `render()` on the exception, so no Handler change needed unless you also want explicit logging. Skip Handler modification.

- [ ] **Step 4: Run + Pint.**

- [ ] **Step 5: Commit**

```bash
git add backend/app/Exceptions/RequiresPromotionException.php backend/tests/Unit/Exceptions/RequiresPromotionExceptionTest.php
git commit -m "feat(library): RequiresPromotionException → 409 contract"
```

---

### Task B2: Wire interceptor into `StudyCohortController`

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/StudyCohortController.php`
- Test: `backend/tests/Feature/Api/V1/StudyCohortAttachAutoPromoteTest.php`

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Feature\Api\V1;

use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudyCohortAttachAutoPromoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_attaching_draft_cohort_returns_409_with_contract(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(['studies.edit', 'cohorts.edit']);
        Sanctum::actingAs($owner);

        $study = Study::factory()->create(['owner_id' => $owner->id]);
        $cohort = CohortDefinition::factory()->create([
            'created_by' => $owner->id,
            'status' => 'draft',
            'name' => 'My Draft',
        ]);

        $resp = $this->postJson("/api/v1/studies/{$study->id}/cohorts", [
            'cohort_definition_id' => $cohort->id,
        ]);

        $resp->assertStatus(409)
            ->assertJson([
                'requires_promotion' => true,
                'item_type' => 'cohort_definition',
                'item_id' => $cohort->id,
                'item_name' => 'My Draft',
            ]);
    }

    public function test_attaching_active_cohort_succeeds(): void
    {
        $owner = User::factory()->create();
        $owner->givePermissionTo(['studies.edit', 'cohorts.edit']);
        Sanctum::actingAs($owner);

        $study = Study::factory()->create(['owner_id' => $owner->id]);
        $cohort = CohortDefinition::factory()->create([
            'created_by' => $owner->id,
            'status' => 'active',
        ]);

        $this->postJson("/api/v1/studies/{$study->id}/cohorts", [
            'cohort_definition_id' => $cohort->id,
        ])->assertSuccessful();
    }
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Wire interceptor**

In `StudyCohortController::attach()` (or whatever the existing method is), before the actual attachment:

```php
use App\Enums\LibraryStatus;
use App\Exceptions\RequiresPromotionException;
use App\Models\App\CohortDefinition;

// ...

$cohort = CohortDefinition::query()->withAnyStatus()->findOrFail($request->cohort_definition_id);

if ($cohort->status === LibraryStatus::DRAFT && $cohort->created_by === $request->user()->id) {
    throw new RequiresPromotionException(
        itemType: 'cohort_definition',
        itemId: $cohort->id,
        itemName: $cohort->name,
    );
}

if ($cohort->status === LibraryStatus::DRAFT) {
    abort(403, 'You cannot attach another user\'s draft.');
}
if ($cohort->status === LibraryStatus::ARCHIVED) {
    abort(422, 'Cannot attach archived cohort definitions.');
}
```

- [ ] **Step 4: Run + Pint.** If existing tests around this controller fail because they don't seed `status`, the migration default `'active'` should already handle them — but verify.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/StudyCohortController.php backend/tests/Feature/Api/V1/StudyCohortAttachAutoPromoteTest.php
git commit -m "feat(library): 409 auto-promote contract on study-cohort attach"
```

---

### Task B3: Wire interceptor into `StudyDesignController` (concept sets + analyses)

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/StudyDesignController.php`
- Test: extend `StudyCohortAttachAutoPromoteTest.php` with concept-set + analysis variants

- [ ] **Step 1: Write tests** for analogous draft-attach paths for concept sets and one analysis type. Same shape as B2's test.

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Apply the same pre-flight pattern** to every attach endpoint in `StudyDesignController` that takes a concept-set or analysis ID. Factor the check into a private helper:

```php
private function ensurePromoted(\Illuminate\Database\Eloquent\Model $item, string $type, \App\Models\App\User $actor): void
{
    if ($item->status === LibraryStatus::DRAFT && (int) $item->created_by === (int) $actor->id) {
        throw new RequiresPromotionException($type, $item->id, $item->name ?? '');
    }
    if ($item->status === LibraryStatus::DRAFT) {
        abort(403, 'You cannot attach another user\'s draft.');
    }
    if ($item->status === LibraryStatus::ARCHIVED) {
        abort(422, "Cannot attach archived {$type}.");
    }
}
```

Call `ensurePromoted()` everywhere the controller resolves a concept set or analysis from the request.

- [ ] **Step 4: Run + Pint + PHPStan.**

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/StudyDesignController.php backend/tests/Feature/Api/V1/StudyCohortAttachAutoPromoteTest.php
git commit -m "feat(library): 409 auto-promote on study-design attach endpoints"
```

---

### Task B4: Frontend types + lifecycle API hooks

**Files:**
- Create: `frontend/src/features/library/types.ts`
- Create: `frontend/src/features/library/api/lifecycleApi.ts`
- Test: `frontend/src/features/library/api/__tests__/lifecycleApi.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePromoteItem } from "../lifecycleApi";
import { apiClient } from "@/lib/apiClient";

vi.mock("@/lib/apiClient", () => ({
  apiClient: { post: vi.fn() },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("usePromoteItem", () => {
  it("posts to /promote with entity+id", async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 5, status: "active" },
    });

    const { result } = renderHook(() => usePromoteItem("concept-sets"), { wrapper: wrap() });
    result.current.mutate(5);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith("/concept-sets/5/promote");
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```
docker compose exec -T node sh -c "cd /app && npx vitest run src/features/library/api/__tests__/lifecycleApi.test.ts"
```

- [ ] **Step 3: Implementation**

`types.ts`:

```ts
export type LibraryStatus = "draft" | "active" | "archived";

export type LibraryEntity =
  | "concept-sets"
  | "cohort-definitions"
  | "incidence-rate-analyses"
  | "pathway-analyses"
  | "estimation-analyses"
  | "prediction-analyses"
  | "feature-analyses"
  | "sccs-analyses"
  | "evidence-synthesis-analyses"
  | "self-controlled-cohort-analyses";

export interface LifecycleResponse {
  id: number;
  status: LibraryStatus;
}

export interface BulkResponse {
  archived: number[];
  skipped: number[];
}

export interface RequiresPromotionPayload {
  requires_promotion: true;
  item_type: string;
  item_id: number;
  item_name: string;
  message: string;
}
```

`lifecycleApi.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import type { LibraryEntity, LifecycleResponse, BulkResponse } from "../types";

export function usePromoteItem(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(`/${entity}/${id}/promote`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useArchiveItem(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(`/${entity}/${id}/archive`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useRestoreItem(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number): Promise<LifecycleResponse> => {
      const { data } = await apiClient.post<LifecycleResponse>(`/${entity}/${id}/restore`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useBulkArchive(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]): Promise<BulkResponse> => {
      const { data } = await apiClient.post<BulkResponse>(`/${entity}/bulk-archive`, { ids });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}

export function useBulkRestore(entity: LibraryEntity) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]): Promise<BulkResponse> => {
      const { data } = await apiClient.post<BulkResponse>(`/${entity}/bulk-restore`, { ids });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [entity] }),
  });
}
```

- [ ] **Step 4: Run + tsc + vite build**

```
docker compose exec -T node sh -c "cd /app && npx vitest run src/features/library && npx tsc --noEmit && npx vite build"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/library/types.ts frontend/src/features/library/api frontend/src/features/library/api/__tests__
git commit -m "feat(library): TS types + TanStack Query hooks for lifecycle"
```

---

### Task B5: `StatusTabs` component

**Files:**
- Create: `frontend/src/features/library/components/StatusTabs.tsx`
- Test: `frontend/src/features/library/components/__tests__/StatusTabs.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusTabs } from "../StatusTabs";

describe("StatusTabs", () => {
  it("renders four tabs with counts and calls onChange", () => {
    const onChange = vi.fn();
    render(
      <StatusTabs
        value="active"
        counts={{ active: 12, draft: 3, archived: 5, all: 20 }}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/Active.*12/)).toBeInTheDocument();
    expect(screen.getByText(/Drafts.*3/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Drafts/));
    expect(onChange).toHaveBeenCalledWith("draft");
  });
});
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```tsx
import { type LibraryStatus } from "../types";

export type StatusTab = LibraryStatus | "all";

interface Props {
  value: StatusTab;
  counts: Record<StatusTab, number>;
  onChange: (v: StatusTab) => void;
}

const TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All mine" },
];

export function StatusTabs({ value, counts, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md bg-zinc-900 p-1 ring-1 ring-zinc-800" role="tablist">
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={
              "px-3 py-1.5 text-sm rounded-md transition " +
              (active
                ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700"
                : "text-zinc-400 hover:text-zinc-200")
            }
          >
            {t.label} <span className="ml-1 text-xs text-zinc-500">{counts[t.key] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run + tsc + vite build.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/library/components/StatusTabs.tsx frontend/src/features/library/components/__tests__/StatusTabs.test.tsx
git commit -m "feat(library): StatusTabs segmented control"
```

---

### Task B6: `BulkActionToolbar` component

**Files:**
- Create: `frontend/src/features/library/components/BulkActionToolbar.tsx`
- Test: `frontend/src/features/library/components/__tests__/BulkActionToolbar.test.tsx`

- [ ] **Step 1: Failing test** — render with `selectedIds=[1,2]`, status="active", click "Archive", assert callback fired with `[1,2]`. Render with status="archived", confirm "Restore" button appears instead.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkActionToolbar } from "../BulkActionToolbar";

describe("BulkActionToolbar", () => {
  it("shows Archive for active selection and fires onArchive with ids", () => {
    const onArchive = vi.fn();
    render(
      <BulkActionToolbar
        statusContext="active"
        selectedIds={[1, 2, 3]}
        onArchive={onArchive}
        onRestore={vi.fn()}
        onClear={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Archive 3/i }));
    expect(onArchive).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("shows Restore for archived selection", () => {
    render(
      <BulkActionToolbar
        statusContext="archived"
        selectedIds={[1]}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Restore 1/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```tsx
import type { StatusTab } from "./StatusTabs";

interface Props {
  statusContext: StatusTab;
  selectedIds: number[];
  onArchive: (ids: number[]) => void;
  onRestore: (ids: number[]) => void;
  onClear: () => void;
}

export function BulkActionToolbar({ statusContext, selectedIds, onArchive, onRestore, onClear }: Props) {
  if (selectedIds.length === 0) return null;

  const archiveable = statusContext === "active" || statusContext === "draft" || statusContext === "all";
  const restorable = statusContext === "archived";

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 rounded-md bg-zinc-900 px-4 py-2 ring-1 ring-zinc-800">
      <span className="text-sm text-zinc-300">{selectedIds.length} selected</span>
      {archiveable && (
        <button
          type="button"
          onClick={() => onArchive(selectedIds)}
          className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          Archive {selectedIds.length}
        </button>
      )}
      {restorable && (
        <button
          type="button"
          onClick={() => onRestore(selectedIds)}
          className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 hover:bg-zinc-700"
        >
          Restore {selectedIds.length}
        </button>
      )}
      <button type="button" onClick={onClear} className="ml-auto text-sm text-zinc-400 hover:text-zinc-200">
        Clear
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run + tsc + vite build.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/library/components/BulkActionToolbar.tsx frontend/src/features/library/components/__tests__/BulkActionToolbar.test.tsx
git commit -m "feat(library): BulkActionToolbar"
```

---

### Task B7: Wire `StatusTabs` + `BulkActionToolbar` into `/concept-sets`

**Files:**
- Modify: `frontend/src/features/concept-sets/pages/<ListPage>.tsx`
- Modify: `frontend/src/features/concept-sets/api/conceptSetsApi.ts` — accept `status` query param.

- [ ] **Step 1: Determine the exact list-page filename and current shape.** Run:

```bash
ls frontend/src/features/concept-sets/pages/
grep -n "useConceptSets\|useQuery" frontend/src/features/concept-sets/api/conceptSetsApi.ts | head
```

- [ ] **Step 2: Add status filter to the list hook.** Append a `status?: StatusTab` parameter; include it in `queryKey` and the URL: `/concept-sets?status=${status}`.

- [ ] **Step 3: In the list page component:**

```tsx
const [statusTab, setStatusTab] = useState<StatusTab>("active");
const [selectedIds, setSelectedIds] = useState<number[]>([]);
const list = useConceptSets({ status: statusTab });
const bulkArchive = useBulkArchive("concept-sets");
const bulkRestore = useBulkRestore("concept-sets");

// counts: pull from the response envelope; backend adds `counts: {active,draft,archived,all}`
```

- [ ] **Step 4: Backend tweak — list endpoint returns counts.**
   Update `ConceptSetController@index` to include `counts` in its JSON envelope:

```php
$counts = [
    'active' => ConceptSet::query()->active()->ownedBy($user)->count(),
    'draft' => ConceptSet::query()->draft()->ownedBy($user)->count(),
    'archived' => ConceptSet::query()->withArchived()->archived()->ownedBy($user)->count(),
    'all' => ConceptSet::query()->withAnyStatus()->ownedBy($user)->count(),
];
```

(Apply the same shape later for cohort definitions and analyses in their controllers — repeat in B9.)

- [ ] **Step 5: Run all checks**

```
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint && vendor/bin/phpstan analyse --memory-limit=512M"
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit && npx vite build && npx vitest run --changed"
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/ConceptSetController.php frontend/src/features/concept-sets
git commit -m "feat(library): status tabs + bulk archive on concept sets list"
```

---

### Task B8: Wire the same into `/cohort-definitions`

Repeat B7 for `frontend/src/features/cohort-definitions/pages/...` and the matching backend controller.

- [ ] Step 1: locate list page + API hook + controller.
- [ ] Step 2: extend backend `index` with `counts` block (per B7 step 4 — adjust permission name to `cohorts.view`).
- [ ] Step 3: add `StatusTabs` + `BulkActionToolbar` to the page exactly like B7.
- [ ] Step 4: run all checks.
- [ ] Step 5: commit `git commit -m "feat(library): status tabs + bulk archive on cohort definitions list"`.

---

### Task B9: Wire the same into `/analyses`

Repeat for `frontend/src/features/analyses/pages/...`. Important: the analyses list endpoint shows multiple analysis types; the `counts` query needs to UNION across the 8 analysis tables.

- [ ] Backend: add a single `AnalysisListController@index` that does `UNION ALL` across the 8 tables for both list and counts. If the controller already has this pattern, extend it.
- [ ] Frontend: same as B7/B8 but entity defaults to `"incidence-rate-analyses"` etc. depending on row type — bulk-archive on this page needs to dispatch the right URL per row's analysis type.
- [ ] Run + commit.

```bash
git commit -m "feat(library): status tabs + bulk archive on analyses list"
```

---

### Task B10: `AutoPromoteModal` + `useAutoPromoteOn409` hook

**Files:**
- Create: `frontend/src/features/library/components/AutoPromoteModal.tsx`
- Create: `frontend/src/features/library/hooks/useAutoPromoteOn409.ts`
- Test: both.

- [ ] **Step 1: Failing test** — render modal with the 409 payload, click Promote & Attach, assert mutation called.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutoPromoteModal } from "../AutoPromoteModal";

describe("AutoPromoteModal", () => {
  it("renders item name and calls onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <AutoPromoteModal
        payload={{
          requires_promotion: true,
          item_type: "cohort_definition",
          item_id: 5,
          item_name: "CHF v3",
          message: "...",
        }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/CHF v3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Promote & Attach/ }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

`AutoPromoteModal.tsx`:

```tsx
import type { RequiresPromotionPayload } from "../types";

interface Props {
  payload: RequiresPromotionPayload;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function AutoPromoteModal({ payload, onConfirm, onCancel, isPending }: Props) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="w-full max-w-md rounded-lg bg-zinc-900 p-6 ring-1 ring-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-100">Promote draft to Active?</h2>
        <p className="mt-3 text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">"{payload.item_name}"</span> is a draft.
          Promoting it will make it visible to your Study collaborators.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded bg-crimson-600 px-3 py-1.5 text-sm text-white hover:bg-crimson-500 disabled:opacity-50"
          >
            {isPending ? "Promoting…" : "Promote & Attach"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

`useAutoPromoteOn409.ts`:

```ts
import { useState, useCallback } from "react";
import type { LibraryEntity, RequiresPromotionPayload } from "../types";
import { usePromoteItem } from "../api/lifecycleApi";

interface UseAutoPromoteOn409<TArgs> {
  /** Run the attach mutation; if it 409s, captures the payload and exposes a confirm() that promotes then re-runs the attach. */
  attempt: (args: TArgs) => Promise<void>;
  pendingPayload: RequiresPromotionPayload | null;
  confirm: () => Promise<void>;
  cancel: () => void;
  isPromoting: boolean;
}

export function useAutoPromoteOn409<TArgs>(
  entity: LibraryEntity,
  attachFn: (args: TArgs) => Promise<unknown>,
): UseAutoPromoteOn409<TArgs> {
  const [pendingPayload, setPendingPayload] = useState<RequiresPromotionPayload | null>(null);
  const [pendingArgs, setPendingArgs] = useState<TArgs | null>(null);
  const promote = usePromoteItem(entity);

  const attempt = useCallback(
    async (args: TArgs) => {
      try {
        await attachFn(args);
      } catch (err) {
        const e = err as { response?: { status?: number; data?: RequiresPromotionPayload } };
        if (e.response?.status === 409 && e.response.data?.requires_promotion) {
          setPendingPayload(e.response.data);
          setPendingArgs(args);
          return;
        }
        throw err;
      }
    },
    [attachFn],
  );

  const confirm = useCallback(async () => {
    if (!pendingPayload || !pendingArgs) return;
    await promote.mutateAsync(pendingPayload.item_id);
    await attachFn(pendingArgs);
    setPendingPayload(null);
    setPendingArgs(null);
  }, [attachFn, pendingArgs, pendingPayload, promote]);

  const cancel = useCallback(() => {
    setPendingPayload(null);
    setPendingArgs(null);
  }, []);

  return { attempt, pendingPayload, confirm, cancel, isPromoting: promote.isPending };
}
```

- [ ] **Step 4: Run + tsc + vite build.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/library/components/AutoPromoteModal.tsx frontend/src/features/library/hooks/useAutoPromoteOn409.ts frontend/src/features/library/components/__tests__/AutoPromoteModal.test.tsx frontend/src/features/library/hooks/__tests__
git commit -m "feat(library): AutoPromoteModal + 409 retry hook"
```

---

### Task B11: Apply `useAutoPromoteOn409` to Study workbench pickers

**Files:**
- Modify: `frontend/src/features/studies/components/workbench/CohortDraftPanel.tsx`
- Modify: `frontend/src/features/studies/components/workbench/ConceptSetDraftPanel.tsx`
- Modify: `frontend/src/features/studies/components/workbench/AnalysisPlanPanel.tsx`
- Test: per-panel mock test asserting 409 routes through modal.

- [ ] **Step 1: Failing test** for each panel — mock the attach mutation to reject with 409, assert modal appears.

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: For each panel:**

  1. Add a `[showDrafts, setShowDrafts]` checkbox state.
  2. Pass `?include_drafts=1` to the picker API when `showDrafts` is true.
  3. Render Drafts with a yellow "DRAFT" badge.
  4. Wrap the existing attach mutation in `useAutoPromoteOn409(entity, attachMutation.mutateAsync)`.
  5. Render `<AutoPromoteModal>` when `pendingPayload` is non-null.

- [ ] **Step 4: Backend** — picker list endpoints accept `?include_drafts=1` to bypass the global scope, AND must filter out items whose only Study attachments are to archived Studies (spec §4 picker rule):

```php
$user = $request->user();
$query = ConceptSet::query();
if ($request->boolean('include_drafts')) {
    $query->withAnyStatus();
}
// Picker visibility: owned by user OR attached to a non-archived Study
$query->where(function ($q) use ($user) {
    $q->where('created_by', $user->id)
      ->orWhereIn('id', function ($sub) {
          $sub->select('concept_set_id')
              ->from('study_concept_sets')
              ->join('studies', 'studies.id', '=', 'study_concept_sets.study_id')
              ->where('studies.status', '!=', 'archived');
      });
});
```

Repeat the same pattern in the cohort-definition and analysis picker endpoints (using `study_cohort_definitions` and the analysis pivot tables respectively).

- [ ] **Step 5: Run all checks + commit.**

```bash
git commit -m "feat(library): auto-promote modal wired into Study workbench pickers"
```

---

### Task B12: Phase B wrap — deploy + smoke

- [ ] Run full backend + frontend check suite.
- [ ] `./deploy.sh` (full deploy).
- [ ] Manual smoke at https://parthenon.acumenus.net:
   1. Create a new concept set → confirm it lands in "Drafts" tab (per backfill rules, new items will be Draft once `created_by` heuristic is set — see Phase D backfill).
   2. Attach to a Study → confirm modal appears → Promote & Attach succeeds.
   3. Archive → confirm it moves to Archived tab → Restore → confirm round-trip.

---

# Phase C — Cleanup automation (background job + page)

Ships: nightly `SuggestLibraryCleanupJob` populates the suggestions table; the Cleanup Suggestions page surfaces them and supports bulk-archive.

### Task C1: `SuggestLibraryCleanupJob`

**Files:**
- Create: `backend/app/Jobs/SuggestLibraryCleanupJob.php`
- Test: `backend/tests/Feature/Jobs/SuggestLibraryCleanupJobTest.php`
- Modify: `backend/app/Console/Kernel.php` (schedule it daily 02:00)

- [ ] **Step 1: Failing test**

```php
<?php

namespace Tests\Feature\Jobs;

use App\Jobs\SuggestLibraryCleanupJob;
use App\Models\App\ConceptSet;
use App\Models\App\LibraryCleanupSuggestion;
use App\Models\App\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SuggestLibraryCleanupJobTest extends TestCase
{
    use RefreshDatabase;

    public function test_flags_active_items_untouched_90_days_and_not_in_study(): void
    {
        $alice = User::factory()->create();
        $stale = ConceptSet::factory()->create([
            'created_by' => $alice->id,
            'status' => 'active',
            'updated_at' => now()->subDays(120),
        ]);
        $fresh = ConceptSet::factory()->create([
            'created_by' => $alice->id,
            'status' => 'active',
            'updated_at' => now()->subDays(10),
        ]);

        (new SuggestLibraryCleanupJob())->handle();

        $this->assertDatabaseHas('library_cleanup_suggestions', [
            'user_id' => $alice->id,
            'item_type' => 'concept_set',
            'item_id' => $stale->id,
        ]);
        $this->assertDatabaseMissing('library_cleanup_suggestions', [
            'item_id' => $fresh->id,
        ]);
    }

    public function test_skips_items_attached_to_active_study(): void
    {
        $alice = User::factory()->create();
        $set = ConceptSet::factory()->create([
            'created_by' => $alice->id,
            'status' => 'active',
            'updated_at' => now()->subDays(120),
        ]);
        // Attach to a non-archived study (assume the attach helper exists)
        // ... omitted: use the actual study_concept_sets pivot insert
        \DB::table('study_concept_sets')->insert([
            'study_id' => \App\Models\App\Study::factory()->create(['status' => 'active'])->id,
            'concept_set_id' => $set->id,
        ]);

        (new SuggestLibraryCleanupJob())->handle();

        $this->assertDatabaseMissing('library_cleanup_suggestions', ['item_id' => $set->id]);
    }
}
```

(Adjust pivot table name once verified during implementation.)

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Jobs;

use App\Enums\LibraryStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;

class SuggestLibraryCleanupJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $cutoff = CarbonImmutable::now()->subDays(90);
        $now = CarbonImmutable::now();

        DB::transaction(function () use ($cutoff, $now) {
            DB::table('library_cleanup_suggestions')->truncate();
            $this->collectConceptSets($cutoff, $now);
            $this->collectCohorts($cutoff, $now);
            // Analyses: do an UNION across the 8 tables — see step 3a below.
        });
    }

    private function collectConceptSets(CarbonImmutable $cutoff, CarbonImmutable $now): void
    {
        $rows = ConceptSet::query()
            ->where('status', LibraryStatus::ACTIVE->value)
            ->where('updated_at', '<', $cutoff)
            ->whereNotIn('id', function ($q) {
                $q->select('concept_set_id')->from('study_concept_sets')
                    ->join('studies', 'studies.id', '=', 'study_concept_sets.study_id')
                    ->where('studies.status', '!=', 'archived'); // adjust to actual Study state column
            })
            ->get(['id', 'created_by', 'updated_at']);

        foreach ($rows->chunk(500) as $chunk) {
            DB::table('library_cleanup_suggestions')->insert(
                $chunk->map(fn ($r) => [
                    'user_id' => $r->created_by,
                    'item_type' => 'concept_set',
                    'item_id' => $r->id,
                    'last_activity_at' => $r->updated_at,
                    'computed_at' => $now,
                ])->all()
            );
        }
    }

    private function collectCohorts(CarbonImmutable $cutoff, CarbonImmutable $now): void
    {
        $rows = CohortDefinition::query()
            ->where('status', LibraryStatus::ACTIVE->value)
            ->where('updated_at', '<', $cutoff)
            ->whereNotIn('id', function ($q) {
                $q->select('cohort_definition_id')->from('study_cohort_definitions')
                    ->join('studies', 'studies.id', '=', 'study_cohort_definitions.study_id')
                    ->where('studies.status', '!=', 'archived');
            })
            ->get(['id', 'created_by', 'updated_at']);

        foreach ($rows->chunk(500) as $chunk) {
            DB::table('library_cleanup_suggestions')->insert(
                $chunk->map(fn ($r) => [
                    'user_id' => $r->created_by,
                    'item_type' => 'cohort_definition',
                    'item_id' => $r->id,
                    'last_activity_at' => $r->updated_at,
                    'computed_at' => $now,
                ])->all()
            );
        }
    }
}
```

3a. Add a `collectAnalyses` method that loops over the 8 analysis models, queries each, and inserts with `item_type` = the model's snake_case basename (`incidence_rate_analysis`, etc.).

- [ ] **Step 4: Schedule it**

In `Kernel.php@schedule`:

```php
$schedule->job(new \App\Jobs\SuggestLibraryCleanupJob())->dailyAt('02:00');
```

- [ ] **Step 5: Run + Pint + commit**

```bash
git add backend/app/Jobs/SuggestLibraryCleanupJob.php backend/app/Console/Kernel.php backend/tests/Feature/Jobs/SuggestLibraryCleanupJobTest.php
git commit -m "feat(library): nightly cleanup suggestion job"
```

---

### Task C2: Cleanup Suggestions API endpoint

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/Library/CleanupSuggestionsController.php`
- Modify: `backend/routes/api.php`
- Test: feature test

- [ ] **Step 1: Failing test**

```php
public function test_index_returns_current_users_suggestions_only(): void
{
    $alice = User::factory()->create();
    $bob = User::factory()->create();

    LibraryCleanupSuggestion::create([
        'user_id' => $alice->id, 'item_type' => 'concept_set', 'item_id' => 1,
        'last_activity_at' => now()->subDays(120), 'computed_at' => now(),
    ]);
    LibraryCleanupSuggestion::create([
        'user_id' => $bob->id, 'item_type' => 'concept_set', 'item_id' => 2,
        'last_activity_at' => now()->subDays(120), 'computed_at' => now(),
    ]);

    Sanctum::actingAs($alice);
    $resp = $this->getJson('/api/v1/library/cleanup');

    $resp->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.item_id', 1);
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Http\Controllers\Api\V1\Library;

use App\Http\Controllers\Controller;
use App\Models\App\LibraryCleanupSuggestion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CleanupSuggestionsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = LibraryCleanupSuggestion::query()
            ->where('user_id', $request->user()->id)
            ->orderBy('last_activity_at')
            ->get();
        return response()->json(['data' => $rows]);
    }
}
```

Route (inside `auth:sanctum` group):

```php
Route::get('/library/cleanup', [\App\Http\Controllers\Api\V1\Library\CleanupSuggestionsController::class, 'index']);
```

- [ ] **Step 4: Run + Pint + commit.**

```bash
git commit -m "feat(library): cleanup suggestions API endpoint"
```

---

### Task C3: Cleanup Suggestions page + banner

**Files:**
- Create: `frontend/src/features/library/pages/CleanupSuggestionsPage.tsx`
- Create: `frontend/src/features/library/components/CleanupBanner.tsx`
- Create: `frontend/src/features/library/api/cleanupApi.ts`
- Tests for each.
- Modify: `frontend/src/App.tsx` (route).
- Modify: each list page to render `<CleanupBanner>`.

- [ ] **Step 1: Failing test** for `CleanupBanner` — renders nothing when count=0; renders link with count when >0.

- [ ] **Step 2: Implementation**

`cleanupApi.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export interface CleanupSuggestion {
  user_id: number;
  item_type: string;
  item_id: number;
  last_activity_at: string;
  computed_at: string;
}

export function useCleanupSuggestions() {
  return useQuery({
    queryKey: ["library", "cleanup"],
    queryFn: async (): Promise<CleanupSuggestion[]> => {
      const { data } = await apiClient.get<{ data: CleanupSuggestion[] }>("/library/cleanup");
      return data.data;
    },
  });
}
```

`CleanupBanner.tsx`:

```tsx
import { Link } from "react-router-dom";
import { useCleanupSuggestions } from "../api/cleanupApi";

export function CleanupBanner({ entityFilter }: { entityFilter?: string }) {
  const { data } = useCleanupSuggestions();
  const rows = entityFilter ? (data ?? []).filter((s) => s.item_type === entityFilter) : data ?? [];
  if (rows.length <= 5) return null;

  return (
    <div className="rounded-md border border-amber-700/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
      You have <strong>{rows.length}</strong> items not used in 90+ days.{" "}
      <Link to="/library/cleanup" className="underline">
        Review for cleanup →
      </Link>
    </div>
  );
}
```

`CleanupSuggestionsPage.tsx`: groups suggestions by `item_type`, renders each group with checkboxes and a bulk-archive button (calls the right `useBulkArchive(entity)` per group).

- [ ] **Step 3: Wire route**

```tsx
<Route path="/library/cleanup" element={<CleanupSuggestionsPage />} />
```

- [ ] **Step 4: Render `<CleanupBanner entityFilter="concept_set" />`** at top of `ConceptSetsListPage`, `"cohort_definition"` on cohort list page, no filter on analyses page.

- [ ] **Step 5: Run all checks + commit**

```bash
git commit -m "feat(library): cleanup suggestions page + cross-page banner"
```

---

### Task C4: Phase C wrap

- [ ] Deploy backend + frontend.
- [ ] Manually trigger the job: `docker compose exec -T php sh -c "cd /var/www/html && php artisan tinker --execute='dispatch_sync(new \App\Jobs\SuggestLibraryCleanupJob());'"`.
- [ ] Verify `library_cleanup_suggestions` has rows; banner appears on list pages; bulk-archive from the suggestions page works.

---

# Phase D — Admin surface (superuser inline + /admin/library + backfill)

Ships: superusers can flip "All users" mode on each list page; can navigate to `/admin/library` to see everything; can hard-delete archived items and reassign owners; backfill command runs.

### Task D1: Superuser inline toggle (backend)

**Files:**
- Modify: list controllers (`ConceptSetController@index`, etc.)
- Test: feature test

- [ ] **Step 1: Failing test** — superuser hits `/api/v1/concept-sets?scope=all` and gets all users' items.

```php
public function test_super_admin_with_scope_all_sees_all_users_items(): void
{
    $super = User::factory()->create();
    $super->assignRole('super-admin');
    $other = User::factory()->create();

    ConceptSet::factory()->create(['created_by' => $other->id, 'status' => 'active', 'name' => 'X']);

    Sanctum::actingAs($super);
    $resp = $this->getJson('/api/v1/concept-sets?scope=all');

    $resp->assertOk()->assertJsonPath('data.0.name', 'X');
}

public function test_non_super_admin_scope_all_is_ignored(): void
{
    $alice = User::factory()->create();
    $alice->givePermissionTo('concept-sets.view');
    $other = User::factory()->create();

    ConceptSet::factory()->create(['created_by' => $other->id, 'status' => 'active', 'name' => 'X']);

    Sanctum::actingAs($alice);
    $resp = $this->getJson('/api/v1/concept-sets?scope=all');

    $resp->assertOk()->assertJsonCount(0, 'data');
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

In each list controller (`ConceptSetController@index`, `CohortDefinitionController@index`, `AnalysesController@index`):

```php
$query = ConceptSet::query();
if ($request->input('scope') === 'all' && $request->user()->hasRole('super-admin')) {
    $query->withAnyStatus(); // bypass default scope
} else {
    $query->ownedBy($request->user()); // only own items
}
// status filter
if ($request->input('status') === 'draft') { $query->draft(); }
elseif ($request->input('status') === 'archived') { $query->withArchived()->archived(); }
elseif ($request->input('status') === 'all') { $query->withAnyStatus(); }
// default: active (handled by global scope)
```

- [ ] **Step 4: Run + Pint + commit.**

```bash
git commit -m "feat(library): superuser scope=all on list endpoints"
```

---

### Task D2: Superuser inline toggle (frontend)

**Files:**
- Modify: each list page.
- Create: `frontend/src/features/library/components/AllUsersToggle.tsx`
- Test: component test + role gating.

- [ ] **Step 1: Failing test** — renders only for super-admin; flipping it updates state.

- [ ] **Step 2: Implementation**

```tsx
import { useAuthStore } from "@/stores/authStore";

interface Props {
  value: boolean;
  onChange: (v: boolean) => void;
}

export function AllUsersToggle({ value, onChange }: Props) {
  const hasRole = useAuthStore((s) => s.hasRole);
  if (!hasRole("super-admin")) return null;

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-zinc-700 bg-zinc-800"
      />
      All users (admin)
    </label>
  );
}
```

In each list page:

```tsx
const [allUsers, setAllUsers] = useLocalStorage("library:scope:concept-sets", false);
const list = useConceptSets({ status: statusTab, scope: allUsers ? "all" : "mine" });
```

Add an `Owner` column to the table when `allUsers` is true.

- [ ] **Step 3: Run + commit.**

```bash
git commit -m "feat(library): superuser All Users toggle on list pages"
```

---

### Task D3: `/admin/library` backend — unified `index`

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/Admin/LibraryController.php`
- Modify: `backend/routes/api.php`
- Test.

- [ ] **Step 1: Failing test** — `GET /api/v1/admin/library` returns rows from all 10 tables, supports filters.

```php
public function test_admin_library_index_returns_union_across_types(): void
{
    $super = User::factory()->create();
    $super->assignRole('super-admin');
    ConceptSet::factory()->create(['name' => 'CS-X']);
    CohortDefinition::factory()->create(['name' => 'CD-Y']);

    Sanctum::actingAs($super);
    $resp = $this->getJson('/api/v1/admin/library');

    $resp->assertOk();
    $names = collect($resp->json('data'))->pluck('name')->all();
    $this->assertContains('CS-X', $names);
    $this->assertContains('CD-Y', $names);
}

public function test_admin_library_index_requires_super_admin(): void
{
    $alice = User::factory()->create();
    Sanctum::actingAs($alice);
    $this->getJson('/api/v1/admin/library')->assertForbidden();
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LibraryController extends Controller
{
    private const TABLES = [
        ['table' => 'concept_sets', 'type' => 'concept_set'],
        ['table' => 'cohort_definitions', 'type' => 'cohort_definition'],
        ['table' => 'incidence_rate_analyses', 'type' => 'incidence_rate_analysis'],
        ['table' => 'pathway_analyses', 'type' => 'pathway_analysis'],
        ['table' => 'estimation_analyses', 'type' => 'estimation_analysis'],
        ['table' => 'prediction_analyses', 'type' => 'prediction_analysis'],
        ['table' => 'feature_analyses', 'type' => 'feature_analysis'],
        ['table' => 'sccs_analyses', 'type' => 'sccs_analysis'],
        ['table' => 'evidence_synthesis_analyses', 'type' => 'evidence_synthesis_analysis'],
        ['table' => 'self_controlled_cohort_analyses', 'type' => 'self_controlled_cohort_analysis'],
    ];

    public function index(Request $request): JsonResponse
    {
        $type = $request->input('type');
        $tables = $type
            ? array_filter(self::TABLES, fn ($t) => $t['type'] === $type)
            : self::TABLES;

        $queries = collect($tables)->map(function ($t) use ($request) {
            $q = DB::table($t['table'])
                ->select([
                    'id', 'name', 'created_by', 'status', 'updated_at', 'archived_at',
                    DB::raw("'{$t['type']}' as item_type"),
                ]);
            if ($request->filled('owner_id')) {
                $q->where('created_by', $request->integer('owner_id'));
            }
            if ($request->filled('status')) {
                $q->where('status', $request->input('status'));
            }
            if ($request->boolean('include_trash')) {
                // soft-deleted: requires the source table to have deleted_at; conditional union
            }
            return $q;
        })->all();

        $union = array_shift($queries);
        foreach ($queries as $q) {
            $union->unionAll($q);
        }

        $rows = $union->orderByDesc('updated_at')->limit(500)->get();
        return response()->json(['data' => $rows]);
    }
}
```

Route:

```php
Route::middleware('role:super-admin')->prefix('admin/library')->group(function () {
    Route::get('/', [\App\Http\Controllers\Api\V1\Admin\LibraryController::class, 'index']);
});
```

- [ ] **Step 4: Run + Pint + commit.**

```bash
git commit -m "feat(library): /admin/library unified index across 10 tables"
```

---

### Task D4: Hard-delete with preflight + audit

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Admin/LibraryController.php` (add `bulkDelete`)
- Create: `backend/app/Http/Requests/Admin/Library/BulkDeleteRequest.php`
- Migration for `audit_log` if not already present (skip if exists).
- Test.

- [ ] **Step 1: Failing test**

```php
public function test_hard_delete_blocks_when_attachments_exist(): void
{
    $super = User::factory()->create(); $super->assignRole('super-admin');
    $set = ConceptSet::factory()->create(['status' => 'archived']);
    $study = Study::factory()->create();
    \DB::table('study_concept_sets')->insert(['study_id' => $study->id, 'concept_set_id' => $set->id]);

    Sanctum::actingAs($super);
    $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
        'items' => [['type' => 'concept_set', 'id' => $set->id]],
    ]);

    $resp->assertStatus(422)->assertJsonStructure(['blocked' => [['id', 'type', 'attached_to']]]);
    $this->assertNotSoftDeleted('concept_sets', ['id' => $set->id]);
}

public function test_hard_delete_succeeds_when_archived_and_no_attachments(): void
{
    $super = User::factory()->create(); $super->assignRole('super-admin');
    $set = ConceptSet::factory()->create(['status' => 'archived']);

    Sanctum::actingAs($super);
    $resp = $this->postJson('/api/v1/admin/library/bulk-delete', [
        'items' => [['type' => 'concept_set', 'id' => $set->id]],
    ]);

    $resp->assertOk();
    $this->assertSoftDeleted('concept_sets', ['id' => $set->id]);
    $this->assertDatabaseHas('audit_log', [
        'action' => 'library.hard_delete',
        'subject_type' => 'concept_set',
        'subject_id' => $set->id,
    ]);
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
public function bulkDelete(BulkDeleteRequest $request): JsonResponse
{
    $blocked = []; $deleted = [];

    foreach ($request->input('items') as $entry) {
        $modelClass = $this->resolveClass($entry['type']);
        /** @var \Illuminate\Database\Eloquent\Model $item */
        $item = $modelClass::query()->withAnyStatus()->findOrFail($entry['id']);

        if ($item->status->value !== 'archived') {
            return response()->json(['error' => 'Item must be archived first', 'id' => $item->id], 422);
        }

        $attachments = $this->countAttachments($entry['type'], $item->id);
        if (! empty($attachments)) {
            $blocked[] = ['id' => $item->id, 'type' => $entry['type'], 'attached_to' => $attachments];
            continue;
        }

        DB::transaction(function () use ($item, $entry, $request) {
            DB::table('audit_log')->insert([
                'actor_id' => $request->user()->id,
                'action' => 'library.hard_delete',
                'subject_type' => $entry['type'],
                'subject_id' => $item->id,
                'snapshot' => json_encode($item->toArray()),
                'created_at' => now(),
            ]);
            $item->delete(); // soft-delete via SoftDeletes
        });
        $deleted[] = $item->id;
    }

    if (! empty($blocked)) {
        return response()->json(['blocked' => $blocked, 'deleted' => $deleted], 422);
    }
    return response()->json(['deleted' => $deleted]);
}

private function countAttachments(string $type, int $id): array
{
    // Returns list of {study_id, study_name} for each Study (active or archived) referencing the item.
    return match ($type) {
        'concept_set' => DB::table('study_concept_sets')
            ->join('studies', 'studies.id', '=', 'study_concept_sets.study_id')
            ->where('study_concept_sets.concept_set_id', $id)
            ->get(['studies.id as study_id', 'studies.name as study_name'])->all(),
        'cohort_definition' => DB::table('study_cohort_definitions')
            ->join('studies', 'studies.id', '=', 'study_cohort_definitions.study_id')
            ->where('study_cohort_definitions.cohort_definition_id', $id)
            ->get(['studies.id as study_id', 'studies.name as study_name'])->all(),
        default => [], // analyses: define per-type pivot
    };
}
```

`BulkDeleteRequest.php`:

```php
public function rules(): array
{
    return [
        'items' => 'required|array|min:1|max:200',
        'items.*.type' => 'required|string',
        'items.*.id' => 'required|integer',
    ];
}
```

- [ ] **Step 4: Add `SoftDeletes` trait + `deleted_at` column** to tables that don't already have it (concept_sets and cohort_definitions need SoftDeletes if not already present — check first):

```bash
docker compose exec -T php sh -c "cd /var/www/html && php artisan db:show --connection=pgsql 2>&1 | grep -E 'concept_sets|cohort_definitions'"
```

If missing, create migration `add_soft_deletes_to_concept_sets_and_cohort_definitions.php`.

- [ ] **Step 5: Run + Pint + commit.**

```bash
git commit -m "feat(library): admin hard-delete with attachment preflight + audit"
```

---

### Task D5: Purge job (30-day grace)

**Files:**
- Create: `backend/app/Jobs/PurgeSoftDeletedLibraryItemsJob.php`
- Modify: `backend/app/Console/Kernel.php`
- Test.

- [ ] **Step 1: Failing test** — soft-deleted >30 days → purged; <30 days → retained.

- [ ] **Step 2: Implementation** — for each model with SoftDeletes, `Model::onlyTrashed()->where('deleted_at', '<', now()->subDays(30))->forceDelete()`. Schedule dailyAt 03:00.

- [ ] **Step 3: Commit.**

```bash
git commit -m "feat(library): nightly 30-day purge of soft-deleted library items"
```

---

### Task D6: Reassign owner

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Admin/LibraryController.php`
- Create: `backend/app/Http/Requests/Admin/Library/ReassignOwnerRequest.php`
- Test.

- [ ] **Step 1: Failing test** — POST changes `created_by`, writes audit row, rejects if target lacks the relevant `.view` permission.

- [ ] **Step 2: Implementation** — controller method `reassign`, validates `items[]` + `target_email`. Looks up target user. For each item: confirm target has `{permDomain}.view` permission; if yes, update `created_by` + audit; if no, return 422 with blocked list.

- [ ] **Step 3: Commit.**

```bash
git commit -m "feat(library): admin reassign-owner with permission check + audit"
```

---

### Task D7: `/admin/library` page (frontend)

**Files:**
- Create: page + table + filters + modals (per File Structure section).
- Tests.

- [ ] **Step 1: Failing component test** for `AdminLibraryTable` — renders rows from the union; bulk-select fires the right mutations; HardDeleteModal opens preflight call.

- [ ] **Step 2: Implementation** — uses `useQuery` against `/admin/library` with filter params. Filter controls drive the query key. Bulk actions call `useBulkDelete` / `useReassignOwner`.

`HardDeleteModal.tsx`:
   - On open, fires the preflight call (could be `GET /admin/library/preflight-delete?items=...` — add this endpoint if needed, or piggyback on `bulk-delete` returning blocked items as 422).
   - Shows blocked Studies as deep links.
   - Disabled until all selected items are clean.

`ReassignOwnerModal.tsx`:
   - Email input + typed confirmation (require exact match to "confirm").
   - Submits to `/admin/library/reassign`.

`TrashTab.tsx`:
   - Calls `GET /admin/library?include_trash=1`.
   - "Restore" (undo soft-delete) and "Purge now" actions.

- [ ] **Step 3: Wire route** `<Route path="/admin/library" element={<AdminLibraryPage />} />` and add sidebar entry guarded by `super-admin`.

- [ ] **Step 4: Run + commit.**

```bash
git commit -m "feat(library): /admin/library page with bulk delete, reassign, trash"
```

---

### Task D8: Backfill command

**Files:**
- Create: `backend/app/Console/Commands/LibraryBackfillLifecycleCommand.php`
- Test.

- [ ] **Step 1: Failing test**

```php
public function test_backfill_classifies_per_rules(): void
{
    $user = User::factory()->create();
    $inStudy = ConceptSet::factory()->create(['created_by' => $user->id, 'updated_at' => now()->subDays(120)]);
    $study = Study::factory()->create();
    \DB::table('study_concept_sets')->insert(['study_id' => $study->id, 'concept_set_id' => $inStudy->id]);

    $fresh = ConceptSet::factory()->create(['created_by' => $user->id, 'updated_at' => now()->subDays(5)]);
    $abandoned = ConceptSet::factory()->create(['created_by' => $user->id, 'updated_at' => now()->subDays(120)]);
    $seeded = ConceptSet::factory()->create(['created_by' => null, 'updated_at' => now()->subDays(200)]);

    \Artisan::call('library:backfill-lifecycle', ['--apply' => true]);

    $this->assertSame('active', $inStudy->fresh()->status->value);
    $this->assertSame('active', $fresh->fresh()->status->value);
    $this->assertSame('draft', $abandoned->fresh()->status->value);
    $this->assertSame('active', $seeded->fresh()->status->value);
}
```

- [ ] **Step 2: Run to confirm fail.**

- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Console\Commands;

use App\Enums\LibraryStatus;
use App\Models\App\ConceptSet;
use App\Models\App\CohortDefinition;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class LibraryBackfillLifecycleCommand extends Command
{
    protected $signature = 'library:backfill-lifecycle {--dry-run} {--apply}';
    protected $description = 'Reclassify existing library items per backfill rules.';

    public function handle(): int
    {
        if (! $this->option('dry-run') && ! $this->option('apply')) {
            $this->error('Specify --dry-run or --apply.');
            return self::FAILURE;
        }

        $apply = (bool) $this->option('apply');
        $counts = [];

        foreach ($this->classify() as $type => $changes) {
            $counts[$type] = $changes;
            if ($apply) {
                foreach ($changes['set_draft'] as $id) {
                    DB::table($type)->where('id', $id)->update(['status' => LibraryStatus::DRAFT->value]);
                }
            }
        }

        $this->table(['Table', 'Set draft', 'Stays active'], collect($counts)->map(
            fn ($c, $t) => [$t, count($c['set_draft']), $c['stays_active']]
        )->all());

        return self::SUCCESS;
    }

    /** @return array<string, array{set_draft: list<int>, stays_active: int}> */
    private function classify(): array
    {
        $result = [];
        foreach ([
            'concept_sets' => 'study_concept_sets',
            'cohort_definitions' => 'study_cohort_definitions',
            // analyses pivots — adjust per actual schema; if no Study pivot exists, treat zero-attachment as the rule.
        ] as $table => $pivot) {
            $abandoned = DB::table($table)
                ->whereNotNull('created_by') // exclude seed rows
                ->where('updated_at', '<', now()->subDays(30))
                ->whereNotIn('id', function ($q) use ($pivot, $table) {
                    $idColumn = ($table === 'concept_sets') ? 'concept_set_id' : 'cohort_definition_id';
                    $q->select($idColumn)->from($pivot);
                })
                ->pluck('id')->all();
            $active = DB::table($table)->count() - count($abandoned);
            $result[$table] = ['set_draft' => $abandoned, 'stays_active' => $active];
        }
        return $result;
    }
}
```

- [ ] **Step 4: Run + Pint + commit.**

```bash
git commit -m "feat(library): library:backfill-lifecycle command"
```

---

### Task D9: Phase D wrap — production rollout

- [ ] Run full check suite (Pint, PHPStan, Pest, tsc, vite build, vitest).
- [ ] `./deploy.sh` (full).
- [ ] Run backfill in dry-run on production:
   ```bash
   docker compose exec -T php sh -c "cd /var/www/html && php artisan library:backfill-lifecycle --dry-run"
   ```
   Review the per-table counts. If reasonable, run `--apply`.
- [ ] Manual smoke as super-admin:
   1. Flip "All users" toggle on `/concept-sets` → see other users' items.
   2. Navigate to `/admin/library` → see unified table.
   3. Pick an Archived item with no attachments → Hard delete → goes to Trash.
   4. From Trash → Restore → reappears as Archived.
- [ ] One-time toast for end users: implement as part of this task or punt to a follow-up commit on `feature_flags` / a session-storage flag.

---

## Self-Review

**Spec coverage check (against `2026-05-13-library-lifecycle-design.md`):**

| Spec section | Covered by |
|---|---|
| §3 Data model — columns | A2, A3, A4 |
| §3 Cleanup table | A5 |
| §3 Trait + casts + scopes | A6, A7, A8 |
| §3 `LibraryStatus` enum | A1 |
| §3 Policies | A9 |
| §4 Picker rules (active Study filter) | C1 (cleanup), B11 (picker) — note: backend picker endpoints respect default scope; archived-Study filter is implicit because items not attached to non-archived Studies fall out of the cleanup-suggestion query and never appear in pickers if owner-only. **Add explicit picker filter on archived-Study attachments in B11 backend step.** ← captured below |
| §5 Auto-promote 409 contract | B1, B2, B3 |
| §6.1 List page tabs + bulk | B5, B6, B7, B8, B9 |
| §6.2 Cleanup Suggestions | C1, C2, C3 |
| §6.3 Auto-promote modal | B10, B11 |
| §6.4 Picker drafts checkbox | B11 |
| §6.5 Superuser inline mode | D1, D2 |
| §6.6 `/admin/library` | D3, D7 |
| §6.7 Hard-delete preflight | D4 |
| §6.8 Reassign owner | D6 |
| §7 Migration A | A2–A5 |
| §7 Backfill command | D8 |
| §7 User comms (toast) | D9 (noted as optional) |
| §8 Testing | embedded per task |

**Gap found:** §4 picker rule says items attached only to archived Studies should NOT appear in pickers. The plan currently handles this only implicitly. **Adding explicit note to Task B11 backend step:** picker endpoints (`?include_drafts=1` variant) must filter out items whose only Study attachments are to archived Studies. The cleanest implementation: in the picker endpoint, use:

```php
$query->where(function ($q) use ($user) {
    $q->where('created_by', $user->id)
      ->orWhereIn('id', function ($sub) {
          $sub->select('concept_set_id')->from('study_concept_sets')
              ->join('studies', 'studies.id', '=', 'study_concept_sets.study_id')
              ->where('studies.status', '!=', 'archived');
      });
});
```

Add this requirement to Task B11 step 4.

**Placeholder scan:** No "TBD", "TODO", or "implement later" outside the explicit "skip if exists" note in D4 (which is a defensive instruction, not a placeholder). Acceptable.

**Type consistency:** The trait's restore method is named `restore_lifecycle()` consistently across A6, A9, A10, A11. The policy method is `restoreLifecycle()` (camelCase, as Laravel policies expect). Controller uses `$this->authorize('restoreLifecycle', …)` — consistent.

The Frontend `entity` discriminator strings (`"concept-sets"`, `"cohort-definitions"`, etc.) are kebab-case and match backend route prefixes — consistent.

The Backend `item_type` strings in API responses + cleanup table are snake_case (`"concept_set"`, `"cohort_definition"`, …). Frontend converts where needed (e.g., `entityFilter="concept_set"` in C3). Consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-library-lifecycle.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
