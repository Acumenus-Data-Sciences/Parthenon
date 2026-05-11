---
doc_type: spec
status: historical
date: 2026-05-09
owner: acumenus
module: extension-points
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Contracts/TenantResolverInterface.php
related_prs: []
---
# Extension Point: Tenant Resolver

**Interface:** `App\Contracts\TenantResolverInterface`
**Default driver (CE):** `App\Tenancy\SingleTenantResolver`
**Service provider:** `App\Providers\TenancyServiceProvider`
**Config:** `backend/config/tenancy.php`
**Trait:** `App\Tenancy\Concerns\BelongsToTenant`
**Status:** Live since [Phase 2 #2](../../superpowers/plans/2026-05-09-ce-ee-fork-plan-02-02-tenant-resolver.md)

## Purpose

Decouple Parthenon's tenant context resolution from a specific deployment topology. CE deployments are single-tenant by default — the resolver returns Tenant#1 ('default') for every request. EE deployments swap in a `MultiTenantResolver` that derives tenant from subdomain / `X-Tenant-Slug` header / JWT claim / authenticated user's primary tenant.

The resolver is paired with the `BelongsToTenant` Eloquent trait, which:
- auto-fills `tenant_id` from the resolver on `creating`
- registers a global scope filtering queries to `tenant_id = resolver->currentId()`

## The contract

```php
interface TenantResolverInterface
{
    public function current(): Tenant;
    public function currentId(): int;
    public function setCurrent(Tenant $tenant): void;
    public function clear(): void;

    /** R2: queued-job context lifecycle */
    public function snapshot(): array;
    public function restore(array $snap): void;
}
```

### Why `snapshot()` / `restore()`

Laravel queued jobs serialize their payload and restore on dequeue. Tenant context is request-scoped by default (subdomain, header, JWT) and would otherwise be lost when a job runs on a worker. The R2 lifecycle:

1. When a job dispatches, a queue middleware calls `$resolver->snapshot()` and embeds the result in the job payload.
2. When the worker picks up the job, the same middleware calls `$resolver->restore($snap)` before `$job->handle()` runs.

CE's `SingleTenantResolver::snapshot()` returns `[]` (always Tenant#1, nothing to serialize). EE's `MultiTenantResolver::snapshot()` returns something like `['slug' => 'tenant-x']`, and `restore()` looks up the Tenant by slug.

## CE-shipped resolver

### `SingleTenantResolver`

- Always returns Tenant#1 ('default')
- Memoizes within a request
- Throws `RuntimeException` if Tenant#1 is missing (fail-loud — should never happen because the migration that creates `app.tenants` also inserts Tenant#1)
- `setCurrent()` / `clear()` work as expected (used in tests for impersonation flows)
- `snapshot()` returns `[]`; `restore()` is a no-op

The class is intentionally simple: no DB lookups beyond the initial resolution, no external dependencies, always available.

## The `BelongsToTenant` trait

Apply to any Eloquent model that lives in a tenant-scoped table:

```php
namespace App\Models\App;

use App\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CohortDefinition extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        // ... existing columns ...
        'tenant_id',
    ];
}
```

Behavior:
- **On create:** if `$model->tenant_id` is null, it's set to `app(TenantResolverInterface::class)->currentId()` before insert.
- **On query:** a global scope `App\Tenancy\Concerns\TenantScope` adds `WHERE tenant_id = resolver->currentId()` to every query.
- **Bypass:** `Model::withoutGlobalScope(\App\Tenancy\Concerns\TenantScope::class)` — used by admin tooling, cross-tenant migrations, super-admin reports.

## What's tenant-scoped (and what isn't)

The migration `2026_05_09_200001_add_tenant_id_to_core_tables.php` adds nullable `tenant_id` (default 1) to:
- `users`, `sources`, `cohort_definitions`, `concept_sets`, `analysis_executions`, `studies`, `user_audit_logs`, `ingestion_jobs`

Currently only `User` uses the trait. The other 7 models will adopt the trait in a follow-up rolling-refactor PR — the column is in place so EE's MultiTenantResolver works against them today via direct queries (queries that don't go through Eloquent's global scope).

**Intentionally NOT tenant-scoped:**
- OMOP CDM tables (`omop.*`, `vocab.*`, source-specific schemas) — clinical data lives in source-specific schemas; source membership *is* the tenancy boundary
- Vocabulary tables — shared globally
- Achilles `*_results` schemas — bound to a source, not a tenant directly
- Application infrastructure tables (jobs, cache, sessions)

## How to register a custom resolver

### Pattern A — config-driven (CE convention)

Set `TENANCY_RESOLVER` in `.env` to your class:

```bash
TENANCY_RESOLVER=My\Namespace\MyTenantResolver
```

`TenancyServiceProvider` reads `config/tenancy.php` and binds `TenantResolverInterface` to the configured class.

### Pattern B — service provider override (EE convention)

EE's `EnterpriseServiceProvider::register()` does:

```php
if ($licenseService->hasEntitlement('tenancy.multi')) {
    $this->app->bind(
        \App\Contracts\TenantResolverInterface::class,
        \Acumenus\Parthenon\Enterprise\Tenant\MultiTenantResolver::class,
    );
}
```

This pattern is preferred when the resolver depends on runtime state (license entitlements, tenant config). The container binding is a simple swap; the interface contract guarantees behavior compatibility.

## Hypothetical EE `MultiTenantResolver`

```php
class MultiTenantResolver implements TenantResolverInterface
{
    private ?Tenant $current = null;

    public function __construct(private readonly Request $request) {}

    public function current(): Tenant
    {
        if ($this->current) return $this->current;

        $slug = $this->resolveFromSubdomain()
              ?? $this->request->header('X-Tenant-Slug')
              ?? $this->resolveFromJwtClaim()
              ?? $this->resolveFromUser();

        if ($slug === null) {
            throw new \RuntimeException('Could not resolve tenant');
        }

        return $this->current = Tenant::where('slug', $slug)->firstOrFail();
    }

    public function snapshot(): array { return ['slug' => $this->current()->slug]; }
    public function restore(array $snap): void
    {
        if (isset($snap['slug'])) {
            $this->current = Tenant::where('slug', $snap['slug'])->firstOrFail();
        }
    }
    // ...
}
```

## Diagnostic CLI

```bash
php artisan tenant:current
```

Output:
```
Current tenant: id=1 slug='default' name='Default Tenant' billing_status='active'
Resolver: App\Tenancy\SingleTenantResolver
```

EE customers see `Resolver: Acumenus\Parthenon\Enterprise\Tenant\MultiTenantResolver` — quick verification that the EE resolver is bound.

## Migration story for EE customers

When an existing single-tenant deployment upgrades to EE:

1. **Day 0**: Customer is on CE single-tenant; everything is Tenant#1.
2. **EE install runs the multi-tenant init phase** (see Plan 02-07 + Plan 04 Task 12) which creates additional tenants in `app.tenants`.
3. **Customer migrates per-tenant data**: backfill `tenant_id` on existing rows for the tenant that owns them. This is a customer-specific migration script — Parthenon-EE ships templates but the data partition is customer-driven.
4. **Customer flips `TENANCY_RESOLVER`** to `MultiTenantResolver`.
5. **Restart**: now requests are routed by subdomain/header/etc. Existing single-tenant data stays on Tenant#1; new tenants get fresh `tenant_id` values.

## Testing patterns

- **Unit tests for the resolver itself:** see `tests/Feature/Tenancy/SingleTenantResolverTest.php` (8 cases).
- **Trait tests:** see `tests/Feature/Tenancy/BelongsToTenantTraitTest.php` (5 cases). Cover auto-fill, scope filtering, withoutGlobalScope bypass, and pre-trait NULL-row handling.
- **Pluggability proof:** see `tests/Feature/Tenancy/StubMultiTenantResolver.php` + `TenantResolverPluggabilityTest.php` (3 cases). Demonstrates the contract that EE's `MultiTenantResolver` fulfills.
- **End-to-end:** existing auth tests (`tests/Feature/Api/V1/AuthTest.php`, `tests/Feature/Auth/`) all pass with the trait active on User, proving byte-identical CE behavior preservation.

## Security notes

- **Mass-assignment safety:** the trait does NOT use `$guarded = []` (HIGHSEC §3.1). Models using the trait must include `'tenant_id'` in `$fillable` for tests that explicitly set it.
- **Cross-tenant leakage:** the global scope is the primary defense. Direct DB queries (e.g. raw `\DB::table('users')->...`) bypass the scope — admin tooling that does this MUST add explicit `where('tenant_id', ...)` clauses or use Eloquent for safety.
- **`withoutGlobalScope` audit:** every call site of `withoutGlobalScope(TenantScope::class)` should be reviewable in code search. Treat it as a sensitive operation in PR review (similar to disabling SQL injection protection).

## Out of scope (deferred)

- Tenant-aware data migrations (moving existing single-tenant rows to specific tenants) — Plan 04 customer migration tooling
- Tenant-scoped storage paths / S3 prefixes — Plan 04
- Per-tenant rate limiting — Plan 04
- Tenant-aware Solr cores — Plan 04 / future
- Applying `BelongsToTenant` to the other 7 tenant-scoped models — follow-up rolling-refactor PR after this lands
