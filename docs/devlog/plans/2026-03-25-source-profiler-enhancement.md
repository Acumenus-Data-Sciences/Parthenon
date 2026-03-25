# Source Profiler Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Source Profiler into the definitive source intelligence page with server-side persistence, Achilles CDM context, PII detection, scan comparison, and RBAC.

**Architecture:** Three-phase enhancement of existing WhiteRabbit profiler. Phase 1 adds persistence + CDM context + RBAC. Phase 2 adds PII detection + comparison. Phase 3 adds FK visualization. Each phase is independently shippable. Backend follows existing Laravel service/controller pattern. Frontend follows TanStack Query + Zustand + feature module pattern.

**Tech Stack:** Laravel 11 / PHP 8.4, React 19 / TypeScript, TanStack Query, PostgreSQL, Spatie RBAC, WhiteRabbit sidecar

**Spec:** `docs/devlog/specs/2026-03-25-source-profiler-design.md`

---

## Phase 1: Persistence + CDM Context + Scan Progress + RBAC

### Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_25_200000_alter_source_profiles_for_whiterabbit.php`
- Create: `backend/database/migrations/2026_03_25_200001_add_table_fields_to_field_profiles.php`

- [ ] **Step 1: Create source_profiles migration**

```php
<?php
// backend/database/migrations/2026_03_25_200000_alter_source_profiles_for_whiterabbit.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the existing FK constraint on ingestion_job_id so we can make it nullable
        // with nullOnDelete behavior (was cascadeOnDelete + NOT NULL).
        // Use raw SQL to avoid doctrine/dbal dependency for column changes.
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN ingestion_job_id DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_name DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_format DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN file_size DROP NOT NULL');
        DB::statement('ALTER TABLE source_profiles ALTER COLUMN storage_path DROP NOT NULL');

        // Drop old FK and recreate with nullOnDelete
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->dropForeign(['ingestion_job_id']);
        });
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->foreign('ingestion_job_id')->references('id')->on('ingestion_jobs')->nullOnDelete();
        });

        Schema::table('source_profiles', function (Blueprint $table) {
            // New columns for WhiteRabbit scan persistence
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('scan_type', 20)->default('whiterabbit');
            $table->float('scan_time_seconds')->nullable();
            $table->string('overall_grade', 2)->nullable();
            $table->integer('table_count')->nullable();
            $table->bigInteger('total_rows')->nullable();
            $table->jsonb('summary_json')->nullable();

            $table->index('source_id');
            $table->index('scan_type');
        });
    }

    public function down(): void
    {
        Schema::table('source_profiles', function (Blueprint $table) {
            $table->dropForeign(['source_id']);
            $table->dropColumn([
                'source_id', 'scan_type', 'scan_time_seconds',
                'overall_grade', 'table_count', 'total_rows', 'summary_json',
            ]);
        });
    }
};
```

- [ ] **Step 2: Create field_profiles migration**

```php
<?php
// backend/database/migrations/2026_03_25_200001_add_table_fields_to_field_profiles.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Use raw SQL to relax NOT NULL constraints (avoids doctrine/dbal)
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN column_index DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN inferred_type DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN non_null_count DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN null_count DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN null_percentage DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN distinct_count DROP NOT NULL');
        DB::statement('ALTER TABLE field_profiles ALTER COLUMN distinct_percentage DROP NOT NULL');

        Schema::table('field_profiles', function (Blueprint $table) {
            $table->string('table_name', 255)->nullable()->after('source_profile_id');
            $table->bigInteger('row_count')->nullable()->after('table_name');
            $table->index(['source_profile_id', 'table_name']);
        });
    }

    public function down(): void
    {
        Schema::table('field_profiles', function (Blueprint $table) {
            $table->dropIndex(['source_profile_id', 'table_name']);
            $table->dropColumn(['table_name', 'row_count']);
        });
    }
};
```

- [ ] **Step 3: Run migrations**

