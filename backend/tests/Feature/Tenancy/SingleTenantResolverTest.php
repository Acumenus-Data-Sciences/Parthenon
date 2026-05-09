<?php

use App\Tenancy\SingleTenantResolver;
use App\Tenancy\Tenant;
use Database\Seeders\DefaultTenantSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DefaultTenantSeeder::class);
    $this->resolver = app(SingleTenantResolver::class);
});

it('always resolves to Tenant#1', function () {
    expect($this->resolver->currentId())->toBe(1)
        ->and($this->resolver->current())->toBeInstanceOf(Tenant::class)
        ->and($this->resolver->current()->slug)->toBe('default')
        ->and($this->resolver->current()->display_name)->toBe('Default Tenant');
});

it('memoizes within a request', function () {
    $a = $this->resolver->current();
    $b = $this->resolver->current();
    expect($a)->toBe($b);
});

it('honors setCurrent for impersonation', function () {
    $other = Tenant::create([
        'slug' => 'pharma-acme',
        'display_name' => 'ACME Pharma',
        'billing_status' => 'active',
    ]);
    $this->resolver->setCurrent($other);
    expect($this->resolver->currentId())->toBe($other->id);
});

it('clears back to default', function () {
    $other = Tenant::create([
        'slug' => 'pharma-acme',
        'display_name' => 'ACME Pharma',
        'billing_status' => 'active',
    ]);
    $this->resolver->setCurrent($other);
    $this->resolver->clear();
    expect($this->resolver->currentId())->toBe(1);
});

it('throws if Tenant#1 is missing (R2 fail-loud)', function () {
    Tenant::where('id', 1)->delete();
    expect(fn () => (new SingleTenantResolver)->current())
        ->toThrow(RuntimeException::class, 'Default tenant');
});

it('snapshot returns empty for SingleTenantResolver (R2)', function () {
    expect($this->resolver->snapshot())->toBe([]);
});

it('restore is a no-op for SingleTenantResolver (R2)', function () {
    $this->resolver->restore(['arbitrary' => 'snapshot']);
    expect($this->resolver->currentId())->toBe(1);
});

it('seeder is idempotent', function () {
    // First seed already ran in beforeEach; running again must not error or duplicate.
    $this->seed(DefaultTenantSeeder::class);
    expect(Tenant::where('id', 1)->count())->toBe(1)
        ->and(Tenant::find(1)->slug)->toBe('default');
});
