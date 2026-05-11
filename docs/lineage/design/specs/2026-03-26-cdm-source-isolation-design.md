# CDM Source Isolation — Architectural Correction Spec

**Date:** 2026-03-26
**Status:** Approved
**Priority:** Mission-critical
**Scope:** Full-stack (Backend + Frontend + CI)

---

## Problem Statement

Parthenon has no enforced CDM source isolation. The system was designed for a single-CDM deployment, and multi-source support was added incrementally without architectural guardrails. This has caused:

1. **Data cross-contamination:** Sources 47 (OHDSI Acumenus CDM) and 57 (IRSF Natural History Study) share identical CDM/Results schemas (`omop`/`results`). Switching between them in the UI changes only the source ID — both resolve to the same tables.
2. **Connection pool leaks:** `AchillesResultReaderService` and `DynamicConnectionFactory` use `SET search_path` on shared named connections (`'results'`, `'omop'`). This is a PostgreSQL session-level mutation that persists across requests in PHP-FPM's connection pool.
3. **144+ hardcoded connections:** Services, controllers, jobs, and 52 Eloquent models hardcode `DB::connection('omop')` or `DB::connection('results')`, bypassing any source-aware logic.
4. **No frontend source context:** Each feature manages its own `selectedSourceId` state. No Axios interceptor injects source context. Query cache keys often omit `sourceId`, causing cross-source cache collisions.
5. **No enforcement layer:** No middleware, no CI rule, no runtime check prevents any of the above.

### Current Source Registry (Host PG 17)

| ID | Source | Connection | CDM Schema | Results Schema | Vocab Schema | db_host |
|----|--------|-----------|-----------|---------------|-------------|---------|
| 46 | Eunomia (demo) | eunomia | eunomia | eunomia_results | eunomia | — |
| 47 | OHDSI Acumenus CDM | omop | omop | results | omop | — |
| 48 | CMS SynPUF 2.3M | omop | synpuf | synpuf_results | omop | pgsql.acumenus.net |
| 50 | synpuf-2.3M | — | synpuf | synpuf_results | omop | pgsql.acumenus.net |
| 52 | Staging: PII Detection | pgsql | staging_3 | — | — | — |
| 53 | Synthetic EHR (1K) | omop | — | — | — | — |
| 57 | IRSF Natural History | omop | omop | results | omop | — |

**Conflict:** Sources 47 and 57 have identical CDM and Results schemas — no isolation.

---

## Architecture: Six Layers of Defense

### Layer 1: Request-Scoped Source Context (Backend)

#### 1.1 `SourceContext` Value Object

File: `backend/app/Context/SourceContext.php`

A request-scoped singleton holding the resolved source and its connection names.

```php
namespace App\Context;

use App\Models\App\Source;

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
            throw new NoSourceContextException(
                'Source context required but not set. '
                . 'Ensure this route uses ResolveSourceContext middleware '
                . 'or pass --source to the command.'
            );
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
     * Factory for Jobs/Commands that run outside HTTP context.
     */
    public static function forSource(Source $source): self
    {
        $ctx = new self(
            source: $source,
            cdmSchema: $source->getTableQualifier(DaimonType::CDM),
            resultsSchema: $source->getTableQualifier(DaimonType::Results),
            vocabSchema: $source->getTableQualifier(DaimonType::Vocabulary),
        );
        $ctx->registerConnections($source);
        app()->instance(self::class, $ctx);
        return $ctx;
    }

    private function registerConnections(Source $source): void
    {
        // For sources with db_host: build dynamic connections
        // For local sources: clone named connection with schema-specific search_path
        // Each daimon gets its own isolated connection — no shared SET search_path
    }
}
```

Registered in `AppServiceProvider::register()`:
```php
$this->app->scoped(SourceContext::class, fn () => new SourceContext());
```

#### 1.2 `ResolveSourceContext` Middleware

File: `backend/app/Http/Middleware/ResolveSourceContext.php`

Runs on all `auth:sanctum` route groups. Resolution order:
1. Route parameter `{source}` (implicit model binding — highest priority)
2. `X-Source-Id` request header (fallback for routes without `{source}`)
3. `null` for genuinely source-agnostic routes

