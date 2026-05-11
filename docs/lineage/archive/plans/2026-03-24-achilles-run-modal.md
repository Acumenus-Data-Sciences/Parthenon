# Achilles Interactive Run Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Heel Checks" tab with a unified "Achilles" tab featuring two-column layout (Achilles runs left, Heel checks right), a "Run Achilles" button that launches an interactive modal showing every analysis step with real-time progress via Reverb WebSocket + polling fallback, and a "Run Heel Checks" button for the existing heel functionality.

**Architecture:** The backend adds two tables (`achilles_runs`, `achilles_run_steps`) to track per-analysis progress. `AchillesEngineService` writes step status as it executes each analysis and broadcasts `AchillesStepCompleted` events via Reverb. The frontend polls every 2s as a fallback and also listens on a public Reverb channel for instant updates. A full-screen modal displays analyses grouped by category with live timers.

**Tech Stack:** Laravel 11 (migrations, events, queue jobs), Reverb WebSocket broadcasting, React 19, TanStack Query, Laravel Echo, TypeScript

---

## File Map

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `backend/database/migrations/2026_03_24_000001_create_achilles_runs_table.php` | `achilles_runs` table (run lifecycle) |
| `backend/database/migrations/2026_03_24_000002_create_achilles_run_steps_table.php` | `achilles_run_steps` table (per-analysis progress) |
| `backend/app/Models/Results/AchillesRun.php` | Eloquent model for `achilles_runs` |
| `backend/app/Models/Results/AchillesRunStep.php` | Eloquent model for `achilles_run_steps` |
| `backend/app/Events/AchillesStepCompleted.php` | Reverb broadcast event |

### Backend — Modified Files

| File | Changes |
|------|---------|
| `backend/app/Services/Achilles/AchillesEngineService.php` | Add `run_id` tracking, write step rows, broadcast events |
| `backend/app/Jobs/Achilles/RunAchillesJob.php` | Accept optional `run_id`, create `achilles_runs` row, pass to engine |
| `backend/app/Console/Commands/RunAchillesCommand.php` | Pass `run_id` to `RunAchillesJob::dispatch()` |
| `backend/app/Http/Controllers/Api/V1/AchillesController.php` | Add `achillesRuns()`, `achillesProgress()` endpoints; modify `run()` to return `run_id` |
| `backend/routes/api.php` | Add new Achilles run/progress routes |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/data-explorer/components/AchillesRunModal.tsx` | Full interactive modal with per-step progress |
| `frontend/src/features/data-explorer/hooks/useAchillesRun.ts` | TanStack Query hooks + Echo listener for Achilles runs |
| `frontend/src/features/data-explorer/api/achillesRunApi.ts` | API functions for run/progress/history |

### Frontend — Modified Files

| File | Changes |
|------|---------|
| `frontend/src/features/data-explorer/pages/DataExplorerPage.tsx` | Rename "Heel Checks" tab to "Achilles", update TabId type |
| `frontend/src/features/data-explorer/pages/HeelTab.tsx` | Rename to `AchillesTab.tsx`, restructure to two-column layout with both buttons |
| `frontend/src/features/data-explorer/pages/DataExplorerPage.tsx` | Remove header "Run Achilles" button + achillesMutation, rename tab, update lazy import |

---

## Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_24_000001_create_achilles_runs_table.php`
- Create: `backend/database/migrations/2026_03_24_000002_create_achilles_run_steps_table.php`

- [ ] **Step 1: Create achilles_runs migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achilles_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->uuid('run_id')->unique();
            $table->string('status', 20)->default('pending'); // pending, running, completed, failed, cancelled
            $table->unsignedInteger('total_analyses')->default(0);
            $table->unsignedInteger('completed_analyses')->default(0);
            $table->unsignedInteger('failed_analyses')->default(0);
            $table->json('categories')->nullable(); // which categories were requested (null = all)
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['source_id', 'created_at']);
            $table->index('run_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achilles_runs');
    }
};
```

- [ ] **Step 2: Create achilles_run_steps migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('achilles_run_steps', function (Blueprint $table) {
            $table->id();
            $table->uuid('run_id');
            $table->unsignedInteger('analysis_id');
            $table->string('analysis_name');
            $table->string('category', 50);
            $table->string('status', 20)->default('pending'); // pending, running, completed, failed
            $table->float('elapsed_seconds')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('run_id');
            $table->index(['run_id', 'category']);
            $table->unique(['run_id', 'analysis_id']);
            $table->foreign('run_id')->references('run_id')->on('achilles_runs')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achilles_run_steps');
    }
};
```

- [ ] **Step 3: Run migrations**

