<?php

use App\Contracts\TenantResolverInterface;
use App\Models\User;
use App\Tenancy\SingleTenantResolver;
use App\Tenancy\Tenant;
use Database\Seeders\DefaultTenantSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Tenancy\StubMultiTenantResolver;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DefaultTenantSeeder::class);
});

it('honors a custom resolver registered via the container binding', function () {
    Tenant::create(['slug' => 'acme', 'display_name' => 'ACME', 'billing_status' => 'active']);

    // Bind the alternate resolver — proves the contract allows EE to plug in.
    app()->bind(TenantResolverInterface::class, StubMultiTenantResolver::class);

    $defaultUser = User::factory()->create([
        'email' => 'default@x.com',
        'tenant_id' => 1,
    ]);
    $acmeUser = User::factory()->create([
        'email' => 'acme@x.com',
        'tenant_id' => Tenant::where('slug', 'acme')->first()->id,
    ]);

    // No header → resolver returns 'default' tenant → only default user visible.
    expect(User::query()->where('email', 'like', '%@x.com')->pluck('email')->all())
        ->toBe(['default@x.com']);
});

it('snapshot/restore roundtrip preserves tenant context (R2)', function () {
    $acme = Tenant::create(['slug' => 'acme', 'display_name' => 'ACME', 'billing_status' => 'active']);

    app()->bind(TenantResolverInterface::class, StubMultiTenantResolver::class);
    /** @var StubMultiTenantResolver $resolver */
    $resolver = app(TenantResolverInterface::class);
    $resolver->setCurrent($acme);

    $snap = $resolver->snapshot();
    expect($snap)->toBe(['slug' => 'acme']);

    // Simulate the queued-job lifecycle: clear + restore.
    $resolver->clear();
    $resolver2 = new StubMultiTenantResolver;
    $resolver2->restore($snap);
    expect($resolver2->currentId())->toBe($acme->id);
});

it('SingleTenantResolver and an EE-style resolver implement the same contract', function () {
    $tenant = Tenant::create(['slug' => 'tenant-x', 'display_name' => 'Tenant X', 'billing_status' => 'active']);

    // CE default
    /** @var SingleTenantResolver $single */
    $single = app(SingleTenantResolver::class);
    expect($single->snapshot())->toBe([]);
    $single->setCurrent($tenant);
    expect($single->currentId())->toBe($tenant->id);

    // EE-style
    $multi = new StubMultiTenantResolver;
    $multi->setCurrent($tenant);
    expect($multi->snapshot())->toBe(['slug' => 'tenant-x'])
        ->and($multi->currentId())->toBe($tenant->id);
});