When a source is resolved:
- Validates user access via `Source::visibleToUser()`
- Resolves CDM, Results, and Vocabulary schemas from `SourceDaimon`
- Registers isolated connections (`ctx_cdm`, `ctx_results`, `ctx_vocab`) with correct `search_path` baked into config
- Populates the scoped `SourceContext` singleton
- Adds `source_id` and `source_name` to Laravel's log context

**Connection isolation mechanism:**
```php
// Instead of: DB::connection('results')->statement("SET search_path TO ...");
// We register a fresh connection with search_path in config:
config(["database.connections.ctx_results" => [
    ...config("database.connections.{$baseConnection}"),
    'search_path' => "\"{$resultsSchema}\",public",
]]);
DB::purge('ctx_results');
```

This eliminates the connection pool leak — each request gets its own connection config.

#### 1.3 `RequireSourceContext` Middleware

File: `backend/app/Http/Middleware/RequireSourceContext.php`

Stricter variant applied to route groups that MUST have a source (e.g., `/sources/{source}/*`, CDM-querying endpoints). Returns 422 if `SourceContext::source` is null after `ResolveSourceContext` ran.

Registration in `bootstrap/app.php`:
```php
$middleware->alias([
    'source.resolve' => ResolveSourceContext::class,
    'source.require' => RequireSourceContext::class,
]);
```

Applied in `routes/api.php`:
```php
Route::middleware(['auth:sanctum', 'source.resolve'])->group(function () {
    // All authenticated routes get source resolution from header

    Route::middleware(['source.require'])->prefix('sources/{source}')->group(function () {
        // These MUST have a source — 422 if missing
    });
});
```

---

### Layer 2: Source-Aware Connection Resolution (Backend)

#### 2.1 `SourceAware` Trait

File: `backend/app/Concerns/SourceAware.php`

Drop-in replacement for hardcoded `DB::connection()` calls in services:

```php
namespace App\Concerns;

use App\Context\SourceContext;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

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

Migration pattern:
```php
// Before:
DB::connection('omop')->table('person')->count();

// After:
use SourceAware;
$this->cdm()->table('person')->count();
```

#### 2.2 Dynamic Connection on Eloquent Base Models

Three base models override `getConnectionName()` to resolve dynamically:

**CdmModel.php:**
```php
public function getConnectionName(): string
{
    $ctx = app(SourceContext::class);
    return $ctx->source ? $ctx->cdmConnection() : 'omop';
}
```

**ResultsModel.php:**
```php
public function getConnectionName(): string
{
    $ctx = app(SourceContext::class);
    return $ctx->source ? $ctx->resultsConnection() : 'results';
}
```

**VocabularyModel.php:**
```php
public function getConnectionName(): string
{
    $ctx = app(SourceContext::class);
    return $ctx->source ? $ctx->vocabConnection() : 'omop';
}
```

Fallback to hardcoded connection ensures CLI commands and seeders that run outside request context continue working.

#### 2.3 Jobs and Commands

**Jobs** that operate on source-specific data:
- Accept `Source $source` as constructor parameter (most already do)
- Call `SourceContext::forSource($source)` in `handle()` before any DB queries
- Example: `RunAchillesJob`, `ProcessClinicalNotesJob`, `VocabularyImportJob`

**Commands** that load data into specific schemas:
- Accept `--source={id}` option
- Call `SourceContext::forSource($source)` in `handle()`
- Current hardcoded schema becomes the default when `--source` is omitted
- Example: `LoadIrsfCommand`, `LoadEunomiaCommand`, `LoadVocabularies`

#### 2.4 Migration Inventory

| Tier | Scope | Count | Strategy |
|------|-------|-------|----------|
| 1 — Models | CdmModel, ResultsModel, VocabularyModel | 52 models (3 base classes) | Override `getConnectionName()` on 3 base classes |
| 2 — Services | `DB::connection('omop'/'results')` in services | 88 calls across ~20 files | Add `SourceAware` trait, replace calls |
| 3 — Controllers | TextToSql, Ares, Morpheus | 8 calls across ~4 files | Inject `SourceContext`, replace calls |
| 4 — Jobs | Ingestion, Clinical Notes, Vocabulary | 8 calls across ~3 files | Pass `Source`, set up context in `handle()` |
| 5 — Commands | LoadIrsf, LoadEunomia, LoadVocabularies, ComputeEmbeddings | 20 calls across ~4 files | Add `--source` option |
| GIS — Keep | All `DB::connection('gis')` | 30 calls across 8 files | **No change** — GIS is reference data, not CDM-scoped |

**Total migration: ~176 connection references across ~34 files.**

---

### Layer 3: Frontend Global Source Context

#### 3.1 Expanded `sourceStore`

File: `frontend/src/stores/sourceStore.ts`

```typescript
interface SourceState {
  activeSourceId: number | null;
  defaultSourceId: number | null;
  sources: Source[];
  setActiveSource: (id: number) => void;
  setDefaultSourceId: (id: number | null) => void;
  setSources: (sources: Source[]) => void;
}
```

Persisted to `localStorage` via Zustand's `persist` middleware. When user switches source anywhere in the app, it updates globally and all source-scoped queries refetch.

#### 3.2 Axios Interceptor — `X-Source-Id` Header

File: `frontend/src/lib/api-client.ts`

```typescript
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const sourceId = useSourceStore.getState().activeSourceId;
  if (sourceId) config.headers['X-Source-Id'] = String(sourceId);

  return config;
});
```

Safety net: even if a developer forgets `sourceId` in the URL/params, the backend middleware still resolves source from the header.

#### 3.3 Global Source Selector in App Header

Move the `SourceSelector` component from individual features into `MainLayout.tsx`. Visible on every page. Shows which CDM the user is working with.

Features no longer manage their own `selectedSourceId`. They read from `useSourceStore().activeSourceId`.

#### 3.4 `useSourceQuery` Hook

File: `frontend/src/hooks/useSourceQuery.ts`

Wrapper around TanStack Query that automatically includes `sourceId` in the key and guards on valid source:

```typescript
function useSourceQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn'>
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

