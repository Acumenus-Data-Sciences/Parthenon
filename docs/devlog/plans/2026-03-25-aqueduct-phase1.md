# Aqueduct Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Aqueduct ETL mapping designer (Phase 1): restructure ETL Tools page into a 2-step pipeline, add data model + API for mapping projects, and build the React Flow canvas with table-level overview and field-level drill-down.

**Architecture:** Laravel backend with 3 new Eloquent models, controller, policy, and form requests. React frontend with React Flow (`@xyflow/react`) for interactive node-based canvas. Two-level navigation: table overview → field detail. Auto-save with debounced optimistic locking. CDM v5.4 schema bundled as static constants.

**Tech Stack:** Laravel 11 / PHP 8.4, React 19 / TypeScript strict, React Flow (`@xyflow/react`), dagre (`@dagrejs/dagre`), TanStack Query, PostgreSQL, Spatie RBAC

**Spec:** `docs/devlog/specs/2026-03-25-aqueduct-etl-mapping-design.md`

---

## Phase 1 Task Overview

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migrations (3 tables) | 3 migration files |
| 2 | Eloquent models + policy | 4 model/policy files, 1 modified |
| 3 | RBAC permissions | 1 modified seeder |
| 4 | CDM schema definition | 1 TS file, 1 PHP file, 1 Python script |
| 5 | Form requests | 4 request files |
| 6 | Backend service + controller + routes | 3 new files, 1 modified |
| 7 | Frontend API hooks | 2 modified files |
| 8 | Install React Flow + layout helpers | npm install, 1 new file |
| 9 | Custom React Flow nodes | 2 new component files |
| 10 | Custom React Flow edge | 1 new component file |
| 11 | Table overview canvas | 2 new component files |
| 12 | Field mapping detail view | 3 new component files |
| 13 | ETL Tools page restructure | 1 heavily modified file, 1 modified router |
| 14 | Deploy + verify | Deploy, test, commit |

---

### Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_26_100000_create_etl_projects_table.php`
- Create: `backend/database/migrations/2026_03_26_100001_create_etl_table_mappings_table.php`
- Create: `backend/database/migrations/2026_03_26_100002_create_etl_field_mappings_table.php`

- [ ] **Step 1: Create etl_projects migration**

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
        Schema::create('etl_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('cdm_version', 10)->default('5.4');
            $table->string('name', 255);
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->constrained('users'); // RESTRICT: user cannot be deleted while owning ETL projects
            $table->foreignId('scan_profile_id')->constrained('source_profiles');
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        // Partial unique index: one active project per source + CDM version
        DB::statement('CREATE UNIQUE INDEX etl_projects_source_cdm_active ON etl_projects (source_id, cdm_version) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('etl_projects');
    }
};
```

- [ ] **Step 2: Create etl_table_mappings migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etl_table_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etl_project_id')->constrained('etl_projects')->cascadeOnDelete();
            $table->string('source_table', 255);
            $table->string('target_table', 255);
            $table->text('logic')->nullable();
            $table->boolean('is_completed')->default(false);
            $table->boolean('is_stem')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['etl_project_id', 'source_table', 'target_table']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etl_table_mappings');
    }
};
```

- [ ] **Step 3: Create etl_field_mappings migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etl_field_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('etl_table_mapping_id')->constrained('etl_table_mappings')->cascadeOnDelete();
            $table->string('source_column', 255)->nullable();
            $table->string('target_column', 255);
            $table->string('mapping_type', 20)->default('direct');
            $table->text('logic')->nullable();
            $table->boolean('is_required')->default(false);
            $table->float('confidence')->nullable();
            $table->boolean('is_ai_suggested')->default(false);
            $table->boolean('is_reviewed')->default(false);
            $table->timestamps();

            $table->unique(['etl_table_mapping_id', 'target_column']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etl_field_mappings');
    }
};
```

- [ ] **Step 4: Run migrations**

Run: `docker compose exec php php artisan migrate`
Expected: All 3 migrations succeed.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_03_26_10000*
git commit -m "feat(aqueduct): add migrations for ETL project, table mapping, and field mapping tables"
```

---

### Task 2: Eloquent Models + Policy

