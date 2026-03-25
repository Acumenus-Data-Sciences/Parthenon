# Ares Parity — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data model, event infrastructure, release management, and annotation system that all subsequent Ares phases depend on.

**Architecture:** 6 new database tables + 2 alter-table migrations. 3 new Laravel events + 3 listeners for auto-release creation. New `AresController` with release and annotation CRUD endpoints. Frontend Ares tab hub skeleton with Releases and Annotations drill-in views.

**Tech Stack:** Laravel 11 / PHP 8.4 / PostgreSQL 17 / React 19 / TypeScript / TanStack Query / Recharts / Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-24-ares-parity-design.md`

---

## File Map

### Backend — New Files

```
backend/
├── app/
│   ├── Events/
│   │   ├── AchillesRunCompleted.php          # New event
│   │   ├── DqdRunCompleted.php               # New event
│   │   └── ReleaseCreated.php                # New event
│   ├── Listeners/
│   │   ├── CreateAutoRelease.php             # Listens: AchillesRunCompleted
│   │   ├── AssociateDqdWithRelease.php       # Listens: DqdRunCompleted
│   │   └── ComputeDqDeltas.php              # Listens: ReleaseCreated (queued)
│   ├── Models/
│   │   └── App/
│   │       ├── SourceRelease.php             # New model
│   │       ├── ChartAnnotation.php           # New model
│   │       └── UnmappedSourceCode.php        # New model
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   └── AresController.php            # New controller
│   │   └── Requests/Api/
│   │       ├── StoreReleaseRequest.php       # New form request
│   │       ├── UpdateReleaseRequest.php      # New form request
│   │       ├── StoreAnnotationRequest.php    # New form request
│   │       └── UpdateAnnotationRequest.php   # New form request
│   ├── Services/Ares/
│   │   ├── ReleaseService.php                # New service
│   │   └── AnnotationService.php             # New service
│   └── Console/Commands/
│       └── BackfillReleasesCommand.php       # New artisan command
├── database/migrations/
│   ├── 2026_03_25_000001_create_source_releases_table.php
│   ├── 2026_03_25_000002_create_dqd_deltas_table.php
│   ├── 2026_03_25_000003_create_chart_annotations_table.php
│   ├── 2026_03_25_000004_create_unmapped_source_codes_table.php
│   ├── 2026_03_25_000005_create_feasibility_tables.php
│   ├── 2026_03_25_000006_add_release_mode_to_sources.php
│   └── 2026_03_25_000007_add_release_id_to_runs_and_results.php
└── tests/
    ├── Unit/Services/Ares/
    │   ├── ReleaseServiceTest.php
    │   └── AnnotationServiceTest.php
    └── Feature/Api/
        └── AresControllerTest.php
```

### Backend — Modified Files

```
backend/
├── app/
│   ├── Jobs/Achilles/RunAchillesJob.php      # Add event dispatch at line 74
│   ├── Jobs/Dqd/RunDqdJob.php                # Add event dispatch at line 63
│   ├── Models/App/Source.php                  # Add release_mode to fillable/casts
│   ├── Models/App/DqdResult.php               # Add release_id to fillable/casts
│   └── Models/Results/AchillesRun.php         # Add release_id to fillable/casts
├── routes/api.php                             # Add Ares route group
└── app/Providers/EventServiceProvider.php     # Register event→listener mappings (or use Event::listen)
```

### Frontend — New Files

```
frontend/src/features/data-explorer/
├── pages/
│   └── AresTab.tsx                            # Hub + drill-in router
├── components/ares/
│   ├── AresHub.tsx                            # Hub card grid
│   ├── AresHealthBanner.tsx                   # Top KPI banner
│   ├── AresBreadcrumb.tsx                     # Sticky breadcrumb nav
│   ├── HubCard.tsx                            # Reusable card component
│   ├── releases/
│   │   └── ReleasesView.tsx                   # Release timeline + CRUD
│   └── annotations/
│       ├── AnnotationsView.tsx                # Browse annotations
│       ├── AnnotationMarker.tsx               # Chart overlay (composable)
│       └── AnnotationPopover.tsx              # Create/edit form
├── hooks/
│   ├── useReleaseData.ts                      # Release TanStack Query hooks
│   ├── useAnnotationData.ts                   # Annotation hooks
│   └── useAresHub.ts                          # Hub overview KPI hooks
├── api/
│   ├── releaseApi.ts                          # Release API functions
│   └── annotationApi.ts                       # Annotation API functions
└── types/
    └── ares.ts                                # Ares TypeScript types
```

### Frontend — Modified Files

```
frontend/src/features/data-explorer/
└── pages/DataExplorerPage.tsx                 # Add Ares tab (lines 12, 18, 25, 119)
```

---

## Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_25_000001_create_source_releases_table.php`
- Create: `backend/database/migrations/2026_03_25_000002_create_dqd_deltas_table.php`
- Create: `backend/database/migrations/2026_03_25_000003_create_chart_annotations_table.php`
- Create: `backend/database/migrations/2026_03_25_000004_create_unmapped_source_codes_table.php`
- Create: `backend/database/migrations/2026_03_25_000005_create_feasibility_tables.php`
- Create: `backend/database/migrations/2026_03_25_000006_add_release_mode_to_sources.php`
- Create: `backend/database/migrations/2026_03_25_000007_add_release_id_to_runs_and_results.php`

- [ ] **Step 1: Create source_releases migration**

```php
<?php
// 2026_03_25_000001_create_source_releases_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('release_key');
            $table->string('release_name');
            $table->string('release_type', 20);
            $table->string('cdm_version', 20)->nullable();
            $table->string('vocabulary_version', 100)->nullable();
            $table->string('etl_version', 100)->nullable();
            $table->bigInteger('person_count')->default(0);
            $table->bigInteger('record_count')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['source_id', 'release_key']);
            $table->index(['source_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_releases');
    }
};
```

- [ ] **Step 2: Create dqd_deltas migration**

```php
<?php
// 2026_03_25_000002_create_dqd_deltas_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dqd_deltas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('current_release_id')->constrained('source_releases')->cascadeOnDelete();
            $table->foreignId('previous_release_id')->nullable()->constrained('source_releases')->nullOnDelete();
            $table->string('check_id', 100);
            $table->string('delta_status', 20);
            $table->boolean('current_passed');
            $table->boolean('previous_passed')->nullable();
            $table->timestamp('created_at');

            $table->index('current_release_id');
            $table->index(['source_id', 'current_release_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dqd_deltas');
    }
};
```

- [ ] **Step 3: Create chart_annotations migration**

```php
<?php
// 2026_03_25_000003_create_chart_annotations_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chart_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('chart_type', 50);
            $table->jsonb('chart_context')->default('{}');
            $table->string('x_value', 100);
            $table->float('y_value')->nullable(); // double precision
            $table->text('annotation_text');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['chart_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chart_annotations');
    }
};
```

- [ ] **Step 4: Create unmapped_source_codes migration**

```php
<?php
// 2026_03_25_000004_create_unmapped_source_codes_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('unmapped_source_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('release_id')->constrained('source_releases')->cascadeOnDelete();
            $table->string('source_code');
            $table->string('source_vocabulary_id', 50);
            $table->string('cdm_table', 100);
            $table->string('cdm_field', 100);
            $table->bigInteger('record_count');
            $table->timestamp('created_at');

            $table->index(['source_id', 'release_id']);
            $table->index('cdm_table');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('unmapped_source_codes');
    }
};
```

- [ ] **Step 5: Create feasibility tables migration**

```php
<?php
// 2026_03_25_000005_create_feasibility_tables.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feasibility_assessments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->jsonb('criteria');
            $table->integer('sources_assessed')->default(0);
            $table->integer('sources_passed')->default(0);
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('created_at');
        });

        Schema::create('feasibility_assessment_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assessment_id')->constrained('feasibility_assessments')->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->boolean('domain_pass');
            $table->boolean('concept_pass');
            $table->boolean('visit_pass');
            $table->boolean('date_pass');
            $table->boolean('patient_pass');
            $table->boolean('overall_pass');
            $table->jsonb('details');

            $table->index('assessment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feasibility_assessment_results');
        Schema::dropIfExists('feasibility_assessments');
    }
};
```

- [ ] **Step 6: Add release_mode to sources**

```php
<?php
// 2026_03_25_000006_add_release_mode_to_sources.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sources', function (Blueprint $table) {
            $table->string('release_mode', 10)->default('auto');
        });
    }

    public function down(): void
    {
        Schema::table('sources', function (Blueprint $table) {
            $table->dropColumn('release_mode');
        });
    }
};
```

