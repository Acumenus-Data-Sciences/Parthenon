# CDM Source Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate cross-CDM data contamination with six layers of defense: request-scoped SourceContext, middleware enforcement, SourceAware trait, schema uniqueness validation, static analysis guards, and frontend global source context.

**Architecture:** A `SourceContext` singleton is populated per-request by `ResolveSourceContext` middleware (from route param or `X-Source-Id` header). It registers isolated database connections (`ctx_cdm`, `ctx_results`, `ctx_vocab`) with schema baked into config — no more `SET search_path` on shared connections. A `SourceAware` trait replaces all 144+ hardcoded `DB::connection()` calls. The frontend gets a global source store with Axios interceptor that injects `X-Source-Id` on every request.

**Tech Stack:** Laravel 11/PHP 8.4, React 19/TypeScript, Zustand, TanStack Query, PHPStan

**Spec:** `docs/superpowers/specs/2026-03-26-cdm-source-isolation-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/Context/SourceContext.php` | Request-scoped source + isolated connection registration |
| `backend/app/Context/NoSourceContextException.php` | Fail-fast exception when source is required but missing |
| `backend/app/Http/Middleware/ResolveSourceContext.php` | Resolve source from route param or X-Source-Id header |
| `backend/app/Http/Middleware/RequireSourceContext.php` | Reject requests that must have source but don't (422) |
| `backend/app/Concerns/SourceAware.php` | Trait providing `$this->cdm()`, `$this->results()`, `$this->vocab()` |
| `backend/app/Rules/UniqueDaimonSchema.php` | Validation rule: no duplicate CDM/Results schemas |
| `backend/app/Console/Commands/AuditSourceSchemas.php` | Detect existing schema conflicts |
| `backend/tests/Unit/Context/SourceContextTest.php` | Tests for SourceContext |
| `backend/tests/Unit/Middleware/ResolveSourceContextTest.php` | Tests for middleware |
| `backend/tests/Unit/Rules/UniqueDaimonSchemaTest.php` | Tests for schema uniqueness |
| `frontend/src/hooks/useSourceQuery.ts` | TanStack Query wrapper with automatic sourceId in key |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/Providers/AppServiceProvider.php` | Register scoped SourceContext singleton |
| `backend/bootstrap/app.php` | Register middleware aliases |
| `backend/routes/api.php` | Apply source.resolve to auth:sanctum groups |
| `backend/app/Models/Cdm/CdmModel.php` | Dynamic `getConnectionName()` |
| `backend/app/Models/Results/ResultsModel.php` | Dynamic `getConnectionName()` |
| `backend/app/Models/Vocabulary/VocabularyModel.php` | Dynamic `getConnectionName()` |
| `backend/app/Services/Achilles/AchillesResultReaderService.php` | Use SourceAware trait |
| `backend/app/Services/Achilles/AchillesEngineService.php` | Use SourceAware trait |
| `backend/app/Services/AI/AbbyAiService.php` | Use SourceAware trait |
| `backend/app/Services/Investigation/ConceptSearchService.php` | Use SourceAware trait |
| `backend/app/Services/Imaging/ImagingTimelineService.php` | Use SourceAware trait |
| `backend/app/Services/Imaging/ImagingAiService.php` | Use SourceAware trait |
| `backend/app/Services/Genomics/VariantOutcomeService.php` | Use SourceAware trait |
| `backend/app/Services/Genomics/TumorBoardService.php` | Use SourceAware trait |
| `backend/app/Services/Ingestion/CdmWriterService.php` | Use SourceAware trait |
| `backend/app/Services/Dqd/DqdEngineService.php` | Use SourceAware trait |
| `backend/app/Services/Fhir/VocabularyLookupService.php` | Use SourceAware trait |
| `backend/app/Http/Controllers/Api/V1/TextToSqlController.php` | Use SourceAware trait |
| `backend/app/Http/Controllers/Api/V1/AresController.php` | Use SourceAware trait |
| `frontend/src/stores/sourceStore.ts` | Expand to track activeSourceId + sources |
| `frontend/src/lib/api-client.ts` | Add X-Source-Id interceptor |
| `frontend/src/components/layout/Header.tsx` | Add global source selector |
| `frontend/src/features/dashboard/pages/DashboardPage.tsx` | Read from global source store |

---

## Task 1: SourceContext Value Object + Exception

**Files:**
- Create: `backend/app/Context/SourceContext.php`
- Create: `backend/app/Context/NoSourceContextException.php`
- Create: `backend/tests/Unit/Context/SourceContextTest.php`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Unit/Context/SourceContextTest.php`:

```php
<?php

namespace Tests\Unit\Context;

use App\Context\NoSourceContextException;
use App\Context\SourceContext;
use Tests\TestCase;

class SourceContextTest extends TestCase
{
    public function test_empty_context_has_null_source(): void
    {
        $ctx = new SourceContext();
        $this->assertNull($ctx->source);
        $this->assertNull($ctx->cdmSchema);
        $this->assertNull($ctx->resultsSchema);
        $this->assertNull($ctx->vocabSchema);
    }

    public function test_require_source_throws_when_empty(): void
    {
        $this->expectException(NoSourceContextException::class);
        $this->expectExceptionMessage('Source context required but not set');

        $ctx = new SourceContext();
        $ctx->requireSource();
    }

    public function test_cdm_connection_throws_when_no_source(): void
    {
        $this->expectException(NoSourceContextException::class);

        $ctx = new SourceContext();
        $ctx->cdmConnection();
    }

    public function test_results_connection_throws_when_no_source(): void
    {
        $this->expectException(NoSourceContextException::class);

        $ctx = new SourceContext();
        $ctx->resultsConnection();
    }

    public function test_vocab_connection_throws_when_no_source(): void
    {
        $this->expectException(NoSourceContextException::class);

        $ctx = new SourceContext();
        $ctx->vocabConnection();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Context/SourceContextTest.php`
