# Evidence Investigation Phase 1a — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Investigation model, Evidence Board shell (left rail, context bar, focus panel, sidebar), Concept Explorer, evidence pin system, and basic Synthesis shell — the architectural foundation for the full Evidence Investigation platform.

**Architecture:** New `app.investigations` and `app.evidence_pins` tables with Laravel Eloquent models, a RESTful API behind Sanctum auth, and a React feature module at `frontend/src/features/investigation/` using the focus+context Evidence Board layout. The Concept Explorer queries existing OMOP vocabulary tables via a new `ConceptSearchService`. State is server-persisted (JSONB columns), not browser state.

**Tech Stack:** Laravel 11 / PHP 8.4 (backend), React 19 / TypeScript / Tailwind 4 (frontend), PostgreSQL JSONB, TanStack Query, Zustand, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-20-finngen-evidence-investigation-design.md`

---

## File Structure

### Backend — New Files

| File | Responsibility |
|------|---------------|
| `backend/database/migrations/2026_03_20_000001_create_investigations_table.php` | Investigation table schema |
| `backend/database/migrations/2026_03_20_000002_create_evidence_pins_table.php` | Evidence pins table schema |
| `backend/database/migrations/2026_03_20_000003_add_investigation_id_to_finngen_runs.php` | FK from finngen_runs → investigations |
| `backend/database/migrations/2026_03_20_000004_add_workbench_mode_to_users.php` | User workbench_mode preference |
| `backend/app/Models/App/Investigation.php` | Eloquent model |
| `backend/app/Models/App/EvidencePin.php` | Eloquent model |
| `backend/app/Services/Investigation/InvestigationService.php` | CRUD + state save logic |
| `backend/app/Services/Investigation/EvidencePinService.php` | Pin CRUD + cross-link resolution |
| `backend/app/Services/Investigation/ConceptSearchService.php` | OMOP vocabulary search (type-ahead, hierarchy, counts) |
| `backend/app/Http/Controllers/Api/V1/InvestigationController.php` | Investigation REST endpoints |
| `backend/app/Http/Controllers/Api/V1/EvidencePinController.php` | Pin REST endpoints |
| `backend/app/Http/Controllers/Api/V1/ConceptExplorerController.php` | Vocabulary search endpoints |
| `backend/app/Http/Requests/Investigation/StoreInvestigationRequest.php` | Create validation |
| `backend/app/Http/Requests/Investigation/UpdateInvestigationRequest.php` | Update validation |
| `backend/app/Http/Requests/Investigation/SaveDomainStateRequest.php` | Domain state save validation |
| `backend/app/Http/Requests/Investigation/StorePinRequest.php` | Pin create validation |
| `backend/app/Http/Requests/Investigation/UpdatePinRequest.php` | Pin update validation |
| `backend/tests/Feature/Api/V1/InvestigationCrudTest.php` | Investigation API tests |
| `backend/tests/Feature/Api/V1/EvidencePinTest.php` | Pin API tests |
| `backend/tests/Feature/Api/V1/ConceptExplorerTest.php` | Concept search tests |

### Backend — Modified Files

| File | Changes |
|------|---------|
| `backend/routes/api.php` | Add investigation, pin, and concept-explorer route groups |
| `backend/app/Models/App/FinnGenRun.php` | Add `investigation()` BelongsTo relationship |
| `backend/app/Models/User.php` | Add `workbench_mode` to fillable/casts, add `investigations()` HasMany |

### Frontend — New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/investigation/types.ts` | Investigation, EvidencePin, domain state interfaces |
| `frontend/src/features/investigation/api.ts` | API functions for investigations, pins, concept search |
| `frontend/src/features/investigation/hooks/useInvestigation.ts` | TanStack Query hooks for investigation CRUD |
| `frontend/src/features/investigation/hooks/useEvidencePins.ts` | TanStack Query hooks for pins |
| `frontend/src/features/investigation/hooks/useConceptSearch.ts` | TanStack Query hook for concept type-ahead |
| `frontend/src/features/investigation/stores/investigationStore.ts` | Zustand store for active investigation UI state (active domain, sidebar open, etc.) |
| `frontend/src/features/investigation/pages/InvestigationPage.tsx` | Evidence Board page (the main shell) |
| `frontend/src/features/investigation/pages/NewInvestigationPage.tsx` | Create investigation page (title + question entry) |
| `frontend/src/features/investigation/components/EvidenceBoard.tsx` | Board layout: left rail + context bar + focus panel + sidebar |
| `frontend/src/features/investigation/components/LeftRail.tsx` | Vertical domain nav + pinned count + runs count |
| `frontend/src/features/investigation/components/ContextBar.tsx` | Horizontal summary cards for all 4 domains |
| `frontend/src/features/investigation/components/ContextCard.tsx` | Individual domain summary card |
| `frontend/src/features/investigation/components/EvidenceSidebar.tsx` | Collapsible right sidebar with pinned findings |
| `frontend/src/features/investigation/components/PinCard.tsx` | Individual pinned finding card |
| `frontend/src/features/investigation/components/DomainPlaceholder.tsx` | Placeholder panel for domains not yet built (Clinical, Genomic) |
| `frontend/src/features/investigation/components/SynthesisPanel.tsx` | Basic synthesis shell (section list with pins) |
| `frontend/src/features/investigation/components/phenotype/ConceptExplorer.tsx` | Type-ahead search + hierarchy browser + counts |
| `frontend/src/features/investigation/components/phenotype/ConceptTree.tsx` | Hierarchical concept tree with expand/collapse |
| `frontend/src/features/investigation/components/phenotype/ConceptSetBuilder.tsx` | Selected concepts panel with include/exclude descendants |
| `frontend/src/features/investigation/components/phenotype/PhenotypePanel.tsx` | Phenotype domain focus panel (sub-tab container) |