#### 3.5 Features That Stay Source-Agnostic

| Feature | Reason |
|---------|--------|
| Vocabulary search | Global vocabulary shared across sources |
| Concept Sets (definitions) | Global definitions, executed per-source |
| Commons/messaging | Platform-level collaboration |
| User management | System-level |
| Jobs list | Cross-source monitoring |
| Data Sources management | Meta — managing sources, not querying one |

---

### Layer 4: Schema Uniqueness Validation

#### 4.1 Unique Schema Rule

File: `backend/app/Rules/UniqueDaimonSchema.php`

Validates on source create/update that no other source on the same database host shares the same CDM or Results `table_qualifier`.

**Vocabulary is exempt** — multiple sources may legitimately share a vocabulary schema (the OMOP vocabulary is reference data).

Applied in `StoreSourceRequest` and `UpdateSourceRequest` form requests.

Error message:
> "Schema 'omop' is already registered as the CDM schema for source 'OHDSI Acumenus CDM' (ID 47). Each source must have its own isolated CDM and Results schemas."

#### 4.2 Schema Audit Command

File: `backend/app/Console/Commands/AuditSourceSchemas.php`

```bash
php artisan source:audit-schemas
```

Detects existing schema collisions across all registered sources. Outputs conflicts with recommendations. Runs as part of `deploy.sh` — deployment warns (not blocks, to avoid breaking existing deployments) if conflicts exist.

#### 4.3 Fix Existing Source 57 Conflict

**Decision required from user:** Either:
- **Option A:** Create `irsf` and `irsf_results` schemas, migrate IRSF data, update Source 57 daimons
- **Option B:** Delete Source 57 if it's a duplicate registration

#### 4.4 Source Registration Pre-Flight (Frontend)

The Data Sources management page shows validation when creating/editing a source:
- Schema exists in the database
- Schema is not claimed by another source (CDM/Results)
- Schema contains expected OMOP tables
- Connection test passes

---

### Layer 5: Static Analysis Guards (CI)

#### 5.1 PHPStan Custom Rule

File: `backend/phpstan/Rules/NoBareConnectionCallRule.php`

Flags any `DB::connection('omop')`, `DB::connection('results')`, or `DB::connection('inpatient')` call outside of allowed files (`SourceContext.php`, `DynamicConnectionFactory.php`, base model classes).