Run: `docker compose exec php php artisan migrate`
Expected: Both tables created successfully.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_24_000001_create_achilles_runs_table.php backend/database/migrations/2026_03_24_000002_create_achilles_run_steps_table.php
git commit -m "feat: add achilles_runs and achilles_run_steps tables for per-analysis tracking"
```

---

## Task 2: Eloquent Models

**Files:**
- Create: `backend/app/Models/Results/AchillesRun.php`
- Create: `backend/app/Models/Results/AchillesRunStep.php`

- [ ] **Step 1: Create AchillesRun model**

```php
<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AchillesRun extends Model
{
    protected $table = 'achilles_runs';

    protected $fillable = [
        'source_id',
        'run_id',
        'total_analyses',
        'completed_analyses',
        'failed_analyses',
        'categories',
        'started_at',
        'completed_at',
    ];
    // Note: 'status' intentionally excluded from $fillable (HIGHSEC §3.1).
    // Set via explicit update() calls only to prevent mass assignment of run status.

    protected $casts = [
        'categories' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /** @return HasMany<AchillesRunStep, $this> */
    public function steps(): HasMany
    {
        return $this->hasMany(AchillesRunStep::class, 'run_id', 'run_id');
    }
}
```

- [ ] **Step 2: Create AchillesRunStep model**

```php
<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AchillesRunStep extends Model
{
    protected $table = 'achilles_run_steps';

    protected $fillable = [
        'run_id',
        'analysis_id',
        'analysis_name',
        'category',
        'status',
        'elapsed_seconds',
        'error_message',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'elapsed_seconds' => 'float',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /** @return BelongsTo<AchillesRun, $this> */
    public function run(): BelongsTo
    {
        return $this->belongsTo(AchillesRun::class, 'run_id', 'run_id');
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Models/Results/AchillesRun.php backend/app/Models/Results/AchillesRunStep.php
git commit -m "feat: add AchillesRun and AchillesRunStep Eloquent models"
```

---

## Task 3: Broadcast Event

**Files:**
- Create: `backend/app/Events/AchillesStepCompleted.php`

- [ ] **Step 1: Create the broadcast event**

Model this after `backend/app/Events/StudyExecutionUpdated.php` — use a public channel since the data isn't sensitive (analysis names/timings, no PHI).

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AchillesStepCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $runId,
        public readonly int $sourceId,
        public readonly int $analysisId,
        public readonly string $analysisName,
        public readonly string $category,
        public readonly string $status,
        public readonly float $elapsedSeconds,
        public readonly int $completedAnalyses,
        public readonly int $totalAnalyses,
        public readonly int $failedAnalyses,
        public readonly ?string $errorMessage = null,
    ) {}

    /** @return array<Channel> */
    public function broadcastOn(): array
    {
        return [
            new Channel("achilles.run.{$this->runId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'step.completed';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'run_id' => $this->runId,
            'source_id' => $this->sourceId,
            'analysis_id' => $this->analysisId,
            'analysis_name' => $this->analysisName,
            'category' => $this->category,
            'status' => $this->status,
            'elapsed_seconds' => $this->elapsedSeconds,
            'completed_analyses' => $this->completedAnalyses,
            'total_analyses' => $this->totalAnalyses,
            'failed_analyses' => $this->failedAnalyses,
            'error_message' => $this->errorMessage,
            'timestamp' => now()->toISOString(),
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Events/AchillesStepCompleted.php
git commit -m "feat: add AchillesStepCompleted broadcast event for Reverb"
```

---

## Task 4: Modify AchillesEngineService for Run Tracking

**Files:**
- Modify: `backend/app/Services/Achilles/AchillesEngineService.php`

This is the core change. The engine must:
1. Accept a `run_id` parameter
2. Pre-populate all step rows as `pending` before execution starts
3. Mark each step `running` before execution, `completed`/`failed` after
4. Update the parent `achilles_runs` row counts after each step
5. Broadcast an `AchillesStepCompleted` event after each step

- [ ] **Step 1: Add run tracking to executeAnalyses and executeSingle**

Key changes to `AchillesEngineService`:

1. Add `use App\Events\AchillesStepCompleted;`, `use App\Models\Results\AchillesRun;`, `use App\Models\Results\AchillesRunStep;` imports.

2. Add `?string $runId = null` parameter to `executeAnalyses()` and `runAll()` and `runAnalyses()`.

3. In `executeAnalyses()`, before the foreach loop, if `$runId` is set:
   - Insert all pending step rows via `AchillesRunStep::insert(...)` (batch insert for efficiency)
   - Update the `AchillesRun` row to `status=running`, `started_at=now()`

4. In the foreach loop in `executeAnalyses()`, if `$runId` is set:
   - Before `executeSingle()`: update the step row to `status=running`, `started_at=now()`
   - After `executeSingle()`: update the step row to `status=completed|failed`, `elapsed_seconds`, `completed_at=now()`, `error_message` if failed
   - Increment `completed_analyses` or `failed_analyses` on the `AchillesRun` row
   - Broadcast `AchillesStepCompleted` event

5. After the foreach loop, if `$runId` is set:
   - Update the `AchillesRun` row to `status=completed`, `completed_at=now()`

Here is the modified `executeAnalyses()` method (replace the existing one):

```php
/**
 * Execute a batch of analyses with optional run tracking.
 *
 * @param  array<int, AchillesAnalysisInterface>  $analyses
 * @return array{completed: int, failed: int, results: list<array{analysis_id: int, status: string, elapsed_seconds: float, error?: string}>}
 */
private function executeAnalyses(Source $source, array $analyses, ?string $runId = null): array
{
    $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
    $resultsSchema = $source->getTableQualifier(DaimonType::Results);

    if (! $cdmSchema || ! $resultsSchema) {
        if ($runId) {
            AchillesRun::where('run_id', $runId)->update([
                'status' => 'failed',
                'completed_at' => now(),
            ]);
        }

        return [
            'completed' => 0,
            'failed' => count($analyses),
            'results' => array_map(fn (AchillesAnalysisInterface $a) => [
                'analysis_id' => $a->analysisId(),
                'status' => 'failed',
                'elapsed_seconds' => 0.0,
                'error' => 'Source is missing CDM or Results daimon configuration.',
            ], array_values($analyses)),
        ];
    }

    // Pre-populate step rows if tracking
    if ($runId) {
        $stepRows = [];
        $now = now();
        foreach ($analyses as $analysis) {
            $stepRows[] = [
                'run_id' => $runId,
                'analysis_id' => $analysis->analysisId(),
                'analysis_name' => $analysis->analysisName(),
                'category' => $analysis->category(),
                'status' => 'pending',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        // Batch insert in chunks of 50
        foreach (array_chunk($stepRows, 50) as $chunk) {
            AchillesRunStep::insert($chunk);
        }

        AchillesRun::where('run_id', $runId)->update([
            'status' => 'running',
            'total_analyses' => count($analyses),
            'started_at' => now(),
        ]);
    }

    $completed = 0;
    $failed = 0;
    $results = [];

    foreach ($analyses as $analysis) {
        // Mark step running
        if ($runId) {
            AchillesRunStep::where('run_id', $runId)
                ->where('analysis_id', $analysis->analysisId())
                ->update(['status' => 'running', 'started_at' => now()]);
        }

        $result = $this->executeSingle($source, $analysis, $cdmSchema, $resultsSchema);
        $results[] = $result;

        if ($result['status'] === 'completed') {
            $completed++;
        } else {
            $failed++;
        }

        // Update step and run, broadcast
        if ($runId) {
            AchillesRunStep::where('run_id', $runId)
                ->where('analysis_id', $analysis->analysisId())
                ->update([
                    'status' => $result['status'],
                    'elapsed_seconds' => $result['elapsed_seconds'],
                    'error_message' => $result['error'] ?? null,
                    'completed_at' => now(),
                ]);

            AchillesRun::where('run_id', $runId)->update([
                'completed_analyses' => $completed,
                'failed_analyses' => $failed,
            ]);

            broadcast(new AchillesStepCompleted(
                runId: $runId,
                sourceId: $source->id,
                analysisId: $analysis->analysisId(),
                analysisName: $analysis->analysisName(),
                category: $analysis->category(),
                status: $result['status'],
                elapsedSeconds: $result['elapsed_seconds'],
                completedAnalyses: $completed,
                totalAnalyses: count($analyses),
                failedAnalyses: $failed,
                errorMessage: $result['error'] ?? null,
            ));
        }
    }

    // Mark run complete
    if ($runId) {
        AchillesRun::where('run_id', $runId)->update([
            'status' => $failed === count($analyses) ? 'failed' : 'completed',
            'completed_at' => now(),
        ]);
    }

    return [
        'completed' => $completed,
        'failed' => $failed,
        'results' => $results,
    ];
}
```

Update the `runAll()` and `runAnalyses()` signatures to pass through `$runId`:

```php
public function runAll(Source $source, ?array $categories = null, ?string $runId = null): array
{
    $analyses = $categories
        ? collect($categories)->flatMap(fn (string $c) => $this->registry->byCategory($c))->all()
        : $this->registry->all();

    return $this->executeAnalyses($source, $analyses, $runId);
}

public function runAnalyses(Source $source, array $analysisIds, ?string $runId = null): array
{
    $analyses = array_filter(
        array_map(fn (int $id) => $this->registry->get($id), $analysisIds),
    );

    return $this->executeAnalyses($source, $analyses, $runId);
}
```

- [ ] **Step 2: Verify PHPStan passes**

Run: `docker compose exec php vendor/bin/phpstan analyse app/Services/Achilles/AchillesEngineService.php --level=8`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/Achilles/AchillesEngineService.php
git commit -m "feat: add per-analysis run tracking and Reverb broadcasting to AchillesEngineService"
```

---

## Task 5: Modify RunAchillesJob and RunAchillesCommand

**Files:**
- Modify: `backend/app/Jobs/Achilles/RunAchillesJob.php`
- Modify: `backend/app/Console/Commands/RunAchillesCommand.php`

**IMPORTANT:** `$runId` is placed AFTER `$fresh` (the last parameter) to preserve backward compatibility with existing callers. `RunAchillesCommand` dispatches `RunAchillesJob::dispatch($source, $categories, $analysisIds, $fresh)` — inserting `$runId` earlier would break the positional arguments.

- [ ] **Step 1: Add optional run_id to RunAchillesJob**

```php
<?php

namespace App\Jobs\Achilles;

use App\Models\App\Source;
use App\Models\Results\AchillesRun;
use App\Services\Achilles\AchillesEngineService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class RunAchillesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600;

    public int $tries = 1;

    /**
     * @param  list<string>|null  $categories
     * @param  list<int>|null  $analysisIds
     */
    public function __construct(
        public Source $source,
        public ?array $categories = null,
        public ?array $analysisIds = null,
        public bool $fresh = false,
        public ?string $runId = null,
    ) {
        $this->queue = 'achilles';
    }

    public function handle(AchillesEngineService $engine): void
    {
        // Generate run_id if not provided (backward compat with CLI)
        $this->runId ??= (string) Str::uuid();

        Log::info('Achilles job started', [
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'categories' => $this->categories,
            'analysis_ids' => $this->analysisIds,
            'fresh' => $this->fresh,
        ]);

        // Create the run record
        AchillesRun::create([
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'status' => 'pending',
            'categories' => $this->categories,
        ]);

        if ($this->fresh) {
            $engine->clearResults($this->analysisIds);
        }

        if ($this->analysisIds) {
            $result = $engine->runAnalyses($this->source, $this->analysisIds, $this->runId);
        } else {
            $result = $engine->runAll($this->source, $this->categories, $this->runId);
        }

        Log::info('Achilles job completed', [
            'source_id' => $this->source->id,
            'run_id' => $this->runId,
            'completed' => $result['completed'],
            'failed' => $result['failed'],
        ]);
    }
}
```

- [ ] **Step 2: Update RunAchillesCommand to pass run_id**

In `backend/app/Console/Commands/RunAchillesCommand.php`, update line 58 to pass a `runId`:

```php
// Change:
RunAchillesJob::dispatch($source, $categories, $analysisIds, (bool) $this->option('fresh'));

// To:
$runId = (string) \Illuminate\Support\Str::uuid();
RunAchillesJob::dispatch($source, $categories, $analysisIds, (bool) $this->option('fresh'), $runId);
$this->info("Achilles job dispatched to queue (run_id: {$runId}).");
```

Also add `use Illuminate\Support\Str;` to the imports and remove the redundant `$this->info('Achilles job dispatched to queue.');` on line 59.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Jobs/Achilles/RunAchillesJob.php backend/app/Console/Commands/RunAchillesCommand.php
git commit -m "feat: add run_id tracking to RunAchillesJob (backward compatible)"
```

---

## Task 6: Controller Endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/AchillesController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add achillesRuns() and achillesProgress() methods to AchillesController**

Add these methods and modify the existing `run()` method to return a `run_id`:

```php
// Add to imports at top of file:
use App\Models\Results\AchillesRun;
use App\Models\Results\AchillesRunStep;
use App\Services\Achilles\AchillesAnalysisRegistry;

/**
 * POST /v1/sources/{source}/achilles/run
 *
 * Dispatches a full Achilles characterization job and returns run_id for tracking.
 */
public function run(Request $request, Source $source): JsonResponse
{
    try {
        $runId = (string) Str::uuid();

        RunAchillesJob::dispatch(
            $source,
            $request->input('categories'),
            $request->input('analysis_ids'),
            $request->boolean('fresh', false),
            $runId,
        );

        return response()->json([
            'run_id' => $runId,
            'total_analyses' => $this->analysisRegistry->count(),
            'message' => 'Achilles run dispatched.',
        ], 202);
    } catch (\Throwable $e) {
        return $this->errorResponse('Failed to dispatch Achilles run', $e);
    }
}

/**
 * GET /v1/sources/{source}/achilles/runs
 *
 * List Achilles characterization runs for a source.
 */
public function achillesRuns(Source $source): JsonResponse
{
    $runs = AchillesRun::where('source_id', $source->id)
        ->orderByDesc('created_at')
        ->limit(20)
        ->get()
        ->map(fn (AchillesRun $run) => [
            'run_id' => $run->run_id,
            'status' => $run->status,
            'total_analyses' => $run->total_analyses,
            'completed_analyses' => $run->completed_analyses,
            'failed_analyses' => $run->failed_analyses,
            'categories' => $run->categories,
            'started_at' => $run->started_at?->toISOString(),
            'completed_at' => $run->completed_at?->toISOString(),
        ]);

    return response()->json(['data' => $runs]);
}

/**
 * GET /v1/sources/{source}/achilles/runs/{runId}/progress
 *
 * Full progress for a specific Achilles run including all steps grouped by category.
 */
public function achillesProgress(Source $source, string $runId): JsonResponse
{
    $run = AchillesRun::where('run_id', $runId)
        ->where('source_id', $source->id)
        ->first();

    if (! $run) {
        return response()->json(['error' => 'Run not found'], 404);
    }

    $steps = AchillesRunStep::where('run_id', $runId)
        ->orderBy('analysis_id')
        ->get()
        ->map(fn (AchillesRunStep $step) => [
            'analysis_id' => $step->analysis_id,
            'analysis_name' => $step->analysis_name,
            'category' => $step->category,
            'status' => $step->status,
            'elapsed_seconds' => $step->elapsed_seconds,
            'error_message' => $step->error_message,
            'started_at' => $step->started_at?->toISOString(),
            'completed_at' => $step->completed_at?->toISOString(),
        ]);

    // Group steps by category
    $categories = $steps->groupBy('category')->map(fn ($catSteps, $category) => [
        'category' => $category,
        'total' => $catSteps->count(),
        'completed' => $catSteps->where('status', 'completed')->count(),
        'failed' => $catSteps->where('status', 'failed')->count(),
        'running' => $catSteps->where('status', 'running')->count(),
        'steps' => $catSteps->values(),
    ])->values();

    return response()->json([
        'run_id' => $run->run_id,
        'status' => $run->status,
        'total_analyses' => $run->total_analyses,
        'completed_analyses' => $run->completed_analyses,
        'failed_analyses' => $run->failed_analyses,
        'started_at' => $run->started_at?->toISOString(),
        'completed_at' => $run->completed_at?->toISOString(),
        'categories' => $categories,
    ]);
}
```

Update the controller constructor to inject `AchillesAnalysisRegistry`:

```php
public function __construct(
    private readonly AchillesResultReaderService $reader,
    private readonly AchillesHeelService $heel,
    private readonly AchillesHeelRuleRegistry $heelRegistry,
    private readonly AchillesAnalysisRegistry $analysisRegistry,
    private readonly AnalysesSearchService $analysesSearch,
) {}
```

- [ ] **Step 2: Add routes**

In `backend/routes/api.php`, inside the `sources/{source}/achilles` prefix group, add these two routes alongside the existing ones:

```php
Route::get('/runs', [AchillesController::class, 'achillesRuns']);
Route::get('/runs/{runId}/progress', [AchillesController::class, 'achillesProgress']);
```

Place them **before** the existing `Route::post('/run', ...)` line.

**HIGHSEC compliance:** The existing Achilles routes lack `permission:` middleware. While fixing the existing gap is out of scope for this task, the new routes should be consistent with the existing ones (inside `auth:sanctum` group, no additional permission middleware). Add a `// TODO: Add permission:data-quality.view/run middleware per HIGHSEC spec` comment above the route group as a follow-up reminder.

- [ ] **Step 3: Verify routes registered**

Run: `docker compose exec php php artisan route:list --path=achilles`
Expected: New `/runs` and `/runs/{runId}/progress` routes visible alongside existing routes.

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/AchillesController.php backend/routes/api.php
git commit -m "feat: add Achilles run history and per-step progress endpoints"
```

---

## Task 7: Frontend API Functions

**Files:**
- Create: `frontend/src/features/data-explorer/api/achillesRunApi.ts`

- [ ] **Step 1: Create the API module**

```typescript
import apiClient from "@/lib/api-client";

const BASE = (sourceId: number) => `/sources/${sourceId}/achilles`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AchillesRunStep {
  analysis_id: number;
  analysis_name: string;
  category: string;
  status: "pending" | "running" | "completed" | "failed";
  elapsed_seconds: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AchillesRunCategory {
  category: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
  steps: AchillesRunStep[];
}

export interface AchillesRunProgress {
  run_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  total_analyses: number;
  completed_analyses: number;
  failed_analyses: number;
  started_at: string | null;
  completed_at: string | null;
  categories: AchillesRunCategory[];
}

export interface AchillesRunSummary {
  run_id: string;
  status: string;
  total_analyses: number;
  completed_analyses: number;
  failed_analyses: number;
  categories: string[] | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface RunAchillesResponse {
  run_id: string;
  total_analyses: number;
  message: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function runAchilles(
  sourceId: number,
  options?: { categories?: string[]; fresh?: boolean },
): Promise<RunAchillesResponse> {
  const { data } = await apiClient.post(`${BASE(sourceId)}/run`, options);
  return unwrap<RunAchillesResponse>(data);
}

export async function fetchAchillesRuns(
  sourceId: number,
): Promise<AchillesRunSummary[]> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/runs`);
  return unwrap<AchillesRunSummary[]>(data);
}

export async function fetchAchillesProgress(
  sourceId: number,
  runId: string,
): Promise<AchillesRunProgress> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/runs/${runId}/progress`);
  return unwrap<AchillesRunProgress>(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/api/achillesRunApi.ts
git commit -m "feat: add frontend API functions for Achilles run tracking"
```

---

## Task 8: Frontend Hooks with Echo + Polling Hybrid

**Files:**
- Create: `frontend/src/features/data-explorer/hooks/useAchillesRun.ts`

- [ ] **Step 1: Create the hooks module**

This hook uses TanStack Query for polling as fallback AND listens on a Reverb channel for instant updates. When an Echo event arrives, it updates the query cache directly without waiting for the next poll.

```typescript
import { useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import {
  runAchilles,
  fetchAchillesRuns,
  fetchAchillesProgress,
} from "../api/achillesRunApi";
import type { AchillesRunProgress } from "../api/achillesRunApi";

// ── Run history ──────────────────────────────────────────────────────────────

export function useAchillesRuns(sourceId: number) {
  return useQuery({
    queryKey: ["achilles", "runs", sourceId],
    queryFn: () => fetchAchillesRuns(sourceId),
    enabled: sourceId > 0,
  });
}

// ── Dispatch mutation ────────────────────────────────────────────────────────

export function useRunAchilles(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { categories?: string[]; fresh?: boolean }) =>
      runAchilles(sourceId, options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achilles", "runs", sourceId] });
    },
  });
}

// ── Progress with hybrid polling + Echo ──────────────────────────────────────

export function useAchillesProgress(sourceId: number, runId: string | null) {
  const qc = useQueryClient();
  // Memoize to prevent useCallback/useEffect re-firing on every render
  const queryKey = useMemo(() => ["achilles", "run-progress", sourceId, runId], [sourceId, runId]);

  // Polling fallback: 2s while active, stop when completed
  const query = useQuery({
    queryKey,
    queryFn: () => fetchAchillesProgress(sourceId, runId!),
    enabled: sourceId > 0 && runId != null,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "completed" || status === "failed" || status === "cancelled") {
        return false;
      }
      return 2000;
    },
  });

  // Reverb listener for instant updates
  const handleStepEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      // Optimistically update the cached progress data
      qc.setQueryData<AchillesRunProgress>(queryKey, (old) => {
        if (!old) return old;

        const updated = { ...old };
        updated.completed_analyses = event.completed_analyses;
        updated.failed_analyses = event.failed_analyses;

        // Update the step within its category
        updated.categories = updated.categories.map((cat) => {
          if (cat.category !== event.category) return cat;
          return {
            ...cat,
            completed: cat.steps.filter(
              (s) => s.status === "completed" || (s.analysis_id === event.analysis_id && event.status === "completed"),
            ).length,
            failed: cat.steps.filter(
              (s) => s.status === "failed" || (s.analysis_id === event.analysis_id && event.status === "failed"),
            ).length,
            running: cat.steps.filter(
              (s) => s.status === "running" && s.analysis_id !== event.analysis_id,
            ).length,
            steps: cat.steps.map((step) => {
              if (step.analysis_id !== event.analysis_id) return step;
              return {
                ...step,
                status: event.status,
                elapsed_seconds: event.elapsed_seconds,
                error_message: event.error_message,
                completed_at: event.timestamp,
              };
            }),
          };
        });

        // If all done, mark run completed
        if (updated.completed_analyses + updated.failed_analyses >= updated.total_analyses) {
          updated.status = updated.failed_analyses === updated.total_analyses ? "failed" : "completed";
        }

        return updated;
      });
    },
    [qc, queryKey],
  );

  useEffect(() => {
    if (!runId) return;

    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(`achilles.run.${runId}`);
    channel.listen(".step.completed", handleStepEvent);

    return () => {
      echo.leave(`achilles.run.${runId}`);
    };
  }, [runId, handleStepEvent]);

  return query;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/hooks/useAchillesRun.ts
git commit -m "feat: add useAchillesRun hooks with hybrid Reverb + polling"
```

---

## Task 9: AchillesRunModal Component

**Files:**
- Create: `frontend/src/features/data-explorer/components/AchillesRunModal.tsx`

- [ ] **Step 1: Create the modal component**

This is the interactive modal showing every analysis step grouped by category with live timers. Key UX:
- Categories are collapsible; completed ones auto-collapse, active stays open
- Each step shows status icon, name, live timer (running) or elapsed (completed)
- Overall progress bar with ETA
- Failed steps expand to show error message

```typescript
import { useState, useEffect, useRef } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAchillesProgress } from "../hooks/useAchillesRun";
import type { AchillesRunCategory, AchillesRunStep } from "../api/achillesRunApi";