Run: `docker compose exec php php artisan migrate`
Expected: Both migrations succeed. Verify with `php artisan migrate:status`.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_25_20000*
git commit -m "feat(profiler): add migrations for WhiteRabbit scan persistence"
```

### Task 2: Update Eloquent Models

**Files:**
- Modify: `backend/app/Models/App/SourceProfile.php`
- Modify: `backend/app/Models/App/FieldProfile.php`
- Modify: `backend/app/Models/App/Source.php`

- [ ] **Step 1: Update SourceProfile model**

Add to `$fillable`: `source_id`, `scan_type`, `scan_time_seconds`, `overall_grade`, `table_count`, `total_rows`, `summary_json`. Add `summary_json` cast. Add `source()` relationship.

```php
// backend/app/Models/App/SourceProfile.php
protected $fillable = [
    'ingestion_job_id',
    'file_name',
    'file_format',
    'file_size',
    'row_count',
    'column_count',
    'format_metadata',
    'storage_path',
    // WhiteRabbit scan fields
    'source_id',
    'scan_type',
    'scan_time_seconds',
    'overall_grade',
    'table_count',
    'total_rows',
    'summary_json',
];

protected function casts(): array
{
    return [
        'format_metadata' => 'array',
        'summary_json' => 'array',
    ];
}

// Add after ingestionJob() relationship:
/**
 * @return BelongsTo<Source, $this>
 */
public function source(): BelongsTo
{
    return $this->belongsTo(Source::class);
}
```

- [ ] **Step 2: Update FieldProfile model**

Add `table_name` and `row_count` to `$fillable`.

```php
// backend/app/Models/App/FieldProfile.php — add to $fillable array:
'table_name',
'row_count',
```

- [ ] **Step 3: Add relationship to Source model**

Add `sourceProfiles()` HasMany to `Source.php` after existing relationships.

```php
// backend/app/Models/App/Source.php — add import at top:
use App\Models\App\SourceProfile;

// Add relationship method:
/**
 * @return HasMany<SourceProfile, $this>
 */
public function sourceProfiles(): HasMany
{
    return $this->hasMany(SourceProfile::class);
}
```

- [ ] **Step 4: Verify syntax**

Run: `cd backend && php -l app/Models/App/SourceProfile.php && php -l app/Models/App/FieldProfile.php && php -l app/Models/App/Source.php`
Expected: No syntax errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Models/App/SourceProfile.php backend/app/Models/App/FieldProfile.php backend/app/Models/App/Source.php
git commit -m "feat(profiler): update models for WhiteRabbit scan persistence"
```

### Task 3: RBAC Permissions

**Files:**
- Modify: `backend/database/seeders/RolePermissionSeeder.php`

- [ ] **Step 1: Add profiler permission domain**

In `RolePermissionSeeder.php`, add to the `PERMISSIONS` constant after the `gis` entry:

```php
// ── Source profiler ────────────────────────────────────────────────
'profiler' => ['view', 'scan', 'delete'],
```

- [ ] **Step 2: Add profiler permissions to roles**

In the `ROLES` constant:
- `admin` array: add `'profiler.view', 'profiler.scan', 'profiler.delete'`
- `researcher` array: add `'profiler.view'`
- `data-steward` array: add `'profiler.view', 'profiler.scan'`
- `viewer` array: add `'profiler.view'`

- [ ] **Step 3: Run seeder**

Run: `docker compose exec php php artisan db:seed --class=RolePermissionSeeder`
Expected: Seeder completes without errors.

- [ ] **Step 4: Commit**

```bash
git add backend/database/seeders/RolePermissionSeeder.php
git commit -m "feat(profiler): add RBAC permissions for source profiler"
```

### Task 4: SourceProfilerService

**Files:**
- Create: `backend/app/Services/Profiler/SourceProfilerService.php`

- [ ] **Step 1: Create service**

