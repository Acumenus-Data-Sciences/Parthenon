# Multi-File Ingestion with Staging Tables — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Upload Files tab from single-file-per-job to multi-file projects with per-project PostgreSQL staging schemas, batch upload with editable review list, and queryable staging tables.

**Architecture:** New `IngestionProject` model as parent of `IngestionJob`. Per-project staging schemas (`staging_{id}`) with TEXT-only tables created via PostgreSQL COPY. Hybrid parsing: inline for small files, Horizon queue for large. Frontend restructured to project list/detail with multi-file drag-and-drop.

**Tech Stack:** Laravel 11 / PHP 8.4, PostgreSQL 17 (dynamic schemas), PhpSpreadsheet (Excel), React 19 / TypeScript, TanStack Query

**Spec:** `docs/devlog/specs/2026-03-25-multi-file-ingestion-design.md`

---

## Phase 1 Task Overview

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migrations | 2 migration files |
| 2 | IngestionProject model + policy | 3 new files, 1 modified |
| 3 | Fix existing ingestion route permissions | 1 modified file |
| 4 | Column/table name sanitizer | 1 new file |
| 5 | StagingService (schema + table + COPY) | 1 new file |
| 6 | StageFileJob (queue) | 1 new file |
| 7 | Form requests + controller + routes | 5 new files, 1 modified |
| 8 | Install PhpSpreadsheet + extend FileUploadService | 1 modified file |
| 9 | Frontend API hooks + types | 2 new/modified files |
| 10 | Frontend — ProjectListView | 1 new file |
| 11 | Frontend — FileReviewList + multi-file upload | 2 new files, 1 modified |
| 12 | Frontend — ProjectDetailView + StagingPreview | 2 new files |
| 13 | Frontend — Restructure IngestionDashboardPage | 1 modified file |
| 14 | Deploy + verify | Deploy, test |

---

### Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_26_200000_create_ingestion_projects_table.php`
- Create: `backend/database/migrations/2026_03_26_200001_add_project_id_to_ingestion_jobs.php`

- [ ] **Step 1: Create ingestion_projects migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ingestion_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->constrained('users');
            $table->integer('file_count')->default(0);
            $table->bigInteger('total_size_bytes')->default(0);
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ingestion_projects');
    }
};
```

- [ ] **Step 2: Create add_project_id migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingestion_jobs', function (Blueprint $table) {
            $table->foreignId('ingestion_project_id')->nullable()->after('id')
                ->constrained('ingestion_projects')->nullOnDelete();
            $table->string('staging_table_name', 255)->nullable()->after('source_id');
        });
    }

    public function down(): void
    {
        Schema::table('ingestion_jobs', function (Blueprint $table) {
            $table->dropForeign(['ingestion_project_id']);
            $table->dropColumn(['ingestion_project_id', 'staging_table_name']);
        });
    }
};
```

- [ ] **Step 3: Run migrations**

Run: `docker compose exec php php artisan migrate`

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_26_20000*
git commit -m "feat(ingestion): add ingestion_projects table and project_id on ingestion_jobs"
```

---

### Task 2: IngestionProject Model + Policy

**Files:**
- Create: `backend/app/Models/App/IngestionProject.php`
- Create: `backend/app/Policies/IngestionProjectPolicy.php`
- Modify: `backend/app/Models/App/IngestionJob.php`

- [ ] **Step 1: Create IngestionProject model**

```php
<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class IngestionProject extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'source_id',
        'status',
        'created_by',
        'file_count',
        'total_size_bytes',
        'notes',
    ];

    /**
     * Derived staging schema name — no stored column needed.
     */
    public function getStagingSchemaAttribute(): string
    {
        return "staging_{$this->id}";
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return HasMany<IngestionJob, $this> */
    public function jobs(): HasMany
    {
        return $this->hasMany(IngestionJob::class)->orderByDesc('created_at');
    }
}
```

- [ ] **Step 2: Create IngestionProjectPolicy**

```php
<?php

