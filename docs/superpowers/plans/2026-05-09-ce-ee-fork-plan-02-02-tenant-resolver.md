# CE/EE Fork — Plan 02-02: TenantResolver Extension Point

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. See [Plan 02-01](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md) for the canonical TDD pattern this plan follows.

**Goal:** Add a `TenantResolverInterface` abstraction so Parthenon Community Edition can stay single-tenant by default while Enterprise Edition plugs in a `MultiTenantResolver` that routes requests, scopes Eloquent queries, and isolates per-tenant storage.

**Architecture:** Request-scoped resolver service. The resolver answers "what is the current tenant for this request?" and CE's default returns a static `Tenant::default()` (a singleton row with id=1). EE's `MultiTenantResolver` resolves from subdomain / `X-Tenant-Id` header / authenticated user's tenant claim. Tenant-aware Eloquent global scopes consume the resolver to filter queries by `tenant_id`. CE adds nullable `tenant_id` columns to relevant tables (defaults to 1, hidden behind a feature flag); existing single-tenant deployments see no behavior change.

**Tech Stack:** PHP 8.4, Laravel 11, Eloquent global scopes, Pest 3.

**Spec reference:** Spec §5 row 2.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:**
- Plan 02-01 merged (AuthDriver provides authenticated User context that the EE MultiTenantResolver may consume)
- Local main is current
- All license-guard required checks pass

---

## Pre-flight

```bash
cd /home/smudoshi/Github/Parthenon
git checkout main && git pull
git status                            # clean tree
head -3 LICENSE | grep AFFERO         # AGPLv3 confirmed
docker compose exec -T php sh -c "cd /var/www/html && php artisan tenant:current 2>&1 || echo 'OK: command not yet defined'"
```

---

## File structure

**New files:**

| Path | Purpose | LOC |
|---|---|---|
| `backend/app/Contracts/TenantResolverInterface.php` | Extension contract | ~50 |
| `backend/app/Tenancy/Tenant.php` | Eloquent model for `app.tenants` | ~50 |
| `backend/app/Tenancy/SingleTenantResolver.php` | CE default — always returns Tenant#1 | ~30 |
| `backend/app/Tenancy/Concerns/BelongsToTenant.php` | Trait: nullable `tenant_id` + global scope | ~70 |
| `backend/app/Providers/TenancyServiceProvider.php` | Binds resolver + registers feature flag | ~40 |
| `backend/config/tenancy.php` | Active resolver config + feature flag | ~30 |
| `backend/database/migrations/<ts>_create_tenants_table.php` | `app.tenants` schema | ~60 |
| `backend/database/migrations/<ts>_add_tenant_id_to_core_tables.php` | nullable `tenant_id` on User, Source, Cohort, etc. | ~80 |
| `backend/database/seeders/DefaultTenantSeeder.php` | Inserts Tenant#1 'default' | ~30 |
| `backend/tests/Feature/Tenancy/SingleTenantResolverTest.php` | Default resolver tests | ~60 |
| `backend/tests/Feature/Tenancy/BelongsToTenantTraitTest.php` | Global scope tests | ~120 |
| `backend/tests/Feature/Tenancy/StubMultiTenantResolver.php` | Test fixture proving pluggability | ~50 |
| `backend/tests/Feature/Tenancy/TenantResolverPluggabilityTest.php` | Stub-driver test | ~80 |
| `backend/app/Console/Commands/TenantCurrentCommand.php` | Diagnostic CLI: print current tenant | ~30 |
| `docs/architecture/extension-points/tenant-resolver.md` | Detailed doc | ~250 |

**Modified files:**

| Path | What changes |
|---|---|
| `backend/app/Models/User.php` | `use BelongsToTenant;` |
| `backend/app/Models/App/Source.php` | `use BelongsToTenant;` |
| `backend/app/Models/App/Cohort.php` (and similar tenant-scoped models) | `use BelongsToTenant;` |
| `backend/bootstrap/providers.php` | Register `TenancyServiceProvider` |
| `backend/config/database.php` | No change (single DB stays the same) |
| `docs/architecture/extension-points.md` | Mark row 2 done; link detail page |