```
ERROR: Direct DB::connection('omop') in AbbyAiService.php:333.
       Use the SourceAware trait: $this->cdm()
```

Runs in CI (PHPStan level 8 already configured) and pre-commit hook.

#### 5.2 Frontend Query Key CI Check

A grep-based CI step that flags `useQuery` calls in source-scoped features where the `queryKey` doesn't include `sourceId`. Can be a simple shell script in the pre-commit hook or a CI job.

---

### Layer 6: Runtime Observability

#### 6.1 `SourceContext::requireSource()` Fail-Fast

Services that query CDM/Results data call `requireSource()`. If no source is in context, throws `NoSourceContextException` — a 500 with a clear log entry telling the developer what to fix. Replaces silent fallback to `'omop'`.

#### 6.2 Request Log Context

`ResolveSourceContext` middleware adds `source_id` and `source_name` to Laravel's log context via `Log::withContext()`. Every log entry for that request includes source identity.

---

## Defense Layer Summary

| Layer | What It Catches | When |
|-------|----------------|------|
| PHPStan rule | Hardcoded `DB::connection('omop'/'results')` in new code | CI / pre-commit |
| Frontend CI check | Missing `sourceId` in query keys | CI / pre-commit |
| Schema uniqueness rule | Duplicate CDM/Results schema registration | Source create/update |
| `ResolveSourceContext` middleware | Missing source on source-scoped routes | Request time |
| `RequireSourceContext` middleware | Routes that MUST have source but don't | Request time |
| `SourceContext::requireSource()` | Service called without source context | Runtime |
| `X-Source-Id` header interceptor | Frontend forgot sourceId in URL | Every request |
| `source:audit-schemas` command | Existing schema conflicts | Deploy time |

---

## Files Created (New)

| File | Purpose |
|------|---------|
| `backend/app/Context/SourceContext.php` | Request-scoped source + connection holder |
| `backend/app/Context/NoSourceContextException.php` | Fail-fast exception |
| `backend/app/Http/Middleware/ResolveSourceContext.php` | Middleware: resolve source from route/header |
| `backend/app/Http/Middleware/RequireSourceContext.php` | Middleware: reject if no source |
| `backend/app/Concerns/SourceAware.php` | Trait: `$this->cdm()`, `$this->results()`, `$this->vocab()` |
| `backend/app/Rules/UniqueDaimonSchema.php` | Validation: no duplicate CDM/Results schemas |
| `backend/app/Console/Commands/AuditSourceSchemas.php` | Command: detect schema conflicts |
| `backend/phpstan/Rules/NoBareConnectionCallRule.php` | PHPStan: ban hardcoded connections |
| `frontend/src/hooks/useSourceQuery.ts` | Hook: source-scoped TanStack Query wrapper |

## Files Modified (Key)

| File | Change |
|------|--------|
| `backend/bootstrap/app.php` | Register middleware aliases |
| `backend/routes/api.php` | Apply `source.resolve` and `source.require` middleware |
| `backend/app/Providers/AppServiceProvider.php` | Register scoped `SourceContext` |
| `backend/app/Models/Cdm/CdmModel.php` | Dynamic `getConnectionName()` |
| `backend/app/Models/Results/ResultsModel.php` | Dynamic `getConnectionName()` |
| `backend/app/Models/Vocabulary/VocabularyModel.php` | Dynamic `getConnectionName()` |
| `frontend/src/stores/sourceStore.ts` | Expand to track `activeSourceId` + `sources` |
| `frontend/src/lib/api-client.ts` | Add `X-Source-Id` interceptor |
| `frontend/src/components/layout/MainLayout.tsx` | Add global source selector |
| ~20 backend service files | Replace `DB::connection('omop')` with `$this->cdm()` |
| ~4 backend controller files | Replace hardcoded connections |
| ~3 backend job files | Add `SourceContext::forSource()` in `handle()` |
| ~4 backend command files | Add `--source` option |
| ~10 frontend API files | Use `useSourceQuery` or add `sourceId` to keys |

## Out of Scope

- GIS `DB::connection('gis')` calls — GIS is reference data, not CDM-scoped
- Multi-database federation beyond what `DynamicConnectionFactory` already supports
- Row-level security within a schema
- Source-level RBAC beyond the existing `restricted_to_roles` field on Source