### Frontend — Modified Files

| File | Changes |
|------|---------|
| `frontend/src/app/router.tsx` | Add investigation routes under `/workbench/investigation/` |
| `frontend/src/features/workbench/toolsets.ts` | (No change — investigations are accessed via launcher, not as a toolset) |
| `frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx` | Add "Recent Investigations" section below toolset grid |

---

## Task Breakdown

### Task 1: Database migrations

**Files:**
- Create: `backend/database/migrations/2026_03_20_000001_create_investigations_table.php`
- Create: `backend/database/migrations/2026_03_20_000002_create_evidence_pins_table.php`
- Create: `backend/database/migrations/2026_03_20_000003_add_investigation_id_to_finngen_runs.php`
- Create: `backend/database/migrations/2026_03_20_000004_add_workbench_mode_to_users.php`

- [ ] **Step 1: Create investigations migration**

```bash
cd backend && php artisan make:migration create_investigations_table
```

Migration content:
```php
public function up(): void
{
    Schema::create('investigations', function (Blueprint $table) {
        $table->id();
        $table->string('title', 255);
        $table->text('research_question')->nullable();
        $table->string('status', 20)->default('draft');
        $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
        $table->jsonb('phenotype_state')->default('{}');
        $table->jsonb('clinical_state')->default('{}');
        $table->jsonb('genomic_state')->default('{}');
        $table->jsonb('synthesis_state')->default('{}');
        $table->timestamp('completed_at')->nullable();
        $table->foreignId('last_modified_by')->nullable()->constrained('users')->nullOnDelete();
        $table->timestamps();

        $table->index('owner_id');
        $table->index('status');
    });
}

public function down(): void
{
    Schema::dropIfExists('investigations');
}
```

- [ ] **Step 2: Create evidence_pins migration**

```bash
cd backend && php artisan make:migration create_evidence_pins_table
```

Migration content:
```php
public function up(): void
{
    Schema::create('evidence_pins', function (Blueprint $table) {
        $table->id();
        $table->foreignId('investigation_id')->constrained('investigations')->cascadeOnDelete();
        $table->string('domain', 20);
        $table->string('section', 40);
        $table->string('finding_type', 40);
        $table->jsonb('finding_payload');
        $table->integer('sort_order')->default(0);
        $table->boolean('is_key_finding')->default(false);
        $table->text('narrative_before')->nullable();
        $table->text('narrative_after')->nullable();
        $table->timestamps();

        $table->index('investigation_id');
        $table->index(['investigation_id', 'domain']);
        $table->index(['investigation_id', 'section']);
    });
}

public function down(): void
{
    Schema::dropIfExists('evidence_pins');
}
```

Note: `concept_ids` (integer[]) and `gene_symbols` (varchar[]) arrays will be added in Phase 3 when the cross-linking engine is built. For Phase 1a, pins are simple key-value findings.

- [ ] **Step 3: Create finngen_runs FK migration**

```bash
cd backend && php artisan make:migration add_investigation_id_to_finngen_runs
```

```php
public function up(): void
{
    Schema::table('finngen_runs', function (Blueprint $table) {
        $table->foreignId('investigation_id')->nullable()->constrained('investigations')->nullOnDelete();
        $table->index('investigation_id');
    });
}

public function down(): void
{
    Schema::table('finngen_runs', function (Blueprint $table) {
        $table->dropConstrainedForeignId('investigation_id');
    });
}
```

- [ ] **Step 4: Create users workbench_mode migration**

```bash
cd backend && php artisan make:migration add_workbench_mode_to_users
```

```php
public function up(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->string('workbench_mode', 10)->default('guided');
    });
}

public function down(): void
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropColumn('workbench_mode');
    });
}
```

- [ ] **Step 5: Run migrations against test database**

Run: `cd backend && php artisan migrate --database=testing`
Expected: All 4 migrations run successfully

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations/
git commit -m "feat(investigation): add investigations, evidence_pins, and supporting migrations"
```

---

### Task 2: Eloquent models

**Files:**
- Create: `backend/app/Models/App/Investigation.php`
- Create: `backend/app/Models/App/EvidencePin.php`
- Modify: `backend/app/Models/App/FinnGenRun.php`
- Modify: `backend/app/Models/User.php`

- [ ] **Step 1: Create Investigation model**

Create `backend/app/Models/App/Investigation.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Investigation extends Model
{
    protected $table = 'investigations';

    protected $fillable = [
        'title',
        'research_question',
        'status',
        'owner_id',
        'phenotype_state',
        'clinical_state',
        'genomic_state',
        'synthesis_state',
        'completed_at',
        'last_modified_by',
    ];

    protected $casts = [
        'phenotype_state' => 'array',
        'clinical_state' => 'array',
        'genomic_state' => 'array',
        'synthesis_state' => 'array',
        'completed_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /** @return BelongsTo<User, $this> */
    public function lastModifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_modified_by');
    }

    /** @return HasMany<EvidencePin, $this> */
    public function pins(): HasMany
    {
        return $this->hasMany(EvidencePin::class)->orderBy('sort_order');
    }

    /** @return HasMany<FinnGenRun, $this> */
    public function runs(): HasMany
    {
        return $this->hasMany(FinnGenRun::class);
    }
}
```

- [ ] **Step 2: Create EvidencePin model**

Create `backend/app/Models/App/EvidencePin.php`:

```php
<?php