```php
<?php

namespace App\Services\Profiler;

use App\Models\App\FieldProfile;
use App\Models\App\Source;
use App\Models\App\SourceProfile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SourceProfilerService
{
    private string $whiteRabbitUrl;

    public function __construct()
    {
        $this->whiteRabbitUrl = rtrim(config('services.whiterabbit.url', 'http://whiterabbit:8090'), '/');
    }

    /**
     * Run a WhiteRabbit scan and persist results.
     *
     * @param  list<string>|null  $tables
     */
    public function scan(Source $source, ?array $tables = null, int $sampleRows = 100000): SourceProfile
    {
        $source->loadMissing('daimons');

        $payload = [
            'connection' => \App\Services\Analysis\HadesBridgeService::buildSourceSpec($source),
            'sample_size' => $sampleRows,
        ];

        if ($tables) {
            $payload['tables'] = $tables;
        }

        Log::info('Profiler scan started', ['source_id' => $source->id]);

        $startTime = microtime(true);

        $response = Http::timeout(600)->post(
            "{$this->whiteRabbitUrl}/scan",
            $payload,
        );

        $elapsed = round(microtime(true) - $startTime, 3);

        if ($response->failed()) {
            Log::error('Profiler scan failed', [
                'source_id' => $source->id,
                'status' => $response->status(),
            ]);

            throw new \RuntimeException(
                'WhiteRabbit scan failed: '.($response->json('message') ?? $response->body())
            );
        }

        $scanData = $response->json();

        return $this->persistResults($source, $scanData, $elapsed);
    }

    /**
     * Persist WhiteRabbit scan results to source_profiles + field_profiles.
     */
    private function persistResults(Source $source, array $scanData, float $elapsed): SourceProfile
    {
        $tables = $scanData['tables'] ?? [];

        $tableCount = count($tables);
        $columnCount = 0;
        $totalRows = 0;
        $highNullColumns = 0;
        $emptyTables = 0;
        $lowCardinalityColumns = 0;
        $singleValueColumns = 0;

        foreach ($tables as $table) {
            $totalRows += $table['row_count'] ?? 0;
            $columnCount += $table['column_count'] ?? count($table['columns'] ?? []);

            if (($table['row_count'] ?? 0) === 0) {
                $emptyTables++;
            }

            foreach ($table['columns'] ?? [] as $col) {
                $nullPct = ($col['fraction_empty'] ?? 0) * 100;
                if ($nullPct > 50) {
                    $highNullColumns++;
                }
                $uniqueCount = $col['unique_count'] ?? 0;
                if ($uniqueCount < 5 && ($table['row_count'] ?? 0) > 0) {
                    $lowCardinalityColumns++;
                }
                if ($uniqueCount <= 1 && ($table['row_count'] ?? 0) > 0) {
                    $singleValueColumns++;
                }
            }
        }

        $grade = $this->computeOverallGrade($tables);

        $profile = SourceProfile::create([
            'source_id' => $source->id,
            'scan_type' => 'whiterabbit',
            'scan_time_seconds' => $elapsed,
            'overall_grade' => $grade,
            'table_count' => $tableCount,
            'column_count' => $columnCount,
            'total_rows' => $totalRows,
            'row_count' => $totalRows,
            'summary_json' => [
                'high_null_columns' => $highNullColumns,
                'empty_tables' => $emptyTables,
                'low_cardinality_columns' => $lowCardinalityColumns,
                'single_value_columns' => $singleValueColumns,
            ],
        ]);

        // Persist field profiles
        foreach ($tables as $table) {
            $tableName = $table['table_name'];
            $tableRowCount = $table['row_count'] ?? 0;

            foreach ($table['columns'] ?? [] as $idx => $col) {
                $nullPct = round(($col['fraction_empty'] ?? 0) * 100, 2);
                $nRows = $col['n_rows'] ?? $tableRowCount;
                $nullCount = (int) round($nRows * ($col['fraction_empty'] ?? 0));

                FieldProfile::create([
                    'source_profile_id' => $profile->id,
                    'table_name' => $tableName,
                    'row_count' => $tableRowCount,
                    'column_name' => $col['name'],
                    'column_index' => $idx,
                    'inferred_type' => $col['type'] ?? 'unknown',
                    'non_null_count' => $nRows - $nullCount,
                    'null_count' => $nullCount,
                    'null_percentage' => $nullPct,
                    'distinct_count' => $col['unique_count'] ?? 0,
                    'distinct_percentage' => $nRows > 0
                        ? round(($col['unique_count'] ?? 0) / $nRows * 100, 2)
                        : 0,
                    'sample_values' => $col['values'] ?? null,
                ]);
            }
        }

        Log::info('Profiler scan persisted', [
            'source_id' => $source->id,
            'profile_id' => $profile->id,
            'tables' => $tableCount,
            'columns' => $columnCount,
            'grade' => $grade,
            'elapsed' => $elapsed,
        ]);

        return $profile;
    }

    /**
     * Compute overall A-F grade from average null fraction across all columns.
     *
     * @param  list<array{columns?: list<array{fraction_empty?: float}>}>  $tables
     */
    private function computeOverallGrade(array $tables): string
    {
        $totalNull = 0;
        $totalCols = 0;

        foreach ($tables as $table) {
            foreach ($table['columns'] ?? [] as $col) {
                $totalNull += $col['fraction_empty'] ?? 0;
                $totalCols++;
            }
        }

        if ($totalCols === 0) {
            return 'F';
        }

        $avgNull = ($totalNull / $totalCols) * 100;

        return match (true) {
            $avgNull <= 5 => 'A',
            $avgNull <= 15 => 'B',
            $avgNull <= 30 => 'C',
            $avgNull <= 50 => 'D',
            default => 'F',
        };
    }
}
```