**Models that get the trait** (initial set; expand as needed):
- `User`, `App\Source`, `App\Cohort`, `App\ConceptSet`, `App\Analysis`, `App\Study`, `App\AuditLog`, `App\IngestionJob`

**NOT scoped by tenant** (intentional):
- OMOP CDM tables (`omop.*`, `vocab.*`) — clinical data lives in source-specific schemas, source membership is the tenancy boundary
- Vocabulary tables — shared
- Achilles `*_results` schemas — bound to a source, not a tenant directly

---

## Task 1: TenantResolverInterface + Tenant model + SingleTenantResolver

- [ ] **Step 1.1: Interface**

```php
<?php
namespace App\Contracts;

use App\Tenancy\Tenant;

/**
 * Resolves the current tenant for the active request/job.
 *
 * Community Edition: SingleTenantResolver returns Tenant#1 ('default')
 * for every request — single-tenant deployments see no behavior change.
 *
 * Enterprise Edition: MultiTenantResolver resolves from request context
 * (subdomain, X-Tenant-Id header, JWT claim, or authenticated user's
 * primary tenant) and supports impersonation for super-admins.
 *
 * Implementations MUST be safe to call multiple times per request and
 * SHOULD memoize the result. Implementations MUST throw if no tenant
 * can be resolved (rather than returning null) — Parthenon assumes
 * every request has a tenant context.
 */
interface TenantResolverInterface
{
    public function current(): Tenant;
    public function currentId(): int;

    /** Switch the request-scoped tenant context (for impersonation, jobs). */
    public function setCurrent(Tenant $tenant): void;
    public function clear(): void;
}
```

- [ ] **Step 1.2: Tenants migration**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::connection('pgsql')->create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();             // e.g. 'default', 'geisinger', 'pharma-acme'
            $table->string('display_name');
            $table->string('billing_status')->default('active');  // 'active'|'suspended'|'archived'
            $table->json('settings')->nullable();         // tenant-scoped feature flags etc.
            $table->timestamps();
        });
    }
    public function down(): void {
        Schema::connection('pgsql')->dropIfExists('tenants');
    }
};
```

- [ ] **Step 1.3: Add `tenant_id` to core tables (nullable, default 1)**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    private array $tables = [
        'users', 'sources', 'cohorts', 'concept_sets',
        'analyses', 'studies', 'audit_logs', 'ingestion_jobs',
    ];

    public function up(): void {
        foreach ($this->tables as $t) {
            if (!Schema::connection('pgsql')->hasColumn($t, 'tenant_id')) {
                Schema::connection('pgsql')->table($t, function (Blueprint $table) {
                    $table->unsignedBigInteger('tenant_id')->nullable()->default(1)->index();
                    $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
                });
            }
        }
    }

    public function down(): void {
        foreach ($this->tables as $t) {
            Schema::connection('pgsql')->table($t, function (Blueprint $table) use ($t) {
                if (Schema::hasColumn($t, 'tenant_id')) {
                    $table->dropForeign(["{$t}_tenant_id_foreign"]);
                    $table->dropColumn('tenant_id');
                }
            });
        }
    }
};
```

- [ ] **Step 1.4: DefaultTenantSeeder**

```php
<?php
namespace Database\Seeders;

use App\Tenancy\Tenant;
use Illuminate\Database\Seeder;

class DefaultTenantSeeder extends Seeder {
    public function run(): void {
        Tenant::updateOrCreate(
            ['id' => 1],
            ['slug' => 'default', 'display_name' => 'Default Tenant', 'billing_status' => 'active'],
        );
    }
}
```

Wire into `DatabaseSeeder::run()` near the top so other seeders that touch tenant-scoped tables can rely on Tenant#1 existing.

