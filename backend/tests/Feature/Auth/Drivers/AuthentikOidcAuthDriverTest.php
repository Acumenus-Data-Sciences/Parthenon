<?php

use App\Auth\Drivers\AuthDriverException;
use App\Auth\Drivers\AuthDriverResult;
use App\Auth\Drivers\AuthentikOidcAuthDriver;
use App\Models\User;
use App\Services\Auth\Oidc\OidcReconciliationService;
use App\Services\Auth\Oidc\ValidatedClaims;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery as m;

uses(RefreshDatabase::class);

afterEach(fn () => m::close());

beforeEach(function () {
    $this->reconciler = m::mock(OidcReconciliationService::class);
    $this->driver = new AuthentikOidcAuthDriver($this->reconciler);
});

it('has the expected stable name', function () {
    expect($this->driver->name())->toBe('authentik-oidc');
});

it('reports unavailable when OIDC config is missing', function () {
    config()->set('services.oidc.client_id', null);
    expect($this->driver->isAvailable())->toBeFalse();
});

it('reports available when OIDC config is present', function () {
    config()->set('services.oidc.client_id', 'parthenon-client');
    config()->set('services.oidc.discovery_url', 'https://auth.example/.well-known/openid-configuration');
    expect($this->driver->isAvailable())->toBeTrue();
});

it('resolves a user from validated OIDC claims', function () {
    $user = User::factory()->create([
        'email' => 'sso-user@acumenus.net',
    ]);

    $claims = new ValidatedClaims(
        sub: 'authentik|abc123',
        email: 'sso-user@acumenus.net',
        name: 'SSO User',
        groups: ['researchers'],
    );

    $this->reconciler
        ->shouldReceive('reconcile')
        ->with($claims)
        ->once()
        ->andReturn(['user' => $user, 'reason' => 'linked_by_sub']);

    $result = $this->driver->authenticate(['claims' => $claims]);

    expect($result)->toBeInstanceOf(AuthDriverResult::class)
        ->and($result->user->id)->toBe($user->id)
        ->and($result->driverName)->toBe('authentik-oidc')
        ->and($result->mustChangePassword)->toBeFalse()
        ->and($result->mfaAuthenticated)->toBeFalse()
        ->and($result->providerSubject)->toBe('authentik|abc123')
        ->and($result->providerClaims)->toMatchArray([
            'email' => 'sso-user@acumenus.net',
            'name' => 'SSO User',
            'groups' => ['researchers'],
            'reason' => 'linked_by_sub',
        ]);
});

it('rejects credentials missing claims with 422', function () {
    expect(fn () => $this->driver->authenticate([
        'state' => 'xyz',
    ]))->toThrow(AuthDriverException::class, 'Malformed credentials');
});

it('rejects credentials with non-ValidatedClaims claims with 422', function () {
    expect(fn () => $this->driver->authenticate([
        'claims' => 'a string instead of an object',
    ]))->toThrow(AuthDriverException::class, 'Malformed credentials');
});

it('wraps reconciler exceptions as AuthDriverException with code 401', function () {
    $claims = new ValidatedClaims(
        sub: 'authentik|abc123',
        email: 'sso-user@acumenus.net',
        name: 'SSO User',
        groups: [],
    );

    $this->reconciler
        ->shouldReceive('reconcile')
        ->andThrow(new RuntimeException('reconciliation failed'));

    try {
        $this->driver->authenticate(['claims' => $claims]);
        $this->fail('Expected AuthDriverException');
    } catch (AuthDriverException $e) {
        expect($e->getCode())->toBe(AuthDriverException::CODE_INVALID_CREDENTIALS)
            ->and($e->driverName)->toBe('authentik-oidc');
    }
});