interface AchillesRunModalProps {
  sourceId: number;
  runId: string;
  totalAnalyses: number;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C9A227] tabular-nums">
      [{elapsed.toFixed(1)}s]
    </span>
  );
}

function StepRow({ step }: { step: AchillesRunStep }) {
  const [showError, setShowError] = useState(false);

  return (
    <div className="space-y-0">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-3 rounded-md text-sm",
          step.status === "failed" && "bg-[#E85A6B]/5 cursor-pointer",
          step.status === "running" && "bg-[#C9A227]/5",
        )}
        onClick={() => step.status === "failed" && setShowError(!showError)}
      >
        {step.status === "pending" && <Clock size={13} className="text-[#5A5650] shrink-0" />}
        {step.status === "running" && <Loader2 size={13} className="animate-spin text-[#C9A227] shrink-0" />}
        {step.status === "completed" && <CheckCircle2 size={13} className="text-[#2DD4BF] shrink-0" />}
        {step.status === "failed" && <AlertCircle size={13} className="text-[#E85A6B] shrink-0" />}

        <span className={cn(
          "flex-1 truncate",
          step.status === "pending" && "text-[#5A5650]",
          step.status === "running" && "text-[#F0EDE8]",
          step.status === "completed" && "text-[#C5C0B8]",
          step.status === "failed" && "text-[#E85A6B]",
        )}>
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D] mr-1.5">
            {step.analysis_id}
          </span>
          {step.analysis_name}
        </span>

        {step.status === "running" && step.started_at && (
          <LiveTimer startedAt={step.started_at} />
        )}
        {step.status === "completed" && step.elapsed_seconds != null && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#5A5650] tabular-nums">
            {step.elapsed_seconds.toFixed(2)}s
          </span>
        )}
        {step.status === "failed" && (
          <ChevronDown size={12} className={cn("text-[#E85A6B] transition-transform", showError && "rotate-180")} />
        )}
      </div>
      {showError && step.error_message && (
        <div className="ml-7 px-3 py-2 text-xs text-[#E85A6B]/80 bg-[#E85A6B]/5 rounded-md border border-[#E85A6B]/10 font-['IBM_Plex_Mono',monospace] whitespace-pre-wrap break-all">
          {step.error_message}
        </div>
      )}
    </div>
  );
}