**Files:**
- Create: `backend/app/Models/App/EtlProject.php`
- Create: `backend/app/Models/App/EtlTableMapping.php`
- Create: `backend/app/Models/App/EtlFieldMapping.php`
- Create: `backend/app/Policies/EtlProjectPolicy.php`
- Modify: `backend/app/Models/App/Source.php`

- [ ] **Step 1: Create EtlProject model**

```php
<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EtlProject extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'source_id',
        'cdm_version',
        'name',
        'status',
        'created_by',
        'scan_profile_id',
        'notes',
    ];

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<SourceProfile, $this> */
    public function scanProfile(): BelongsTo
    {
        return $this->belongsTo(SourceProfile::class, 'scan_profile_id');
    }

    /** @return HasMany<EtlTableMapping, $this> */
    public function tableMappings(): HasMany
    {
        return $this->hasMany(EtlTableMapping::class)->orderBy('sort_order');
    }
}
```

- [ ] **Step 2: Create EtlTableMapping model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EtlTableMapping extends Model
{
    protected $fillable = [
        'etl_project_id',
        'source_table',
        'target_table',
        'logic',
        'is_completed',
        'is_stem',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_completed' => 'boolean',
            'is_stem' => 'boolean',
        ];
    }

    /** @return BelongsTo<EtlProject, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(EtlProject::class, 'etl_project_id');
    }

    /** @return HasMany<EtlFieldMapping, $this> */
    public function fieldMappings(): HasMany
    {
        return $this->hasMany(EtlFieldMapping::class);
    }
}
```

- [ ] **Step 3: Create EtlFieldMapping model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EtlFieldMapping extends Model
{
    protected $fillable = [
        'etl_table_mapping_id',
        'source_column',
        'target_column',
        'mapping_type',
        'logic',
        'is_required',
        'confidence',
        'is_ai_suggested',
        'is_reviewed',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'confidence' => 'float',
            'is_ai_suggested' => 'boolean',
            'is_reviewed' => 'boolean',
        ];
    }

    /** @return BelongsTo<EtlTableMapping, $this> */
    public function tableMapping(): BelongsTo
    {
        return $this->belongsTo(EtlTableMapping::class, 'etl_table_mapping_id');
    }
}
```

- [ ] **Step 4: Create EtlProjectPolicy**

```php
<?php

namespace App\Policies;

use App\Models\App\EtlProject;
use App\Models\User;

class EtlProjectPolicy
{
    public function view(User $user, EtlProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }

    public function update(User $user, EtlProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }

    public function delete(User $user, EtlProject $project): bool
    {
        return $user->id === $project->created_by
            || $user->hasRole(['admin', 'super-admin']);
    }
}
```

Register in `AuthServiceProvider` or `AppServiceProvider` (check which the project uses for policy registration). If using auto-discovery, the naming convention `EtlProjectPolicy` for `EtlProject` model should work automatically.

- [ ] **Step 5: Add etlProjects() relationship to Source model**

In `backend/app/Models/App/Source.php`, add import and relationship:

```php
use App\Models\App\EtlProject;

/** @return HasMany<EtlProject, $this> */
public function etlProjects(): HasMany
{
    return $this->hasMany(EtlProject::class);
}
```

- [ ] **Step 6: Syntax check all files**

Run: `cd backend && php -l app/Models/App/EtlProject.php && php -l app/Models/App/EtlTableMapping.php && php -l app/Models/App/EtlFieldMapping.php && php -l app/Policies/EtlProjectPolicy.php`

- [ ] **Step 7: Commit**

```bash
git add backend/app/Models/App/Etl*.php backend/app/Policies/EtlProjectPolicy.php backend/app/Models/App/Source.php
git commit -m "feat(aqueduct): add EtlProject, EtlTableMapping, EtlFieldMapping models and policy"
```

---

### Task 3: RBAC Permissions

**Files:**
- Modify: `backend/database/seeders/RolePermissionSeeder.php`

- [ ] **Step 1: Add etl permission domain**

In the `PERMISSIONS` constant, add after `profiler`:

```php
// ── ETL mapping designer ──────────────────────────────────────────
'etl' => ['view', 'create', 'delete', 'export'],
```

- [ ] **Step 2: Add to roles**