Expected: FAIL — classes don't exist yet.

- [ ] **Step 3: Create NoSourceContextException**

Create `backend/app/Context/NoSourceContextException.php`:

```php
<?php

namespace App\Context;

use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class NoSourceContextException extends HttpException
{
    public function __construct(string $message = '')
    {
        parent::__construct(
            statusCode: 500,
            message: $message ?: 'Source context required but not set. '
                . 'Ensure this route uses ResolveSourceContext middleware '
                . 'or pass --source to the command.',
        );
    }
}
```

- [ ] **Step 4: Create SourceContext**

Create `backend/app/Context/SourceContext.php`:

```php
<?php

namespace App\Context;

use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SourceContext
{
    public function __construct(
        public readonly ?Source $source = null,
        public readonly ?string $cdmSchema = null,
        public readonly ?string $resultsSchema = null,
        public readonly ?string $vocabSchema = null,
    ) {}

    public function requireSource(): Source
    {
        if ($this->source === null) {
            throw new NoSourceContextException();
        }

        return $this->source;
    }

    public function cdmConnection(): string
    {
        $this->requireSource();

        return 'ctx_cdm';
    }

    public function resultsConnection(): string
    {
        $this->requireSource();

        return 'ctx_results';
    }

    public function vocabConnection(): string
    {
        $this->requireSource();

        return 'ctx_vocab';
    }

    /**
     * Build a SourceContext for a given source and register isolated connections.
     *
     * Used by middleware (HTTP requests) and jobs/commands (non-HTTP).
     */
    public static function forSource(Source $source): self
    {
        $source->loadMissing('daimons');

        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary);

        $ctx = new self(
            source: $source,
            cdmSchema: $cdmSchema,
            resultsSchema: $resultsSchema,
            vocabSchema: $vocabSchema,
        );

        $ctx->registerConnections($source);

        // Bind into container so services can resolve it
        app()->instance(self::class, $ctx);

        Log::withContext([
            'source_id' => $source->id,
            'source_name' => $source->source_name,
        ]);

        return $ctx;
    }

    /**
     * Register isolated database connections for this source's daimons.
     *
     * Instead of SET search_path on shared connections (which leaks in connection pools),
     * we register fresh named connections with the schema baked into config.
     */
    private function registerConnections(Source $source): void
    {
        if (! empty($source->db_host)) {
            $this->registerDynamicConnections($source);
        } else {
            $this->registerLocalConnections($source);
        }
    }

    /**
     * For sources with db_host: build a base connection config and register
     * three schema-specific variants.
     */
    private function registerDynamicConnections(Source $source): void
    {
        $baseConfig = $this->buildDynamicConfig($source);

        $this->registerConnection('ctx_cdm', $baseConfig, $this->cdmSchema);
        $this->registerConnection('ctx_results', $baseConfig, $this->resultsSchema);
        $this->registerConnection('ctx_vocab', $baseConfig, $this->vocabSchema);
    }

    /**
     * For local sources (no db_host): clone the source's named connection
     * with schema-specific search_path.
     */
    private function registerLocalConnections(Source $source): void
    {
        $connName = $source->source_connection ?? 'omop';
        $baseConfig = config("database.connections.{$connName}", []);

        $this->registerConnection('ctx_cdm', $baseConfig, $this->cdmSchema);
        $this->registerConnection('ctx_results', $baseConfig, $this->resultsSchema);
        $this->registerConnection('ctx_vocab', $baseConfig, $this->vocabSchema);
    }

    /**
     * Register a single isolated connection with schema baked into search_path.
     *
     * @param  array<string, mixed>  $baseConfig
     */
    private function registerConnection(string $name, array $baseConfig, ?string $schema): void
    {
        if ($schema === null) {
            // No daimon for this type — connection will throw on use via requireSource()
            return;
        }

        $config = array_merge($baseConfig, [
            'search_path' => "\"{$schema}\",public",
        ]);

        config(["database.connections.{$name}" => $config]);
        DB::purge($name);
    }

    /**
     * Build a base connection config for a dynamic (external) source.
     *
     * @return array<string, mixed>
     */
    private function buildDynamicConfig(Source $source): array
    {
        /** @var array<string, mixed> $opts */
        $opts = $source->db_options ?? [];

        return match ($source->source_dialect) {
            'postgresql', 'redshift' => [
                'driver' => 'pgsql',
                'host' => $source->db_host,
                'port' => $source->db_port ?? ($source->source_dialect === 'redshift' ? 5439 : 5432),
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => 'utf8',
                'prefix' => '',
                'schema' => 'public',
                'sslmode' => $opts['sslmode'] ?? 'prefer',
            ],
            default => [
                'driver' => 'pgsql',
                'host' => $source->db_host,
                'port' => $source->db_port ?? 5432,
                'database' => $source->db_database,
                'username' => $source->username,
                'password' => $source->password,
                'charset' => 'utf8',
                'prefix' => '',
                'schema' => 'public',
            ],
        };
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Context/SourceContextTest.php`
Expected: All 5 tests PASS.

- [ ] **Step 6: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Context/ tests/Unit/Context/"`

- [ ] **Step 7: Commit**

```bash
cd backend
git add app/Context/ tests/Unit/Context/
git commit -m "feat: add SourceContext value object with fail-fast guards"
```

---

## Task 2: ResolveSourceContext Middleware

**Files:**
- Create: `backend/app/Http/Middleware/ResolveSourceContext.php`
- Create: `backend/app/Http/Middleware/RequireSourceContext.php`
- Modify: `backend/bootstrap/app.php` (line 33-35, add aliases)
- Modify: `backend/app/Providers/AppServiceProvider.php` (line 85-86, register scoped singleton)
- Create: `backend/tests/Unit/Middleware/ResolveSourceContextTest.php`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Unit/Middleware/ResolveSourceContextTest.php`:

```php
<?php