declare(strict_types=1);

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EvidencePin extends Model
{
    protected $table = 'evidence_pins';

    protected $fillable = [
        'investigation_id',
        'domain',
        'section',
        'finding_type',
        'finding_payload',
        'sort_order',
        'is_key_finding',
        'narrative_before',
        'narrative_after',
    ];

    protected $casts = [
        'finding_payload' => 'array',
        'is_key_finding' => 'boolean',
        'sort_order' => 'integer',
    ];

    /** @return BelongsTo<Investigation, $this> */
    public function investigation(): BelongsTo
    {
        return $this->belongsTo(Investigation::class);
    }
}
```

- [ ] **Step 3: Add investigation relationship to FinnGenRun**

In `backend/app/Models/App/FinnGenRun.php`, add to the `$fillable` array:
```php
'investigation_id',
```

Add relationship method:
```php
/** @return BelongsTo<Investigation, $this> */
public function investigation(): BelongsTo
{
    return $this->belongsTo(Investigation::class);
}
```

Add to `$casts` if not present: the `investigation_id` does not need a cast (it's an integer FK).

- [ ] **Step 4: Add workbench_mode to User model**

In `backend/app/Models/User.php`, add `'workbench_mode'` to `$fillable`. Add to `$casts`:
```php
'workbench_mode' => 'string',
```

Add relationship:
```php
/** @return HasMany<Investigation, $this> */
public function investigations(): HasMany
{
    return $this->hasMany(Investigation::class, 'owner_id');
}
```

Add the `use` import for `HasMany` and `Investigation` if not already present.

- [ ] **Step 5: Verify PHPStan passes**

Run: `cd backend && vendor/bin/phpstan analyse app/Models/App/Investigation.php app/Models/App/EvidencePin.php`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add backend/app/Models/
git commit -m "feat(investigation): add Investigation and EvidencePin Eloquent models"
```

---

### Task 3: Form Requests

**Files:**
- Create: `backend/app/Http/Requests/Investigation/StoreInvestigationRequest.php`
- Create: `backend/app/Http/Requests/Investigation/UpdateInvestigationRequest.php`
- Create: `backend/app/Http/Requests/Investigation/SaveDomainStateRequest.php`
- Create: `backend/app/Http/Requests/Investigation/StorePinRequest.php`
- Create: `backend/app/Http/Requests/Investigation/UpdatePinRequest.php`

- [ ] **Step 1: Create the Requests directory and StoreInvestigationRequest**

```bash
mkdir -p backend/app/Http/Requests/Investigation
```

Create `backend/app/Http/Requests/Investigation/StoreInvestigationRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;

class StoreInvestigationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'research_question' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
```

- [ ] **Step 2: Create UpdateInvestigationRequest**

Create `backend/app/Http/Requests/Investigation/UpdateInvestigationRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInvestigationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'string', 'max:255'],
            'research_question' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(['draft', 'active', 'complete', 'archived'])],
        ];
    }
}
```

- [ ] **Step 3: Create SaveDomainStateRequest**

Create `backend/app/Http/Requests/Investigation/SaveDomainStateRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveDomainStateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'state' => ['required', 'array'],
        ];
    }
}
```

- [ ] **Step 4: Create StorePinRequest and UpdatePinRequest**

Create `backend/app/Http/Requests/Investigation/StorePinRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'domain' => ['required', Rule::in(['phenotype', 'clinical', 'genomic'])],
            'section' => ['required', Rule::in([
                'phenotype_definition', 'population', 'clinical_evidence',
                'genomic_evidence', 'synthesis', 'limitations', 'methods',
            ])],
            'finding_type' => ['required', Rule::in([
                'cohort_summary', 'hazard_ratio', 'incidence_rate', 'kaplan_meier',
                'codewas_hit', 'gwas_locus', 'colocalization', 'open_targets_association',
                'prediction_model', 'custom',
            ])],
            'finding_payload' => ['required', 'array'],
            'is_key_finding' => ['sometimes', 'boolean'],
        ];
    }
}
```

Create `backend/app/Http/Requests/Investigation/UpdatePinRequest.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests\Investigation;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_key_finding' => ['sometimes', 'boolean'],
            'narrative_before' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'narrative_after' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'section' => ['sometimes', 'string'],
        ];
    }
}
```

- [ ] **Step 5: Verify PHPStan passes**

Run: `cd backend && vendor/bin/phpstan analyse app/Http/Requests/Investigation/`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Requests/Investigation/
git commit -m "feat(investigation): add Form Request validation classes"
```

---

### Task 4: Services

**Files:**
- Create: `backend/app/Services/Investigation/InvestigationService.php`
- Create: `backend/app/Services/Investigation/EvidencePinService.php`

- [ ] **Step 1: Create InvestigationService**

```bash
mkdir -p backend/app/Services/Investigation
```

Create `backend/app/Services/Investigation/InvestigationService.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Investigation;

use App\Models\App\Investigation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class InvestigationService
{
    /** @return LengthAwarePaginator<Investigation> */
    public function listForUser(int $userId, ?string $status = null, int $perPage = 20): LengthAwarePaginator
    {
        $query = Investigation::where('owner_id', $userId)
            ->orderByDesc('updated_at');

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->paginate($perPage);
    }

    /** @param array<string, mixed> $data */
    public function create(int $userId, array $data): Investigation
    {
        return Investigation::create([
            'title' => $data['title'],
            'research_question' => $data['research_question'] ?? null,
            'status' => 'draft',
            'owner_id' => $userId,
            'phenotype_state' => [],
            'clinical_state' => [],
            'genomic_state' => [],
            'synthesis_state' => [],
        ]);
    }

    /** @param array<string, mixed> $data */
    public function update(Investigation $investigation, array $data, int $userId): Investigation
    {
        $updateData = array_filter($data, fn ($v) => $v !== null);
        $updateData['last_modified_by'] = $userId;

        if (isset($updateData['status']) && $updateData['status'] === 'complete') {
            $updateData['completed_at'] = now();
        }

        $investigation->update($updateData);

        return $investigation->fresh() ?? $investigation;
    }

    /** @param array<string, mixed> $state */
    public function saveDomainState(Investigation $investigation, string $domain, array $state, int $userId): Investigation
    {
        $column = $domain . '_state';

        $investigation->update([
            $column => $state,
            'last_modified_by' => $userId,
        ]);

        if ($investigation->status === 'draft') {
            $investigation->update(['status' => 'active']);
        }

        return $investigation->fresh() ?? $investigation;
    }

    public function delete(Investigation $investigation): void
    {
        $investigation->update(['status' => 'archived']);
    }
}
```

- [ ] **Step 2: Create EvidencePinService**

Create `backend/app/Services/Investigation/EvidencePinService.php`:

```php
<?php