- [ ] **Step 2: Verify syntax**

Run: `cd backend && php -l app/Services/Profiler/SourceProfilerService.php`
Expected: No syntax errors.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/Profiler/SourceProfilerService.php
git commit -m "feat(profiler): add SourceProfilerService for scan + persistence"
```

### Task 5: Form Request + Controller + Routes

**Files:**
- Create: `backend/app/Http/Requests/RunScanRequest.php`
- Create: `backend/app/Http/Controllers/Api/V1/SourceProfilerController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create Form Request**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RunScanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // RBAC handled by route middleware
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tables' => ['nullable', 'array'],
            'tables.*' => ['string', 'max:255'],
            'sample_rows' => ['nullable', 'integer', 'min:100', 'max:1000000'],
        ];
    }
}
```

- [ ] **Step 2: Create Controller**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RunScanRequest;
use App\Models\App\Source;
use App\Models\App\SourceProfile;
use App\Services\Profiler\SourceProfilerService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

#[Group('Source Profiler', weight: 231)]
class SourceProfilerController extends Controller
{
    public function __construct(
        private readonly SourceProfilerService $profilerService,
    ) {}

    /**
     * GET /sources/{source}/profiles
     *
     * List scan history for a source (newest first, paginated).
     */
    public function index(Source $source): JsonResponse
    {
        $profiles = $source->sourceProfiles()
            ->where('scan_type', 'whiterabbit')
            ->orderByDesc('created_at')
            ->paginate(20, ['id', 'source_id', 'scan_type', 'scan_time_seconds', 'overall_grade', 'table_count', 'column_count', 'total_rows', 'summary_json', 'created_at']);

        return response()->json($profiles);
    }

    /**
     * GET /sources/{source}/profiles/{profile}
     *
     * Single scan with all field profiles.
     */
    public function show(Source $source, SourceProfile $profile): JsonResponse
    {
        if ($profile->source_id !== $source->id) {
            return response()->json(['error' => 'Profile does not belong to this source'], 404);
        }

        $profile->load('fields');

        return response()->json(['data' => $profile]);
    }

    /**
     * POST /sources/{source}/profiles/scan
     *
     * Trigger a WhiteRabbit scan, persist results, return profile.
     */
    public function scan(RunScanRequest $request, Source $source): JsonResponse
    {
        try {
            $profile = $this->profilerService->scan(
                $source,
                $request->input('tables'),
                $request->integer('sample_rows', 100000),
            );

            return response()->json([
                'data' => $profile->only([
                    'id', 'source_id', 'overall_grade', 'table_count',
                    'column_count', 'total_rows', 'scan_time_seconds', 'summary_json',
                ]),
                'message' => 'Scan completed and saved.',
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Profiler scan request failed', [
                'source_id' => $source->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => 'Scan failed',
                'message' => 'Unable to complete database scan. Check that the source is accessible.',
            ], 502);
        }
    }

    /**
     * DELETE /sources/{source}/profiles/{profile}
     *
     * Delete a scan and its field profiles (cascade).
     */
    public function destroy(Source $source, SourceProfile $profile): JsonResponse
    {
        if ($profile->source_id !== $source->id) {
            return response()->json(['error' => 'Profile does not belong to this source'], 404);
        }

        $profile->delete();

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 3: Add routes**

In `backend/routes/api.php`, add inside the `auth:sanctum` middleware group, after the existing ETL block (around line 729):

```php
// Source Profiler (persisted WhiteRabbit scans)
// NOTE: /compare and /scan must be registered BEFORE /{profile} to avoid wildcard capture.
Route::prefix('sources/{source}/profiles')->group(function () {
    Route::get('/', [SourceProfilerController::class, 'index'])
        ->middleware('permission:profiler.view');
    Route::get('/compare', [SourceProfilerController::class, 'compare'])
        ->middleware('permission:profiler.view');
    Route::post('/scan', [SourceProfilerController::class, 'scan'])
        ->middleware(['permission:profiler.scan', 'throttle:3,10']);
    Route::get('/{profile}', [SourceProfilerController::class, 'show'])
        ->middleware('permission:profiler.view')
        ->where('profile', '[0-9]+');
    Route::delete('/{profile}', [SourceProfilerController::class, 'destroy'])
        ->middleware('permission:profiler.delete')
        ->where('profile', '[0-9]+');
});
```

Also add permission middleware to existing ETL scan route:

```php
// Change line 717 from:
Route::post('/scan', [WhiteRabbitController::class, 'scan']);
// To:
Route::post('/scan', [WhiteRabbitController::class, 'scan'])
    ->middleware('permission:profiler.scan');