namespace Tests\Unit\Middleware;

use App\Context\SourceContext;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ResolveSourceContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_middleware_resolves_source_from_header(): void
    {
        $source = Source::factory()->create(['source_connection' => 'omop']);
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => 'cdm',
            'table_qualifier' => 'test_cdm',
        ]);

        $user = \App\Models\User::factory()->create();
        $user->assignRole('super-admin');

        $response = $this->actingAs($user)
            ->withHeader('X-Source-Id', (string) $source->id)
            ->getJson('/api/v1/dashboard/stats');

        $response->assertOk();

        // Verify the context was populated
        $ctx = app(SourceContext::class);
        $this->assertNotNull($ctx->source);
        $this->assertEquals($source->id, $ctx->source->id);
    }

    public function test_middleware_allows_requests_without_source(): void
    {
        $user = \App\Models\User::factory()->create();
        $user->assignRole('super-admin');

        $response = $this->actingAs($user)->getJson('/api/v1/dashboard/stats');
        $response->assertOk();

        $ctx = app(SourceContext::class);
        $this->assertNull($ctx->source);
    }

    public function test_require_middleware_rejects_without_source(): void
    {
        $user = \App\Models\User::factory()->create();
        $user->assignRole('super-admin');

        // This endpoint is behind source.require — test by calling
        // an achilles endpoint without a valid source
        $response = $this->actingAs($user)
            ->getJson('/api/v1/sources/99999/achilles/record-counts');

        $response->assertStatus(404); // Source not found via model binding
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Middleware/ResolveSourceContextTest.php`
Expected: FAIL — middleware classes don't exist yet.

- [ ] **Step 3: Create ResolveSourceContext middleware**

Create `backend/app/Http/Middleware/ResolveSourceContext.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Context\SourceContext;
use App\Models\App\Source;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveSourceContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $source = $this->resolveSource($request);

        if ($source !== null) {
            SourceContext::forSource($source);
        }

        return $next($request);
    }

    private function resolveSource(Request $request): ?Source
    {
        // Priority 1: Route parameter {source} (implicit model binding)
        $routeSource = $request->route('source');
        if ($routeSource instanceof Source) {
            return $routeSource;
        }

        // Priority 2: X-Source-Id header
        $headerId = $request->header('X-Source-Id');
        if ($headerId !== null && is_numeric($headerId)) {
            return Source::with('daimons')->find((int) $headerId);
        }

        return null;
    }
}
```

- [ ] **Step 4: Create RequireSourceContext middleware**

Create `backend/app/Http/Middleware/RequireSourceContext.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Context\SourceContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireSourceContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $ctx = app(SourceContext::class);

        if ($ctx->source === null) {
            return response()->json([
                'message' => 'Source context required. Pass a source route parameter or X-Source-Id header.',
            ], 422);
        }

        return $next($request);
    }
}
```

- [ ] **Step 5: Register scoped singleton in AppServiceProvider**

In `backend/app/Providers/AppServiceProvider.php`, add at line 87 (inside `register()`):

```php
// Source context — request-scoped, populated by ResolveSourceContext middleware
$this->app->scoped(SourceContext::class, fn () => new SourceContext());
```

Add the import at the top of the file:
```php
use App\Context\SourceContext;
```

- [ ] **Step 6: Register middleware aliases in bootstrap/app.php**

In `backend/bootstrap/app.php`, add to the `$middleware->alias()` array (after line 35):

```php
'source.resolve' => \App\Http\Middleware\ResolveSourceContext::class,
'source.require' => \App\Http\Middleware\RequireSourceContext::class,
```

- [ ] **Step 7: Apply source.resolve to the main auth:sanctum group in routes/api.php**

In `backend/routes/api.php`, change line 143 from:

```php
Route::middleware('auth:sanctum')->group(function () {
```

to:

```php
Route::middleware(['auth:sanctum', 'source.resolve'])->group(function () {
```

Also apply `source.resolve` to the other `auth:sanctum` groups at lines 706, 1019, 1058, 1121, 1126, 1134, 1161, 1244, 1282, 1295, 1304, 1310, 1328, 1408, 1445. Each `middleware('auth:sanctum')` becomes `middleware(['auth:sanctum', 'source.resolve'])`.

**Exception:** The GIS import group at line 1226 already has array middleware — add `'source.resolve'` to its array.

- [ ] **Step 8: Run tests**

Run: `cd backend && vendor/bin/pest tests/Unit/Middleware/ResolveSourceContextTest.php`
Expected: All 3 tests PASS.

- [ ] **Step 9: Run Pint + PHPStan**

Run:
```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse --memory-limit=512M"
```

- [ ] **Step 10: Commit**

```bash
cd backend
git add app/Http/Middleware/ResolveSourceContext.php app/Http/Middleware/RequireSourceContext.php \
  app/Providers/AppServiceProvider.php bootstrap/app.php routes/api.php \
  tests/Unit/Middleware/
git commit -m "feat: add ResolveSourceContext and RequireSourceContext middleware"
```

---

## Task 3: SourceAware Trait

**Files:**
- Create: `backend/app/Concerns/SourceAware.php`

- [ ] **Step 1: Create the trait**

Create `backend/app/Concerns/SourceAware.php`:

```php
<?php

namespace App\Concerns;

use App\Context\SourceContext;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

/**
 * Provides source-aware database connection accessors.
 *
 * Use this trait in any service that needs to query CDM, Results, or Vocabulary
 * data. It replaces hardcoded DB::connection('omop') / DB::connection('results')
 * calls with context-aware methods that resolve from the request's SourceContext.
 */
trait SourceAware
{
    protected function cdm(): Connection
    {
        return DB::connection(app(SourceContext::class)->cdmConnection());
    }

    protected function results(): Connection
    {
        return DB::connection(app(SourceContext::class)->resultsConnection());
    }

    protected function vocab(): Connection
    {
        return DB::connection(app(SourceContext::class)->vocabConnection());
    }
}
```

- [ ] **Step 2: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Concerns/SourceAware.php"`

- [ ] **Step 3: Commit**

```bash
cd backend
git add app/Concerns/SourceAware.php
git commit -m "feat: add SourceAware trait for source-aware DB connections"
```

---

## Task 4: Dynamic Connection on Base Models

**Files:**
- Modify: `backend/app/Models/Cdm/CdmModel.php` (lines 3, 10)
- Modify: `backend/app/Models/Results/ResultsModel.php` (lines 3, 9)
- Modify: `backend/app/Models/Vocabulary/VocabularyModel.php` (lines 3, 9)

- [ ] **Step 1: Modify CdmModel**

In `backend/app/Models/Cdm/CdmModel.php`:

Remove the hardcoded connection line (line 10):
```php
protected $connection = 'omop';
```

Add the import and dynamic method:
```php
use App\Context\SourceContext;
```

Add after `public $timestamps = false;` (line 12):
```php
public function getConnectionName(): string
{
    $ctx = app(SourceContext::class);

    return $ctx->source !== null ? $ctx->cdmConnection() : 'omop';
}
```

- [ ] **Step 2: Modify ResultsModel**

In `backend/app/Models/Results/ResultsModel.php`:

Remove line 9:
```php
protected $connection = 'results';
```

Add import and dynamic method:
```php
use App\Context\SourceContext;
```

Add after `public $timestamps = false;`:
```php
public function getConnectionName(): string
{
    $ctx = app(SourceContext::class);

    return $ctx->source !== null ? $ctx->resultsConnection() : 'results';
}
```

- [ ] **Step 3: Modify VocabularyModel**

In `backend/app/Models/Vocabulary/VocabularyModel.php`:

Remove line 9:
```php
protected $connection = 'omop';
```

Add import and dynamic method:
```php
use App\Context\SourceContext;
```

Add after `public $timestamps = false;`:
```php
public function getConnectionName(): string
{
    $ctx = app(SourceContext::class);

    return $ctx->source !== null ? $ctx->vocabConnection() : 'omop';
}
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd backend && vendor/bin/pest --filter="Achilles|Vocabulary|Results" --stop-on-failure`

If no specific tests exist for these models, run the full suite:
Run: `cd backend && vendor/bin/pest --stop-on-failure`
Expected: All existing tests PASS (fallback to hardcoded connections in test context).

- [ ] **Step 5: Run Pint + PHPStan**

Run:
```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Models/Cdm/CdmModel.php app/Models/Results/ResultsModel.php app/Models/Vocabulary/VocabularyModel.php"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse --memory-limit=512M"
```

- [ ] **Step 6: Commit**

```bash
cd backend
git add app/Models/Cdm/CdmModel.php app/Models/Results/ResultsModel.php app/Models/Vocabulary/VocabularyModel.php
git commit -m "feat: dynamic connection resolution on CdmModel, ResultsModel, VocabularyModel"
```

---

## Task 5: Frontend Global Source Store + Axios Interceptor

**Files:**
- Modify: `frontend/src/stores/sourceStore.ts`
- Modify: `frontend/src/lib/api-client.ts` (line 13-19)
- Create: `frontend/src/hooks/useSourceQuery.ts`

- [ ] **Step 1: Expand sourceStore**

Replace `frontend/src/stores/sourceStore.ts` entirely:

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SourceInfo {
  id: number;
  source_name: string;
  is_default?: boolean;
}

interface SourceState {
  /** Currently selected source — global across all features */
  activeSourceId: number | null;
  /** Cached default source ID from the server */
  defaultSourceId: number | null;
  /** Cached source list for selectors */
  sources: SourceInfo[];
  setActiveSource: (id: number) => void;
  setDefaultSourceId: (id: number | null) => void;
  setSources: (sources: SourceInfo[]) => void;
}

export const useSourceStore = create<SourceState>()(
  persist(
    (set) => ({
      activeSourceId: null,
      defaultSourceId: null,
      sources: [],
      setActiveSource: (id) => set({ activeSourceId: id }),
      setDefaultSourceId: (id) => set({ defaultSourceId: id }),
      setSources: (sources) => set({ sources }),
    }),
    { name: "parthenon-source" },
  ),
);
```

- [ ] **Step 2: Add X-Source-Id interceptor to api-client.ts**

In `frontend/src/lib/api-client.ts`, modify the request interceptor (lines 13-19). Replace:

```typescript
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

With:

```typescript
import { useSourceStore } from "@/stores/sourceStore";

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const sourceId = useSourceStore.getState().activeSourceId;
  if (sourceId) {
    config.headers["X-Source-Id"] = String(sourceId);
  }

  return config;
});
```

- [ ] **Step 3: Create useSourceQuery hook**

Create `frontend/src/hooks/useSourceQuery.ts`:

```typescript
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useSourceStore } from "@/stores/sourceStore";

/**
 * TanStack Query wrapper that automatically includes the active sourceId
 * in the query key and guards on valid source selection.
 *
 * When activeSourceId changes, all useSourceQuery hooks refetch automatically
 * because the key changes.
 */
export function useSourceQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, (string | number | null)[]>, "queryKey" | "queryFn">,
) {
  const sourceId = useSourceStore((s) => s.activeSourceId);

  return useQuery({
    queryKey: [...key, sourceId],
    queryFn,
    enabled: (sourceId ?? 0) > 0 && (options?.enabled ?? true),
    ...options,
  });
}
```

- [ ] **Step 4: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 5: Build check**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/stores/sourceStore.ts src/lib/api-client.ts src/hooks/useSourceQuery.ts
git commit -m "feat: global source store with X-Source-Id interceptor and useSourceQuery hook"
```

---

## Task 6: Global Source Selector in Header

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx` (lines 80-100)
- Modify: `frontend/src/features/dashboard/pages/DashboardPage.tsx` (lines 51-63)

- [ ] **Step 1: Add source selector to Header**

In `frontend/src/components/layout/Header.tsx`, add imports at the top:

```typescript
import { Database, Star, ChevronDown as ChevronDownIcon } from "lucide-react";
import { useSourceStore } from "@/stores/sourceStore";
import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
```

Add a `GlobalSourceSelector` component before the `Header` function (before line 80):

```typescript
function GlobalSourceSelector() {
  const { activeSourceId, setActiveSource, setSources, setDefaultSourceId } = useSourceStore();
  const { data: sources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  // Sync sources into store and auto-select default
  React.useEffect(() => {
    if (!sources?.length) return;
    setSources(sources.map((s) => ({ id: s.id, source_name: s.source_name, is_default: s.is_default })));
    const defaultSrc = sources.find((s) => s.is_default);
    if (defaultSrc) setDefaultSourceId(defaultSrc.id);
    if (!activeSourceId) {
      setActiveSource(defaultSrc ? defaultSrc.id : sources[0].id);
    }
  }, [sources, activeSourceId, setActiveSource, setSources, setDefaultSourceId]);

  const selected = sources?.find((s) => s.id === activeSourceId);

  return (
    <div className="flex items-center gap-1.5">
      {selected?.is_default ? (
        <Star size={12} className="text-[#C9A227] fill-[#C9A227]" />
      ) : (
        <Database size={12} className="text-[#8A857D]" />
      )}
      <select
        value={activeSourceId ?? ""}
        onChange={(e) => setActiveSource(Number(e.target.value))}
        className="appearance-none rounded border border-[#232328] bg-[#0E0E11] pl-2 pr-6 py-1 text-xs text-[#C5C0B8] focus:border-[#C9A227] focus:outline-none cursor-pointer min-w-[140px]"
      >
        <option value="" disabled>Select source</option>
        {sources?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.is_default ? "\u2605 " : ""}{s.source_name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

Add `import React from "react";` if not already imported.

Then in the `Header` component's JSX, add the selector in the topbar-actions div (around line 103), before the existing buttons:

```typescript
<div className="topbar-actions">
  {isAuthenticated && user ? (
    <>
      <GlobalSourceSelector />
      {/* ... existing buttons ... */}
```

- [ ] **Step 2: Update DashboardPage to use global source store**

In `frontend/src/features/dashboard/pages/DashboardPage.tsx`:

Replace the local source state management (lines 51-58):

```typescript
const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

useEffect(() => {
  if (stats?.sources.length && !selectedSourceId) {
    const defaultSrc = stats.sources.find((s: { id: number; is_default?: boolean }) => s.is_default);
    setSelectedSourceId(defaultSrc ? defaultSrc.id : stats.sources[0].id);
  }
}, [stats?.sources, selectedSourceId]);
```

With:

```typescript
import { useSourceStore } from "@/stores/sourceStore";

// Inside the component:
const activeSourceId = useSourceStore((s) => s.activeSourceId);
```

Update the `sourceId` derivation (line 60):

```typescript
const sourceId = activeSourceId ?? 0;
```

Remove the `SourceSelector` import (line 26) and its usage in the JSX (line 185). Replace the source selector area with a simple label showing the current source name:

```typescript
<p className="mt-0.5 text-sm text-[#8A857D]">
  Clinical data profile for the selected source
  {" "}<span className="text-[#C9A227]">(change in header)</span>
</p>
```

Remove the `useState` import if no longer needed.

- [ ] **Step 3: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Build check**

Run: `cd frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/components/layout/Header.tsx src/features/dashboard/pages/DashboardPage.tsx
git commit -m "feat: global source selector in header, dashboard reads from global store"
```

---

## Task 7: Migrate AchillesResultReaderService to SourceAware

**Files:**
- Modify: `backend/app/Services/Achilles/AchillesResultReaderService.php`

This is the highest-priority migration — it's the service causing the Dashboard bug.

- [ ] **Step 1: Add SourceAware trait and remove manual schema switching**

In `backend/app/Services/Achilles/AchillesResultReaderService.php`:

Add the trait import and usage:
```php
use App\Concerns\SourceAware;

class AchillesResultReaderService
{
    use SourceAware;
```

Remove the `$activeConnection` property (line 25):
```php
private string $activeConnection = 'results';
```

Remove the entire `setSchemaForSource()` method (lines 27-42).

Update the query helper methods (lines 48-70) to use `$this->results()`:

```php
/** @return Builder<AchillesResult> */
private function ar(): Builder
{
    return AchillesResult::on($this->results()->getName())->newQuery();
}

/** @return Builder<AchillesResultDist> */
private function ard(): Builder
{
    return AchillesResultDist::on($this->results()->getName())->newQuery();
}

/** @return Builder<AchillesAnalysis> */
private function aa(): Builder
{
    return AchillesAnalysis::on($this->results()->getName())->newQuery();
}

/** @return Builder<AchillesPerformance> */
private function ap(): Builder
{
    return AchillesPerformance::on($this->results()->getName())->newQuery();
}
```

Remove all calls to `$this->setSchemaForSource($source)` throughout the file (they appear at the start of each public method like `getRecordCounts()`, `getDemographics()`, etc.). Since the middleware now sets up SourceContext before the controller runs, these calls are no longer needed.

Replace the hardcoded vocabulary lookups at lines 765 and 804:
```php
// Before (line 765):
$concept = DB::connection('omop')->table('concept')...

// After:
$concept = $this->vocab()->table('concept')...
```

```php
// Before (line 804):
$concepts = DB::connection('omop')->table('concept')...

// After:
$concepts = $this->vocab()->table('concept')...
```

Remove the `DynamicConnectionFactory` constructor dependency since we no longer need it:
```php
// Before:
public function __construct(
    private readonly DynamicConnectionFactory $connectionFactory,
) {}

// After:
public function __construct() {}
```

Remove the `use App\Services\Database\DynamicConnectionFactory;` import.

- [ ] **Step 2: Run Pint + PHPStan**

Run:
```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Achilles/AchillesResultReaderService.php"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Services/Achilles/AchillesResultReaderService.php --memory-limit=512M"
```

- [ ] **Step 3: Commit**

```bash
cd backend
git add app/Services/Achilles/AchillesResultReaderService.php
git commit -m "refactor: migrate AchillesResultReaderService to SourceAware trait"
```

---

## Task 8: Migrate Remaining Services (Batch)

**Files:** All services with hardcoded `DB::connection('omop')` or `DB::connection('results')`.

For each service below, the pattern is identical:
1. Add `use App\Concerns\SourceAware;` import
2. Add `use SourceAware;` inside the class
3. Replace `DB::connection('omop')` → `$this->cdm()`
4. Replace `DB::connection('results')` → `$this->results()`
5. Replace vocabulary lookups `DB::connection('omop')->table('concept')` → `$this->vocab()->table('concept')`

- [ ] **Step 1: AchillesEngineService**

File: `backend/app/Services/Achilles/AchillesEngineService.php`
- Line 283: `DB::connection('results')` → `$this->results()`

- [ ] **Step 2: AbbyAiService**

File: `backend/app/Services/AI/AbbyAiService.php`
- Line 333: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 3: ConceptSearchService**

File: `backend/app/Services/Investigation/ConceptSearchService.php`
- Lines 17, 46, 63, 92, 132: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 4: ImagingTimelineService**

File: `backend/app/Services/Imaging/ImagingTimelineService.php`
- Lines 106, 146, 250, 297, 305: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 5: ImagingAiService**

File: `backend/app/Services/Imaging/ImagingAiService.php`
- Line 172: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 6: VariantOutcomeService**

File: `backend/app/Services/Genomics/VariantOutcomeService.php`
- Lines 38, 144: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 7: TumorBoardService**

File: `backend/app/Services/Genomics/TumorBoardService.php`
- Line 32: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 8: CdmWriterService**

File: `backend/app/Services/Ingestion/CdmWriterService.php`
- Line 300: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 9: DqdEngineService**

File: `backend/app/Services/Dqd/DqdEngineService.php`
- Lines 220, 225: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 10: VocabularyLookupService (FHIR)**

File: `backend/app/Services/Fhir/VocabularyLookupService.php`
- Lines 191, 221: `DB::connection('omop')` → `$this->vocab()`

- [ ] **Step 11: TextToSqlController**

File: `backend/app/Http/Controllers/Api/V1/TextToSqlController.php`
- Lines 214, 266, 300: `DB::connection('omop')` → `$this->cdm()`
- Add `use App\Concerns\SourceAware;` and `use SourceAware;` in the controller class.

- [ ] **Step 12: AresController**

File: `backend/app/Http/Controllers/Api/V1/AresController.php`
- Line 628: `DB::connection('omop')` → `$this->vocab()`
- Add `use App\Concerns\SourceAware;` and `use SourceAware;` in the controller class.

- [ ] **Step 13: Ares Services (DiversityService, NetworkComparisonService, etc.)**

File: `backend/app/Services/Ares/DiversityService.php`
- Lines 88, 210, 387, 537, 629: Replace `DB::connection('omop')` → `$this->cdm()`, `DB::connection('results')` → `$this->results()`

File: `backend/app/Services/Ares/NetworkComparisonService.php`
- Lines 96, 199, 326, 377, 412, 433: Replace accordingly.

File: `backend/app/Services/Ares/PatientArrivalForecastService.php`
- Line 59: `DB::connection('results')` → `$this->results()`

File: `backend/app/Services/Ares/FeasibilityService.php`
- Line 231: `DB::connection('results')` → `$this->results()`

File: `backend/app/Services/Ares/ConceptStandardizationService.php`
- Line 97: `DB::connection('results')` → `$this->results()`

File: `backend/app/Services/Ares/CoverageService.php`
- Lines 177, 251: `DB::connection('results')` → `$this->results()`

File: `backend/app/Services/Ares/DqHistoryService.php`
- Line 371: `DB::connection('results')` → `$this->results()`

File: `backend/app/Services/Ares/UnmappedCodeService.php`
- Line 274: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 14: FHIR Services**

File: `backend/app/Services/Fhir/FhirDedupService.php`
- Line 114: `DB::connection('omop')` → `$this->cdm()`

File: `backend/app/Services/Fhir/Export/OmopToFhirService.php`
- Lines 51, 83, 122: `DB::connection('omop')` → `$this->cdm()`

File: `backend/app/Services/Fhir/Export/ReverseVocabularyService.php`
- Lines 133, 148: `DB::connection('omop')` → `$this->vocab()`

File: `backend/app/Services/Fhir/FhirNdjsonProcessorService.php`
- Lines 300, 305, 337, 368: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 15: Ingestion Services**

File: `backend/app/Services/Ingestion/ObservationPeriodCalculator.php`
- Line 39: `DB::connection('omop')` → `$this->cdm()`

File: `backend/app/Services/Ingestion/PostLoadValidationService.php`
- Lines 43, 299: `DB::connection('omop')` → `$this->cdm()`

- [ ] **Step 16: Morpheus (uses 'inpatient')**

File: `backend/app/Http/Controllers/Api/V1/MorpheusDashboardController.php`
- Line 28: `DB::connection('inpatient')` → `$this->cdm()`

File: `backend/app/Services/Morpheus/MorpheusDashboardService.php`
- Line 37: `DB::connection($this->conn)` → `$this->cdm()`
- Remove the `private string $conn = 'inpatient';` property.

File: `backend/app/Http/Controllers/Api/V1/MorpheusDatasetController.php`
- Lines 15, 28: `DB::connection('inpatient')` → `$this->cdm()`

File: `backend/app/Http/Controllers/Api/V1/MorpheusPatientController.php`
- Line 28: `DB::connection('inpatient')` → `$this->cdm()`

- [ ] **Step 17: Run Pint on all modified files**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 18: Run PHPStan**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse --memory-limit=512M"`
Fix any type errors introduced by the migration.

- [ ] **Step 19: Run full test suite**

Run: `cd backend && vendor/bin/pest --stop-on-failure`
Expected: All tests pass. The fallback in base models (`'omop'`/`'results'` when no SourceContext) ensures existing tests work without middleware.

- [ ] **Step 20: Commit**

```bash
cd backend
git add -A
git commit -m "refactor: migrate all services and controllers from hardcoded DB connections to SourceAware trait"
```

---

## Task 9: Schema Uniqueness Validation

**Files:**
- Create: `backend/app/Rules/UniqueDaimonSchema.php`
- Create: `backend/app/Console/Commands/AuditSourceSchemas.php`
- Create: `backend/tests/Unit/Rules/UniqueDaimonSchemaTest.php`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Unit/Rules/UniqueDaimonSchemaTest.php`:

```php
<?php

namespace Tests\Unit\Rules;

use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Rules\UniqueDaimonSchema;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class UniqueDaimonSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_rejects_duplicate_cdm_schema(): void
    {
        $existing = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $existing->id,
            'daimon_type' => 'cdm',
            'table_qualifier' => 'omop',
        ]);

        $rule = new UniqueDaimonSchema('cdm', null);
        $validator = Validator::make(
            ['table_qualifier' => 'omop'],
            ['table_qualifier' => $rule],
        );

        $this->assertTrue($validator->fails());
        $this->assertStringContainsString('already registered', $validator->errors()->first('table_qualifier'));
    }

    public function test_allows_unique_cdm_schema(): void
    {
        $existing = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $existing->id,
            'daimon_type' => 'cdm',
            'table_qualifier' => 'omop',
        ]);

        $rule = new UniqueDaimonSchema('cdm', null);
        $validator = Validator::make(
            ['table_qualifier' => 'irsf'],
            ['table_qualifier' => $rule],
        );

        $this->assertFalse($validator->fails());
    }

    public function test_allows_same_vocabulary_schema(): void
    {
        $existing = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $existing->id,
            'daimon_type' => 'vocabulary',
            'table_qualifier' => 'omop',
        ]);

        // Vocabulary is exempt — multiple sources can share it
        $rule = new UniqueDaimonSchema('vocabulary', null);
        $validator = Validator::make(
            ['table_qualifier' => 'omop'],
            ['table_qualifier' => $rule],
        );

        $this->assertFalse($validator->fails());
    }

    public function test_allows_own_schema_on_update(): void
    {
        $source = Source::factory()->create();
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => 'cdm',
            'table_qualifier' => 'omop',
        ]);

        // Updating own source — should not conflict with itself
        $rule = new UniqueDaimonSchema('cdm', $source->id);
        $validator = Validator::make(
            ['table_qualifier' => 'omop'],
            ['table_qualifier' => $rule],
        );

        $this->assertFalse($validator->fails());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Rules/UniqueDaimonSchemaTest.php`
Expected: FAIL — class doesn't exist.

- [ ] **Step 3: Create UniqueDaimonSchema rule**

Create `backend/app/Rules/UniqueDaimonSchema.php`:

```php
<?php