- `admin` array: add `'etl.view', 'etl.create', 'etl.delete', 'etl.export'`
- `researcher` array: add `'etl.view', 'etl.create', 'etl.export'`
- `data-steward` array: add `'etl.view', 'etl.create', 'etl.export'`
- `viewer` array: add `'etl.view'`

- [ ] **Step 3: Run seeder**

Run: `docker compose exec php php artisan db:seed --class=RolePermissionSeeder`

- [ ] **Step 4: Commit**

```bash
git add backend/database/seeders/RolePermissionSeeder.php
git commit -m "feat(aqueduct): add ETL mapping RBAC permissions"
```

---

### Task 4: CDM Schema Definition

**Files:**
- Create: `frontend/src/features/etl/lib/cdm-schema-v54.ts`
- Create: `backend/config/cdm-schema-v54.php`
- Create: `scripts/generate-cdm-schema.py`

- [ ] **Step 1: Create the Python generator script**

Download the OHDSI CDM v5.4 CSV from GitHub and generate both TypeScript and PHP files. The script reads the CSV and outputs both formats.

Run: `python3 scripts/generate-cdm-schema.py`

The script should:
1. Fetch `https://raw.githubusercontent.com/OHDSI/CommonDataModel/v5.4/inst/csv/OMOP_CDMv5.4_Table_Level.csv` and `OMOP_CDMv5.4_Field_Level.csv`
2. Parse into table + column definitions
3. Write `frontend/src/features/etl/lib/cdm-schema-v54.ts`
4. Write `backend/config/cdm-schema-v54.php`

If the CSV fetch fails, fall back to the core OMOP CDM v5.4 tables hardcoded in the script (person, observation_period, visit_occurrence, visit_detail, condition_occurrence, drug_exposure, procedure_occurrence, device_exposure, measurement, observation, death, note, note_nlp, specimen, condition_era, drug_era, dose_era, cost, payer_plan_period, location, care_site, provider, concept, vocabulary, domain, concept_class, concept_relationship, relationship, concept_synonym, concept_ancestor, drug_strength, cohort, cohort_definition).

- [ ] **Step 2: Verify generated files**

Run: `cd frontend && npx tsc --noEmit` (TypeScript check)
Run: `cd backend && php -l config/cdm-schema-v54.php` (PHP syntax check)

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-cdm-schema.py frontend/src/features/etl/lib/cdm-schema-v54.ts backend/config/cdm-schema-v54.php
git commit -m "feat(aqueduct): add CDM v5.4 schema definitions with generator script"
```

---

### Task 5: Form Requests

**Files:**
- Create: `backend/app/Http/Requests/CreateEtlProjectRequest.php`
- Create: `backend/app/Http/Requests/UpdateEtlProjectRequest.php`
- Create: `backend/app/Http/Requests/CreateTableMappingRequest.php`
- Create: `backend/app/Http/Requests/UpdateFieldMappingsRequest.php`

- [ ] **Step 1: Create all 4 form requests**

`CreateEtlProjectRequest`:
- `source_id`: required, integer, exists:sources,id
- `cdm_version`: required, string, in:5.4,5.3
- `scan_profile_id`: required, integer, exists:source_profiles,id
- `notes`: nullable, string

`UpdateEtlProjectRequest`:
- `name`: nullable, string, max:255
- `status`: nullable, string, in:draft,in_review,approved,archived
- `notes`: nullable, string

`CreateTableMappingRequest`:
- `source_table`: required, string, max:255
- `target_table`: required, string, max:255 (validate against CDM schema in Phase 1 via custom rule or controller check)
- `logic`: nullable, string
- `is_stem`: nullable, boolean

`UpdateFieldMappingsRequest`:
- `fields`: required, array
- `fields.*.target_column`: required, string, max:255
- `fields.*.source_column`: nullable, string, max:255
- `fields.*.mapping_type`: nullable, string, in:direct,transform,lookup,constant,concat,expression
- `fields.*.logic`: nullable, string
- `fields.*.is_reviewed`: nullable, boolean
- `updated_at`: required, date (optimistic locking — reject if stale)

- [ ] **Step 2: Syntax check**

Run: `cd backend && php -l app/Http/Requests/Create*.php && php -l app/Http/Requests/Update*.php`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Requests/CreateEtlProjectRequest.php backend/app/Http/Requests/UpdateEtlProjectRequest.php backend/app/Http/Requests/CreateTableMappingRequest.php backend/app/Http/Requests/UpdateFieldMappingsRequest.php
git commit -m "feat(aqueduct): add form requests for ETL project and mapping validation"
```