function CategorySection({ category }: { category: AchillesRunCategory }) {
  const isDone = category.completed + category.failed >= category.total;
  const hasRunning = category.running > 0;
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse completed categories
  const prevDoneRef = useRef(isDone);
  useEffect(() => {
    if (isDone && !prevDoneRef.current) {
      setCollapsed(true);
    }
    prevDoneRef.current = isDone;
  }, [isDone]);

  const statusIcon = isDone
    ? category.failed > 0
      ? <AlertCircle size={14} className="text-[#E85A6B]" />
      : <CheckCircle2 size={14} className="text-[#2DD4BF]" />
    : hasRunning
      ? <Loader2 size={14} className="animate-spin text-[#C9A227]" />
      : <Clock size={14} className="text-[#5A5650]" />;

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-[#1A1A1E] transition-colors"
      >
        {collapsed ? <ChevronRight size={14} className="text-[#8A857D]" /> : <ChevronDown size={14} className="text-[#8A857D]" />}
        {statusIcon}
        <span className="text-sm font-medium text-[#F0EDE8] flex-1">{category.category}</span>
        <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
          {category.completed}/{category.total}
        </span>
        {category.failed > 0 && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#E85A6B]">
            {category.failed} failed
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-0.5">
          {category.steps.map((step) => (
            <StepRow key={step.analysis_id} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AchillesRunModal({
  sourceId,
  runId,
  totalAnalyses,
  onClose,
}: AchillesRunModalProps) {
  const { data: progress } = useAchillesProgress(sourceId, runId);

  const completed = progress?.completed_analyses ?? 0;
  const failed = progress?.failed_analyses ?? 0;
  const total = progress?.total_analyses ?? totalAnalyses;
  const done = completed + failed;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const isFinished = progress?.status === "completed" || progress?.status === "failed";

  // ETA calculation
  const startedAt = progress?.started_at ? new Date(progress.started_at).getTime() : null;
  const elapsedTotal = startedAt ? (Date.now() - startedAt) / 1000 : 0;
  const avgPerAnalysis = done > 0 ? elapsedTotal / done : 0;
  const remaining = (total - done) * avgPerAnalysis;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[#232328] bg-[#0E0E11] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232328]">
          <div className="flex items-center gap-3">
            {isFinished ? (
              <Zap size={20} className="text-[#2DD4BF]" />
            ) : (
              <Activity size={20} className="text-[#C9A227] animate-pulse" />
            )}
            <div>
              <h2 className="text-base font-semibold text-[#F0EDE8]">
                Achilles Characterization
              </h2>
              <p className="text-xs text-[#5A5650]">
                {isFinished
                  ? `Completed in ${formatDuration(elapsedTotal)}`
                  : `${done} of ${total} analyses`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1A1A1E] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar + stats */}
        <div className="px-6 py-4 border-b border-[#232328] space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-['IBM_Plex_Mono',monospace] text-[#C9A227] text-lg font-semibold">
              {pct.toFixed(1)}%
            </span>
            <div className="flex items-center gap-4">
              {completed > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#2DD4BF]">
                  <CheckCircle2 size={12} /> {completed} passed
                </span>
              )}
              {failed > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#E85A6B]">
                  <AlertCircle size={12} /> {failed} failed
                </span>
              )}
              {!isFinished && remaining > 0 && (
                <span className="flex items-center gap-1 text-xs text-[#8A857D]">
                  <Clock size={12} /> ~{formatDuration(remaining)} remaining
                </span>
              )}
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1A1A1E]">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${pct}%`,
                background: failed > 0
                  ? "linear-gradient(90deg, #C9A227 0%, #E85A6B 100%)"
                  : "linear-gradient(90deg, #C9A227 0%, #2DD4BF 100%)",
              }}
            />
          </div>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {progress?.categories && progress.categories.length > 0 ? (
            progress.categories.map((cat) => (
              <CategorySection key={cat.category} category={cat} />
            ))
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[#8A857D]" />
              <span className="ml-2 text-sm text-[#5A5650]">Waiting for analyses to start...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-[#232328]">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              isFinished
                ? "bg-[#2DD4BF]/10 text-[#2DD4BF] hover:bg-[#2DD4BF]/20"
                : "bg-[#1A1A1E] text-[#C5C0B8] hover:bg-[#232328]",
            )}
          >
            {isFinished ? "Done" : "Run in Background"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/components/AchillesRunModal.tsx
git commit -m "feat: add AchillesRunModal with per-step progress and live timers"
```

---

## Task 10: Restructure HeelTab → AchillesTab (Two-Column Layout)

**Files:**
- Modify: `frontend/src/features/data-explorer/pages/HeelTab.tsx` (rename to AchillesTab)
- Modify: `frontend/src/features/data-explorer/pages/DataExplorerPage.tsx`

This is the biggest frontend change. The tab becomes a two-column layout:
- **Left column:** Achilles characterization panel — "Run Achilles" button, run history dropdown, summary of selected historical run (or live modal while running)
- **Right column:** Existing Heel Checks panel — "Run Heel Checks" button + all existing heel UI

- [ ] **Step 1: Create AchillesTab.tsx as a new file**

The left column is new; the right column reuses existing heel components from HeelTab. To keep this clean, extract the heel content into a `HeelPanel` component and the new achilles content into an `AchillesPanel`.

Create `frontend/src/features/data-explorer/pages/AchillesTab.tsx`:

```typescript
import { useState, useEffect, lazy, Suspense } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PlayCircle,
  Loader2,
  ShieldCheck,
  History,
  ChevronDown,
  Activity,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAchillesRuns, useRunAchilles } from "../hooks/useAchillesRun";
import {
  useHeelResults,
  useHeelRuns,
  useHeelProgress,
} from "../hooks/useAchillesData";
import { runHeel } from "../api/achillesApi";
import type { HeelResult, HeelSeverity } from "../types/dataExplorer";
import type { AchillesRunSummary } from "../api/achillesRunApi";

const AchillesRunModal = lazy(() => import("../components/AchillesRunModal"));

interface AchillesTabProps {
  sourceId: number;
}

// ── Heel components (extracted from old HeelTab) ─────────────────────────────

const SEVERITY_CONFIG: Record<
  HeelSeverity,
  { label: string; icon: typeof AlertCircle; rowClass: string; badgeClass: string; iconClass: string; barColor: string }
> = {
  error: {
    label: "Errors",
    icon: AlertCircle,
    rowClass: "border-[#E85A6B]/20 bg-[#E85A6B]/5",
    badgeClass: "bg-[#E85A6B]/15 text-[#E85A6B] border border-[#E85A6B]/30",
    iconClass: "text-[#E85A6B]",
    barColor: "#E85A6B",
  },
  warning: {
    label: "Warnings",
    icon: AlertCircle,
    rowClass: "border-[#C9A227]/20 bg-[#C9A227]/5",
    badgeClass: "bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30",
    iconClass: "text-[#C9A227]",
    barColor: "#C9A227",
  },
  notification: {
    label: "Notifications",
    icon: AlertCircle,
    rowClass: "border-[#3B82F6]/20 bg-[#3B82F6]/5",
    badgeClass: "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30",
    iconClass: "text-[#3B82F6]",
    barColor: "#3B82F6",
  },
};

function SeverityBadge({ severity }: { severity: HeelSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.badgeClass)}>
      {severity}
    </span>
  );
}

function SeverityRow({ severity, count }: { severity: HeelSeverity; count: number }) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className={cfg.iconClass} />
      <span className="text-xs font-medium" style={{ color: cfg.barColor }}>{count}</span>
      <span className="text-xs text-[#5A5650]">{cfg.label.toLowerCase()}</span>
    </div>
  );
}