```

Add import at top of `routes/api.php`:
```php
use App\Http\Controllers\Api\V1\SourceProfilerController;
```

- [ ] **Step 4: Verify syntax**

Run: `cd backend && php -l app/Http/Requests/RunScanRequest.php && php -l app/Http/Controllers/Api/V1/SourceProfilerController.php`
Expected: No syntax errors.

Run: `docker compose exec php php artisan route:list --path=profiles`
Expected: Shows the 4 new profiler routes with correct middleware.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Requests/RunScanRequest.php backend/app/Http/Controllers/Api/V1/SourceProfilerController.php backend/routes/api.php
git commit -m "feat(profiler): add controller, form request, and routes with RBAC"
```

### Task 6: Frontend — API Hooks + Types

**Files:**
- Create: `frontend/src/features/etl/hooks/useProfilerData.ts`
- Modify: `frontend/src/features/etl/api.ts`

- [ ] **Step 1: Add types and API functions to api.ts**

Append to `frontend/src/features/etl/api.ts`:

```typescript
// ---------------------------------------------------------------------------
// Types — Source Profiler (persisted)
// ---------------------------------------------------------------------------

export interface ProfileSummary {
  id: number;
  source_id: number;
  scan_type: string;
  scan_time_seconds: number;
  overall_grade: string;
  table_count: number;
  column_count: number;
  total_rows: number;
  summary_json: {
    high_null_columns: number;
    empty_tables: number;
    low_cardinality_columns: number;
    single_value_columns: number;
  };
  created_at: string;
}

export interface PersistedFieldProfile {
  id: number;
  source_profile_id: number;
  table_name: string;
  row_count: number;
  column_name: string;
  column_index: number;
  inferred_type: string;
  null_percentage: number;
  distinct_count: number;
  sample_values: Record<string, number> | null;
  is_potential_pii: boolean;
  pii_type: string | null;
}

export interface PersistedProfile extends ProfileSummary {
  fields: PersistedFieldProfile[];
}

export interface PaginatedProfiles {
  data: ProfileSummary[];
  current_page: number;
  last_page: number;
  total: number;
}

// ---------------------------------------------------------------------------
// API functions — Source Profiler (persisted)
// ---------------------------------------------------------------------------

export async function fetchProfileHistory(sourceId: number): Promise<PaginatedProfiles> {
  const { data } = await apiClient.get<PaginatedProfiles>(
    `/sources/${sourceId}/profiles`,
  );
  return data;
}

export async function fetchProfile(sourceId: number, profileId: number): Promise<PersistedProfile> {
  const { data } = await apiClient.get<{ data: PersistedProfile }>(
    `/sources/${sourceId}/profiles/${profileId}`,
  );
  return data.data;
}

export async function runPersistedScan(
  sourceId: number,
  request: { tables?: string[]; sample_rows?: number },
): Promise<ProfileSummary> {
  const { data } = await apiClient.post<{ data: ProfileSummary }>(
    `/sources/${sourceId}/profiles/scan`,
    request,
  );
  return data.data;
}

export async function deleteProfile(sourceId: number, profileId: number): Promise<void> {
  await apiClient.delete(`/sources/${sourceId}/profiles/${profileId}`);
}
```

- [ ] **Step 2: Create TanStack Query hooks**