---

### Task 6: Backend Service + Controller + Routes

**Files:**
- Create: `backend/app/Services/Etl/EtlProjectService.php`
- Create: `backend/app/Http/Controllers/Api/V1/EtlProjectController.php`
- Create: `backend/app/Http/Controllers/Api/V1/EtlFieldMappingController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create EtlProjectService**

Handles project creation (auto-generates name from source), table mapping CRUD, completion percentage calculation.

Key methods:
- `createProject(Source $source, array $data, User $user): EtlProject`
- `getProjectWithMappings(EtlProject $project): EtlProject` (eager loads tableMappings with fieldMappings count)
- `createTableMapping(EtlProject $project, array $data): EtlTableMapping`
- `computeProgress(EtlProject $project): array` (returns mapped_tables, total_cdm_tables, field_coverage_pct)

- [ ] **Step 2: Create EtlProjectController**

Handles project CRUD + table mapping CRUD. Uses `$this->authorize()` for policy checks.

Endpoints: index (paginated, scoped by ownership), store, show, update, destroy. Plus nested table-mapping routes: tableMappings, storeTableMapping, updateTableMapping, destroyTableMapping.

- [ ] **Step 3: Create EtlFieldMappingController**

Single controller for field mapping operations:
- `index(EtlProject, EtlTableMapping)` — list field mappings
- `bulkUpsert(UpdateFieldMappingsRequest, EtlProject, EtlTableMapping)` — accepts full field array, compares `updated_at` for optimistic locking, returns 409 if stale

- [ ] **Step 4: Add routes**

In `backend/routes/api.php`, inside the `auth:sanctum` group, add:

```php
use App\Http\Controllers\Api\V1\EtlProjectController;
use App\Http\Controllers\Api\V1\EtlFieldMappingController;

// Aqueduct ETL Mapping Designer
Route::prefix('etl-projects')->group(function () {
    Route::get('/', [EtlProjectController::class, 'index'])
        ->middleware('permission:etl.view');
    Route::post('/', [EtlProjectController::class, 'store'])
        ->middleware('permission:etl.create');
    Route::get('/{project}', [EtlProjectController::class, 'show'])
        ->middleware('permission:etl.view')
        ->where('project', '[0-9]+');
    Route::put('/{project}', [EtlProjectController::class, 'update'])
        ->middleware('permission:etl.create')
        ->where('project', '[0-9]+');
    Route::delete('/{project}', [EtlProjectController::class, 'destroy'])
        ->middleware('permission:etl.delete')
        ->where('project', '[0-9]+');

    // Table mappings
    Route::get('/{project}/table-mappings', [EtlProjectController::class, 'tableMappings'])
        ->middleware('permission:etl.view');
    Route::post('/{project}/table-mappings', [EtlProjectController::class, 'storeTableMapping'])
        ->middleware('permission:etl.create');
    Route::put('/{project}/table-mappings/{mapping}', [EtlProjectController::class, 'updateTableMapping'])
        ->middleware('permission:etl.create');
    Route::delete('/{project}/table-mappings/{mapping}', [EtlProjectController::class, 'destroyTableMapping'])
        ->middleware('permission:etl.create');

    // Field mappings
    Route::get('/{project}/table-mappings/{mapping}/fields', [EtlFieldMappingController::class, 'index'])
        ->middleware('permission:etl.view');
    Route::put('/{project}/table-mappings/{mapping}/fields', [EtlFieldMappingController::class, 'bulkUpsert'])
        ->middleware('permission:etl.create');
});
```

- [ ] **Step 5: Verify routes**

Run: `docker compose exec php php artisan route:list --path=etl-projects`
Expected: 12 routes with correct middleware.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Etl/ backend/app/Http/Controllers/Api/V1/Etl*.php backend/routes/api.php
git commit -m "feat(aqueduct): add ETL project controller, service, and routes with RBAC"
```

---

### Task 7: Frontend API Hooks