function HeelResultRow({ result }: { result: HeelResult }) {
  const cfg = SEVERITY_CONFIG[result.severity];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-3", cfg.rowClass)}>
      <Icon size={14} className={cn("mt-0.5 shrink-0", cfg.iconClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#F0EDE8]">{result.rule_name}</span>
          <SeverityBadge severity={result.severity} />
        </div>
        {result.attribute_name && (
          <p className="mt-0.5 text-xs text-[#8A857D]">
            <span className="text-[#C5C0B8]">{result.attribute_name}</span>
            {result.attribute_value != null && (
              <span className="ml-1">= {result.attribute_value}</span>
            )}
          </p>
        )}
      </div>
      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8] shrink-0">
        {result.record_count.toLocaleString()}
      </span>
    </div>
  );
}

// ── Heel Panel (right column) ────────────────────────────────────────────────

function HeelPanel({ sourceId }: { sourceId: number }) {
  const queryClient = useQueryClient();
  const [activeRunIdLive, setActiveRunIdLive] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(false);

  const heelRuns = useHeelRuns(sourceId);
  const activeRunId = selectedRunId ?? heelRuns.data?.[0]?.run_id ?? null;
  const detectRunId = activeRunIdLive === null ? (heelRuns.data?.[0]?.run_id ?? null) : null;
  const detectProgress = useHeelProgress(sourceId, detectRunId);

  useEffect(() => {
    if (activeRunIdLive === null && detectProgress.data &&
        (detectProgress.data.status === "running" || detectProgress.data.status === "pending")) {
      setActiveRunIdLive(detectProgress.data.run_id);
    }
  }, [activeRunIdLive, detectProgress.data]);

  const { data, isLoading } = useHeelResults(activeRunIdLive ? 0 : sourceId);
  const progressQuery = useHeelProgress(sourceId, activeRunIdLive);

  useEffect(() => {
    if (progressQuery.data?.status === "completed" && activeRunIdLive) {
      setActiveRunIdLive(null);
      queryClient.invalidateQueries({ queryKey: ["achilles", "heel", sourceId] });
      queryClient.invalidateQueries({ queryKey: ["heel", "runs", sourceId] });
    }
  }, [progressQuery.data?.status, activeRunIdLive, sourceId, queryClient]);

  // Inline mutation (not useRunHeel) because we need onSuccess to capture run_id for live progress
  const runMutation = useMutation({
    mutationFn: () => runHeel(sourceId),
    onSuccess: (result) => {
      setActiveRunIdLive(result.run_id);
      queryClient.invalidateQueries({ queryKey: ["heel", "runs", sourceId] });
    },
  });

  const isRunning = activeRunIdLive != null;
  const totalErrors = data?.error.length ?? 0;
  const totalWarnings = data?.warning.length ?? 0;
  const totalNotifications = data?.notification.length ?? 0;
  const totalIssues = totalErrors + totalWarnings + totalNotifications;
  const hasResults = data != null && !isRunning;

  return (
    <div className="space-y-4">
      {/* Header + button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#F0EDE8] uppercase tracking-wide flex items-center gap-2">
          <ShieldCheck size={15} className="text-[#2DD4BF]" />
          Heel Checks
        </h3>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || isRunning}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-3 py-1.5 text-xs font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending || isRunning ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <PlayCircle size={12} />
          )}
          {isRunning ? "Running..." : "Run Heel Checks"}
        </button>
      </div>

      {/* Run history selector */}
      {heelRuns.data && heelRuns.data.length > 0 && !isRunning && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRunSelector(!showRunSelector)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-1.5 text-xs text-[#C5C0B8] hover:bg-[#1A1A1E] transition-colors w-full"
          >
            <History size={12} className="text-[#8A857D]" />
            {activeRunId ? `Run ${activeRunId.slice(0, 8)}...` : "Select run"}
            <ChevronDown size={10} className="text-[#8A857D] ml-auto" />
          </button>
          {showRunSelector && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg border border-[#232328] bg-[#1A1A1E] shadow-xl">
              {heelRuns.data.map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  onClick={() => { setSelectedRunId(run.run_id); setShowRunSelector(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#232328] transition-colors",
                    run.run_id === activeRunId ? "text-[#C9A227]" : "text-[#C5C0B8]",
                  )}
                >
                  <span className="font-['IBM_Plex_Mono',monospace]">{run.run_id.slice(0, 12)}</span>
                  <span className="text-[#5A5650]">{new Date(run.started_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {runMutation.isError && (
        <span className="text-xs text-[#E85A6B]">Failed to dispatch heel checks</span>
      )}

      {/* Live progress */}
      {isRunning && progressQuery.data && (
        <div className="rounded-xl border border-[#232328] bg-[#151518] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#C9A227] animate-pulse" />
            <span className="text-xs text-[#F0EDE8]">Running heel checks...</span>
            <span className="ml-auto font-['IBM_Plex_Mono',monospace] text-sm text-[#C9A227]">
              {progressQuery.data.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1A1A1E]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressQuery.data.percentage}%`, background: "linear-gradient(90deg, #C9A227, #2DD4BF)" }}
            />
          </div>
          <div className="flex gap-4">
            {progressQuery.data.by_severity.map((sev) => (
              <SeverityRow key={sev.severity} severity={sev.severity as HeelSeverity} count={sev.count} />
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {!isRunning && isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-[#8A857D]" />
        </div>
      )}

      {/* No results */}
      {!isRunning && !isLoading && !hasResults && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-8">
          <ShieldCheck size={24} className="mb-2 text-[#5A5650]" />
          <p className="text-xs text-[#8A857D]">No heel checks run yet</p>
        </div>
      )}

      {/* Summary banner */}
      {hasResults && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2",
          totalErrors > 0 ? "border-[#E85A6B]/20 bg-[#E85A6B]/5"
            : totalWarnings > 0 ? "border-[#C9A227]/20 bg-[#C9A227]/5"
            : "border-[#2DD4BF]/20 bg-[#2DD4BF]/5",
        )}>
          {totalErrors > 0 ? <AlertCircle size={14} className="shrink-0 text-[#E85A6B]" />
            : totalWarnings > 0 ? <AlertCircle size={14} className="shrink-0 text-[#C9A227]" />
            : <CheckCircle2 size={14} className="shrink-0 text-[#2DD4BF]" />}
          <p className="text-xs text-[#C5C0B8]">
            {totalIssues === 0
              ? "All checks passed"
              : `${totalIssues} issue${totalIssues !== 1 ? "s" : ""}: ${totalErrors}E / ${totalWarnings}W / ${totalNotifications}N`}
          </p>
        </div>
      )}

      {/* Results */}
      {hasResults && totalIssues > 0 && (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {(["error", "warning", "notification"] as const).map((sev) => {
            const results = data[sev];
            if (results.length === 0) return null;
            return results.map((r) => <HeelResultRow key={r.id} result={r} />);
          })}
        </div>
      )}
    </div>
  );
}

// ── Achilles Panel (left column) ─────────────────────────────────────────────

function AchillesPanel({ sourceId }: { sourceId: number }) {
  const [showModal, setShowModal] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [totalAnalyses, setTotalAnalyses] = useState(0);
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<string | null>(null);
  const [showRunSelector, setShowRunSelector] = useState(false);

  const achillesRuns = useAchillesRuns(sourceId);
  const runMutation = useRunAchilles(sourceId);

  const displayRunId = selectedHistoryRun ?? achillesRuns.data?.[0]?.run_id ?? null;
  const displayRun = achillesRuns.data?.find((r) => r.run_id === displayRunId);

  const handleRun = () => {
    runMutation.mutate(undefined, {
      onSuccess: (result) => {
        setActiveRunId(result.run_id);
        setTotalAnalyses(result.total_analyses);
        setShowModal(true);
      },
    });
  };

  const handleModalClose = () => {
    setShowModal(false);
    setActiveRunId(null);
    // Refresh run history
    achillesRuns.refetch();
  };

  return (
    <div className="space-y-4">
      {/* Header + button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#F0EDE8] uppercase tracking-wide flex items-center gap-2">
          <Zap size={15} className="text-[#C9A227]" />
          Achilles Characterization
        </h3>
        <button
          type="button"
          onClick={handleRun}
          disabled={runMutation.isPending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-3 py-1.5 text-xs font-medium text-[#F0EDE8]",
            "hover:bg-[#B82D42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {runMutation.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <PlayCircle size={12} />
          )}
          Run Achilles
        </button>
      </div>

      {runMutation.isError && (
        <span className="text-xs text-[#E85A6B]">Failed to dispatch Achilles run</span>
      )}

      {/* Run history dropdown */}
      {achillesRuns.data && achillesRuns.data.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRunSelector(!showRunSelector)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-3 py-1.5 text-xs text-[#C5C0B8] hover:bg-[#1A1A1E] transition-colors w-full"
          >
            <History size={12} className="text-[#8A857D]" />
            {displayRun
              ? `${displayRun.started_at ? new Date(displayRun.started_at).toLocaleString() : displayRunId?.slice(0, 8)}`
              : "Select run"}
            <ChevronDown size={10} className="text-[#8A857D] ml-auto" />
          </button>
          {showRunSelector && (
            <div className="absolute top-full left-0 z-10 mt-1 w-full rounded-lg border border-[#232328] bg-[#1A1A1E] shadow-xl max-h-48 overflow-y-auto">
              {achillesRuns.data.map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  onClick={() => { setSelectedHistoryRun(run.run_id); setShowRunSelector(false); }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-[#232328] transition-colors",
                    run.run_id === displayRunId ? "text-[#C9A227]" : "text-[#C5C0B8]",
                  )}
                >
                  <span className="font-['IBM_Plex_Mono',monospace]">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : run.run_id.slice(0, 12)}
                  </span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    run.status === "completed" ? "text-[#2DD4BF] bg-[#2DD4BF]/10"
                      : run.status === "failed" ? "text-[#E85A6B] bg-[#E85A6B]/10"
                      : run.status === "running" ? "text-[#C9A227] bg-[#C9A227]/10"
                      : "text-[#5A5650]",
                  )}>
                    {run.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected run summary */}
      {displayRun && (
        <div className="rounded-xl border border-[#232328] bg-[#151518] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A857D]">Status</span>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              displayRun.status === "completed" ? "text-[#2DD4BF] bg-[#2DD4BF]/10"
                : displayRun.status === "failed" ? "text-[#E85A6B] bg-[#E85A6B]/10"
                : displayRun.status === "running" ? "text-[#C9A227] bg-[#C9A227]/10"
                : "text-[#5A5650] bg-[#5A5650]/10",
            )}>
              {displayRun.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-[#F0EDE8]">
                {displayRun.total_analyses}
              </div>
              <div className="text-xs text-[#5A5650]">total</div>
            </div>
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-[#2DD4BF]">
                {displayRun.completed_analyses}
              </div>
              <div className="text-xs text-[#5A5650]">passed</div>
            </div>
            <div className="text-center">
              <div className="font-['IBM_Plex_Mono',monospace] text-lg text-[#E85A6B]">
                {displayRun.failed_analyses}
              </div>
              <div className="text-xs text-[#5A5650]">failed</div>
            </div>
          </div>
          {displayRun.started_at && displayRun.completed_at && (
            <div className="flex items-center gap-1.5 text-xs text-[#5A5650]">
              <Clock size={11} />
              Duration: {((new Date(displayRun.completed_at).getTime() - new Date(displayRun.started_at).getTime()) / 1000).toFixed(1)}s
            </div>
          )}
          {displayRun.status === "running" && (
            <button
              type="button"
              onClick={() => { setActiveRunId(displayRun.run_id); setTotalAnalyses(displayRun.total_analyses); setShowModal(true); }}
              className="w-full rounded-lg bg-[#C9A227]/10 px-3 py-1.5 text-xs font-medium text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors"
            >
              View Live Progress
            </button>
          )}
        </div>
      )}

      {/* No runs yet */}
      {(!achillesRuns.data || achillesRuns.data.length === 0) && !achillesRuns.isLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-8">
          <Zap size={24} className="mb-2 text-[#5A5650]" />
          <p className="text-xs text-[#8A857D]">No Achilles runs yet</p>
          <p className="mt-0.5 text-xs text-[#5A5650]">Click "Run Achilles" to characterize your data</p>
        </div>
      )}

      {/* Modal */}
      {showModal && activeRunId && (
        <Suspense fallback={null}>
          <AchillesRunModal
            sourceId={sourceId}
            runId={activeRunId}
            totalAnalyses={totalAnalyses}
            onClose={handleModalClose}
          />
        </Suspense>
      )}
    </div>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────────

export default function AchillesTab({ sourceId }: AchillesTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AchillesPanel sourceId={sourceId} />
      <HeelPanel sourceId={sourceId} />
    </div>
  );
}
```

- [ ] **Step 2: Update DataExplorerPage.tsx**

In `frontend/src/features/data-explorer/pages/DataExplorerPage.tsx`:

1. Change the lazy import from `HeelTab` to `AchillesTab`:
   ```typescript
   // Change: const HeelTab = lazy(() => import("./HeelTab"));
   // To:
   const AchillesTab = lazy(() => import("./AchillesTab"));
   ```

2. In the `TABS` array, rename the heel entry:
   ```typescript
   // Change: { id: "heel", label: "Heel Checks" },
   // To:
   { id: "heel", label: "Achilles" },
   ```

3. In the tab content rendering, update the component:
   ```typescript
   // Change: {activeTab === "heel" && <HeelTab sourceId={sourceId} />}
   // To:
   {activeTab === "heel" && <AchillesTab sourceId={sourceId} />}
   ```

   Keep the `TabId` type and `id: "heel"` unchanged to avoid breaking URL state or other references.

4. **Remove the header "Run Achilles" button** (lines 62-66 and 86-119 of DataExplorerPage.tsx):
   - Delete the `achillesMutation` declaration (lines 62-66)
   - Delete the entire `{sourceId && sourceId > 0 && ( ... )}` block containing the "Run Achilles" button (lines 86-104)
   - Delete the Achilles run feedback banners (lines 109-119)
   - Remove the `useMutation` import if no longer used
   - Remove the `apiClient` import if no longer used
   - Remove `PlayCircle` and `Loader2` from lucide imports if no longer used elsewhere in the file

- [ ] **Step 3: Delete the old HeelTab.tsx**

Once AchillesTab.tsx is working, delete the old file:

Run: `rm frontend/src/features/data-explorer/pages/HeelTab.tsx`

Verify no other imports reference it:

Run: `grep -r "HeelTab" frontend/src/ --include="*.tsx" --include="*.ts"`
Expected: No results (or only the old lazy import that was already changed).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/pages/AchillesTab.tsx frontend/src/features/data-explorer/pages/DataExplorerPage.tsx
git rm frontend/src/features/data-explorer/pages/HeelTab.tsx
git commit -m "feat: replace Heel Checks tab with unified Achilles tab (two-column layout)"
```

---

## Task 11: Build Verification & Deploy

- [ ] **Step 1: Run TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors.

- [ ] **Step 2: Run PHPStan**

Run: `docker compose exec php vendor/bin/phpstan analyse --level=8`
Expected: No new errors.

- [ ] **Step 3: Run frontend build**

Run: `./deploy.sh --frontend`
Expected: Build succeeds.

- [ ] **Step 4: Run backend deploy (migrations)**

Run: `./deploy.sh --db`
Expected: Migrations run, tables created.

- [ ] **Step 5: Verify in browser**

1. Navigate to Data Explorers page
2. Confirm tab reads "Achilles" (was "Heel Checks")
3. Confirm tab order: Overview, Domains, Temporal, Achilles, Data Quality
4. Confirm two-column layout: Achilles left, Heel Checks right
5. Click "Run Achilles" — modal should appear with category sections
6. Modal should show live progress per analysis
7. "Run Heel Checks" should still work independently on the right side

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address build/runtime issues from Achilles tab implementation"
```

---

## Architecture Notes for the Implementing Agent

### Broadcasting Pattern
- Uses **public channel** (`achilles.run.{runId}`) — no channel auth needed. This matches `StudyExecutionUpdated` which also uses a public channel. The data is non-sensitive (analysis names, timings).
- No changes to `channels.php` needed for public channels.

### Queue Configuration
- Both `RunAchillesJob` and `RunHeelJob` use the `achilles` queue. Make sure Horizon is processing this queue. Check `backend/config/horizon.php` for queue configuration.

### The Hybrid Pattern
- **Poll (2s):** TanStack Query's `refetchInterval` polls the progress endpoint. This is the reliable fallback.
- **Push (instant):** Echo listens on the Reverb channel. When `AchillesStepCompleted` fires, the `setQueryData` callback updates the React Query cache immediately, so the UI updates without waiting for the next poll.
- When the run completes, polling stops (refetchInterval returns false). The Echo channel is cleaned up on component unmount.

### Error Handling
- If Reverb is down, the polling fallback handles everything — degraded but functional.
- If the queue worker isn't running, the button click will succeed (202 response) but nothing will progress. The modal will show "Waiting for analyses to start..." indefinitely. The user can close and check back later.