namespace App\Policies;

use App\Models\App\IngestionProject;
use App\Models\User;

class IngestionProjectPolicy
{
    public function view(User $user, IngestionProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }

    public function update(User $user, IngestionProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }

    public function delete(User $user, IngestionProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }
}
```

Register the policy in `AppServiceProvider` (same pattern as `EtlProjectPolicy`).

- [ ] **Step 3: Update IngestionJob model**

Add to `$fillable`: `'ingestion_project_id'`, `'staging_table_name'`

Add relationship:
```php
/** @return BelongsTo<IngestionProject, $this> */
public function project(): BelongsTo
{
    return $this->belongsTo(IngestionProject::class, 'ingestion_project_id');
}
```

- [ ] **Step 4: Syntax check + commit**

```bash
cd backend && php -l app/Models/App/IngestionProject.php && php -l app/Policies/IngestionProjectPolicy.php && php -l app/Models/App/IngestionJob.php
git add app/Models/App/IngestionProject.php app/Policies/IngestionProjectPolicy.php app/Models/App/IngestionJob.php app/Providers/AppServiceProvider.php
git commit -m "feat(ingestion): add IngestionProject model and policy"
```

---

### Task 3: Fix Existing Ingestion Route Permissions

**Files:**
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add permission middleware to existing ingestion routes**

Find the ingestion route block (around lines 180-205) and add permission middleware:

```php
// Ingestion
Route::post('/ingestion/upload', [IngestionController::class, 'upload'])
    ->middleware('permission:ingestion.upload');
Route::get('/ingestion/jobs', [IngestionController::class, 'index'])
    ->middleware('permission:ingestion.view');