namespace App\Rules;

use App\Models\App\SourceDaimon;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Validates that a CDM or Results daimon schema is not already
 * registered by another source. Vocabulary schemas are exempt
 * since they are shared reference data.
 */
class UniqueDaimonSchema implements ValidationRule
{
    public function __construct(
        private readonly string $daimonType,
        private readonly ?int $excludeSourceId = null,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Vocabulary is shared reference data — allow duplicates
        if ($this->daimonType === 'vocabulary') {
            return;
        }

        $query = SourceDaimon::where('daimon_type', $this->daimonType)
            ->where('table_qualifier', $value);

        if ($this->excludeSourceId !== null) {
            $query->where('source_id', '!=', $this->excludeSourceId);
        }

        $conflict = $query->with('source:id,source_name')->first();

        if ($conflict !== null) {
            $sourceName = $conflict->source?->source_name ?? "ID {$conflict->source_id}";
            $fail("Schema '{$value}' is already registered as the {$this->daimonType} schema for source '{$sourceName}' (ID {$conflict->source_id}). Each source must have its own isolated CDM and Results schemas.");
        }
    }
}
```

- [ ] **Step 4: Create AuditSourceSchemas command**

Create `backend/app/Console/Commands/AuditSourceSchemas.php`:

```php
<?php