declare(strict_types=1);

namespace App\Services\Investigation;

use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use Illuminate\Database\Eloquent\Collection;

class EvidencePinService
{
    /** @return Collection<int, EvidencePin> */
    public function listForInvestigation(int $investigationId): Collection
    {
        return EvidencePin::where('investigation_id', $investigationId)
            ->orderBy('section')
            ->orderBy('sort_order')
            ->get();
    }

    /** @param array<string, mixed> $data */
    public function create(Investigation $investigation, array $data): EvidencePin
    {
        $maxOrder = EvidencePin::where('investigation_id', $investigation->id)
            ->where('section', $data['section'])
            ->max('sort_order') ?? -1;

        return EvidencePin::create([
            'investigation_id' => $investigation->id,
            'domain' => $data['domain'],
            'section' => $data['section'],
            'finding_type' => $data['finding_type'],
            'finding_payload' => $data['finding_payload'],
            'sort_order' => $maxOrder + 1,
            'is_key_finding' => $data['is_key_finding'] ?? false,
        ]);
    }

    /** @param array<string, mixed> $data */
    public function update(EvidencePin $pin, array $data): EvidencePin
    {
        $pin->update(array_filter($data, fn ($v) => $v !== null));

        return $pin->fresh() ?? $pin;
    }

    public function delete(EvidencePin $pin): void
    {
        $pin->delete();
    }
}
```

- [ ] **Step 3: Verify PHPStan passes**

Run: `cd backend && vendor/bin/phpstan analyse app/Services/Investigation/`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/Investigation/
git commit -m "feat(investigation): add InvestigationService and EvidencePinService"
```

---

### Task 5: Controllers + Routes

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/InvestigationController.php`
- Create: `backend/app/Http/Controllers/Api/V1/EvidencePinController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create InvestigationController**

Create `backend/app/Http/Controllers/Api/V1/InvestigationController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Investigation\SaveDomainStateRequest;
use App\Http\Requests\Investigation\StoreInvestigationRequest;
use App\Http\Requests\Investigation\UpdateInvestigationRequest;
use App\Models\App\Investigation;
use App\Services\Investigation\InvestigationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InvestigationController extends Controller
{
    public function __construct(
        private readonly InvestigationService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $status = $request->query('status');

        $paginated = $this->service->listForUser(
            $user->id,
            is_string($status) ? $status : null,
        );

        return response()->json([
            'data' => $paginated->items(),
            'total' => $paginated->total(),
            'current_page' => $paginated->currentPage(),
            'per_page' => $paginated->perPage(),
            'last_page' => $paginated->lastPage(),
        ]);
    }

    public function store(StoreInvestigationRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $investigation = $this->service->create($user->id, $request->validated());

        return response()->json($investigation, 201);
    }

    public function show(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $investigation->load(['pins', 'owner:id,name']);

        return response()->json(['data' => $investigation]);
    }

    public function update(UpdateInvestigationRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $updated = $this->service->update($investigation, $request->validated(), $user->id);

        return response()->json(['data' => $updated]);
    }

    public function destroy(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $this->service->delete($investigation);

        return response()->json(null, 204);
    }

    public function saveDomainState(SaveDomainStateRequest $request, Investigation $investigation, string $domain): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $validDomains = ['phenotype', 'clinical', 'genomic', 'synthesis'];
        if (! in_array($domain, $validDomains, true)) {
            return response()->json(['error' => 'Invalid domain: ' . $domain], 422);
        }

        $updated = $this->service->saveDomainState(
            $investigation,
            $domain,
            $request->validated()['state'],
            $user->id,
        );

        return response()->json([
            'data' => [
                'saved_at' => $updated->updated_at,
                'domain' => $domain,
            ],
        ]);
    }
}
```

- [ ] **Step 2: Create EvidencePinController**

Create `backend/app/Http/Controllers/Api/V1/EvidencePinController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Investigation\StorePinRequest;
use App\Http\Requests\Investigation\UpdatePinRequest;
use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use App\Services\Investigation\EvidencePinService;
use Illuminate\Http\JsonResponse;

class EvidencePinController extends Controller
{
    public function __construct(
        private readonly EvidencePinService $service,
    ) {}

    public function index(Request $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $pins = $this->service->listForInvestigation($investigation->id);

        return response()->json(['data' => $pins]);
    }

    public function store(StorePinRequest $request, Investigation $investigation): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $pin = $this->service->create($investigation, $request->validated());

        return response()->json($pin, 201);
    }

    public function update(UpdatePinRequest $request, Investigation $investigation, EvidencePin $pin): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id || $pin->investigation_id !== $investigation->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $updated = $this->service->update($pin, $request->validated());

        return response()->json(['data' => $updated]);
    }

    public function destroy(Request $request, Investigation $investigation, EvidencePin $pin): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if ($investigation->owner_id !== $user->id || $pin->investigation_id !== $investigation->id) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $this->service->delete($pin);

        return response()->json(null, 204);
    }
}
```

- [ ] **Step 3: Register routes in api.php**

In `backend/routes/api.php`, add the `use` imports at the top:
```php
use App\Http\Controllers\Api\V1\InvestigationController;
use App\Http\Controllers\Api\V1\EvidencePinController;
```

