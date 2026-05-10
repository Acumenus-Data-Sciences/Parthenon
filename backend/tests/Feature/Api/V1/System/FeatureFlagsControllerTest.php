<?php

declare(strict_types=1);

use App\Tenancy\SingleTenantResolver;

it('returns 200 + a tenancy.multi flag without authentication on a fresh CE install', function () {
    config(['tenancy.resolver' => SingleTenantResolver::class]);
    config(['feature-flags.flags' => []]);

    $res = $this->getJson('/api/v1/system/feature-flags');

    $res->assertOk();
    $body = $res->json();
    expect($body)->toHaveKey('data')
        ->and($body['data'])->toBeArray();

    $names = collect($body['data'])->pluck('name')->all();
    expect($names)
        ->toContain('tenancy.multi')
        ->and($names)->not->toContain('auth.saml')
        ->and($names)->not->toContain('auth.keycloak');
});

it('reports tenancy.multi=false / source=ce on the CE single-tenant default', function () {
    config(['tenancy.resolver' => SingleTenantResolver::class]);

    $res = $this->getJson('/api/v1/system/feature-flags');

    $tenancy = collect($res->json('data'))->firstWhere('name', 'tenancy.multi');
    expect($tenancy)
        ->not->toBeNull()
        ->and($tenancy['enabled'])->toBeFalse()
        ->and($tenancy['source'])->toBe('ce');
});

it('flips tenancy.multi=true / source=ee when MultiTenantResolver class name is configured', function () {
    config(['tenancy.resolver' => 'Acumenus\\Parthenon\\Enterprise\\Tenant\\MultiTenantResolver']);

    $res = $this->getJson('/api/v1/system/feature-flags');

    $tenancy = collect($res->json('data'))->firstWhere('name', 'tenancy.multi');
    expect($tenancy['enabled'])->toBeTrue()
        ->and($tenancy['source'])->toBe('ee');
});

it('does not require authentication (deployment posture is public by design)', function () {
    $this->getJson('/api/v1/system/feature-flags')->assertOk();
});

it('every entry has the documented shape', function () {
    $res = $this->getJson('/api/v1/system/feature-flags');

    foreach ($res->json('data') as $row) {
        expect($row)->toHaveKeys(['name', 'enabled', 'source', 'description'])
            ->and($row['name'])->toBeString()
            ->and($row['enabled'])->toBeBool()
            ->and(in_array($row['source'], ['ce', 'ee', 'config', 'license'], true))->toBeTrue();
    }
});

it('surfaces config-driven flags in the response', function () {
    config(['feature-flags.flags' => [
        'audit.signed' => [
            'enabled' => true,
            'source' => 'ee',
            'description' => 'Signed audit chain.',
        ],
    ]]);

    $res = $this->getJson('/api/v1/system/feature-flags');

    $signed = collect($res->json('data'))->firstWhere('name', 'audit.signed');
    expect($signed)
        ->not->toBeNull()
        ->and($signed['enabled'])->toBeTrue()
        ->and($signed['source'])->toBe('ee')
        ->and($signed['description'])->toBe('Signed audit chain.');
});