- [ ] **Step 1.5: Tenant model**

```php
<?php
namespace App\Tenancy;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tenant extends Model {
    use HasFactory;
    protected $connection = 'pgsql';
    protected $table = 'tenants';
    protected $fillable = ['slug', 'display_name', 'billing_status', 'settings'];
    protected $casts = ['settings' => 'array'];

    public static function default(): self {
        return self::firstOrFail()->where('id', 1)->firstOrFail();
    }
}
```

- [ ] **Step 1.6: SingleTenantResolver**

```php
<?php
namespace App\Tenancy;

use App\Contracts\TenantResolverInterface;

class SingleTenantResolver implements TenantResolverInterface {
    private ?Tenant $current = null;

    public function current(): Tenant {
        return $this->current ??= Tenant::find(1) ?? throw new \RuntimeException(
            'Default tenant (id=1) not seeded. Run db:seed --class=DefaultTenantSeeder.'
        );
    }
    public function currentId(): int { return $this->current()->id; }
    public function setCurrent(Tenant $tenant): void { $this->current = $tenant; }
    public function clear(): void { $this->current = null; }
}
```

- [ ] **Step 1.7: Test the resolver**

```php
<?php
use App\Tenancy\SingleTenantResolver;
use App\Tenancy\Tenant;

beforeEach(fn() => $this->resolver = app(SingleTenantResolver::class));

it('always resolves to Tenant#1', function () {
    expect($this->resolver->currentId())->toBe(1)
        ->and($this->resolver->current())->toBeInstanceOf(Tenant::class)
        ->and($this->resolver->current()->slug)->toBe('default');
});

it('memoizes within a request', function () {
    $a = $this->resolver->current();
    $b = $this->resolver->current();
    expect($a)->toBe($b);
});

it('honors setCurrent for impersonation', function () {
    $other = Tenant::create(['slug' => 'pharma-acme', 'display_name' => 'ACME']);
    $this->resolver->setCurrent($other);
    expect($this->resolver->currentId())->toBe($other->id);
});

it('clears back to default', function () {
    $other = Tenant::create(['slug' => 'pharma-acme', 'display_name' => 'ACME']);
    $this->resolver->setCurrent($other);
    $this->resolver->clear();
    expect($this->resolver->currentId())->toBe(1);
});

it('throws if Tenant#1 is missing', function () {
    Tenant::where('id', 1)->delete();
    expect(fn() => (new SingleTenantResolver())->current())
        ->toThrow(\RuntimeException::class, 'Default tenant');
});
```

- [ ] **Step 1.8: Run + commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Tenancy/SingleTenantResolverTest.php"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Contracts/TenantResolverInterface.php app/Tenancy/"