Add the route group inside the existing `auth:sanctum` middleware group:
```php
// ── Evidence Investigations ──────────────────────────────────────────
Route::prefix('investigations')->group(function () {
    Route::get('/', [InvestigationController::class, 'index']);
    Route::post('/', [InvestigationController::class, 'store']);
    Route::get('/{investigation}', [InvestigationController::class, 'show']);
    Route::patch('/{investigation}', [InvestigationController::class, 'update']);
    Route::delete('/{investigation}', [InvestigationController::class, 'destroy']);
    Route::patch('/{investigation}/state/{domain}', [InvestigationController::class, 'saveDomainState']);

    // Evidence Pins
    Route::get('/{investigation}/pins', [EvidencePinController::class, 'index']);
    Route::post('/{investigation}/pins', [EvidencePinController::class, 'store']);
    Route::patch('/{investigation}/pins/{pin}', [EvidencePinController::class, 'update']);
    Route::delete('/{investigation}/pins/{pin}', [EvidencePinController::class, 'destroy']);
});
```

- [ ] **Step 4: Verify PHPStan passes**

Run: `cd backend && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/InvestigationController.php app/Http/Controllers/Api/V1/EvidencePinController.php`
Expected: No errors (or only pre-existing baseline errors)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/InvestigationController.php backend/app/Http/Controllers/Api/V1/EvidencePinController.php backend/routes/api.php
git commit -m "feat(investigation): add Investigation and EvidencePin controllers with routes"
```

---

### Task 6: Backend tests

**Files:**
- Create: `backend/tests/Feature/Api/V1/InvestigationCrudTest.php`
- Create: `backend/tests/Feature/Api/V1/EvidencePinTest.php`

- [ ] **Step 1: Create InvestigationCrudTest**

Create `backend/tests/Feature/Api/V1/InvestigationCrudTest.php`:

```php
<?php

use App\Models\App\Investigation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates an investigation', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/v1/investigations', [
        'title' => 'SGLT2i and CKD Progression',
        'research_question' => 'Does SGLT2 inhibition reduce CKD progression in T2DM?',
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('title', 'SGLT2i and CKD Progression');
    $response->assertJsonPath('status', 'draft');
    $this->assertDatabaseHas('investigations', ['title' => 'SGLT2i and CKD Progression']);
});

it('lists investigations for the authenticated user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    Investigation::create(['title' => 'Mine', 'owner_id' => $user->id, 'status' => 'draft']);
    Investigation::create(['title' => 'Theirs', 'owner_id' => $other->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->getJson('/api/v1/investigations');

    $response->assertStatus(200);
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.title', 'Mine');
});

it('shows a single investigation with pins', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}");

    $response->assertStatus(200);
    $response->assertJsonPath('data.title', 'Test');
    $response->assertJsonPath('data.pins', []);
});

it('updates investigation title and status', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Old', 'owner_id' => $user->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->patchJson("/api/v1/investigations/{$inv->id}", [
        'title' => 'New Title',
        'status' => 'active',
    ]);

    $response->assertStatus(200);
    $response->assertJsonPath('data.title', 'New Title');
    $response->assertJsonPath('data.status', 'active');
});

it('archives an investigation on delete', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'To Archive', 'owner_id' => $user->id, 'status' => 'active']);

    $response = $this->actingAs($user)->deleteJson("/api/v1/investigations/{$inv->id}");

    $response->assertStatus(204);
    $this->assertDatabaseHas('investigations', ['id' => $inv->id, 'status' => 'archived']);
});

it('saves domain state and transitions draft to active', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'draft']);

    $state = ['concept_sets' => [['id' => 'cs1', 'name' => 'T2DM', 'concepts' => []]]];

    $response = $this->actingAs($user)->patchJson(
        "/api/v1/investigations/{$inv->id}/state/phenotype",
        ['state' => $state],
    );

    $response->assertStatus(200);
    $response->assertJsonPath('data.domain', 'phenotype');

    $inv->refresh();
    expect($inv->status)->toBe('active');
    expect($inv->phenotype_state)->toHaveKey('concept_sets');
});

it('rejects invalid domain name', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'draft']);

    $response = $this->actingAs($user)->patchJson(
        "/api/v1/investigations/{$inv->id}/state/invalid_domain",
        ['state' => []],
    );

    $response->assertStatus(422);
});

it('requires authentication', function () {
    $response = $this->getJson('/api/v1/investigations');
    $response->assertStatus(401);
});

it('rejects access to another user investigation', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $inv = Investigation::create(['title' => 'Private', 'owner_id' => $owner->id, 'status' => 'draft']);

    $this->actingAs($other)->getJson("/api/v1/investigations/{$inv->id}")
        ->assertStatus(403);

    $this->actingAs($other)->patchJson("/api/v1/investigations/{$inv->id}", ['title' => 'Hacked'])
        ->assertStatus(403);

    $this->actingAs($other)->deleteJson("/api/v1/investigations/{$inv->id}")
        ->assertStatus(403);
});
```

- [ ] **Step 2: Create EvidencePinTest**

Create `backend/tests/Feature/Api/V1/EvidencePinTest.php`:

```php
<?php

use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a pin for an investigation', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $response = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['cohort_name' => 'T2DM', 'count' => 59226],
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('domain', 'phenotype');
    $this->assertDatabaseCount('evidence_pins', 1);
});

it('lists pins for an investigation', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response = $this->actingAs($user)->getJson("/api/v1/investigations/{$inv->id}/pins");

    $response->assertStatus(200);
    $response->assertJsonCount(1, 'data');
});

it('updates a pin', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);
    $pin = EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response = $this->actingAs($user)->patchJson(
        "/api/v1/investigations/{$inv->id}/pins/{$pin->id}",
        ['is_key_finding' => true, 'narrative_before' => 'This cohort represents...'],
    );

    $response->assertStatus(200);
    $response->assertJsonPath('data.is_key_finding', true);
});