- [ ] **Step 7: Add release_id to runs and results**

```php
<?php
// 2026_03_25_000007_add_release_id_to_runs_and_results.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('achilles_runs', function (Blueprint $table) {
            $table->foreignId('release_id')->nullable()->after('source_id')
                ->constrained('source_releases')->nullOnDelete();
        });

        Schema::table('dqd_results', function (Blueprint $table) {
            $table->foreignId('release_id')->nullable()->after('run_id')
                ->constrained('source_releases')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('achilles_runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('release_id');
        });

        Schema::table('dqd_results', function (Blueprint $table) {
            $table->dropConstrainedForeignId('release_id');
        });
    }
};
```

- [ ] **Step 8: Run migrations**

Run: `docker compose exec php php artisan migrate`
Expected: 7 migrations executed successfully, 6 new tables + 2 altered tables

- [ ] **Step 9: Commit**

```bash
git add backend/database/migrations/2026_03_25_00000*.php
git commit -m "feat(ares): add database migrations for release management, annotations, and feasibility"
```

---

## Task 2: Eloquent Models

**Files:**
- Create: `backend/app/Models/App/SourceRelease.php`
- Create: `backend/app/Models/App/ChartAnnotation.php`
- Create: `backend/app/Models/App/UnmappedSourceCode.php`
- Modify: `backend/app/Models/App/Source.php` (lines 35, 55)
- Modify: `backend/app/Models/App/DqdResult.php` (lines 12, 40)
- Modify: `backend/app/Models/Results/AchillesRun.php` (lines 14, 29)

