<?php

use App\Auth\AuthDriverRegistry;
use App\Auth\Drivers\AuthentikOidcAuthDriver;
use App\Auth\Drivers\LocalCredentialsAuthDriver;
use Tests\Feature\Auth\StubAuthDriver;

beforeEach(function () {
    $this->registry = app(AuthDriverRegistry::class);
});

it('resolves the local driver by name', function () {
    expect($this->registry->driver('local'))
        ->toBeInstanceOf(LocalCredentialsAuthDriver::class);
});

it('resolves the authentik-oidc driver by name', function () {
    expect($this->registry->driver('authentik-oidc'))
        ->toBeInstanceOf(AuthentikOidcAuthDriver::class);
});

it('throws on unknown driver name', function () {
    expect(fn () => $this->registry->driver('nonexistent'))
        ->toThrow(InvalidArgumentException::class, 'Unknown auth driver');
});

it('lists registered driver names', function () {
    $names = $this->registry->names();
    expect($names)->toContain('local')->toContain('authentik-oidc');
});

it('accepts runtime-registered drivers (proves pluggability)', function () {
    $this->registry->register(new StubAuthDriver);
    expect($this->registry->driver('stub-test-only'))
        ->toBeInstanceOf(StubAuthDriver::class);
    expect($this->registry->names())->toContain('stub-test-only');
});

it('lists only available drivers', function () {
    config()->set('services.oidc.client_id', null);
    config()->set('services.oidc.discovery_url', null);

    // Re-resolve to pick up config change (driver memoizes nothing at construction).
    $registry = app(AuthDriverRegistry::class);

    expect($registry->availableNames())->toContain('local');
    // authentik-oidc should be excluded because isAvailable() returns false
    expect($registry->availableNames())->not->toContain('authentik-oidc');
});