namespace App\Console\Commands;

use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

class AuditSourceSchemas extends Command
{
    protected $signature = 'source:audit-schemas';

    protected $description = 'Detect CDM/Results schema conflicts between registered sources';

    public function handle(): int
    {
        $conflicts = 0;

        foreach (['cdm', 'results'] as $type) {
            $duplicates = SourceDaimon::where('daimon_type', $type)
                ->with('source:id,source_name')
                ->get()
                ->groupBy('table_qualifier')
                ->filter(fn (Collection $group) => $group->count() > 1);

            foreach ($duplicates as $schema => $daimons) {
                $conflicts++;
                $sources = $daimons->map(fn ($d) => "{$d->source->source_name} (ID {$d->source_id})")->join(', ');
                $this->error("CONFLICT: {$type} schema '{$schema}' shared by: {$sources}");
            }
        }

        if ($conflicts === 0) {
            $this->info('No schema conflicts detected. All CDM and Results schemas are unique per source.');

            return self::SUCCESS;
        }

        $this->warn("{$conflicts} conflict(s) found. Each source must have its own CDM and Results schemas.");

        return self::FAILURE;
    }
}
```

- [ ] **Step 5: Run tests**

Run: `cd backend && vendor/bin/pest tests/Unit/Rules/UniqueDaimonSchemaTest.php`
Expected: All 4 tests PASS.

- [ ] **Step 6: Test the audit command**

Run: `docker compose exec -T php php artisan source:audit-schemas`
Expected: Reports the Source 47/57 conflict (if running against host DB with those sources).

- [ ] **Step 7: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Rules/ app/Console/Commands/AuditSourceSchemas.php tests/Unit/Rules/"`