- [ ] **Step 1: Create SourceRelease model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SourceRelease extends Model
{
    protected $fillable = [
        'source_id',
        'release_key',
        'release_name',
        'release_type',
        'cdm_version',
        'vocabulary_version',
        'etl_version',
        'person_count',
        'record_count',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'person_count' => 'integer',
            'record_count' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function achillesRuns(): HasMany
    {
        return $this->hasMany(\App\Models\Results\AchillesRun::class, 'release_id');
    }

    public function dqdResults(): HasMany
    {
        return $this->hasMany(DqdResult::class, 'release_id');
    }

    // deltas() relationship added in Phase 2 when DqdDelta model is created
}
```

- [ ] **Step 2: Create ChartAnnotation model**

```php
<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChartAnnotation extends Model
{
    protected $fillable = [
        'source_id',
        'chart_type',
        'chart_context',
        'x_value',
        'y_value',
        'annotation_text',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'chart_context' => 'array',
            'y_value' => 'float',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
```

- [ ] **Step 3: Create UnmappedSourceCode model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnmappedSourceCode extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'source_id',
        'release_id',
        'source_code',
        'source_vocabulary_id',
        'cdm_table',
        'cdm_field',
        'record_count',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'record_count' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function release(): BelongsTo
    {
        return $this->belongsTo(SourceRelease::class, 'release_id');
    }
}
```

- [ ] **Step 4: Add release_mode to Source model**

Modify `backend/app/Models/App/Source.php`:
- Add `'release_mode'` to the `$fillable` array
- Add `'release_mode' => 'string'` to the `casts()` return array
- Add `releases()` HasMany relationship

- [ ] **Step 5: Add release_id to AchillesRun model**

Modify `backend/app/Models/Results/AchillesRun.php`:
- Add `'release_id'` to the `$fillable` array
- Add `'release_id' => 'integer'` to the `casts()` array
- Add `release()` BelongsTo relationship to `SourceRelease::class`

- [ ] **Step 6: Add release_id to DqdResult model**

Modify `backend/app/Models/App/DqdResult.php`:
- Add `'release_id'` to the `$fillable` array
- Add `'release_id' => 'integer'` to the `casts()` array
- Add `release()` BelongsTo relationship to `SourceRelease::class`

- [ ] **Step 7: Create SourceReleaseFactory**

```php
<?php
// backend/database/factories/SourceReleaseFactory.php

namespace Database\Factories;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Database\Eloquent\Factories\Factory;

class SourceReleaseFactory extends Factory
{
    protected $model = SourceRelease::class;

    public function definition(): array
    {
        return [
            'source_id' => Source::factory(),
            'release_key' => $this->faker->unique()->slug(),
            'release_name' => $this->faker->words(3, true),
            'release_type' => $this->faker->randomElement(['scheduled_etl', 'snapshot']),
            'cdm_version' => '5.4',
            'vocabulary_version' => 'v5.0',
            'person_count' => $this->faker->numberBetween(1000, 100000),
            'record_count' => $this->faker->numberBetween(10000, 1000000),
        ];
    }
}
```

Also add the `HasFactory` trait to `SourceRelease` model (add `use Illuminate\Database\Eloquent\Factories\HasFactory;` and `use HasFactory;` inside the class).

- [ ] **Step 8: Commit**

```bash
git add backend/app/Models/App/SourceRelease.php backend/app/Models/App/ChartAnnotation.php backend/app/Models/App/UnmappedSourceCode.php backend/app/Models/App/Source.php backend/app/Models/App/DqdResult.php backend/app/Models/Results/AchillesRun.php backend/database/factories/SourceReleaseFactory.php
git commit -m "feat(ares): add SourceRelease, ChartAnnotation, UnmappedSourceCode models and factory"
```

---

## Task 3: Events and Listeners

**Files:**
- Create: `backend/app/Events/AchillesRunCompleted.php`
- Create: `backend/app/Events/DqdRunCompleted.php`
- Create: `backend/app/Events/ReleaseCreated.php`
- Create: `backend/app/Listeners/CreateAutoRelease.php`
- Create: `backend/app/Listeners/AssociateDqdWithRelease.php`
- Create: `backend/app/Listeners/ComputeDqDeltas.php`
- Modify: `backend/app/Jobs/Achilles/RunAchillesJob.php` (line 74)
- Modify: `backend/app/Jobs/Dqd/RunDqdJob.php` (line 63)

- [ ] **Step 1: Create AchillesRunCompleted event**

Reference the existing `AchillesStepCompleted.php` event pattern. This event does NOT need broadcasting — it's for internal listener dispatch only.

```php
<?php

namespace App\Events;

use App\Models\App\Source;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AchillesRunCompleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly int $sourceId,
        public readonly string $runId,
        public readonly Source $source,
    ) {}
}
```

- [ ] **Step 2: Create DqdRunCompleted event**

```php
<?php

namespace App\Events;

use App\Models\App\Source;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DqdRunCompleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly int $sourceId,
        public readonly string $runId,
        public readonly Source $source,
    ) {}
}
```

- [ ] **Step 3: Create ReleaseCreated event**

```php
<?php

namespace App\Events;

use App\Models\App\SourceRelease;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReleaseCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly SourceRelease $release,
    ) {}
}
```

- [ ] **Step 4: Create CreateAutoRelease listener**

```php
<?php

namespace App\Listeners;

use App\Events\AchillesRunCompleted;
use App\Services\Ares\ReleaseService;

class CreateAutoRelease
{
    public function __construct(
        private readonly ReleaseService $releaseService,
    ) {}

    public function handle(AchillesRunCompleted $event): void
    {
        $source = $event->source;

        if ($source->release_mode !== 'auto') {
            return;
        }

        $this->releaseService->autoSnapshot($source, $event->runId);
    }
}
```

- [ ] **Step 5: Create AssociateDqdWithRelease listener**

```php
<?php

namespace App\Listeners;

use App\Events\DqdRunCompleted;
use App\Models\App\DqdResult;
use App\Models\App\SourceRelease;

class AssociateDqdWithRelease
{
    public function handle(DqdRunCompleted $event): void
    {
        $latestRelease = SourceRelease::where('source_id', $event->sourceId)
            ->latest('created_at')
            ->first();

        if (! $latestRelease) {
            return;
        }

        DqdResult::where('source_id', $event->sourceId)
            ->where('run_id', $event->runId)
            ->whereNull('release_id')
            ->update(['release_id' => $latestRelease->id]);
    }
}
```

- [ ] **Step 6: Create ComputeDqDeltas listener (queued)**

```php
<?php

namespace App\Listeners;

use App\Events\ReleaseCreated;
use App\Services\Ares\DqHistoryService;
use Illuminate\Contracts\Queue\ShouldQueue;

class ComputeDqDeltas implements ShouldQueue
{
    public function __construct(
        private readonly DqHistoryService $dqHistoryService,
    ) {}

    public function handle(ReleaseCreated $event): void
    {
        $this->dqHistoryService->computeDeltas($event->release);
    }
}
```

Note: The `DqHistoryService` is built in Phase 2. For now, create a stub that logs and returns. The listener infrastructure is what matters in Phase 1.

- [ ] **Step 7: Modify RunAchillesJob to dispatch event**

Modify `backend/app/Jobs/Achilles/RunAchillesJob.php`. After the existing `Log::info('Achilles job completed...')` line (approximately line 74), add:

```php
use App\Events\AchillesRunCompleted;

// ... inside handle(), after the completion log:
AchillesRunCompleted::dispatch($this->source->id, $this->runId, $this->source);
```

- [ ] **Step 8: Modify RunDqdJob to dispatch event**

Modify `backend/app/Jobs/Dqd/RunDqdJob.php`. After the existing `Log::info('RunDqdJob: DQD execution completed...')` line (approximately line 63), add:

```php
use App\Events\DqdRunCompleted;

// ... inside handle(), after the completion log:
DqdRunCompleted::dispatch($this->source->id, $result['runId'], $this->source);
```

- [ ] **Step 9: Register event→listener mappings**

Check if `EventServiceProvider` exists. If not, register in `bootstrap/app.php` or use `Event::listen()` in a service provider. The mappings:

```php
use App\Events\AchillesRunCompleted;
use App\Events\DqdRunCompleted;
use App\Events\ReleaseCreated;
use App\Listeners\CreateAutoRelease;
use App\Listeners\AssociateDqdWithRelease;
use App\Listeners\ComputeDqDeltas;

// In EventServiceProvider or AppServiceProvider boot():
Event::listen(AchillesRunCompleted::class, CreateAutoRelease::class);
Event::listen(DqdRunCompleted::class, AssociateDqdWithRelease::class);
Event::listen(ReleaseCreated::class, ComputeDqDeltas::class);
```

- [ ] **Step 10: Commit**

```bash
git add backend/app/Events/AchillesRunCompleted.php backend/app/Events/DqdRunCompleted.php backend/app/Events/ReleaseCreated.php backend/app/Listeners/ backend/app/Jobs/Achilles/RunAchillesJob.php backend/app/Jobs/Dqd/RunDqdJob.php
git commit -m "feat(ares): add completion events for Achilles/DQD and auto-release listeners"
```

---

## Task 4: ReleaseService

**Files:**
- Create: `backend/app/Services/Ares/ReleaseService.php`
- Create: `backend/tests/Unit/Services/Ares/ReleaseServiceTest.php`

- [ ] **Step 1: Write failing tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Events\ReleaseCreated;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Services\Ares\ReleaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ReleaseServiceTest extends TestCase
{
    use RefreshDatabase;

    private ReleaseService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(ReleaseService::class);
    }

    public function test_create_release_stores_and_fires_event(): void
    {
        Event::fake([ReleaseCreated::class]);
        $source = Source::factory()->create();

        $release = $this->service->createRelease($source, [
            'release_name' => 'Q1 2026',
            'release_type' => 'scheduled_etl',
            'cdm_version' => '5.4',
        ]);

        $this->assertDatabaseHas('source_releases', [
            'source_id' => $source->id,
            'release_name' => 'Q1 2026',
            'release_type' => 'scheduled_etl',
        ]);
        Event::assertDispatched(ReleaseCreated::class);
    }

    public function test_auto_snapshot_creates_release_for_auto_mode(): void
    {
        Event::fake([ReleaseCreated::class]);
        $source = Source::factory()->create(['release_mode' => 'auto']);

        $release = $this->service->autoSnapshot($source, 'run-123');

        $this->assertNotNull($release);
        $this->assertEquals('snapshot', $release->release_type);
        Event::assertDispatched(ReleaseCreated::class);
    }

    public function test_auto_snapshot_skips_for_manual_mode(): void
    {
        Event::fake([ReleaseCreated::class]);
        $source = Source::factory()->create(['release_mode' => 'manual']);

        $release = $this->service->autoSnapshot($source, 'run-123');

        $this->assertNull($release);
        Event::assertNotDispatched(ReleaseCreated::class);
    }

    public function test_get_timeline_returns_releases_ordered_by_date(): void
    {
        $source = Source::factory()->create();
        SourceRelease::factory()->create(['source_id' => $source->id, 'created_at' => now()->subDays(2)]);
        SourceRelease::factory()->create(['source_id' => $source->id, 'created_at' => now()->subDay()]);
        SourceRelease::factory()->create(['source_id' => $source->id, 'created_at' => now()]);

        $timeline = $this->service->getTimeline($source);

        $this->assertCount(3, $timeline);
        $this->assertTrue($timeline[0]->created_at->gte($timeline[1]->created_at));
    }

    public function test_release_key_is_unique_per_source(): void
    {
        $source = Source::factory()->create();
        $this->service->createRelease($source, [
            'release_name' => 'v1',
            'release_type' => 'scheduled_etl',
        ]);

        // Second source can have same key
        $source2 = Source::factory()->create();
        $release2 = $this->service->createRelease($source2, [
            'release_name' => 'v1',
            'release_type' => 'scheduled_etl',
        ]);
        $this->assertNotNull($release2);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/ReleaseServiceTest.php`
Expected: FAIL — ReleaseService class not found

- [ ] **Step 3: Implement ReleaseService**

```php
<?php

namespace App\Services\Ares;

use App\Events\ReleaseCreated;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ReleaseService
{
    public function createRelease(Source $source, array $data): SourceRelease
    {
        $release = SourceRelease::create([
            'source_id' => $source->id,
            'release_key' => $data['release_key'] ?? $this->generateKey($source),
            'release_name' => $data['release_name'],
            'release_type' => $data['release_type'],
            'cdm_version' => $data['cdm_version'] ?? null,
            'vocabulary_version' => $data['vocabulary_version'] ?? null,
            'etl_version' => $data['etl_version'] ?? null,
            'person_count' => $data['person_count'] ?? 0,
            'record_count' => $data['record_count'] ?? 0,
            'notes' => $data['notes'] ?? null,
        ]);

        ReleaseCreated::dispatch($release);

        return $release;
    }

    public function autoSnapshot(Source $source, string $runId): ?SourceRelease
    {
        if ($source->release_mode !== 'auto') {
            return null;
        }

        return $this->createRelease($source, [
            'release_name' => 'Snapshot ' . now()->format('Y-m-d H:i'),
            'release_type' => 'snapshot',
            'release_key' => $source->source_key . '-' . now()->format('Ymd-His'),
        ]);
    }

    public function getTimeline(Source $source): Collection
    {
        return SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->get();
    }

    public function updateRelease(SourceRelease $release, array $data): SourceRelease
    {
        $release->update(collect($data)->only([
            'release_name', 'cdm_version', 'vocabulary_version', 'etl_version', 'notes',
        ])->toArray());

        return $release->fresh();
    }

    public function deleteRelease(SourceRelease $release): void
    {
        $release->achillesRuns()->update(['release_id' => null]);
        $release->dqdResults()->update(['release_id' => null]);
        $release->delete();
    }

    private function generateKey(Source $source): string
    {
        return ($source->source_key ?? 'src-' . $source->id) . '-' . now()->format('Ymd-His');
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/ReleaseServiceTest.php`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Ares/ReleaseService.php backend/tests/Unit/Services/Ares/ReleaseServiceTest.php
git commit -m "feat(ares): implement ReleaseService with auto-snapshot and timeline"
```

---

## Task 5: AnnotationService

**Files:**
- Create: `backend/app/Services/Ares/AnnotationService.php`
- Create: `backend/tests/Unit/Services/Ares/AnnotationServiceTest.php`

- [ ] **Step 1: Write failing tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\User;
use App\Services\Ares\AnnotationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnnotationServiceTest extends TestCase
{
    use RefreshDatabase;

    private AnnotationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(AnnotationService::class);
    }

    public function test_create_annotation(): void
    {
        $user = User::factory()->create();
        $source = Source::factory()->create();

        $annotation = $this->service->create($user, [
            'source_id' => $source->id,
            'chart_type' => 'temporal_trend',
            'chart_context' => ['domain' => 'condition'],
            'x_value' => '2026-03',
            'annotation_text' => 'New data feed started',
        ]);

        $this->assertDatabaseHas('chart_annotations', [
            'chart_type' => 'temporal_trend',
            'annotation_text' => 'New data feed started',
            'created_by' => $user->id,
        ]);
    }

    public function test_for_chart_returns_matching_annotations(): void
    {
        $user = User::factory()->create();
        $source = Source::factory()->create();

        ChartAnnotation::create([
            'source_id' => $source->id,
            'chart_type' => 'temporal_trend',
            'chart_context' => ['domain' => 'condition'],
            'x_value' => '2026-03',
            'annotation_text' => 'Match',
            'created_by' => $user->id,
        ]);
        ChartAnnotation::create([
            'source_id' => $source->id,
            'chart_type' => 'dq_history',
            'chart_context' => [],
            'x_value' => '2026-03',
            'annotation_text' => 'No match',
            'created_by' => $user->id,
        ]);

        $results = $this->service->forChart('temporal_trend', $source->id);

        $this->assertCount(1, $results);
        $this->assertEquals('Match', $results->first()->annotation_text);
    }

    public function test_update_by_creator_succeeds(): void
    {
        $user = User::factory()->create();
        $annotation = ChartAnnotation::create([
            'chart_type' => 'temporal_trend',
            'chart_context' => [],
            'x_value' => '2026-03',
            'annotation_text' => 'Original',
            'created_by' => $user->id,
        ]);

        $updated = $this->service->update($user, $annotation, ['annotation_text' => 'Updated']);

        $this->assertEquals('Updated', $updated->annotation_text);
    }

    public function test_update_by_non_creator_fails(): void
    {
        $creator = User::factory()->create();
        $other = User::factory()->create();
        $annotation = ChartAnnotation::create([
            'chart_type' => 'temporal_trend',
            'chart_context' => [],
            'x_value' => '2026-03',
            'annotation_text' => 'Original',
            'created_by' => $creator->id,
        ]);

        $this->expectException(AuthorizationException::class);
        $this->service->update($other, $annotation, ['annotation_text' => 'Hacked']);
    }

    public function test_delete_by_creator_succeeds(): void
    {
        $user = User::factory()->create();
        $annotation = ChartAnnotation::create([
            'chart_type' => 'temporal_trend',
            'chart_context' => [],
            'x_value' => '2026-03',
            'annotation_text' => 'Delete me',
            'created_by' => $user->id,
        ]);

        $this->service->delete($user, $annotation);

        $this->assertDatabaseMissing('chart_annotations', ['id' => $annotation->id]);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/AnnotationServiceTest.php`
Expected: FAIL — AnnotationService class not found

- [ ] **Step 3: Implement AnnotationService**

```php
<?php

namespace App\Services\Ares;

use App\Models\App\ChartAnnotation;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class AnnotationService
{
    public function create(User $user, array $data): ChartAnnotation
    {
        return ChartAnnotation::create([
            'source_id' => $data['source_id'] ?? null,
            'chart_type' => $data['chart_type'],
            'chart_context' => $data['chart_context'] ?? [],
            'x_value' => $data['x_value'],
            'y_value' => $data['y_value'] ?? null,
            'annotation_text' => $data['annotation_text'],
            'created_by' => $user->id,
        ]);
    }

    public function forChart(string $chartType, ?int $sourceId = null): Collection
    {
        return ChartAnnotation::where('chart_type', $chartType)
            ->where('source_id', $sourceId)
            ->with('creator:id,name')
            ->orderBy('x_value')
            ->get();
    }

    public function update(User $user, ChartAnnotation $annotation, array $data): ChartAnnotation
    {
        if ($annotation->created_by !== $user->id) {
            throw new AuthorizationException('Only the creator can edit this annotation.');
        }

        $annotation->update(collect($data)->only(['annotation_text'])->toArray());

        return $annotation->fresh();
    }

    public function delete(User $user, ChartAnnotation $annotation): void
    {
        if ($annotation->created_by !== $user->id && ! $user->hasRole('admin') && ! $user->hasRole('super-admin')) {
            throw new AuthorizationException('Only the creator or an admin can delete this annotation.');
        }

        $annotation->delete();
    }

    public function allForSource(int $sourceId): Collection
    {
        return ChartAnnotation::where('source_id', $sourceId)
            ->with('creator:id,name')
            ->orderByDesc('created_at')
            ->get();
    }

    public function allForNetwork(): Collection
    {
        return ChartAnnotation::with('creator:id,name', 'source:id,source_name')
            ->orderByDesc('created_at')
            ->get();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/AnnotationServiceTest.php`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Ares/AnnotationService.php backend/tests/Unit/Services/Ares/AnnotationServiceTest.php
git commit -m "feat(ares): implement AnnotationService with creator-only edit and admin delete"
```

---

## Task 6: Form Requests

**Files:**
- Create: `backend/app/Http/Requests/Api/StoreReleaseRequest.php`
- Create: `backend/app/Http/Requests/Api/UpdateReleaseRequest.php`
- Create: `backend/app/Http/Requests/Api/StoreAnnotationRequest.php`
- Create: `backend/app/Http/Requests/Api/UpdateAnnotationRequest.php`

- [ ] **Step 1: Create StoreReleaseRequest**

```php
<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreReleaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'release_name' => ['required', 'string', 'max:255'],
            'release_type' => ['required', 'string', 'in:scheduled_etl,snapshot'],
            'cdm_version' => ['nullable', 'string', 'max:20'],
            'vocabulary_version' => ['nullable', 'string', 'max:100'],
            'etl_version' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
```

- [ ] **Step 2: Create UpdateReleaseRequest**

```php
<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateReleaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'release_name' => ['sometimes', 'string', 'max:255'],
            'cdm_version' => ['nullable', 'string', 'max:20'],
            'vocabulary_version' => ['nullable', 'string', 'max:100'],
            'etl_version' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
```

- [ ] **Step 3: Create StoreAnnotationRequest**

```php
<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreAnnotationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'chart_type' => ['required', 'string', 'max:50'],
            'chart_context' => ['required', 'array'],
            'x_value' => ['required', 'string', 'max:100'],
            'y_value' => ['nullable', 'numeric'],
            'annotation_text' => ['required', 'string', 'max:2000'],
        ];
    }
}
```

- [ ] **Step 4: Create UpdateAnnotationRequest**

```php
<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAnnotationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'annotation_text' => ['required', 'string', 'max:2000'],
        ];
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Requests/Api/Store*.php backend/app/Http/Requests/Api/Update*.php
git commit -m "feat(ares): add Form Request validation for releases and annotations"
```

---

## Task 7: AresController + Routes

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/AresController.php`
- Modify: `backend/routes/api.php` (add Ares route group)
- Create: `backend/tests/Feature/Api/AresControllerTest.php`

- [ ] **Step 1: Write failing integration tests**

```php
<?php

namespace Tests\Feature\Api;

use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AresControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Source $source;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->user->assignRole('researcher');
        $this->source = Source::factory()->create();
        $this->token = $this->user->createToken('test')->plainTextToken;
    }

    public function test_list_releases_requires_auth(): void
    {
        $this->getJson("/api/v1/sources/{$this->source->id}/ares/releases")
            ->assertStatus(401);
    }

    public function test_list_releases_returns_source_releases(): void
    {
        SourceRelease::factory()->count(3)->create(['source_id' => $this->source->id]);

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/releases")
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_create_release(): void
    {
        $this->withToken($this->token)
            ->postJson("/api/v1/sources/{$this->source->id}/ares/releases", [
                'release_name' => 'Q1 2026',
                'release_type' => 'scheduled_etl',
                'cdm_version' => '5.4',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.release_name', 'Q1 2026');
    }

    public function test_create_annotation(): void
    {
        $this->withToken($this->token)
            ->postJson("/api/v1/sources/{$this->source->id}/ares/annotations", [
                'chart_type' => 'temporal_trend',
                'chart_context' => ['domain' => 'condition'],
                'x_value' => '2026-03',
                'annotation_text' => 'ETL bug here',
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.annotation_text', 'ETL bug here');
    }

    public function test_update_annotation_by_non_creator_returns_403(): void
    {
        $otherUser = User::factory()->create();
        $otherUser->assignRole('researcher');
        $otherToken = $otherUser->createToken('test')->plainTextToken;

        $annotation = ChartAnnotation::create([
            'source_id' => $this->source->id,
            'chart_type' => 'temporal_trend',
            'chart_context' => [],
            'x_value' => '2026-03',
            'annotation_text' => 'Original',
            'created_by' => $this->user->id,
        ]);

        $this->withToken($otherToken)
            ->putJson("/api/v1/sources/{$this->source->id}/ares/annotations/{$annotation->id}", [
                'annotation_text' => 'Hacked',
            ])
            ->assertStatus(403);
    }

    public function test_delete_release(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);

        $this->withToken($this->token)
            ->deleteJson("/api/v1/sources/{$this->source->id}/ares/releases/{$release->id}")
            ->assertOk();

        $this->assertDatabaseMissing('source_releases', ['id' => $release->id]);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/AresControllerTest.php`
Expected: FAIL — routes not defined

- [ ] **Step 3: Implement AresController**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAnnotationRequest;
use App\Http\Requests\Api\StoreReleaseRequest;
use App\Http\Requests\Api\UpdateAnnotationRequest;
use App\Http\Requests\Api\UpdateReleaseRequest;
use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Services\Ares\AnnotationService;
use App\Services\Ares\ReleaseService;
use Illuminate\Http\JsonResponse;

class AresController extends Controller
{
    public function __construct(
        private readonly ReleaseService $releaseService,
        private readonly AnnotationService $annotationService,
    ) {}

    // --- Releases ---

    public function releases(Source $source): JsonResponse
    {
        return response()->json([
            'data' => $this->releaseService->getTimeline($source),
        ]);
    }

    public function showRelease(Source $source, SourceRelease $release): JsonResponse
    {
        $release->load(['achillesRuns:id,release_id,run_id,status,created_at', 'dqdResults']);

        return response()->json(['data' => $release]);
    }

    public function storeRelease(StoreReleaseRequest $request, Source $source): JsonResponse
    {
        $release = $this->releaseService->createRelease($source, $request->validated());

        return response()->json(['data' => $release], 201);
    }

    public function updateRelease(UpdateReleaseRequest $request, Source $source, SourceRelease $release): JsonResponse
    {
        $updated = $this->releaseService->updateRelease($release, $request->validated());

        return response()->json(['data' => $updated]);
    }

    public function destroyRelease(Source $source, SourceRelease $release): JsonResponse
    {
        $this->releaseService->deleteRelease($release);

        return response()->json(['message' => 'Release deleted']);
    }

    // --- Annotations ---

    public function annotations(Source $source): JsonResponse
    {
        $chartType = request()->query('chart_type');
        $annotations = $chartType
            ? $this->annotationService->forChart($chartType, $source->id)
            : $this->annotationService->allForSource($source->id);

        return response()->json(['data' => $annotations]);
    }

    public function storeAnnotation(StoreAnnotationRequest $request, Source $source): JsonResponse
    {
        $annotation = $this->annotationService->create(
            $request->user(),
            array_merge($request->validated(), ['source_id' => $source->id]),
        );

        return response()->json(['data' => $annotation->load('creator:id,name')], 201);
    }

    public function updateAnnotation(UpdateAnnotationRequest $request, Source $source, ChartAnnotation $annotation): JsonResponse
    {
        $updated = $this->annotationService->update($request->user(), $annotation, $request->validated());

        return response()->json(['data' => $updated]);
    }

    public function destroyAnnotation(Source $source, ChartAnnotation $annotation): JsonResponse
    {
        $this->annotationService->delete(request()->user(), $annotation);

        return response()->json(['message' => 'Annotation deleted']);
    }
}
```

- [ ] **Step 4: Add Ares routes to api.php**

Add after the existing Achilles route group (around line 219) in `backend/routes/api.php`:

```php
// Ares — Release Management & Annotations
Route::prefix('sources/{source}/ares')->middleware(['auth:sanctum'])->group(function () {
    // Releases
    Route::get('/releases', [AresController::class, 'releases'])->middleware('permission:analyses.view');
    Route::post('/releases', [AresController::class, 'storeRelease'])->middleware('permission:analyses.create');
    Route::get('/releases/{release}', [AresController::class, 'showRelease'])->middleware('permission:analyses.view');
    Route::put('/releases/{release}', [AresController::class, 'updateRelease'])->middleware('permission:analyses.edit');
    Route::delete('/releases/{release}', [AresController::class, 'destroyRelease'])->middleware('permission:analyses.delete');

    // Annotations
    Route::get('/annotations', [AresController::class, 'annotations'])->middleware('permission:analyses.view');
    Route::post('/annotations', [AresController::class, 'storeAnnotation'])->middleware('permission:analyses.create');
    Route::put('/annotations/{annotation}', [AresController::class, 'updateAnnotation'])->middleware('permission:analyses.edit');
    Route::delete('/annotations/{annotation}', [AresController::class, 'destroyAnnotation'])->middleware('permission:analyses.delete');
});
```

Add the import at the top of the file:
```php
use App\Http\Controllers\Api\V1\AresController;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/AresControllerTest.php`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/AresController.php backend/routes/api.php backend/tests/Feature/Api/AresControllerTest.php
git commit -m "feat(ares): add AresController with release and annotation CRUD endpoints"
```

---

## Task 8: Backfill Releases Command

**Files:**
- Create: `backend/app/Console/Commands/BackfillReleasesCommand.php`

- [ ] **Step 1: Implement the artisan command**

```php
<?php

namespace App\Console\Commands;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\Results\AchillesRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BackfillReleasesCommand extends Command
{
    protected $signature = 'ares:backfill-releases';
    protected $description = 'Create legacy releases for existing sources with Achilles/DQD runs';

    public function handle(): int
    {
        $sources = Source::whereHas('daimons')->get();
        $created = 0;

        foreach ($sources as $source) {
            $existingRelease = SourceRelease::where('source_id', $source->id)->exists();
            if ($existingRelease) {
                $this->info("Source {$source->source_name}: already has releases, skipping.");
                continue;
            }

            $hasRuns = AchillesRun::where('source_id', $source->id)->exists();
            if (! $hasRuns) {
                $this->info("Source {$source->source_name}: no Achilles runs, skipping.");
                continue;
            }

            $release = SourceRelease::create([
                'source_id' => $source->id,
                'release_key' => ($source->source_key ?? 'src-' . $source->id) . '-legacy',
                'release_name' => 'Pre-Ares Legacy',
                'release_type' => 'snapshot',
                'notes' => 'Auto-created by ares:backfill-releases for pre-existing data.',
            ]);

            // Backfill achilles_runs
            AchillesRun::where('source_id', $source->id)
                ->whereNull('release_id')
                ->update(['release_id' => $release->id]);

            // Backfill dqd_results
            DB::table('dqd_results')
                ->where('source_id', $source->id)
                ->whereNull('release_id')
                ->update(['release_id' => $release->id]);

            $this->info("Source {$source->source_name}: created legacy release and backfilled runs.");
            $created++;
        }

        $this->info("Done. Created {$created} legacy release(s).");
        Log::info("ares:backfill-releases created {$created} legacy releases.");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Test manually**

Run: `docker compose exec php php artisan ares:backfill-releases`
Expected: Creates legacy releases for existing sources, logs output

- [ ] **Step 3: Commit**

```bash
git add backend/app/Console/Commands/BackfillReleasesCommand.php
git commit -m "feat(ares): add ares:backfill-releases command for legacy data migration"
```

---

## Task 9: Frontend Types

**Files:**
- Create: `frontend/src/features/data-explorer/types/ares.ts`

- [ ] **Step 1: Create Ares TypeScript types**

```typescript
// frontend/src/features/data-explorer/types/ares.ts

export interface SourceRelease {
  id: number;
  source_id: number;
  release_key: string;
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version: string | null;
  vocabulary_version: string | null;
  etl_version: string | null;
  person_count: number;
  record_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartAnnotation {
  id: number;
  source_id: number | null;
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value: number | null;
  annotation_text: string;
  created_by: number;
  creator?: { id: number; name: string };
  source?: { id: number; source_name: string };
  created_at: string;
  updated_at: string;
}

export interface StoreReleasePayload {
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface UpdateReleasePayload {
  release_name?: string;
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface StoreAnnotationPayload {
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value?: number;
  annotation_text: string;
}

export interface UpdateAnnotationPayload {
  annotation_text: string;
}

export type AresSection =
  | "hub"
  | "network-overview"
  | "concept-comparison"
  | "dq-history"
  | "coverage"
  | "feasibility"
  | "diversity"
  | "releases"
  | "unmapped-codes"
  | "cost"
  | "annotations";

export interface AresHubKpis {
  source_count: number;
  avg_dq_score: number | null;
  total_unmapped_codes: number;
  annotation_count: number;
  latest_releases: Array<{
    source_name: string;
    release_name: string;
    created_at: string;
  }>;
  sources_needing_attention: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/types/ares.ts
git commit -m "feat(ares): add TypeScript type definitions for releases, annotations, and hub"
```

---

## Task 10: Frontend API Layer

**Files:**
- Create: `frontend/src/features/data-explorer/api/releaseApi.ts`
- Create: `frontend/src/features/data-explorer/api/annotationApi.ts`

- [ ] **Step 1: Create releaseApi.ts**

Follow the existing pattern from `achillesRunApi.ts`: import apiClient, unwrap Laravel envelope.

```typescript
// frontend/src/features/data-explorer/api/releaseApi.ts
import apiClient from "@/lib/apiClient";
import type {
  SourceRelease,
  StoreReleasePayload,
  UpdateReleasePayload,
} from "../types/ares";

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export async function fetchReleases(sourceId: number): Promise<SourceRelease[]> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/releases`));
}

export async function fetchRelease(sourceId: number, releaseId: number): Promise<SourceRelease> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/releases/${releaseId}`));
}

export async function createRelease(sourceId: number, data: StoreReleasePayload): Promise<SourceRelease> {
  return unwrap(await apiClient.post(`/sources/${sourceId}/ares/releases`, data));
}

export async function updateRelease(sourceId: number, releaseId: number, data: UpdateReleasePayload): Promise<SourceRelease> {
  return unwrap(await apiClient.put(`/sources/${sourceId}/ares/releases/${releaseId}`, data));
}

export async function deleteRelease(sourceId: number, releaseId: number): Promise<void> {
  await apiClient.delete(`/sources/${sourceId}/ares/releases/${releaseId}`);
}
```

- [ ] **Step 2: Create annotationApi.ts**

```typescript
// frontend/src/features/data-explorer/api/annotationApi.ts
import apiClient from "@/lib/apiClient";
import type {
  ChartAnnotation,
  StoreAnnotationPayload,
  UpdateAnnotationPayload,
} from "../types/ares";

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export async function fetchAnnotations(
  sourceId: number,
  chartType?: string,
): Promise<ChartAnnotation[]> {
  const params = chartType ? { chart_type: chartType } : {};
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/annotations`, { params }));
}

export async function createAnnotation(
  sourceId: number,
  data: StoreAnnotationPayload,
): Promise<ChartAnnotation> {
  return unwrap(await apiClient.post(`/sources/${sourceId}/ares/annotations`, data));
}

export async function updateAnnotation(
  sourceId: number,
  annotationId: number,
  data: UpdateAnnotationPayload,
): Promise<ChartAnnotation> {
  return unwrap(
    await apiClient.put(`/sources/${sourceId}/ares/annotations/${annotationId}`, data),
  );
}

export async function deleteAnnotation(sourceId: number, annotationId: number): Promise<void> {
  await apiClient.delete(`/sources/${sourceId}/ares/annotations/${annotationId}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/api/releaseApi.ts frontend/src/features/data-explorer/api/annotationApi.ts
git commit -m "feat(ares): add release and annotation API client functions"
```

---

## Task 11: Frontend Hooks

**Files:**
- Create: `frontend/src/features/data-explorer/hooks/useReleaseData.ts`
- Create: `frontend/src/features/data-explorer/hooks/useAnnotationData.ts`

- [ ] **Step 1: Create useReleaseData.ts**

Follow the `useAchillesRun.ts` pattern: useQuery + useMutation + queryClient invalidation.

```typescript
// frontend/src/features/data-explorer/hooks/useReleaseData.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRelease,
  deleteRelease,
  fetchReleases,
  updateRelease,
} from "../api/releaseApi";
import type { StoreReleasePayload, UpdateReleasePayload } from "../types/ares";

export function useReleases(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "releases", sourceId],
    queryFn: () => fetchReleases(sourceId!),
    enabled: !!sourceId,
  });
}

export function useCreateRelease(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StoreReleasePayload) => createRelease(sourceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "releases", sourceId] }),
  });
}

export function useUpdateRelease(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, data }: { releaseId: number; data: UpdateReleasePayload }) =>
      updateRelease(sourceId, releaseId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "releases", sourceId] }),
  });
}

export function useDeleteRelease(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (releaseId: number) => deleteRelease(sourceId, releaseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "releases", sourceId] }),
  });
}
```

- [ ] **Step 2: Create useAnnotationData.ts**

```typescript
// frontend/src/features/data-explorer/hooks/useAnnotationData.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAnnotation,
  deleteAnnotation,
  fetchAnnotations,
  updateAnnotation,
} from "../api/annotationApi";
import type { StoreAnnotationPayload, UpdateAnnotationPayload } from "../types/ares";

export function useAnnotations(sourceId: number | null, chartType?: string) {
  return useQuery({
    queryKey: ["ares", "annotations", sourceId, chartType],
    queryFn: () => fetchAnnotations(sourceId!, chartType),
    enabled: !!sourceId,
  });
}

export function useCreateAnnotation(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StoreAnnotationPayload) => createAnnotation(sourceId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "annotations"] }),
  });
}

export function useUpdateAnnotation(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ annotationId, data }: { annotationId: number; data: UpdateAnnotationPayload }) =>
      updateAnnotation(sourceId, annotationId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "annotations"] }),
  });
}

export function useDeleteAnnotation(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (annotationId: number) => deleteAnnotation(sourceId, annotationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "annotations"] }),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/hooks/useReleaseData.ts frontend/src/features/data-explorer/hooks/useAnnotationData.ts
git commit -m "feat(ares): add TanStack Query hooks for releases and annotations"
```

---

## Task 12: Ares Tab Hub + Skeleton Components

**Files:**
- Modify: `frontend/src/features/data-explorer/pages/DataExplorerPage.tsx` (lines 12, 18, 25, 119)
- Create: `frontend/src/features/data-explorer/pages/AresTab.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/AresHub.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/AresHealthBanner.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/AresBreadcrumb.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/HubCard.tsx`

- [ ] **Step 1: Add Ares tab to DataExplorerPage.tsx**

Modify `frontend/src/features/data-explorer/pages/DataExplorerPage.tsx`:

At line 12 (lazy imports section), add:
```typescript
const AresTab = lazy(() => import("./AresTab"));
```

At line 18 (TabId type), change to:
```typescript
type TabId = "overview" | "domains" | "dqd" | "temporal" | "heel" | "ares";
```

At line 25 (TABS array), add after the Data Quality entry:
```typescript
{ id: "ares", label: "Ares" },
```

At line 119 (Suspense render block), add the Ares tab conditional:
```typescript
{activeTab === "ares" && <AresTab />}
```

- [ ] **Step 2: Create HubCard component**

```typescript
// frontend/src/features/data-explorer/components/ares/HubCard.tsx
import type { ReactNode } from "react";
import type { AresSection } from "../../types/ares";

interface HubCardProps {
  section: AresSection;
  title: string;
  accentColor: string;
  children: ReactNode;
  onClick: (section: AresSection) => void;
}

export default function HubCard({ section, title, accentColor, children, onClick }: HubCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(section)}
      className="w-full text-left rounded-lg border border-[#252530] bg-[#151518] p-4
                 transition-colors hover:border-current focus:outline-none focus:ring-1 focus:ring-current"
      style={{ color: accentColor }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
        <span className="text-[11px] uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-[#ccc]">{children}</div>
    </button>
  );
}
```

- [ ] **Step 3: Create AresBreadcrumb component**

```typescript
// frontend/src/features/data-explorer/components/ares/AresBreadcrumb.tsx
import type { AresSection } from "../../types/ares";

const SECTION_LABELS: Record<AresSection, string> = {
  hub: "Hub",
  "network-overview": "Network Overview",
  "concept-comparison": "Concept Comparison",
  "dq-history": "DQ History",
  coverage: "Coverage Matrix",
  feasibility: "Feasibility",
  diversity: "Diversity",
  releases: "Releases",
  "unmapped-codes": "Unmapped Codes",
  cost: "Cost Analysis",
  annotations: "Annotations",
};

interface AresBreadcrumbProps {
  activeSection: AresSection;
  onBack: () => void;
}

export default function AresBreadcrumb({ activeSection, onBack }: AresBreadcrumbProps) {
  if (activeSection === "hub") return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#252530] bg-[#0E0E11] px-4 py-2 text-sm">
      <button
        type="button"
        onClick={onBack}
        className="text-[#2DD4BF] hover:underline"
      >
        Ares
      </button>
      <span className="text-[#555]">›</span>
      <span className="text-[#ccc]">{SECTION_LABELS[activeSection]}</span>
    </div>
  );
}
```

- [ ] **Step 4: Create AresHealthBanner component**

```typescript
// frontend/src/features/data-explorer/components/ares/AresHealthBanner.tsx

interface AresHealthBannerProps {
  sourceCount: number;
  avgDqScore: number | null;
  unmappedCodes: number;
  annotationCount: number;
}

export default function AresHealthBanner({
  sourceCount,
  avgDqScore,
  unmappedCodes,
  annotationCount,
}: AresHealthBannerProps) {
  return (
    <div className="mb-5 flex items-center justify-between rounded-xl border border-[#252530]
                    bg-gradient-to-br from-[#151518] to-[#1a1a22] p-4 px-5">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#888]">Network Health</p>
        <p className="mt-1 text-2xl font-semibold text-white">{sourceCount} Data Sources</p>
      </div>
      <div className="flex gap-6">
        <div className="text-center">
          <p className="text-xl font-semibold text-[#2DD4BF]">
            {avgDqScore !== null ? `${avgDqScore.toFixed(1)}%` : "—"}
          </p>
          <p className="text-[11px] text-[#666]">Avg DQ Score</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold text-[#C9A227]">{unmappedCodes.toLocaleString()}</p>
          <p className="text-[11px] text-[#666]">Unmapped Codes</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold text-[#9B1B30]">{annotationCount}</p>
          <p className="text-[11px] text-[#666]">Annotations</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create AresHub component**

```typescript
// frontend/src/features/data-explorer/components/ares/AresHub.tsx
import type { AresSection } from "../../types/ares";
import AresHealthBanner from "./AresHealthBanner";
import HubCard from "./HubCard";

interface AresHubProps {
  onNavigate: (section: AresSection) => void;
}

export default function AresHub({ onNavigate }: AresHubProps) {
  // Placeholder KPIs — will be wired to API in Phase 3
  return (
    <div>
      <AresHealthBanner
        sourceCount={0}
        avgDqScore={null}
        unmappedCodes={0}
        annotationCount={0}
      />

      {/* Row 1: Primary */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <HubCard section="network-overview" title="Network Overview" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Source health, DQ scores, trend indicators</p>
        </HubCard>
        <HubCard section="concept-comparison" title="Concept Comparison" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Compare concept prevalence across sources</p>
        </HubCard>
        <HubCard section="dq-history" title="DQ History" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Quality trends over releases</p>
        </HubCard>
      </div>

      {/* Row 2: Secondary */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <HubCard section="coverage" title="Coverage Matrix" accentColor="#9B1B30" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Domain × source availability</p>
        </HubCard>
        <HubCard section="feasibility" title="Feasibility" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Can your network support a study?</p>
        </HubCard>
        <HubCard section="diversity" title="Diversity" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Demographic parity across sources</p>
        </HubCard>
      </div>

      {/* Row 3: Tertiary */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <HubCard section="releases" title="Releases" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Version history per source</p>
        </HubCard>
        <HubCard section="unmapped-codes" title="Unmapped Codes" accentColor="#9B1B30" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Source codes without standard mappings</p>
        </HubCard>
        <HubCard section="annotations" title="Annotations" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Chart notes across all sources</p>
        </HubCard>
      </div>

      {/* Row 4: Bottom */}
      <div className="grid grid-cols-1 gap-3">
        <HubCard section="cost" title="Cost Analysis" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Cost data by domain and over time</p>
        </HubCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create AresTab page (hub + drill-in router)**

```typescript
// frontend/src/features/data-explorer/pages/AresTab.tsx
import { useState } from "react";
import type { AresSection } from "../types/ares";
import AresBreadcrumb from "../components/ares/AresBreadcrumb";
import AresHub from "../components/ares/AresHub";

// Drill-in views — lazy loaded as they're built in later phases
// import ReleasesView from "../components/ares/releases/ReleasesView";
// import AnnotationsView from "../components/ares/annotations/AnnotationsView";

export default function AresTab() {
  const [activeSection, setActiveSection] = useState<AresSection>("hub");

  const handleNavigate = (section: AresSection) => {
    setActiveSection(section);
  };

  const handleBack = () => {
    setActiveSection("hub");
  };

  return (
    <div>
      <AresBreadcrumb activeSection={activeSection} onBack={handleBack} />
      {activeSection === "hub" && <AresHub onNavigate={handleNavigate} />}
      {activeSection !== "hub" && (
        <div className="flex items-center justify-center py-20 text-[#555]">
          <p>Coming soon — {activeSection} view</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify the tab renders**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No TypeScript errors

Open http://localhost:5175 → Data Explorer → click "Ares" tab → hub with 10 cards renders

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/data-explorer/pages/AresTab.tsx frontend/src/features/data-explorer/pages/DataExplorerPage.tsx frontend/src/features/data-explorer/components/ares/
git commit -m "feat(ares): add Ares tab with dashboard hub, health banner, and 10 drill-in cards"
```

---

## Task 13: ReleasesView Drill-In

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/releases/ReleasesView.tsx`
- Modify: `frontend/src/features/data-explorer/pages/AresTab.tsx`

- [ ] **Step 1: Implement ReleasesView**

This is the first functional drill-in view. It shows a source selector dropdown, then a vertical timeline of releases for that source with create/edit capability.

```typescript
// frontend/src/features/data-explorer/components/ares/releases/ReleasesView.tsx
import { useState } from "react";
import { useReleases, useCreateRelease, useDeleteRelease } from "../../../hooks/useReleaseData";
import type { StoreReleasePayload } from "../../../types/ares";

// This component will receive sourceId from a parent source selector
// For now, accept sourceId as prop
interface ReleasesViewProps {
  sourceId: number | null;
  sources: Array<{ id: number; source_name: string }>;
  onSourceChange: (id: number) => void;
}

export default function ReleasesView({ sourceId, sources, onSourceChange }: ReleasesViewProps) {
  const { data: releases, isLoading } = useReleases(sourceId);
  const createMutation = useCreateRelease(sourceId ?? 0);
  const deleteMutation = useDeleteRelease(sourceId ?? 0);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<StoreReleasePayload>({
    release_name: "",
    release_type: "scheduled_etl",
  });

  const handleCreate = () => {
    if (!sourceId || !formData.release_name) return;
    createMutation.mutate(formData, {
      onSuccess: () => {
        setShowForm(false);
        setFormData({ release_name: "", release_type: "scheduled_etl" });
      },
    });
  };

  return (
    <div className="p-4">
      {/* Source selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-[#888]">Source:</label>
        <select
          value={sourceId ?? ""}
          onChange={(e) => onSourceChange(Number(e.target.value))}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
        >
          <option value="">Select source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.source_name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ml-auto rounded bg-[#C9A227] px-3 py-1.5 text-sm font-medium text-black
                     hover:bg-[#d4ad2f]"
        >
          + Create Release
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-4 rounded-lg border border-[#333] bg-[#1a1a22] p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Release name (e.g. Q1 2026)"
              value={formData.release_name}
              onChange={(e) => setFormData({ ...formData, release_name: e.target.value })}
              className="rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-white"
            />
            <select
              value={formData.release_type}
              onChange={(e) => setFormData({ ...formData, release_type: e.target.value as "scheduled_etl" | "snapshot" })}
              className="rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-white"
            >
              <option value="scheduled_etl">Scheduled ETL</option>
              <option value="snapshot">Snapshot</option>
            </select>
            <input
              placeholder="CDM version (e.g. 5.4)"
              value={formData.cdm_version ?? ""}
              onChange={(e) => setFormData({ ...formData, cdm_version: e.target.value || undefined })}
              className="rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-white"
            />
            <input
              placeholder="Vocabulary version"
              value={formData.vocabulary_version ?? ""}
              onChange={(e) => setFormData({ ...formData, vocabulary_version: e.target.value || undefined })}
              className="rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={handleCreate} className="rounded bg-[#2DD4BF] px-4 py-1.5 text-sm font-medium text-black">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded border border-[#333] px-4 py-1.5 text-sm text-[#888]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {isLoading && <p className="text-[#555]">Loading releases...</p>}
      {!isLoading && (!releases || releases.length === 0) && (
        <p className="py-10 text-center text-[#555]">No releases yet. Create one or run Achilles to auto-generate.</p>
      )}
      {releases && releases.length > 0 && (
        <div className="space-y-3">
          {releases.map((r) => (
            <div key={r.id} className="flex items-start gap-4 rounded-lg border border-[#252530] bg-[#151518] p-4">
              <div className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: r.release_type === "scheduled_etl" ? "#C9A227" : "#2DD4BF" }} />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-white">{r.release_name}</span>
                  <span className="rounded bg-[#252530] px-2 py-0.5 text-[10px] uppercase text-[#888]">
                    {r.release_type === "scheduled_etl" ? "ETL" : "Snapshot"}
                  </span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-[#666]">
                  {r.cdm_version && <span>CDM {r.cdm_version}</span>}
                  {r.vocabulary_version && <span>Vocab {r.vocabulary_version}</span>}
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-[#888]">
                  <span>{r.person_count.toLocaleString()} persons</span>
                  <span>{r.record_count.toLocaleString()} records</span>
                </div>
                {r.notes && <p className="mt-1 text-xs text-[#555]">{r.notes}</p>}
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(r.id)}
                className="text-xs text-[#555] hover:text-[#9B1B30]"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire ReleasesView into AresTab**

Update `AresTab.tsx` to import and render `ReleasesView` when `activeSection === "releases"`. The source selector needs a list of sources — for now use a simple fetch or pass from parent. Update the placeholder block to render the actual view.

- [ ] **Step 3: Verify ReleasesView renders**

Open browser → Ares tab → click Releases card → should show source selector + create button + empty state

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/releases/ReleasesView.tsx frontend/src/features/data-explorer/pages/AresTab.tsx
git commit -m "feat(ares): add ReleasesView drill-in with timeline and create form"
```

---

## Task 14: AnnotationsView + AnnotationMarker Drill-In

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/annotations/AnnotationsView.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/annotations/AnnotationMarker.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/annotations/AnnotationPopover.tsx`
- Modify: `frontend/src/features/data-explorer/pages/AresTab.tsx`

- [ ] **Step 1: Create AnnotationPopover**

Small popover component for creating/editing annotations. Used by both AnnotationsView and AnnotationMarker.

```typescript
// frontend/src/features/data-explorer/components/ares/annotations/AnnotationPopover.tsx
import { useState } from "react";
import type { ChartAnnotation, StoreAnnotationPayload } from "../../../types/ares";

interface AnnotationPopoverProps {
  annotation?: ChartAnnotation;
  chartType?: string;
  chartContext?: Record<string, unknown>;
  xValue?: string;
  yValue?: number;
  onSave: (data: StoreAnnotationPayload | { annotation_text: string }) => void;
  onClose: () => void;
}

export default function AnnotationPopover({
  annotation,
  chartType,
  chartContext,
  xValue,
  yValue,
  onSave,
  onClose,
}: AnnotationPopoverProps) {
  const [text, setText] = useState(annotation?.annotation_text ?? "");

  const handleSubmit = () => {
    if (!text.trim()) return;

    if (annotation) {
      onSave({ annotation_text: text });
    } else {
      onSave({
        chart_type: chartType!,
        chart_context: chartContext ?? {},
        x_value: xValue!,
        y_value: yValue,
        annotation_text: text,
      });
    }
  };

  return (
    <div className="w-72 rounded-lg border border-[#333] bg-[#1a1a22] p-3 shadow-xl">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note..."
        rows={3}
        className="w-full resize-none rounded border border-[#333] bg-[#151518] px-2 py-1.5
                   text-sm text-white placeholder-[#555] focus:border-[#2DD4BF] focus:outline-none"
        maxLength={2000}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded px-3 py-1 text-xs text-[#888] hover:text-white">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="rounded bg-[#2DD4BF] px-3 py-1 text-xs font-medium text-black disabled:opacity-50"
        >
          {annotation ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AnnotationMarker (composable chart overlay)**

```typescript
// frontend/src/features/data-explorer/components/ares/annotations/AnnotationMarker.tsx
import { useState } from "react";
import { useAnnotations } from "../../../hooks/useAnnotationData";
import type { ChartAnnotation } from "../../../types/ares";

interface AnnotationMarkerProps {
  sourceId: number;
  chartType: string;
  /** X-axis values from the chart, used to position markers */
  xValues: string[];
}

export default function AnnotationMarker({ sourceId, chartType, xValues }: AnnotationMarkerProps) {
  const { data: annotations } = useAnnotations(sourceId, chartType);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (!annotations || annotations.length === 0) return null;

  // Filter to annotations whose x_value matches a chart x-value
  const visible = annotations.filter((a: ChartAnnotation) => xValues.includes(a.x_value));

  return (
    <div className="pointer-events-none absolute inset-0">
      {visible.map((a: ChartAnnotation) => {
        const idx = xValues.indexOf(a.x_value);
        const leftPct = xValues.length > 1 ? (idx / (xValues.length - 1)) * 100 : 50;

        return (
          <div
            key={a.id}
            className="pointer-events-auto absolute -translate-x-1/2"
            style={{ left: `${leftPct}%`, top: 0 }}
            onMouseEnter={() => setHoveredId(a.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div className="h-4 w-4 cursor-pointer rounded-full border-2 border-[#C9A227] bg-[#1a1a22]
                          transition-transform hover:scale-125" />
            {hoveredId === a.id && (
              <div className="absolute left-1/2 top-6 z-20 w-48 -translate-x-1/2 rounded border border-[#333]
                            bg-[#1a1a22] p-2 text-xs shadow-xl">
                <p className="text-white">{a.annotation_text}</p>
                <p className="mt-1 text-[#555]">
                  {a.creator?.name} · {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create AnnotationsView**

```typescript
// frontend/src/features/data-explorer/components/ares/annotations/AnnotationsView.tsx
import { useAnnotations, useDeleteAnnotation } from "../../../hooks/useAnnotationData";
import type { ChartAnnotation } from "../../../types/ares";

interface AnnotationsViewProps {
  sourceId: number | null;
  sources: Array<{ id: number; source_name: string }>;
  onSourceChange: (id: number) => void;
}

export default function AnnotationsView({ sourceId, sources, onSourceChange }: AnnotationsViewProps) {
  const { data: annotations, isLoading } = useAnnotations(sourceId);
  const deleteMutation = useDeleteAnnotation(sourceId ?? 0);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-[#888]">Source:</label>
        <select
          value={sourceId ?? ""}
          onChange={(e) => onSourceChange(Number(e.target.value))}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.source_name}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-[#555]">Loading annotations...</p>}
      {!isLoading && (!annotations || annotations.length === 0) && (
        <p className="py-10 text-center text-[#555]">No annotations yet. Add notes on charts using the + button.</p>
      )}
      {annotations && annotations.length > 0 && (
        <div className="space-y-2">
          {annotations.map((a: ChartAnnotation) => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-[#252530] bg-[#151518] p-3">
              <div className="h-2 w-2 mt-1.5 flex-shrink-0 rounded-full bg-[#C9A227]" />
              <div className="flex-1">
                <p className="text-sm text-white">{a.annotation_text}</p>
                <div className="mt-1 flex gap-3 text-[11px] text-[#666]">
                  <span>{a.chart_type.replace(/_/g, " ")}</span>
                  <span>x: {a.x_value}</span>
                  <span>{a.creator?.name}</span>
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(a.id)}
                className="text-xs text-[#555] hover:text-[#9B1B30]"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire AnnotationsView into AresTab**

Update `AresTab.tsx` to import and render `AnnotationsView` when `activeSection === "annotations"`.

- [ ] **Step 5: Verify**

Open browser → Ares tab → click Annotations card → should show source selector + empty state

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/annotations/ frontend/src/features/data-explorer/pages/AresTab.tsx
git commit -m "feat(ares): add AnnotationsView, AnnotationMarker, and AnnotationPopover components"
```

---

## Task 15: DqHistoryService Stub + Final Phase 1 Verification

**Files:**
- Create: `backend/app/Services/Ares/DqHistoryService.php` (stub for ComputeDqDeltas listener)

- [ ] **Step 1: Create DqHistoryService stub**

The `ComputeDqDeltas` listener depends on this service. Create a minimal stub that will be fully implemented in Phase 2.

```php
<?php

namespace App\Services\Ares;

use App\Models\App\SourceRelease;
use Illuminate\Support\Facades\Log;

class DqHistoryService
{
    public function computeDeltas(SourceRelease $release): void
    {
        // Phase 2 implementation — for now, log and return
        Log::info("DqHistoryService::computeDeltas stub called for release {$release->id}");
    }
}
```

- [ ] **Step 2: Run full backend test suite**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/AresControllerTest.php`
Expected: All tests PASS

- [ ] **Step 3: Run frontend TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors

- [ ] **Step 4: Run migrations on production**

Run: `docker compose exec php php artisan migrate`
Then: `docker compose exec php php artisan ares:backfill-releases`
Expected: Legacy releases created for existing sources

- [ ] **Step 5: Final commit**

```bash
git add backend/app/Services/Ares/DqHistoryService.php
git commit -m "feat(ares): complete Phase 1 foundation — releases, annotations, events, hub UI"
```

- [ ] **Step 6: Deploy**

Run: `./deploy.sh`
Verify: Ares tab visible in Data Explorer with hub cards rendering