it('deletes a pin', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);
    $pin = EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response = $this->actingAs($user)->deleteJson("/api/v1/investigations/{$inv->id}/pins/{$pin->id}");

    $response->assertStatus(204);
    $this->assertDatabaseCount('evidence_pins', 0);
});

it('rejects invalid domain', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $response = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'invalid',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'Test'],
    ]);

    $response->assertStatus(422);
});

it('auto-increments sort_order within a section', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'First'],
    ]);

    $response = $this->actingAs($user)->postJson("/api/v1/investigations/{$inv->id}/pins", [
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'codewas_hit',
        'finding_payload' => ['name' => 'Second'],
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('sort_order', 1);
});
```

- [ ] **Step 3: Run tests**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/InvestigationCrudTest.php tests/Feature/Api/V1/EvidencePinTest.php`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Feature/Api/V1/InvestigationCrudTest.php backend/tests/Feature/Api/V1/EvidencePinTest.php
git commit -m "test(investigation): add Investigation and EvidencePin API tests"
```

---

### Task 7: Frontend types and API client

**Files:**
- Create: `frontend/src/features/investigation/types.ts`
- Create: `frontend/src/features/investigation/api.ts`

- [ ] **Step 1: Create the investigation feature directory and install charting libraries**

```bash
mkdir -p frontend/src/features/investigation/{pages,components/phenotype,hooks,stores}
cd frontend && npm install d3 recharts --legacy-peer-deps && npm install --save-dev @types/d3 --legacy-peer-deps
```

D3 is used for custom genomic/clinical visualizations (Manhattan plots, volcano plots, locus zoom in later phases). Recharts is used for standard statistical charts (KM curves, forest plots, bar charts). Both must be present from Phase 1a so the Concept Explorer can render the schema density heatmap stub and later phases don't face integration friction.

- [ ] **Step 2: Create types.ts**

Create `frontend/src/features/investigation/types.ts` — contains all TypeScript interfaces matching the spec's domain state shapes and API response types. Include: `Investigation`, `EvidencePin`, `PhenotypeState`, `ClinicalState`, `GenomicState`, `SynthesisState`, `InvestigationStatus`, `EvidenceDomain`, `FindingType`, `PinSection`, and the paginated response type.

- [ ] **Step 3: Create api.ts**

Create `frontend/src/features/investigation/api.ts` — async functions wrapping `apiClient` calls for:
- `fetchInvestigations(status?)` → `GET /investigations`
- `fetchInvestigation(id)` → `GET /investigations/{id}`
- `createInvestigation(data)` → `POST /investigations`
- `updateInvestigation(id, data)` → `PATCH /investigations/{id}`
- `deleteInvestigation(id)` → `DELETE /investigations/{id}`
- `saveDomainState(id, domain, state)` → `PATCH /investigations/{id}/state/{domain}`
- `fetchPins(investigationId)` → `GET /investigations/{id}/pins`
- `createPin(investigationId, data)` → `POST /investigations/{id}/pins`
- `updatePin(investigationId, pinId, data)` → `PATCH /investigations/{id}/pins/{pinId}`
- `deletePin(investigationId, pinId)` → `DELETE /investigations/{id}/pins/{pinId}`

Follow the exact pattern from `frontend/src/features/finngen/api.ts`: import `apiClient`, return `response.data.data ?? response.data`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/types.ts frontend/src/features/investigation/api.ts
git commit -m "feat(investigation): add frontend TypeScript types and API client"
```

---

### Task 8: TanStack Query hooks and Zustand store

**Files:**
- Create: `frontend/src/features/investigation/hooks/useInvestigation.ts`
- Create: `frontend/src/features/investigation/hooks/useEvidencePins.ts`
- Create: `frontend/src/features/investigation/stores/investigationStore.ts`

- [ ] **Step 1: Create useInvestigation hook**

Create TanStack Query hooks for investigation CRUD:
- `useInvestigations(status?)` — `useQuery` with key `["investigations", status]`
- `useInvestigation(id)` — `useQuery` with key `["investigation", id]`, enabled when id is truthy
- `useCreateInvestigation()` — `useMutation` that invalidates `["investigations"]`
- `useUpdateInvestigation()` — `useMutation` that invalidates both list and detail
- `useSaveDomainState()` — `useMutation` for domain state saves, invalidates detail

- [ ] **Step 2: Create useEvidencePins hook**

Create TanStack Query hooks:
- `useEvidencePins(investigationId)` — `useQuery` with key `["investigation-pins", id]`
- `useCreatePin()` — `useMutation` invalidating pins list
- `useUpdatePin()` — `useMutation` invalidating pins list
- `useDeletePin()` — `useMutation` invalidating pins list

- [ ] **Step 3: Create investigationStore**

Create Zustand store for UI-only state (not persisted to server):
```typescript
interface InvestigationUiState {
  activeDomain: EvidenceDomain;
  sidebarOpen: boolean;
  setActiveDomain: (domain: EvidenceDomain) => void;
  toggleSidebar: () => void;
}
```

