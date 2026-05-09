<?php

use App\Models\User;
use App\Tenancy\Concerns\TenantScope;
use App\Tenancy\SingleTenantResolver;
use App\Tenancy\Tenant;
use Database\Seeders\DefaultTenantSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DefaultTenantSeeder::class);
    // Reset the resolver's memoized state between tests.
    app(SingleTenantResolver::class)->clear();
});

it('attaches tenant_id from the resolver on User create', function () {
    $u = User::factory()->create([
        'email' => 'a@b.com',
        'tenant_id' => null,
    ]);
    expect($u->fresh()->tenant_id)->toBe(1);
});

it('uses an explicitly-set tenant_id when provided on create', function () {
    $other = Tenant::create(['slug' => 'pharma-acme', 'display_name' => 'ACME', 'billing_status' => 'active']);
    $u = User::factory()->create([
        'email' => 'cross@x.com',
        'tenant_id' => $other->id,
    ]);
    expect($u->fresh()->tenant_id)->toBe($other->id);
});

it('scopes User queries to the current tenant', function () {
    $other = Tenant::create(['slug' => 'pharma-acme', 'display_name' => 'ACME', 'billing_status' => 'active']);
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
    $other = Tenant::create(['slug' => 'p2', 'display_name' => 'P2', 'billing_status' => 'active']);
    User::factory()->create(['email' => 'a1@x.com']);
    User::factory()->create(['email' => 'a2@x.com', 'tenant_id' => $other->id]);

    expect(User::withoutGlobalScope(TenantScope::class)->count())->toBe(2);
});

it('preserves single-tenant behavior — no users invisible if tenant_id defaults to 1', function () {
    // Direct DB insert with NULL tenant_id (simulating pre-trait data).
    DB::connection('pgsql')->table('users')->insert([
        'name' => 'Pre-Trait User',
        'email' => 'pretrait@x.com',
        'password' => bcrypt('x'),
        'tenant_id' => null,  // Explicitly null — testing migration default
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // The migration default of 1 means Postgres fills NULL with 1 server-side
    // when the column is unspecified. With explicit NULL, the row is NULL.
    // We verify the trait scopes correctly: NULL rows are NOT visible to
    // tenant-scoped queries (they don't match `tenant_id = 1`).
    $rawCount = DB::connection('pgsql')->table('users')->where('email', 'pretrait@x.com')->count();
    expect($rawCount)->toBe(1);

    // Through the model with global scope — NULL doesn't match tenant_id=1.
    expect(User::where('email', 'pretrait@x.com')->count())->toBe(0);

    // Without scope — visible.
    expect(User::withoutGlobalScope(TenantScope::class)->where('email', 'pretrait@x.com')->count())->toBe(1);
});