**Files:**
- Modify: `frontend/src/features/etl/api.ts`
- Create: `frontend/src/features/etl/hooks/useAqueductData.ts`

- [ ] **Step 1: Add Aqueduct types and API functions to api.ts**

Append types: `EtlProject`, `EtlTableMapping`, `EtlFieldMapping`, `ProjectProgress`.

Append functions: `fetchProjects()`, `fetchProject(id)`, `createProject(data)`, `updateProject(id, data)`, `deleteProject(id)`, `fetchTableMappings(projectId)`, `createTableMapping(projectId, data)`, `updateTableMapping(projectId, mappingId, data)`, `deleteTableMapping(projectId, mappingId)`, `fetchFieldMappings(projectId, mappingId)`, `bulkUpsertFieldMappings(projectId, mappingId, fields, updatedAt)`.

- [ ] **Step 2: Create TanStack Query hooks**

`useAqueductData.ts` with hooks: `useProjects()`, `useProject(id)`, `useCreateProject()`, `useUpdateProject()`, `useDeleteProject()`, `useTableMappings(projectId)`, `useCreateTableMapping(projectId)`, `useUpdateTableMapping(projectId)`, `useDeleteTableMapping(projectId)`, `useFieldMappings(projectId, mappingId)`, `useBulkUpsertFields(projectId, mappingId)`.

All mutations invalidate parent queries on success.

- [ ] **Step 3: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/etl/api.ts frontend/src/features/etl/hooks/useAqueductData.ts
git commit -m "feat(aqueduct): add frontend API types and TanStack Query hooks"
```

---

### Task 8: Install React Flow + Layout Helpers

**Files:**
- npm install
- Create: `frontend/src/features/etl/lib/aqueduct-layout.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd frontend && npm install @xyflow/react @dagrejs/dagre --legacy-peer-deps`

- [ ] **Step 2: Create layout helper**

`aqueduct-layout.ts` — uses dagre to compute node positions for the table overview canvas.

Key function: `computeLayout(sourceNodes, cdmNodes, edges)` → returns positioned nodes.

Source nodes go in left column, CDM nodes in right column. Dagre handles vertical spacing and edge routing.

- [ ] **Step 3: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/features/etl/lib/aqueduct-layout.ts
git commit -m "feat(aqueduct): install React Flow and dagre, add layout helper"
```

---

### Task 9: Custom React Flow Nodes

**Files:**
- Create: `frontend/src/features/etl/components/aqueduct/SourceTableNode.tsx`
- Create: `frontend/src/features/etl/components/aqueduct/CdmTableNode.tsx`

- [ ] **Step 1: Create SourceTableNode**

Custom React Flow node for source tables:
- Gold border (`#C9A227`), dark background (`#1e1a14`)
- Shows: table name (bold), column count, row count from scan
- Right-side `Handle` (type="source") for creating connections
- `data` prop: `{ tableName: string; columnCount: number; rowCount: number }`
- Dimmed (opacity 30%) if `data.dimmed` is true

- [ ] **Step 2: Create CdmTableNode**

Custom React Flow node for CDM target tables:
- Border colored by domain (use `DOMAIN_COLORS` map), dark background (`#0f1a1a`)
- Shows: table name, required field count (red if > 0 unmapped), domain badge
- Left-side `Handle` (type="target")
- `data` prop: `{ tableName: string; domain: string; requiredCount: number; mappedRequiredCount: number }`
- Dimmed if `data.dimmed` is true

- [ ] **Step 3: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/SourceTableNode.tsx frontend/src/features/etl/components/aqueduct/CdmTableNode.tsx
git commit -m "feat(aqueduct): add custom React Flow nodes for source and CDM tables"
```

---

### Task 10: Custom React Flow Edge

**Files:**
- Create: `frontend/src/features/etl/components/aqueduct/MappingEdge.tsx`

- [ ] **Step 1: Create MappingEdge**

Custom React Flow edge with:
- Progress badge at midpoint: "N/M fields mapped" in a small pill
- Color by status: teal (`#2DD4BF`) if complete, amber (`#F59E0B`) if partial, red (`#EF4444`) if has unmapped required fields
- Animated dashed stroke if `data.isAiSuggested && !data.isReviewed`
- Clickable — `onClick` in edge data calls the drill-down handler
- Uses React Flow's `getBezierPath` for smooth curves
- `data` prop: `{ mappedFields: number; totalFields: number; hasUnmappedRequired: boolean; isComplete: boolean; isAiSuggested: boolean; isReviewed: boolean; onClick: () => void }`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/MappingEdge.tsx
git commit -m "feat(aqueduct): add custom React Flow edge with progress badge"
```

---

### Task 11: Table Overview Canvas

**Files:**
- Create: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx`
- Create: `frontend/src/features/etl/components/aqueduct/MappingToolbar.tsx`