```typescript
// frontend/src/features/etl/hooks/useProfilerData.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProfileHistory,
  fetchProfile,
  runPersistedScan,
  deleteProfile,
} from "../api";

export function useProfileHistory(sourceId: number) {
  return useQuery({
    queryKey: ["profiler", "history", sourceId],
    queryFn: () => fetchProfileHistory(sourceId),
    enabled: sourceId > 0,
    staleTime: 60_000,
  });
}

export function useProfile(sourceId: number, profileId: number) {
  return useQuery({
    queryKey: ["profiler", "detail", sourceId, profileId],
    queryFn: () => fetchProfile(sourceId, profileId),
    enabled: sourceId > 0 && profileId > 0,
  });
}

export function useRunScan(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: { tables?: string[]; sample_rows?: number }) =>
      runPersistedScan(sourceId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
    },
  });
}

export function useDeleteProfile(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: number) => deleteProfile(sourceId, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors in new files.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/etl/api.ts frontend/src/features/etl/hooks/useProfilerData.ts
git commit -m "feat(profiler): add frontend API hooks for persisted scan endpoints"
```

### Task 7: Frontend — CDM Context Panel

**Files:**
- Create: `frontend/src/features/etl/components/CdmContextPanel.tsx`

- [ ] **Step 1: Create component**

The CDM Context Panel fetches Achilles summary data for the selected source and displays it as a horizontal card row. Uses existing `/sources/{source}/achilles/record-counts` and `/sources/{source}/achilles/runs` endpoints.

Key implementation details:
- Fetch record-counts, achilles runs, and DQD latest (if exists) via existing hooks from `features/data-explorer/hooks/useAchillesData.ts`
- If no Achilles data exists, show muted "No characterization data" message with link to `/data-explorer/{sourceId}`
- Cards: Person Count, Observation Period Span, Domain Coverage (non-zero domain count), Latest Run (status + date), DQ Grade
- "View full characterization →" link at bottom
- Styled to match dark clinical theme: `#0E0E11` base, `#2DD4BF` teal accents

- [ ] **Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/etl/components/CdmContextPanel.tsx
git commit -m "feat(profiler): add CDM Context Panel with Achilles overlay"
```

### Task 8: Frontend — Scan Progress Indicator

**Files:**
- Create: `frontend/src/features/etl/components/ScanProgressIndicator.tsx`

- [ ] **Step 1: Create component**

Phased progress indicator that replaces the generic spinner during scans:
- Phase 1: "Connecting to database..." (immediate, pulse animation)
- Phase 2: "Scanning tables..." (after 2s)
- Phase 3: "Profiling columns..." (after 5s)
- Phase 4: "Computing quality metrics..." (after response received)
- Elapsed time counter updating every second
- After 60s: "Large databases may take several minutes" message
- Cancel button that calls `AbortController.abort()`
- Indeterminate progress bar with pulsing animation

Props: `isScanning: boolean`, `onCancel: () => void`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/etl/components/ScanProgressIndicator.tsx
git commit -m "feat(profiler): add phased scan progress indicator"
```

### Task 9: Frontend — Integrate into SourceProfilerPage

**Files:**
- Modify: `frontend/src/features/etl/pages/SourceProfilerPage.tsx`
- Modify: `frontend/src/features/etl/components/ScanHistorySidebar.tsx`

- [ ] **Step 1: Switch SourceProfilerPage to server-side persistence**

Key changes:
- Replace `useScanDatabase()` mutation with `useRunScan(sourceId)` from new hooks
- Replace `loadHistory()`/`saveHistory()` localStorage calls with `useProfileHistory(sourceId)` query
- Add `CdmContextPanel` component above the results area (shown when source selected and results exist)
- Replace generic loading spinner with `ScanProgressIndicator`
- On first load: clear `localStorage.removeItem('parthenon:source-profiler:history')` to prevent stale data
- When viewing a persisted profile: fetch full detail via `useProfile(sourceId, profileId)` and transform `PersistedFieldProfile[]` to the existing `TableProfile[]` shape for rendering compatibility

- [ ] **Step 2: Update ScanHistorySidebar to use server-side data**