Route::get('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'show'])
    ->middleware('permission:ingestion.view');
Route::get('/ingestion/jobs/{ingestionJob}/profile', [IngestionController::class, 'profile'])
    ->middleware('permission:ingestion.view');
Route::delete('/ingestion/jobs/{ingestionJob}', [IngestionController::class, 'destroy'])
    ->middleware('permission:ingestion.delete');
Route::post('/ingestion/jobs/{ingestionJob}/retry', [IngestionController::class, 'retry'])
    ->middleware('permission:ingestion.run');
```

- [ ] **Step 2: Verify routes**

Run: `docker compose exec php php artisan route:list --path=ingestion | grep permission`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/api.php
git commit -m "fix(security): add missing permission middleware to ingestion routes"
```

---

### Task 4: Column/Table Name Sanitizer

**Files:**
- Create: `backend/app/Services/Ingestion/ColumnNameSanitizer.php`

- [ ] **Step 1: Create sanitizer**

A pure utility class with two static methods: `sanitizeColumnName(string): string` and `sanitizeTableName(string): string`.

**Sanitization rules (both):**
1. Lowercase
2. Replace non-alphanumeric chars (except underscore) with `_`
3. Collapse multiple underscores
4. Strip leading/trailing underscores
5. Prefix with `col_` if starts with digit
6. Prefix with `col_` if PostgreSQL reserved word (maintain a const array of ~80 common reserved words: `select`, `table`, `order`, `group`, `user`, `type`, `index`, `primary`, `key`, `column`, `constraint`, `check`, `default`, `create`, `drop`, `alter`, `insert`, `update`, `delete`, `where`, `from`, `join`, `on`, `in`, `as`, `is`, `not`, `null`, `and`, `or`, `between`, `like`, `limit`, `offset`, `having`, `union`, `all`, `any`, `case`, `when`, `then`, `else`, `end`, `exists`, `foreign`, `references`, `unique`, `grant`, `revoke`, `trigger`, `view`, `with`, `desc`, `asc`, `distinct`, `into`, `values`, `set`, `begin`, `commit`, `rollback`, `true`, `false`, `cast`, `current_date`, `current_time`, `current_timestamp`, etc.)
7. Check for collision with `__row_id` → rename to `col___row_id`
8. Truncate to 63 characters
9. Deduplicate within a set: `deduplicateNames(array $names): array` appends `_2`, `_3`, etc.

**Table name additional rule:** Validate against strict regex `/^[a-z][a-z0-9_]{0,62}$/`. Throw `InvalidArgumentException` if not conformant after sanitization.

- [ ] **Step 2: Syntax check + commit**

```bash
cd backend && php -l app/Services/Ingestion/ColumnNameSanitizer.php
git add app/Services/Ingestion/ColumnNameSanitizer.php
git commit -m "feat(ingestion): add column and table name sanitizer with reserved word handling"
```

---

### Task 5: StagingService

**Files:**
- Create: `backend/app/Services/Ingestion/StagingService.php`

- [ ] **Step 1: Create staging service**

Core service with methods:

- `createSchema(IngestionProject $project): void` — `CREATE SCHEMA IF NOT EXISTS {pg_escape_identifier(schema)}`
- `stageFile(IngestionProject $project, IngestionJob $job, string $filePath, string $tableName, string $format): void` — reads headers, creates table, loads data
- `createTable(string $schema, string $tableName, array $columnNames): void` — `CREATE TABLE {schema}.{table} (__row_id SERIAL PRIMARY KEY, col1 TEXT, ...)`
- `loadCsv(string $schema, string $tableName, string $filePath, string $delimiter, array $columnNames): int` — PostgreSQL COPY FROM, returns row count
- `loadExcel(string $schema, string $tableName, string $filePath, array $columnNames): int` — PhpSpreadsheet with chunk reader, batch INSERT
- `dropTable(string $schema, string $tableName): void`
- `dropSchema(string $schema): void` — `DROP SCHEMA {schema} CASCADE`
- `previewTable(string $schema, string $tableName, int $limit, int $offset): array` — returns `{columns: string[], rows: array[], total: int}`

**Security:** All schema and table names pass through `pg_escape_identifier()`. Uses the `pgsql` connection with `SET search_path` for queries.

**CSV loading uses raw `pgsql` COPY:**
```php
$pdo = DB::connection('pgsql')->getPdo();
$pdo->pgsqlCopyFromFile($qualifiedTable, $filePath, $delimiter, '\\N', $columnList);
```

This is the same pattern used in `VocabularyImportJob` already in the codebase.

- [ ] **Step 2: Syntax check + commit**

```bash
cd backend && php -l app/Services/Ingestion/StagingService.php
git add app/Services/Ingestion/StagingService.php
git commit -m "feat(ingestion): add StagingService for schema creation and data loading"
```

---

### Task 6: StageFileJob

**Files:**
- Create: `backend/app/Jobs/Ingestion/StageFileJob.php`

- [ ] **Step 1: Create queue job**

Dispatched for files ≥ 5MB or when batch-uploading multiple files. Runs on the `ingestion` Horizon queue.

```php
class StageFileJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800; // 30 minutes for large files
    public int $tries = 2;

    public function __construct(
        public IngestionProject $project,
        public IngestionJob $job,
        public string $filePath,
        public string $tableName,
        public string $format,
    ) {
        $this->queue = 'ingestion';
    }

    public function handle(StagingService $staging, CsvProfilerService $profiler): void
    {
        // 1. Stage the file
        $staging->createSchema($this->project);
        $staging->stageFile($this->project, $this->job, $this->filePath, $this->tableName, $this->format);

        // 2. Profile the staged data (type inference, PII detection)
        // ... create SourceProfile + FieldProfile records

        // 3. Update job status
        $this->job->update([
            'status' => ExecutionStatus::Completed,
            'staging_table_name' => $this->tableName,
            'completed_at' => now(),
        ]);

        // 4. Recompute project status
        $this->recomputeProjectStatus();
    }
}
```

The profiling step reuses `CsvProfilerService` patterns — type inference and PII detection on the staged TEXT columns.

- [ ] **Step 2: Commit**

```bash
git add app/Jobs/Ingestion/StageFileJob.php
git commit -m "feat(ingestion): add StageFileJob for queue-based file staging"
```

---

### Task 7: Form Requests + Controller + Routes

**Files:**
- Create: `backend/app/Http/Requests/CreateIngestionProjectRequest.php`
- Create: `backend/app/Http/Requests/StageFilesRequest.php`
- Create: `backend/app/Http/Controllers/Api/V1/IngestionProjectController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Http/Controllers/Api/V1/IngestionController.php`

- [ ] **Step 1: Create form requests**

`CreateIngestionProjectRequest`:
- `name`: required, string, max:255
- `source_id`: nullable, integer, exists:sources,id
- `notes`: nullable, string

`StageFilesRequest`:
- `files`: required, array
- `files.*`: file, max:5120000 (5GB in KB)
- `table_names`: required, array
- `table_names.*`: required, string, max:63, regex:/^[a-z][a-z0-9_]{0,62}$/, distinct

- [ ] **Step 2: Create IngestionProjectController**

Endpoints:
- `index()` — paginated list, scoped by ownership (non-admins see only their projects)
- `store(CreateIngestionProjectRequest)` — create project
- `show(IngestionProject)` — with `jobs.profiles` eager loaded
- `update(Request, IngestionProject)` — update name, notes
- `destroy(IngestionProject)` — soft delete
- `stage(StageFilesRequest, IngestionProject)` — store files, dispatch staging (inline < 5MB for single file, queue for batch or large files), return 202 Accepted
- `removeFile(IngestionProject, IngestionJob)` — drop staging table, delete job
- `preview(Request, IngestionProject, string $table)` — validate table name against project's jobs, SELECT with limit/offset from staging

All methods use `$this->authorize()` for policy checks. Error messages sanitized per HIGHSEC.

- [ ] **Step 3: Add routes**

In `backend/routes/api.php`, inside `auth:sanctum` group:

```php
use App\Http\Controllers\Api\V1\IngestionProjectController;

// Ingestion Projects (multi-file staging)
Route::prefix('ingestion-projects')->group(function () {
    Route::get('/', [IngestionProjectController::class, 'index'])
        ->middleware('permission:ingestion.view');
    Route::post('/', [IngestionProjectController::class, 'store'])
        ->middleware('permission:ingestion.upload');
    Route::get('/{project}', [IngestionProjectController::class, 'show'])
        ->middleware('permission:ingestion.view')
        ->where('project', '[0-9]+');
    Route::put('/{project}', [IngestionProjectController::class, 'update'])
        ->middleware('permission:ingestion.upload')
        ->where('project', '[0-9]+');
    Route::delete('/{project}', [IngestionProjectController::class, 'destroy'])
        ->middleware('permission:ingestion.delete')
        ->where('project', '[0-9]+');
    Route::post('/{project}/stage', [IngestionProjectController::class, 'stage'])
        ->middleware(['permission:ingestion.upload', 'throttle:5,10'])
        ->where('project', '[0-9]+');
    Route::delete('/{project}/files/{job}', [IngestionProjectController::class, 'removeFile'])
        ->middleware('permission:ingestion.delete');
    Route::get('/{project}/preview/{table}', [IngestionProjectController::class, 'preview'])
        ->middleware('permission:ingestion.view')
        ->where('project', '[0-9]+');
});
```

- [ ] **Step 4: Modify IngestionController upload for backward compat**

In `IngestionController::upload()`, auto-create an `IngestionProject` for single-file uploads:

```php
// After creating the IngestionJob, wrap in a project
$project = IngestionProject::create([
    'name' => pathinfo($request->file('file')->getClientOriginalName(), PATHINFO_FILENAME),
    'source_id' => $request->validated('source_id'),
    'status' => 'profiling',
    'created_by' => $request->user()->id,
    'file_count' => 1,
    'total_size_bytes' => $request->file('file')->getSize(),
]);
$ingestionJob->update(['ingestion_project_id' => $project->id]);
```

- [ ] **Step 5: Verify routes + syntax check**

Run: `docker compose exec php php artisan route:list --path=ingestion-projects`
Expected: 8 routes with correct middleware.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Requests/CreateIngestionProjectRequest.php backend/app/Http/Requests/StageFilesRequest.php backend/app/Http/Controllers/Api/V1/IngestionProjectController.php backend/app/Http/Controllers/Api/V1/IngestionController.php backend/routes/api.php
git commit -m "feat(ingestion): add IngestionProject controller, form requests, and routes"
```

---

### Task 8: Install PhpSpreadsheet + Extend FileUploadService

**Files:**
- Modify: `backend/app/Services/Ingestion/FileUploadService.php`

- [ ] **Step 1: Install PhpSpreadsheet**

Run: `docker compose exec php composer require phpoffice/phpspreadsheet`

- [ ] **Step 2: Extend detectFormat() for Excel**

Add to `detectFormat()`:
```php
if (in_array($extension, ['xlsx', 'xls'])) {
    return 'excel';
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/composer.json backend/composer.lock backend/app/Services/Ingestion/FileUploadService.php
git commit -m "feat(ingestion): install PhpSpreadsheet and add Excel format detection"
```

---

### Task 9: Frontend API Hooks + Types

**Files:**
- Modify: `frontend/src/features/ingestion/api/ingestionApi.ts`
- Create: `frontend/src/features/ingestion/hooks/useIngestionProjects.ts`

- [ ] **Step 1: Add types and API functions**

Append to `ingestionApi.ts`:
- Types: `IngestionProject`, `StagingPreviewResult`
- Functions: `fetchIngestionProjects()`, `fetchIngestionProject(id)`, `createIngestionProject(data)`, `stageFiles(projectId, files, tableNames)`, `deleteIngestionProject(id)`, `removeProjectFile(projectId, jobId)`, `fetchStagingPreview(projectId, tableName, limit, offset)`

The `stageFiles` function uses `FormData` with multiple file appends.

- [ ] **Step 2: Create TanStack Query hooks**

`useIngestionProjects.ts` with: `useIngestionProjects()`, `useIngestionProject(id)`, `useCreateIngestionProject()`, `useStageFiles(projectId)`, `useDeleteIngestionProject()`, `useRemoveProjectFile(projectId)`, `useStagingPreview(projectId, tableName)`

- [ ] **Step 3: TypeScript check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/src/features/ingestion/
git commit -m "feat(ingestion): add frontend API types and hooks for ingestion projects"
```

---

### Task 10: Frontend — ProjectListView

**Files:**
- Create: `frontend/src/features/ingestion/pages/ProjectListView.tsx`

- [ ] **Step 1: Create project list component**

Table showing the user's ingestion projects:
- Columns: name, status badge, file count, total size (formatted), created date, actions (open, delete)
- "New Project" button (crimson) — opens a modal or inline form for project name + optional source
- Empty state: "No ingestion projects yet. Create one to start uploading source data."
- Uses `useIngestionProjects()` hook
- Status badges match existing pattern: draft=gray, profiling=blue+pulse, ready=teal, failed=red

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/ingestion/pages/ProjectListView.tsx
git commit -m "feat(ingestion): add project list view with status badges"
```

---

### Task 11: Frontend — FileReviewList + Multi-File Upload

**Files:**
- Create: `frontend/src/features/ingestion/components/FileReviewList.tsx`
- Create: `frontend/src/features/ingestion/components/MultiFileUploadZone.tsx`
- Modify: `frontend/src/features/ingestion/components/FileUploadZone.tsx`

- [ ] **Step 1: Create MultiFileUploadZone**

Same visual design as existing `FileUploadZone` but accepts `multiple` files. On file selection/drop, calls `onFilesSelect(files: File[])`.

Accept attribute: `.csv,.tsv,.xlsx,.xls`

- [ ] **Step 2: Create FileReviewList**

Editable list showing files before staging:
- Each row: original filename (read-only), table name (editable text input, pre-populated from sanitized filename), file size, remove button
- "Stage All" button at bottom
- Props: `files: File[]`, `onTableNameChange(index, name)`, `onRemove(index)`, `onStageAll()`, `isStaging: boolean`
- Table name inputs validate against the regex `/^[a-z][a-z0-9_]{0,62}$/` with inline error

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/ingestion/components/
git commit -m "feat(ingestion): add multi-file upload zone and file review list"
```

---

### Task 12: Frontend — ProjectDetailView + StagingPreview

**Files:**
- Create: `frontend/src/features/ingestion/pages/ProjectDetailView.tsx`
- Create: `frontend/src/features/ingestion/components/StagingPreview.tsx`

- [ ] **Step 1: Create StagingPreview**

Inline expandable table showing first 100 rows from a staging table:
- Uses `useStagingPreview(projectId, tableName)` hook
- Simple HTML table with column headers and text rows
- Pagination: "Showing 1–100 of N" with next/prev buttons
- Styling matches existing table patterns (dark theme)

- [ ] **Step 2: Create ProjectDetailView**

Full project detail page:
- Breadcrumb: "← Projects / {name}"
- Status badge + project metadata
- Upload zone (collapsible, expanded for `draft` projects):
  - `MultiFileUploadZone` → files go into `FileReviewList` state
  - "Stage All" triggers `useStageFiles` mutation
- Staged files table:
  - Table name, row count, column count, profiling status, PII count
  - "Preview" expand button → `StagingPreview` inline
  - Delete button per file → `useRemoveProjectFile`
- "Open in Aqueduct →" button when status is `ready` (navigates to `/ingestion?tab=aqueduct`)
- "Add more files" button that re-expands the upload zone

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/ingestion/pages/ProjectDetailView.tsx frontend/src/features/ingestion/components/StagingPreview.tsx
git commit -m "feat(ingestion): add project detail view with staging preview"
```

---

### Task 13: Frontend — Restructure IngestionDashboardPage

**Files:**
- Modify: `frontend/src/features/ingestion/pages/IngestionDashboardPage.tsx`

- [ ] **Step 1: Restructure as project list/detail router**

The existing IngestionDashboardPage (which currently shows inline upload + jobs table) becomes a router between:
- `activeProject === null` → render `ProjectListView`
- `activeProject !== null` → render `ProjectDetailView`

State: `const [activeProjectId, setActiveProjectId] = useState<number | null>(null)`

The existing `UploadSection` and `JobsTable` components are replaced by the new project-oriented views. Legacy `IngestionJob` records without `ingestion_project_id` appear in a collapsed "Legacy Jobs" section at the bottom of `ProjectListView`.

- [ ] **Step 2: TypeScript check + build**

Run: `cd frontend && npx tsc --noEmit && npx vite build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/ingestion/
git commit -m "feat(ingestion): restructure Upload Files tab as project list/detail"
```

---

### Task 14: Deploy + Verify

- [ ] **Step 1: Run linters**

```bash
cd backend && vendor/bin/pint --test
cd backend && vendor/bin/phpstan analyse
cd frontend && npx tsc --noEmit
```

- [ ] **Step 2: Deploy**

```bash
./deploy.sh
```

- [ ] **Step 3: End-to-end verification**

1. Navigate to Data Ingestion → Upload Files tab
2. See project list (empty initially)
3. Click "New Project" → enter "PIONEER Study" → create
4. Project detail opens with upload zone
5. Drag 3 CSV files → review list shows with editable table names
6. Rename table names → click "Stage All"
7. See staging progress (profiling spinners)
8. After staging: table names with row counts, column counts, PII flags
9. Click "Preview" → see first 100 rows inline
10. "Open in Aqueduct →" button appears when all files are ready
11. Back to project list → project shows "ready" status with 3 files
12. Test: legacy single-file upload still works (auto-creates project)

- [ ] **Step 4: Commit + push**

```bash
git push origin main
```