- [ ] **Step 1: Create MappingToolbar**

Top toolbar showing:
- Project name + status badge (draft/in_review/approved)
- Progress: "N of M CDM tables mapped • X% field coverage"
- Filter buttons: All / Mapped / Unmapped
- "AI Suggest All" button (disabled in Phase 1, placeholder)
- "Export" dropdown (disabled in Phase 1, placeholder)

Props: `project: EtlProject`, `progress: ProjectProgress`, `filter: string`, `onFilterChange: (f: string) => void`

- [ ] **Step 2: Create AqueductCanvas**

Main React Flow canvas component:
- Receives `project`, `tableMappings`, `sourceFields` (from scan profile), `cdmSchema` (from static definition)
- Builds source nodes from scan data (group by table_name from field profiles)
- Builds CDM nodes from static schema (grouped by domain)
- Builds edges from table mappings
- Uses `computeLayout()` from aqueduct-layout.ts for positioning
- `onConnect` handler: calls `useCreateTableMapping` to create a new table mapping when user drags from source to CDM node
- Edge click: calls `onDrillDown(tableMappingId)` prop to navigate to field detail
- React Flow `Controls` (zoom, fit), `MiniMap`, `Background` (dots pattern)
- Filter logic: dims nodes/edges based on toolbar filter

Props: `project: EtlProject`, `scanProfile: PersistedProfile`, `onDrillDown: (mappingId: number) => void`

- [ ] **Step 3: TypeScript check + build**

Run: `cd frontend && npx tsc --noEmit && npx vite build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx frontend/src/features/etl/components/aqueduct/MappingToolbar.tsx
git commit -m "feat(aqueduct): add table overview canvas with React Flow"
```

---

### Task 12: Field Mapping Detail View

**Files:**
- Create: `frontend/src/features/etl/components/aqueduct/FieldMappingDetail.tsx`
- Create: `frontend/src/features/etl/components/aqueduct/FieldRow.tsx`
- Create: `frontend/src/features/etl/components/aqueduct/MappingTypeEditor.tsx`

- [ ] **Step 1: Create FieldRow**

Single column row used in both source and CDM panels:
- Shows: column name, type badge (reuse existing `TypeBadge` from profiler-badges), metadata (null%, distinct count for source; required marker for CDM)
- Has a React Flow `Handle` on the appropriate side (right for source, left for CDM)
- Props: `column: { name: string; type: string; required?: boolean; nullPct?: number; distinctCount?: number }; side: 'source' | 'target'; isMapped: boolean`

- [ ] **Step 2: Create MappingTypeEditor**