Use `create<InvestigationUiState>()((set) => ({...}))` — no `persist` middleware (this is ephemeral UI state).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/hooks/ frontend/src/features/investigation/stores/
git commit -m "feat(investigation): add TanStack Query hooks and Zustand UI store"
```

---

### Task 9: Evidence Board shell components

**Files:**
- Create: `frontend/src/features/investigation/components/LeftRail.tsx`
- Create: `frontend/src/features/investigation/components/ContextCard.tsx`
- Create: `frontend/src/features/investigation/components/ContextBar.tsx`
- Create: `frontend/src/features/investigation/components/PinCard.tsx`
- Create: `frontend/src/features/investigation/components/EvidenceSidebar.tsx`
- Create: `frontend/src/features/investigation/components/DomainPlaceholder.tsx`
- Create: `frontend/src/features/investigation/components/EvidenceBoard.tsx`

- [ ] **Step 1: Create LeftRail**

Vertical navigation showing 4 domain items (Phenotype, Clinical, Genomic, Synthesis) with icons, active indicator, and counts for Pinned and Runs. Uses `investigationStore.activeDomain` for highlight. Clicking a domain calls `setActiveDomain`. Uses Lucide icons: `Microscope` (Phenotype), `Activity` (Clinical), `Dna` (Genomic), `FileText` (Synthesis), `Pin` (Pinned), `Play` (Runs).

- [ ] **Step 2: Create ContextCard**

A compact summary card for a single domain. Props: `domain`, `label`, `summary` (key metric string), `isActive`, `onClick`. Dark clinical theme: active gets accent border, inactive is zinc-800. Clicking switches focus.

- [ ] **Step 3: Create ContextBar**

Horizontal row of 4 `ContextCard` components. Receives the investigation data and derives summary strings per domain (e.g., phenotype: "n=59,226", clinical: "3 analyses", genomic: "—", synthesis: "2/8 pinned").

- [ ] **Step 4: Create PinCard and EvidenceSidebar**

`PinCard`: renders a single pinned finding — shows `finding_type` badge, a summary extracted from `finding_payload`, key-finding star indicator, and a delete button.

`EvidenceSidebar`: collapsible right panel showing all pins grouped by section. Uses `useEvidencePins` hook. Toggle controlled by `investigationStore.sidebarOpen`.

- [ ] **Step 5: Create DomainPlaceholder**

A simple centered placeholder panel for domains not yet built: "Clinical Evidence — Coming in Phase 2" / "Genomic Evidence — Coming in Phase 3". Uses the domain's accent color and icon.

- [ ] **Step 6: Create EvidenceBoard**

The main layout component. Composes: `LeftRail` (left), `ContextBar` (top), focus panel (center, conditionally renders the active domain's panel), `EvidenceSidebar` (right). Layout uses CSS grid:
```
grid-template-columns: 200px 1fr auto;
grid-template-rows: auto 1fr;
```

The focus panel renders based on `activeDomain`:
- `phenotype` → `PhenotypePanel` (Task 10)
- `clinical` → `DomainPlaceholder`
- `genomic` → `DomainPlaceholder`
- `synthesis` → `SynthesisPanel` (Task 11)

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/investigation/components/
git commit -m "feat(investigation): add Evidence Board shell components (LeftRail, ContextBar, Sidebar)"
```

---

### Task 10: Concept Explorer (Phenotype domain)

**Files:**
- Create: `backend/app/Services/Investigation/ConceptSearchService.php`
- Create: `backend/app/Http/Controllers/Api/V1/ConceptExplorerController.php`
- Modify: `backend/routes/api.php` (add concept-explorer routes)
- Create: `frontend/src/features/investigation/hooks/useConceptSearch.ts`
- Create: `frontend/src/features/investigation/components/phenotype/ConceptExplorer.tsx`
- Create: `frontend/src/features/investigation/components/phenotype/ConceptTree.tsx`
- Create: `frontend/src/features/investigation/components/phenotype/ConceptSetBuilder.tsx`
- Create: `frontend/src/features/investigation/components/phenotype/PhenotypePanel.tsx`

- [ ] **Step 1: Create ConceptSearchService**

Create `backend/app/Services/Investigation/ConceptSearchService.php`:

Queries the `omop.concept` table using `DB::connection('omop')` explicitly (never the default `pgsql` connection). Methods:

- `search(string $term, ?string $domain, int $limit)` — `WHERE concept_name ILIKE '%term%'` with optional domain filter, returns `concept_id, concept_name, domain_id, vocabulary_id, concept_class_id, standard_concept, concept_code`, limited to `$limit` rows, ordered by relevance (exact match first, then starts-with, then contains)
- `hierarchy(int $conceptId)` — queries `omop.concept_ancestor` to get ancestor and descendant concepts for building the tree. Returns `{ ancestors: [...], descendants: [...] }` with concept details
- `patientCount(int $conceptId)` — queries the appropriate OMOP clinical table (condition_occurrence, drug_exposure, measurement, etc. based on domain) to get `COUNT(DISTINCT person_id)`. Results are cached in Redis with key `concept:count:{concept_id}` and 1-hour TTL using `Cache::remember()`.

All queries use `DB::connection('omop')` and parameterized binding (no raw string interpolation). The domain-to-table mapping uses a match expression: `condition` → `condition_occurrence`, `drug` → `drug_exposure`, `measurement` → `measurement`, etc.

- [ ] **Step 2: Create ConceptExplorerController**

Create `backend/app/Http/Controllers/Api/V1/ConceptExplorerController.php`:

```php
public function search(Request $request): JsonResponse  // GET /concept-explorer/search?q=...&domain=...&limit=25
public function hierarchy(int $conceptId): JsonResponse  // GET /concept-explorer/{conceptId}/hierarchy
public function patientCount(int $conceptId): JsonResponse  // GET /concept-explorer/{conceptId}/count
```

- [ ] **Step 3: Register concept-explorer routes**

In `backend/routes/api.php`, inside the `auth:sanctum` group:
```php
Route::prefix('concept-explorer')->group(function () {
    Route::get('/search', [ConceptExplorerController::class, 'search']);
    Route::get('/{conceptId}/hierarchy', [ConceptExplorerController::class, 'hierarchy']);
    Route::get('/{conceptId}/count', [ConceptExplorerController::class, 'patientCount']);
});
```

- [ ] **Step 4: Create useConceptSearch hook**