git add backend/app/Contracts/TenantResolverInterface.php \
        backend/app/Tenancy/ \
        backend/database/migrations/*tenants* \
        backend/database/migrations/*tenant_id* \
        backend/database/seeders/DefaultTenantSeeder.php \
        backend/tests/Feature/Tenancy/SingleTenantResolverTest.php

git commit -m "feat(tenancy): add TenantResolverInterface + SingleTenantResolver

First step of the TenantResolver extension point (Phase 2 #2 of 8).
Single-tenant CE deployments unaffected: SingleTenantResolver always
returns Tenant#1 ('default'), seeded on first migration.

Adds:
  - App\\Contracts\\TenantResolverInterface — extension contract.
  - App\\Tenancy\\Tenant — Eloquent model on app.tenants.
  - App\\Tenancy\\SingleTenantResolver — CE default driver.
  - Migrations: app.tenants table + nullable tenant_id (default=1) on
    8 core tables (users, sources, cohorts, concept_sets, analyses,
    studies, audit_logs, ingestion_jobs).
  - DefaultTenantSeeder — idempotent insert of Tenant#1.

No models use the BelongsToTenant trait yet — that lands in Task 2.
Existing queries see no behavior change."
```

---

## Task 2: BelongsToTenant trait + global scope

- [ ] **Step 2.1: Failing test**

```php
<?php
use App\Models\User;
use App\Tenancy\Tenant;
use App\Tenancy\SingleTenantResolver;

it('attaches tenant_id from the resolver on create', function () {
    User::factory()->create(['email' => 'a@b.com', 'tenant_id' => null]);
    $u = User::where('email', 'a@b.com')->first();
    expect($u->tenant_id)->toBe(1);
});

it('scopes queries to current tenant', function () {
    $other = Tenant::create(['slug' => 'pharma-acme', 'display_name' => 'ACME']);
    User::factory()->create(['email' => 'tenant1@x.com']);
    User::factory()->create(['email' => 'tenant2@x.com', 'tenant_id' => $other->id]);

    // Default resolver = Tenant#1 → only 1 user visible.
    expect(User::count())->toBe(1)
        ->and(User::first()->email)->toBe('tenant1@x.com');

    // Switch to other tenant → only the other user visible.
    app(SingleTenantResolver::class)->setCurrent($other);
    expect(User::count())->toBe(1)
        ->and(User::first()->email)->toBe('tenant2@x.com');
});

it('allows withoutGlobalScope to bypass for admin tooling', function () {
    $other = Tenant::create(['slug' => 'p2', 'display_name' => 'P2']);
    User::factory()->create();
    User::factory()->create(['tenant_id' => $other->id]);
    expect(User::withoutGlobalScope(\App\Tenancy\Concerns\TenantScope::class)->count())->toBe(2);
});
```

- [ ] **Step 2.2: Trait + scope**

```php
<?php
namespace App\Tenancy\Concerns;

use App\Contracts\TenantResolverInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope {
    public function apply(Builder $builder, Model $model): void {
        $resolver = app(TenantResolverInterface::class);
        $builder->where($model->getTable() . '.tenant_id', $resolver->currentId());
    }
}

trait BelongsToTenant {
    public static function bootBelongsToTenant(): void {
        static::addGlobalScope(new TenantScope());
        static::creating(function (Model $model) {
            if ($model->tenant_id === null) {
                $model->tenant_id = app(TenantResolverInterface::class)->currentId();
            }
        });
    }
}
```

- [ ] **Step 2.3: Apply trait to User**

```php
// backend/app/Models/User.php — add to the use list
use App\Tenancy\Concerns\BelongsToTenant;
// ... in class body:
use BelongsToTenant;
```

- [ ] **Step 2.4: Run tests, verify existing User tests still pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Tenancy/ tests/Feature/Auth/ tests/Unit/Models/User"
```

The `tenant_id` default of 1 in the migration means every existing user keeps working unchanged.

- [ ] **Step 2.5: Commit Task 2**

```bash
git commit -m "feat(tenancy): BelongsToTenant trait + tenant-scoped User queries

Adds App\\Tenancy\\Concerns\\BelongsToTenant trait + TenantScope global
scope. Wired onto App\\Models\\User. Behavior:

  - On create: tenant_id auto-fills from the resolver if null.
  - On query: WHERE tenant_id = resolver->currentId() applied unless
    withoutGlobalScope(TenantScope::class) is used.

Existing User tests pass without modification because the migration's
nullable default of 1 + SingleTenantResolver returning 1 means every
single-tenant flow keeps working unchanged."
```

---

## Task 3: Apply trait to remaining tenant-scoped models

For each of `App\Source`, `App\Cohort`, `App\ConceptSet`, `App\Analysis`, `App\Study`, `App\AuditLog`, `App\IngestionJob`:

- [ ] **Step 3.1: Add `use BelongsToTenant;` to the model**
- [ ] **Step 3.2: Run that model's existing test suite — must pass unchanged**
- [ ] **Step 3.3: Commit per model (or batch if tests are passing)**

```bash
git commit -m "feat(tenancy): scope <Model> by tenant via BelongsToTenant"
```

---

## Task 4: Service provider + config + bootstrap

- [ ] **Step 4.1: TenancyServiceProvider**

```php
<?php
namespace App\Providers;

use App\Contracts\TenantResolverInterface;
use App\Tenancy\SingleTenantResolver;
use Illuminate\Support\ServiceProvider;

class TenancyServiceProvider extends ServiceProvider {
    public function register(): void {
        $resolverClass = config('tenancy.resolver', SingleTenantResolver::class);
        $this->app->singleton(TenantResolverInterface::class, $resolverClass);
        $this->app->alias(TenantResolverInterface::class, 'tenancy.resolver');
    }
}
```

- [ ] **Step 4.2: config/tenancy.php**

```php
<?php

use App\Tenancy\SingleTenantResolver;

return [
    'resolver' => env('TENANCY_RESOLVER', SingleTenantResolver::class),

    /*
    | Future: Enterprise Edition sets TENANCY_RESOLVER to its
    | App\\Tenancy\\MultiTenantResolver class via env or its own service
    | provider. EE-specific options (subdomain regex, header name,
    | impersonation policies) live in the EE config file.
    */

    'feature_flag' => env('TENANCY_MULTI_ENABLED', false),
];
```

- [ ] **Step 4.3: bootstrap/providers.php — register**

Add `App\Providers\TenancyServiceProvider::class` to the providers array.

- [ ] **Step 4.4: Diagnostic command**

```php
<?php
namespace App\Console\Commands;