Key changes:
- Accept `profiles: ProfileSummary[]` prop instead of localStorage history
- Use `useDeleteProfile()` hook for delete button
- Add "Compare" checkboxes (disabled — wired in Phase 2)
- Show `overall_grade`, `table_count`, `created_at` from server data

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit && npx vite build`
Expected: Both pass.

- [ ] **Step 4: Deploy and test**

Run: `./deploy.sh --frontend --php --db`
Test: Navigate to Source Profiler, select a source, run a scan, verify results persist and appear in history sidebar.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/etl/pages/SourceProfilerPage.tsx frontend/src/features/etl/components/ScanHistorySidebar.tsx
git commit -m "feat(profiler): integrate server-side persistence, CDM context, and progress indicator"
```

---

## Phase 2: PII Detection + Comparison View

### Task 10: PII Detection Service

**Files:**
- Create: `backend/app/Services/Profiler/PiiDetectionService.php`

- [ ] **Step 1: Create PII detection service**

Implements two-pass detection:
- Pass 1: Column name regex patterns (ssn, email, phone, mrn, name, address, dob, ip_address)
- Pass 2: Sample value regex patterns (SSN format, email format, phone format, zip format)
- OMOP CDM allowlist: skip columns matching `/_source_value$/`
- When PII detected: set `is_potential_pii = true`, `pii_type` to matched type, redact `sample_values` to `["[REDACTED — potential PII]"]`

- [ ] **Step 2: Wire into SourceProfilerService**

After creating field profiles, call `PiiDetectionService::detectAndFlag($profile)` which iterates field profiles and updates PII flags.

- [ ] **Step 3: Verify syntax**

Run: `cd backend && php -l app/Services/Profiler/PiiDetectionService.php`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/Profiler/PiiDetectionService.php backend/app/Services/Profiler/SourceProfilerService.php
git commit -m "feat(profiler): add PII detection service with column name and value pattern matching"
```

### Task 11: Scan Comparison Service + Endpoint

**Files:**
- Create: `backend/app/Services/Profiler/ScanComparisonService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/SourceProfilerController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create comparison service**

`ScanComparisonService::compare(SourceProfile $current, SourceProfile $baseline): array`

Returns structured diff with:
- `summary`: grade_change, regression count, improvement count, schema_change count, row_count_delta
- `regressions`: columns where null_percentage increased > 5pp or distinct_count dropped > 20%
- `improvements`: columns where null_percentage decreased > 5pp
- `schema_changes`: columns added, removed, or type changed

Matching logic: join field profiles on `table_name + column_name`.

- [ ] **Step 2: Add compare endpoint to controller**

```php
public function compare(Request $request, Source $source): JsonResponse
```

Validates `current` and `baseline` query params (both required, integer, exist in source_profiles).

- [ ] **Step 3: Add route**

```php
Route::get('/compare', [SourceProfilerController::class, 'compare'])
    ->middleware('permission:profiler.view');
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/Profiler/ScanComparisonService.php backend/app/Http/Controllers/Api/V1/SourceProfilerController.php backend/routes/api.php
git commit -m "feat(profiler): add scan comparison service and API endpoint"
```

### Task 12: Frontend — PII Badge + Comparison Components

**Files:**
- Create: `frontend/src/features/etl/components/PiiBadge.tsx`
- Create: `frontend/src/features/etl/components/ComparisonSummary.tsx`
- Create: `frontend/src/features/etl/components/ComparisonDiff.tsx`
- Modify: `frontend/src/features/etl/components/DataQualityScorecard.tsx`
- Modify: `frontend/src/features/etl/components/ScanHistorySidebar.tsx`
- Modify: `frontend/src/features/etl/pages/SourceProfilerPage.tsx`
- Modify: `frontend/src/features/etl/hooks/useProfilerData.ts`
- Modify: `frontend/src/features/etl/api.ts`

- [ ] **Step 1: Create PiiBadge component**

Red shield icon badge for PII columns. Tooltip shows detection reason and PII type.

- [ ] **Step 2: Create ComparisonSummary component**

Four cards: Grade Change, Regressions (red), Improvements (green), Schema Changes (purple). Optional fifth "Data Volume" card if row_count_delta > 10%.

- [ ] **Step 3: Create ComparisonDiff component**

Filterable table showing column-level diffs. Clicking a summary card filters to that category.

- [ ] **Step 4: Add comparison API function and hook**