Create `frontend/src/features/investigation/hooks/useConceptSearch.ts`:
- `useConceptSearch(query, domain?)` — `useQuery` with key `["concept-search", query, domain]`, enabled when query.length >= 2, 500ms debounce via `staleTime`
- `useConceptHierarchy(conceptId)` — `useQuery` with key `["concept-hierarchy", conceptId]`
- `useConceptCount(conceptId)` — `useQuery` with key `["concept-count", conceptId]`

- [ ] **Step 5: Create ConceptExplorer component**

Type-ahead search input with debounced query. Shows results as a scrollable list of concept cards (concept_name, domain badge, vocabulary badge, concept_code). Clicking a concept shows its hierarchy and count. "Add to concept set" button on each result.

- [ ] **Step 6: Create ConceptTree component**

Renders a hierarchical tree of ancestor → selected concept → descendants. Each node shows concept name, level indicator, and expand/collapse toggle. Uses indentation to show depth.

- [ ] **Step 7: Create ConceptSetBuilder component**

Shows the currently selected concepts as a list of cards. Each card has:
- Concept name and ID
- "Include descendants" toggle
- "Exclude" toggle (for exclusion criteria)
- Remove button
- Patient count badge (loaded via `useConceptCount`)

- [ ] **Step 8: Create PhenotypePanel**

Container for the Phenotype domain focus panel. Has sub-tabs: "Explore" (ConceptExplorer), "Build" (placeholder for Phase 1b Cohort Builder), "Validate" (placeholder for Phase 1b CodeWAS). Only "Explore" is functional in Phase 1a.

- [ ] **Step 9: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add backend/app/Services/Investigation/ConceptSearchService.php backend/app/Http/Controllers/Api/V1/ConceptExplorerController.php backend/routes/api.php frontend/src/features/investigation/components/phenotype/ frontend/src/features/investigation/hooks/useConceptSearch.ts
git commit -m "feat(investigation): add Concept Explorer with vocabulary search, hierarchy, and patient counts"
```

---

### Task 11: Synthesis shell and pages

**Files:**
- Create: `frontend/src/features/investigation/components/SynthesisPanel.tsx`
- Create: `frontend/src/features/investigation/pages/InvestigationPage.tsx`
- Create: `frontend/src/features/investigation/pages/NewInvestigationPage.tsx`

- [ ] **Step 1: Create SynthesisPanel**

Basic synthesis shell showing the 8 dossier sections as a vertical list of cards:
1. Research Question, 2. Phenotype Definition, 3. Population Characteristics, 4. Clinical Evidence, 5. Genomic Evidence, 6. Evidence Synthesis, 7. Limitations & Caveats, 8. Methods

Each section card shows: section title, pin count badge, and a list of `PinCard` components for pins in that section. Research Question section shows the investigation's `research_question` field. Other sections show pins or an empty state ("No findings pinned yet").

- [ ] **Step 2: Create InvestigationPage**

The main route-level page. Receives `investigationId` from URL params. Loads the investigation via `useInvestigation(id)`. Renders `EvidenceBoard` with the loaded investigation data. Shows loading spinner while fetching. Shows 404 message if investigation not found.

This is a `default export` function component.

- [ ] **Step 3: Create NewInvestigationPage**

Simple form page: title input (required), research question textarea (optional), "Create Investigation" button. On submit, calls `useCreateInvestigation` mutation, then navigates to `/workbench/investigation/{id}`.

Dark clinical theme, centered card layout matching the Parthenon aesthetic.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/SynthesisPanel.tsx frontend/src/features/investigation/pages/
git commit -m "feat(investigation): add InvestigationPage, NewInvestigationPage, and SynthesisPanel"
```

---

### Task 12: Router integration and WorkbenchLauncher update

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx`

- [ ] **Step 1: Add investigation routes to router.tsx**

Inside the `workbench` children array (added in Task 6 of the previous plan), add:
```typescript
{
  path: "investigation/new",
  lazy: () =>
    import("@/features/investigation/pages/NewInvestigationPage").then(
      (m) => ({ Component: m.default }),
    ),
},
{
  path: "investigation/:investigationId",
  lazy: () =>
    import("@/features/investigation/pages/InvestigationPage").then(
      (m) => ({ Component: m.default }),
    ),
},
```

- [ ] **Step 2: Add "Recent Investigations" to WorkbenchLauncherPage**

Below the toolset grid and above the footer hint, add a "Recent Investigations" section:
- Uses `useInvestigations()` hook to fetch the user's investigations
- Shows up to 5 most recent as clickable cards (title, status badge, last updated timestamp)
- "New Investigation" button linking to `/workbench/investigation/new`
- If no investigations exist, show: "Start your first Evidence Investigation" with a create button

Import the necessary hooks and add the section to the JSX.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Verify frontend builds**

Run: `cd frontend && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds (or same pre-existing dist permissions issue)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx
git commit -m "feat(investigation): add investigation routes and Recent Investigations to launcher"
```

---

### Task 13: Full verification

- [ ] **Step 1: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run frontend ESLint**

Run: `cd frontend && npx eslint src/features/investigation/ src/features/workbench/ src/app/router.tsx`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run backend PHPStan**

Run: `cd backend && vendor/bin/phpstan analyse`
Expected: No new errors beyond pre-existing baseline

- [ ] **Step 4: Run backend Pint**

Run: `cd backend && vendor/bin/pint --test`
Expected: PASS (or only pre-existing failures in unrelated files)

- [ ] **Step 5: Run backend tests**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/InvestigationCrudTest.php tests/Feature/Api/V1/EvidencePinTest.php`
Expected: All tests pass

- [ ] **Step 6: Final commit if any lint fixes needed**

```bash
git add -A
git commit -m "chore: lint fixes after Evidence Investigation Phase 1a"
```