use App\Contracts\TenantResolverInterface;
use Illuminate\Console\Command;

class TenantCurrentCommand extends Command {
    protected $signature = 'tenant:current';
    protected $description = 'Print the currently-resolved tenant';

    public function handle(TenantResolverInterface $resolver): int {
        $t = $resolver->current();
        $this->info("Current tenant: id={$t->id} slug={$t->slug} name='{$t->display_name}'");
        $this->info("Resolver: " . config('tenancy.resolver'));
        return self::SUCCESS;
    }
}
```

- [ ] **Step 4.5: Smoke**

```bash
docker compose exec -T php sh -c "cd /var/www/html && php artisan tenant:current"
# Expect: Current tenant: id=1 slug=default name='Default Tenant'
```

- [ ] **Step 4.6: Commit**

```bash
git commit -m "feat(tenancy): service provider + config + tenant:current command

TenancyServiceProvider binds TenantResolverInterface to the class
named in config/tenancy.php (default: SingleTenantResolver). EE
overrides via TENANCY_RESOLVER env or its own provider.

Adds php artisan tenant:current diagnostic for ops verification."
```

---

## Task 5: Pluggability proof — StubMultiTenantResolver

- [ ] **Step 5.1: Stub fixture**

```php
<?php
namespace Tests\Feature\Tenancy;

use App\Contracts\TenantResolverInterface;
use App\Tenancy\Tenant;

/** Test-only resolver: switches based on a request header. */
class StubMultiTenantResolver implements TenantResolverInterface {
    private ?Tenant $current = null;
    public function current(): Tenant {
        if ($this->current) return $this->current;
        $headerSlug = request()?->header('X-Tenant-Slug') ?? 'default';
        return $this->current = Tenant::where('slug', $headerSlug)->firstOrFail();
    }
    public function currentId(): int { return $this->current()->id; }
    public function setCurrent(Tenant $tenant): void { $this->current = $tenant; }
    public function clear(): void { $this->current = null; }
}
```

- [ ] **Step 5.2: Pluggability test**

```php
<?php
use App\Contracts\TenantResolverInterface;
use App\Models\User;
use App\Tenancy\Tenant;
use Tests\Feature\Tenancy\StubMultiTenantResolver;