Inline editor shown when a field mapping edge is selected:
- Mapping type dropdown: direct | transform | lookup | constant | concat | expression
- Logic text area
- Review toggle checkbox
- Confidence badge (read-only, shown if `isAiSuggested`)
- Auto-saves on change (calls parent's onChange handler, which debounces to API)

Props: `mapping: EtlFieldMapping; onChange: (updates: Partial<EtlFieldMapping>) => void`

- [ ] **Step 3: Create FieldMappingDetail**

Split-panel view for field-level mapping:
- Left panel (35%): source columns from scan data for the source table in this mapping
- Center (30%): React Flow mini-canvas with field-to-field edges
- Right panel (35%): CDM target columns from static schema for the target table
- Selected edge shows `MappingTypeEditor` below the canvas
- Breadcrumb: `Project > source_table → target_table`
- Back button, Previous/Next navigation
- Auto-save: debounce 500ms, calls `useBulkUpsertFields` with optimistic locking

Props: `project: EtlProject; tableMapping: EtlTableMapping; scanProfile: PersistedProfile; onBack: () => void; onNavigate: (mappingId: number) => void`

**Note:** `ConceptSearchInline.tsx` (inline Hecate vocabulary search for `*_concept_id` columns) is deferred to Phase 2 per spec section 2.3. In Phase 1, the `MappingTypeEditor` shows mapping type + logic + review toggle but no live concept search.

- [ ] **Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/FieldMappingDetail.tsx frontend/src/features/etl/components/aqueduct/FieldRow.tsx frontend/src/features/etl/components/aqueduct/MappingTypeEditor.tsx
git commit -m "feat(aqueduct): add field-level mapping detail view with auto-save"
```

---

### Task 13: ETL Tools Page Restructure

**Files:**
- Modify: `frontend/src/features/etl/pages/EtlToolsPage.tsx` (866 lines — heavy modification)
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Restructure EtlToolsPage**

This is the biggest single change. The 866-line 3-tab page becomes a 2-step stepper:

Key changes:
1. Remove FHIR tab and Synthea tab entirely
2. Replace tab navigation with a 2-step stepper: "1. Source Profile" / "2. ETL Mapping"
3. Step 1 renders `SourceProfilerPage` content (import and render the existing page component inline, or refactor it into a reusable component)
4. Step 2 renders the Aqueduct flow:
   - If no project exists for this source: "Create mapping project" button
   - If project exists: render `AqueductCanvas` (table overview) or `FieldMappingDetail` (when drilled down)
5. State: `activeStep` (1 or 2), `selectedProjectId`, `drilledDownMappingId` (null for overview, number for field detail)
6. URL query param: `?step=profiler` selects Step 1, `?step=mapping` selects Step 2
7. "Start mapping →" button in Step 1 transitions to Step 2

Since the existing file is 866 lines and being heavily restructured, this is effectively a rewrite. The existing Synthea/FHIR functionality is removed (Synthea moves to Workbench later; FHIR has its own page). The Source Profiler content can be imported from the existing `SourceProfilerPage` component.

- [ ] **Step 2: Update router**

In `frontend/src/app/router.tsx`, change the `/source-profiler` route to redirect to `/etl-tools?step=profiler`:

```typescript
{
    path: "source-profiler",
    lazy: () =>
      import("@/features/etl/pages/EtlToolsPage").then((m) => ({
        Component: m.default,
      })),
},
```

This makes both `/source-profiler` and `/etl-tools` render the same component. The `EtlToolsPage` component should check `location.pathname` — if the path is `/source-profiler`, default to Step 1 regardless of query params. Alternatively, use a redirect route: `{ path: "source-profiler", element: <Navigate to="/etl-tools?step=profiler" replace /> }`.

- [ ] **Step 3: TypeScript check + build**

Run: `cd frontend && npx tsc --noEmit && npx vite build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/etl/pages/EtlToolsPage.tsx frontend/src/app/router.tsx
git commit -m "feat(aqueduct): restructure ETL Tools as 2-step pipeline (Source Profiler → Aqueduct)"
```

---

### Task 14: Deploy + Verify

- [ ] **Step 1: Run linters**

```bash
cd backend && vendor/bin/pint --test
cd backend && vendor/bin/phpstan analyse
cd frontend && npx tsc --noEmit
cd frontend && npx eslint .
```

- [ ] **Step 2: Deploy**

```bash
./deploy.sh
```

- [ ] **Step 3: End-to-end verification**

1. Navigate to ETL Tools page — verify 2-step stepper layout
2. Step 1: Source Profiler works (scan, history, CDM context, PII, comparison, FK graph)
3. Select a source with scan data → "Start mapping →" button appears
4. Click → Step 2 opens. "Create mapping project" button shown.
5. Create project → React Flow canvas appears with source tables (left) and CDM tables (right)
6. Drag from a source table to a CDM table → connection created, edge appears with "0/N fields mapped"
7. Click the edge → drills into field-level detail view
8. Map a source field to a CDM field → auto-saves
9. Back to overview → edge shows "1/N fields mapped"
10. Navigate to `/source-profiler` → redirects to ETL Tools Step 1
11. Test RBAC: viewer role can view but not create projects

- [ ] **Step 4: Devlog + commit + push**

```bash
git add docs/devlog/
git commit -m "docs: add Aqueduct Phase 1 implementation devlog"
git push origin main
```