In `api.ts`: `fetchComparison(sourceId, currentId, baselineId)`.
In `useProfilerData.ts`: `useComparison(sourceId, currentId, baselineId)`.

- [ ] **Step 5: Wire PII badge into TableAccordion**

Show PiiBadge next to type badge when `is_potential_pii === true`.

- [ ] **Step 6: Add PII count to DataQualityScorecard**

New metric row: "PII columns: N" with advisory icon.

- [ ] **Step 7: Enable comparison in ScanHistorySidebar**

Enable checkboxes, show "Compare" button when exactly 2 selected. Clicking opens comparison view in main area.

- [ ] **Step 8: Integrate comparison view into SourceProfilerPage**

New view mode: `comparison`. When active, renders ComparisonSummary + ComparisonDiff instead of scan results.

- [ ] **Step 9: Build and deploy**

Run: `cd frontend && npx tsc --noEmit && npx vite build`
Run: `./deploy.sh --frontend --php`

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/etl/
git commit -m "feat(profiler): add PII badges, comparison summary cards, and drill-down diff"
```

---

## Phase 3: FK Relationship Visualization

### Task 13: FK Relationship Graph Component

**Files:**
- Create: `frontend/src/features/etl/components/FkRelationshipGraph.tsx`
- Modify: `frontend/src/features/etl/pages/SourceProfilerPage.tsx`

- [ ] **Step 1: Create FK inference logic**

Parse column names ending in `_id` from field profiles. Match against known OMOP CDM tables: `person`, `visit_occurrence`, `visit_detail`, `condition_occurrence`, `drug_exposure`, `procedure_occurrence`, `device_exposure`, `measurement`, `observation`, `death`, `note`, `specimen`, `concept`, `location`, `care_site`, `provider`, `payer_plan_period`, `cost`, `observation_period`, `drug_era`, `condition_era`.

Build edges: `table.column_id → target_table.target_table_id`.

- [ ] **Step 2: Render static graph**

SVG-based layout with:
- Nodes as rounded rectangles, colored by OMOP domain (Person=teal, Visit=blue, Condition=gold, Drug=crimson, Measurement=purple, etc.)
- Edges as curved paths between nodes
- Click handler on nodes to scroll to that table's profile in the accordion
- Only shown when source has CDM daimons

- [ ] **Step 3: Add as tab/section in SourceProfilerPage**

New "Relationships" tab or collapsible section below the CDM Context Panel. Only visible when field profiles contain `_id` columns matching CDM tables.

- [ ] **Step 4: Build and deploy**

Run: `cd frontend && npx tsc --noEmit && npx vite build`
Run: `./deploy.sh --frontend`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/etl/components/FkRelationshipGraph.tsx frontend/src/features/etl/pages/SourceProfilerPage.tsx
git commit -m "feat(profiler): add FK relationship visualization for CDM sources"
```

---

## Final Task: Deploy + Verify

### Task 14: Full Deployment and Verification

- [ ] **Step 1: Add @deprecated annotation to WhiteRabbitController::scan()**

In `backend/app/Http/Controllers/Api/V1/WhiteRabbitController.php`, add to the `scan()` docblock:
```php
@deprecated Use SourceProfilerController::scan() instead. This endpoint will be removed in a future release.
```

- [ ] **Step 2: Run linters**

```bash
cd backend && vendor/bin/pint --test
cd backend && vendor/bin/phpstan analyse
cd frontend && npx tsc --noEmit
cd frontend && npx eslint .
```

- [ ] **Step 2: Full deploy**

```bash
./deploy.sh
```

- [ ] **Step 3: End-to-end verification**

1. Navigate to Source Profiler page
2. Select Acumenus CDM source — verify CDM Context Panel shows person count, domain coverage
3. Run a scan — verify progress indicator shows phases, elapsed time
4. Verify scan persists to history sidebar with grade and timestamp
5. Run a second scan — verify both appear in history
6. Select two scans → Compare — verify summary cards and drill-down diff
7. Check for PII badges on any flagged columns
8. Test RBAC: log in as viewer role — verify scan button is hidden/disabled, view works
9. Verify existing Data Explorer still works (no regressions)

- [ ] **Step 4: Devlog + commit + push**

```bash
# Write devlog, then:
git add docs/devlog/
git commit -m "docs: add Source Profiler enhancement devlog"
git push origin main
```