it('honors a custom resolver registered via the binding', function () {
    Tenant::create(['slug' => 'acme', 'display_name' => 'ACME']);
    app()->bind(TenantResolverInterface::class, StubMultiTenantResolver::class);

    $u1 = User::factory()->create(['tenant_id' => 1, 'email' => 'd@x.com']);
    $u2 = User::factory()->create(['tenant_id' => 2, 'email' => 'a@x.com']);

    $this->withHeader('X-Tenant-Slug', 'acme')
        ->getJson('/api/v1/users')
        ->assertOk()
        ->assertJsonPath('data.0.email', 'a@x.com');
});
```

- [ ] **Step 5.3: Commit**

```bash
git commit -m "test(tenancy): prove pluggability via StubMultiTenantResolver

Demonstrates that an alternate TenantResolverInterface implementation
can replace SingleTenantResolver via the container binding. Header-
driven stub resolves tenant from X-Tenant-Slug; users from other
tenants are correctly invisible to a request scoped to a different
tenant. This is the contract that EE's MultiTenantResolver fulfills."
```

---

## Task 6: Documentation

- [ ] **Step 6.1: Write `docs/architecture/extension-points/tenant-resolver.md`** covering:
  - The `TenantResolverInterface` contract
  - When the trait applies (and when it doesn't — vocab/CDM tables)
  - How to register a custom resolver
  - SingleTenantResolver semantics
  - Hypothetical MultiTenantResolver examples (subdomain, header, JWT)
  - How `withoutGlobalScope(TenantScope::class)` works for admin tooling
  - Migration story for orgs adopting multi-tenancy

- [ ] **Step 6.2: Update `docs/architecture/extension-points.md`** to mark row 2 done with link

- [ ] **Step 6.3: Commit**

```bash
git commit -m "docs(tenancy): document TenantResolver extension point"
```

---

## Task 7: PR

- [ ] **Step 7.1: Push + open**

```bash
git push -u origin feature/extension-point-tenant-resolver

gh pr create --title "feat(tenancy): TenantResolver extension point (Phase 2 #2 of 8)" \
  --body "$(cat <<'EOF'
## Summary

Second of 8 CE extension-point PRs. Adds TenantResolverInterface so EE can ship MultiTenantResolver in `enterprise/backend/src/Tenant/` without patching CE.

## Behavioral changes

**None observable in single-tenant deployments.** `tenant_id` columns added with default=1; SingleTenantResolver always returns Tenant#1. Existing single-tenant deploys keep working byte-for-byte.

## Files
[summary]

## Test plan
- [ ] CI green
- [ ] All existing model tests pass unchanged (SingleTenantResolver default preserves behavior)
- [ ] New tenant tests pass (including pluggability proof via StubMultiTenantResolver)
- [ ] `php artisan tenant:current` works on staging
- [ ] HIGHSEC §3.1 still applies: BelongsToTenant trait does NOT use `$guarded = []`

## What this enables
- EE MultiTenantResolver in Plan 04
- Per-tenant feature flags (Plan 02-06)
- Per-tenant audit retention (Plan 02-04)
EOF
)"
```

- [ ] **Step 7.2: Wait for CI green, merge, delete branch**

---

## Plan 02-02 completion checklist

- [ ] `App\Contracts\TenantResolverInterface` exists, documented
- [ ] `Tenant` model + `app.tenants` table + DefaultTenantSeeder
- [ ] `SingleTenantResolver` is the bound default; preserves CE behavior
- [ ] `BelongsToTenant` trait applied to 8 core models
- [ ] `php artisan tenant:current` reports `default`
- [ ] `StubMultiTenantResolver` test proves pluggability
- [ ] Doc page published; index updated
- [ ] PR merged, license-guard passes (no LICENSE/manifest changes)

## Out of scope

- EE `MultiTenantResolver` — ships in Plan 04 (`Acumenus-Data-Sciences/Parthenon-EE`)
- Tenant-aware data migrations (moving existing single-tenant rows to specific tenants) — Plan 04
- Tenant-scoped storage paths / S3 prefixes — Plan 04
- Per-tenant rate limiting — Plan 04
- Tenant-aware Solr cores — Plan 04 (or later)

*End of Plan 02-02.*