- [ ] **Step 8: Commit**

```bash
cd backend
git add app/Rules/UniqueDaimonSchema.php app/Console/Commands/AuditSourceSchemas.php tests/Unit/Rules/
git commit -m "feat: add schema uniqueness validation and audit command"
```

---

## Task 10: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && vendor/bin/pest`
Expected: All tests pass.

- [ ] **Step 2: Run PHPStan**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse --memory-limit=512M"`
Expected: No new errors.

- [ ] **Step 3: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run frontend build**

Run: `cd frontend && npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Run Pint on entire backend**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`
Expected: No formatting changes needed.

- [ ] **Step 6: Manual smoke test**

1. Start the dev server: `cd frontend && npx vite`
2. Open http://localhost:5175
3. Verify the global source selector appears in the header
4. Switch between sources — Dashboard CDM Characterization should update
5. Check browser DevTools Network tab — all requests should have `X-Source-Id` header
6. Switch to Eunomia — verify different record counts appear
7. Navigate to Data Explorer — verify it uses the same source from the header

- [ ] **Step 7: Final commit (if any fixes needed from smoke test)**

```bash
git add -A
git commit -m "fix: integration fixes from smoke testing"
```

---

## Task 11: CI Guard — Ban Bare DB::connection() Calls

**Files:**
- Create: `backend/phpstan/Rules/NoBareConnectionCallRule.php`
- Modify: `backend/phpstan.neon` or `backend/phpstan-baseline.neon`

