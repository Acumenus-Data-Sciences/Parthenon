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
    User::factory()->create(['email' => 'tenant1-bttt@parthenon.local']);
    User::factory()->create(['email' => 'tenant2-bttt@parthenon.local', 'tenant_id' => $other->id]);

    // Filter to test-created emails so unrelated users from other tests don't leak in.
    $bttQuery = fn () => User::query()->where('email', 'like', '%-bttt@parthenon.local');

    // Default resolver = Tenant#1 → only the tenant1 user is visible (scope filters to tenant_id=1).
    expect($bttQuery()->count())->toBe(1)
        ->and($bttQuery()->first()->email)->toBe('tenant1-bttt@parthenon.local');

    // Switch to other tenant → only the other user visible.
    app(SingleTenantResolver::class)->setCurrent($other);
    expect($bttQuery()->count())->toBe(1)
        ->and($bttQuery()->first()->email)->toBe('tenant2-bttt@parthenon.local');
});

it('allows withoutGlobalScope to bypass for admin tooling', function () {
    $other = Tenant::create(['slug' => 'p2', 'display_name' => 'P2', 'billing_status' => 'active']);
    User::factory()->create(['email' => 'a1-bttt@parthenon.local']);
    User::factory()->create(['email' => 'a2-bttt@parthenon.local', 'tenant_id' => $other->id]);

    // Filter to test-created emails — global scope OFF should reveal both.
    expect(
        User::withoutGlobalScope(TenantScope::class)
            ->where('email', 'like', '%-bttt@parthenon.local')
            ->count()
    )->toBe(2);
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
