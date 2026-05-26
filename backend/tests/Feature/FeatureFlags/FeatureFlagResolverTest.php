<?php

declare(strict_types=1);

use App\Auth\AuthDriverRegistry;
use App\Auth\Drivers\AuthDriverResult;
use App\Contracts\AuthDriverInterface;
use App\Contracts\TenantResolverInterface;
use App\FeatureFlags\FeatureFlag;
use App\FeatureFlags\FeatureFlagResolver;
use App\Models\App\SystemSetting;
use App\Tenancy\SingleTenantResolver;

beforeEach(function () {
    config(['feature-flags.flags' => []]);
});

it('returns tenancy.multi and ai.agents on a fresh CE single-tenant install', function () {
    config(['tenancy.resolver' => SingleTenantResolver::class]);

    $resolver = new FeatureFlagResolver(
        authDrivers: app(AuthDriverRegistry::class),
        tenants: app(TenantResolverInterface::class),
    );

    $flags = $resolver->resolve();

    $names = array_map(fn (FeatureFlag $f) => $f->name, $flags);
    expect($names)
        ->toContain('tenancy.multi')
        ->toContain('ai.agents')
        ->and($names)->not->toContain('auth.saml')
        ->and($names)->not->toContain('auth.keycloak');

    $tenancy = collect($flags)->firstWhere('name', 'tenancy.multi');
    expect($tenancy)
        ->not->toBeNull()
        ->and($tenancy->enabled)->toBeFalse()
        ->and($tenancy->source)->toBe('ce');

    // ai.agents defaults to disabled when no DB row exists.
    $agents = collect($flags)->firstWhere('name', 'ai.agents');
    expect($agents)
        ->not->toBeNull()
        ->and($agents->enabled)->toBeFalse()
        ->and($agents->source)->toBe('config');
});

it('flips tenancy.multi=true when a non-CE resolver is configured', function () {
    config(['tenancy.resolver' => 'Acumenus\\Parthenon\\Enterprise\\Tenant\\MultiTenantResolver']);

    $resolver = new FeatureFlagResolver(authDrivers: null, tenants: null);
    $flags = $resolver->resolve();

    $tenancy = collect($flags)->firstWhere('name', 'tenancy.multi');
    expect($tenancy->enabled)->toBeTrue()
        ->and($tenancy->source)->toBe('ee');
});

it('emits an EE-sourced flag for every non-CE auth driver registered', function () {
    $registry = new AuthDriverRegistry;

    // Register a CE-baseline driver and an EE-style driver.
    $registry->register(new class implements AuthDriverInterface
    {
        public function name(): string
        {
            return 'local';
        }

        public function isAvailable(): bool
        {
            return true;
        }

        public function authenticate(array $credentials): AuthDriverResult
        {
            throw new LogicException('not used in this test');
        }
    });
    $registry->register(new class implements AuthDriverInterface
    {
        public function name(): string
        {
            return 'saml';
        }

        public function isAvailable(): bool
        {
            return true;
        }

        public function authenticate(array $credentials): AuthDriverResult
        {
            throw new LogicException('not used in this test');
        }
    });

    $resolver = new FeatureFlagResolver(authDrivers: $registry, tenants: null);
    $flags = $resolver->resolve();

    $authFlags = collect($flags)->filter(fn (FeatureFlag $f) => str_starts_with($f->name, 'auth.'));
    $names = $authFlags->pluck('name')->all();

    expect($names)
        ->toContain('auth.saml')
        ->and($names)->not->toContain('auth.local'); // CE baseline is not projected as a flag

    $saml = $authFlags->firstWhere('name', 'auth.saml');
    expect($saml->enabled)->toBeTrue()
        ->and($saml->source)->toBe('ee');
});

it('honors per-deployment config('.var_export('feature-flags.flags', true).')', function () {
    config(['feature-flags.flags' => [
        'audit.signed' => [
            'enabled' => true,
            'source' => 'ee',
            'description' => 'Signed audit chain.',
        ],
    ]]);

    $resolver = new FeatureFlagResolver(authDrivers: null, tenants: null);
    $flags = $resolver->resolve();

    $signed = collect($flags)->firstWhere('name', 'audit.signed');
    expect($signed)->not->toBeNull()
        ->and($signed->enabled)->toBeTrue()
        ->and($signed->source)->toBe('ee')
        ->and($signed->description)->toBe('Signed audit chain.');
});

it('skips malformed entries in config()', function () {
    config(['feature-flags.flags' => [
        'good.flag' => ['enabled' => true],
        42 => ['enabled' => true],          // non-string key
        'bad.flag' => 'not-an-array',       // non-array spec
    ]]);

    $resolver = new FeatureFlagResolver(authDrivers: null, tenants: null);
    $names = array_map(fn (FeatureFlag $f) => $f->name, $resolver->resolve());

    expect($names)
        ->toContain('good.flag')
        ->and($names)->not->toContain('bad.flag')
        ->and($names)->not->toContain('42');
});

it('every flag toArray() round-trips with stable shape', function () {
    config(['tenancy.resolver' => SingleTenantResolver::class]);

    $resolver = new FeatureFlagResolver(authDrivers: null, tenants: null);
    $flags = $resolver->resolve();

    foreach ($flags as $flag) {
        $row = $flag->toArray();
        expect($row)->toHaveKeys(['name', 'enabled', 'source', 'description'])
            ->and($row['name'])->toBeString()
            ->and($row['enabled'])->toBeBool()
            ->and(in_array($row['source'], ['ce', 'ee', 'config', 'license'], true))->toBeTrue();
    }
});

it('ai.agents flips to enabled=true when agents.enabled system setting is 1', function () {
    SystemSetting::setValue('agents.enabled', '1', 'agents');

    $resolver = new FeatureFlagResolver(authDrivers: null, tenants: null);
    $flags = $resolver->resolve();

    $agents = collect($flags)->firstWhere('name', 'ai.agents');
    expect($agents)
        ->not->toBeNull()
        ->and($agents->enabled)->toBeTrue()
        ->and($agents->source)->toBe('config');
});