This is the "never regress" guard. New code cannot introduce hardcoded CDM/Results connections.

- [ ] **Step 1: Create the PHPStan rule**

Create directory if needed: `backend/phpstan/Rules/`

Create `backend/phpstan/Rules/NoBareConnectionCallRule.php`:

```php
<?php

namespace App\PHPStan\Rules;

use PhpParser\Node;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleErrorBuilder;

/**
 * Bans direct DB::connection('omop'), DB::connection('results'),
 * and DB::connection('inpatient') calls outside of allowed files.
 *
 * Forces developers to use the SourceAware trait instead.
 *
 * @implements Rule<StaticCall>
 */
class NoBareConnectionCallRule implements Rule
{
    /** Connection names that must not be hardcoded */
    private const BANNED_CONNECTIONS = ['omop', 'results', 'inpatient', 'eunomia'];

    /** Files allowed to use bare connections (infrastructure code) */
    private const ALLOWED_FILES = [
        'Context/SourceContext.php',
        'Database/DynamicConnectionFactory.php',
        'Cdm/CdmModel.php',
        'Results/ResultsModel.php',
        'Vocabulary/VocabularyModel.php',
        'Commands/LoadEunomiaCommand.php',
        'Commands/LoadVocabularies.php',
        'Commands/ComputeEmbeddings.php',
    ];

    public function getNodeType(): string
    {
        return StaticCall::class;
    }

    /**
     * @return list<\PHPStan\Rules\RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node instanceof StaticCall) {
            return [];
        }

        // Check if it's DB::connection(...)
        if (! $node->class instanceof Node\Name) {
            return [];
        }

        $className = $node->class->toString();
        if ($className !== 'DB' && ! str_ends_with($className, '\DB')) {
            return [];
        }

        if (! $node->name instanceof Node\Identifier || $node->name->name !== 'connection') {
            return [];
        }

        // Check the first argument
        if (count($node->getArgs()) === 0) {
            return [];
        }

        $arg = $node->getArgs()[0]->value;
        if (! $arg instanceof String_) {
            return [];
        }

        if (! in_array($arg->value, self::BANNED_CONNECTIONS, true)) {
            return [];
        }

        // Check if file is in the allowed list
        $file = $scope->getFile();
        foreach (self::ALLOWED_FILES as $allowed) {
            if (str_contains($file, $allowed)) {
                return [];
            }
        }

        return [
            RuleErrorBuilder::message(
                "Direct DB::connection('{$arg->value}') is banned. "
                . 'Use the SourceAware trait: $this->cdm(), $this->results(), or $this->vocab(). '
                . 'See docs/superpowers/specs/2026-03-26-cdm-source-isolation-design.md'
            )->build(),
        ];
    }
}
```

- [ ] **Step 2: Register the rule in phpstan.neon**

Add to `backend/phpstan.neon` (or create `backend/phpstan.neon.dist` if needed) under the `rules:` section:

```neon
rules:
    - App\PHPStan\Rules\NoBareConnectionCallRule
```

Also add the autoload path if not already present:

```neon
parameters:
    scanDirectories:
        - phpstan/Rules
```

- [ ] **Step 3: Run PHPStan to verify the rule catches violations**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse --memory-limit=512M"`

Expected: After all Task 8 migrations, no violations should remain. If any are found, they are migration items that were missed — fix them.

- [ ] **Step 4: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint phpstan/Rules/"`

- [ ] **Step 5: Commit**

```bash
cd backend
git add phpstan/Rules/ phpstan.neon
git commit -m "feat: add PHPStan rule banning bare DB::connection() with CDM connection names"
```
