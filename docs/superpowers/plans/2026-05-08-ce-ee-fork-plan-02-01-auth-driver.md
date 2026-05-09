# CE/EE Fork — Plan 02-01: AuthDriver Extension Point

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `AuthDriverInterface` abstraction to Parthenon Community Edition's authentication layer, refactor existing local-credentials and Authentik OIDC flows into pluggable drivers, and document the extension surface so Enterprise Edition can ship Keycloak/SAML/SCIM drivers in `enterprise/backend/src/Auth/` without patching CE files.

**Architecture:** Identity-provider-level driver pattern. `AuthDriverInterface` exposes a single `authenticate(array $credentials): AuthDriverResult` method returning the resolved User plus driver metadata. CE ships two drivers: `local` (existing Sanctum-token + email/password flow from `AuthController::login`) and `authentik-oidc` (existing OIDC flow from `OidcController`). Token issuance via Sanctum stays centralized in the controller after the driver resolves the user. EE drivers (`keycloak`, `saml`, `scim`) are registered in EE's service provider against the same interface.

**Tech Stack:** PHP 8.4, Laravel 11, Sanctum, Spatie\Permission, Pest 3 for tests.

**Spec reference:** [docs/superpowers/specs/2026-05-08-ce-ee-fork-and-agplv3-relicense-design.md](../specs/2026-05-08-ce-ee-fork-and-agplv3-relicense-design.md) §5 row 1.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:**
- Plan 01 PRs (#311, #312, #313) merged to main
- Local clone's `origin` points at `Acumenus-Data-Sciences/Parthenon`
- `composer install`, `npm ci --legacy-peer-deps` succeed
- `docker compose up -d` succeeds

---

## Pre-flight

Before starting any task:

1. `cd /home/smudoshi/Github/Parthenon`
2. `git checkout main && git pull` — confirm at the merged tip
3. `git status` — clean tree (no user WIP); if WIP exists, this plan goes in a worktree
4. `head -3 LICENSE | grep AFFERO` — confirms AGPLv3 is in main
5. `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --version"` — Pest is installed
6. `docker compose exec -T php sh -c "cd /var/www/html && php artisan route:list | grep auth"` — confirms current auth routes work

---

## File structure

**New files:**

| Path | Purpose | LOC est |
|---|---|---|
| `backend/app/Contracts/AuthDriverInterface.php` | The extension-point interface | ~60 |
| `backend/app/Auth/Drivers/AuthDriverResult.php` | Value object returned by drivers (User + metadata) | ~50 |
| `backend/app/Auth/Drivers/LocalCredentialsAuthDriver.php` | Default driver for email/password | ~100 |
| `backend/app/Auth/Drivers/AuthentikOidcAuthDriver.php` | Default driver for Authentik OIDC | ~100 |
| `backend/app/Auth/AuthDriverRegistry.php` | Resolves a driver by name; registered as singleton | ~70 |
| `backend/app/Providers/AuthDriverServiceProvider.php` | Registers built-in drivers + binds the registry | ~50 |
| `backend/config/auth-drivers.php` | Driver registry config (name → class) | ~40 |
| `backend/tests/Feature/Auth/Drivers/LocalCredentialsAuthDriverTest.php` | Integration test | ~120 |
| `backend/tests/Feature/Auth/Drivers/AuthentikOidcAuthDriverTest.php` | Integration test | ~120 |
| `backend/tests/Feature/Auth/AuthDriverRegistryTest.php` | Integration test (resolve, list, error) | ~80 |
| `backend/tests/Feature/Auth/StubAuthDriver.php` | Test fixture proving pluggability | ~40 |
| `docs/architecture/extension-points.md` | Index page for all 8 extension points (start here) | ~80 |
| `docs/architecture/extension-points/auth-driver.md` | Detailed AuthDriver doc | ~200 |

**Modified files:**

| Path | What changes |
|---|---|
| `backend/app/Http/Controllers/Api/V1/AuthController.php` | `login()` delegates user resolution to `AuthDriverRegistry::driver('local')->authenticate(...)`. Token issuance remains in controller. Behavior identical for users. |
| `backend/app/Http/Controllers/Api/V1/Auth/OidcController.php` | `callback()` delegates user resolution to `AuthDriverRegistry::driver('authentik-oidc')->authenticate(...)`. |
| `backend/config/app.php` | Adds `AuthDriverServiceProvider::class` to `providers` array |
| `backend/bootstrap/providers.php` (Laravel 11 convention) | Adds `AuthDriverServiceProvider::class` |

**No deletions.** Refactor preserves all existing classes — they become driver implementations.

---

## Task 1: Define `AuthDriverInterface`

**Files:**
- Create: `backend/app/Contracts/AuthDriverInterface.php`

- [ ] **Step 1.1: Write the interface (TDD-first — define the contract)**

```php
<?php

namespace App\Contracts;

use App\Auth\Drivers\AuthDriverResult;

/**
 * Identity provider abstraction for Parthenon authentication.
 *
 * Implementations resolve a set of credentials (email+password, OIDC
 * authorization code, SAML assertion, SCIM event, etc.) into a Parthenon
 * User. Token issuance (Sanctum) is centralized in AuthController and
 * is NOT the driver's responsibility — drivers only resolve identity.
 *
 * Community Edition ships two drivers:
 *   - LocalCredentialsAuthDriver   (driver name: "local")
 *   - AuthentikOidcAuthDriver      (driver name: "authentik-oidc")
 *
 * Enterprise Edition adds (in enterprise/backend/src/Auth/):
 *   - KeycloakAuthDriver           (driver name: "keycloak")
 *   - SamlAuthDriver               (driver name: "saml")
 *   - ScimSyncAuthDriver           (driver name: "scim")
 *
 * Register a driver by adding it to config/auth-drivers.php under
 * 'drivers' => [ 'driver-name' => DriverClass::class ].
 *
 * See docs/architecture/extension-points/auth-driver.md for the full
 * extension contract.
 */
interface AuthDriverInterface
{
    /**
     * Stable string identifier for this driver. Must match the key
     * registered in config/auth-drivers.php.
     */
    public function name(): string;

    /**
     * Resolve credentials into an authenticated user.
     *
     * @param array<string, mixed> $credentials Driver-specific shape.
     *   For "local": ['email' => string, 'password' => string]
     *   For "authentik-oidc": ['code' => string, 'state' => string]
     *
     * @throws \App\Auth\Drivers\AuthDriverException on auth failure.
     *   The exception's getCode() returns one of:
     *     - 401 (invalid credentials)
     *     - 403 (account disabled / not provisioned)
     *     - 422 (malformed credentials)
     *     - 500 (provider unreachable)
     */
    public function authenticate(array $credentials): AuthDriverResult;

    /**
     * Whether this driver is currently usable (e.g., Authentik
     * configured, network reachable). Used for health checks and to
     * exclude unavailable drivers from login UI.
     */
    public function isAvailable(): bool;
}
```

- [ ] **Step 1.2: No commit yet** — interface is part of larger TDD cycle. Steps 1–4 stage together.

---

## Task 2: Define `AuthDriverResult` and `AuthDriverException`

**Files:**
- Create: `backend/app/Auth/Drivers/AuthDriverResult.php`
- Create: `backend/app/Auth/Drivers/AuthDriverException.php`

- [ ] **Step 2.1: AuthDriverResult**

```php
<?php

namespace App\Auth\Drivers;

use App\Models\User;

/**
 * Value object returned by AuthDriverInterface::authenticate().
 *
 * Drivers return resolved identity + per-driver metadata. The caller
 * (AuthController) is responsible for token issuance and session setup.
 */
final readonly class AuthDriverResult
{
    public function __construct(
        public User $user,
        public string $driverName,
        public bool $mustChangePassword = false,
        public ?string $providerSubject = null,
        /** @var array<string, mixed> */
        public array $providerClaims = [],
    ) {}
}
```

- [ ] **Step 2.2: AuthDriverException**

```php
<?php

namespace App\Auth\Drivers;

use Exception;

class AuthDriverException extends Exception
{
    public const CODE_INVALID_CREDENTIALS = 401;
    public const CODE_ACCOUNT_DISABLED = 403;
    public const CODE_MALFORMED_CREDENTIALS = 422;
    public const CODE_PROVIDER_UNREACHABLE = 500;

    public function __construct(
        string $message,
        int $code,
        public readonly string $driverName,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }
}
```

---

## Task 3: Write the failing test for `LocalCredentialsAuthDriver`

**Files:**
- Create: `backend/tests/Feature/Auth/Drivers/LocalCredentialsAuthDriverTest.php`

- [ ] **Step 3.1: Failing test**

```php
<?php

use App\Auth\Drivers\AuthDriverException;
use App\Auth\Drivers\AuthDriverResult;
use App\Auth\Drivers\LocalCredentialsAuthDriver;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

beforeEach(function () {
    $this->driver = app(LocalCredentialsAuthDriver::class);
});

it('has the expected stable name', function () {
    expect($this->driver->name())->toBe('local');
});

it('reports availability', function () {
    expect($this->driver->isAvailable())->toBeTrue();
});

it('authenticates a user with valid email + password', function () {
    $user = User::factory()->create([
        'email' => 'researcher@acumenus.net',
        'password' => Hash::make('CorrectHorseBattery'),
        'must_change_password' => false,
    ]);

    $result = $this->driver->authenticate([
        'email' => 'researcher@acumenus.net',
        'password' => 'CorrectHorseBattery',
    ]);

    expect($result)->toBeInstanceOf(AuthDriverResult::class)
        ->and($result->user->id)->toBe($user->id)
        ->and($result->driverName)->toBe('local')
        ->and($result->mustChangePassword)->toBeFalse();
});

it('surfaces must_change_password from the user record', function () {
    User::factory()->create([
        'email' => 'newhire@acumenus.net',
        'password' => Hash::make('TempPass123!'),
        'must_change_password' => true,
    ]);

    $result = $this->driver->authenticate([
        'email' => 'newhire@acumenus.net',
        'password' => 'TempPass123!',
    ]);

    expect($result->mustChangePassword)->toBeTrue();
});

it('rejects an unknown email with 401', function () {
    expect(fn() => $this->driver->authenticate([
        'email' => 'nobody@nowhere.net',
        'password' => 'anything',
    ]))->toThrow(
        AuthDriverException::class,
        'Invalid credentials',
    );
});

it('rejects a wrong password with 401', function () {
    User::factory()->create([
        'email' => 'researcher@acumenus.net',
        'password' => Hash::make('CorrectHorseBattery'),
    ]);

    try {
        $this->driver->authenticate([
            'email' => 'researcher@acumenus.net',
            'password' => 'WrongPassword',
        ]);
        $this->fail('Expected AuthDriverException');
    } catch (AuthDriverException $e) {
        expect($e->getCode())->toBe(AuthDriverException::CODE_INVALID_CREDENTIALS)
            ->and($e->driverName)->toBe('local');
    }
});

it('rejects malformed credentials with 422', function () {
    expect(fn() => $this->driver->authenticate([
        // missing 'password' key
        'email' => 'a@b.com',
    ]))->toThrow(AuthDriverException::class);
});
```

- [ ] **Step 3.2: Run test — verify it fails (LocalCredentialsAuthDriver doesn't exist yet)**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Auth/Drivers/LocalCredentialsAuthDriverTest.php 2>&1 | tail -20"
```

Expected: All tests fail with "Class App\Auth\Drivers\LocalCredentialsAuthDriver not found".

---

## Task 4: Implement `LocalCredentialsAuthDriver`

**Files:**
- Create: `backend/app/Auth/Drivers/LocalCredentialsAuthDriver.php`

- [ ] **Step 4.1: Minimal implementation that makes tests pass**

```php
<?php

namespace App\Auth\Drivers;

use App\Contracts\AuthDriverInterface;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class LocalCredentialsAuthDriver implements AuthDriverInterface
{
    public function name(): string
    {
        return 'local';
    }

    public function isAvailable(): bool
    {
        // Local credentials are always available — no external dependency.
        return true;
    }

    public function authenticate(array $credentials): AuthDriverResult
    {
        if (!isset($credentials['email'], $credentials['password'])
            || !is_string($credentials['email'])
            || !is_string($credentials['password'])
        ) {
            throw new AuthDriverException(
                'Malformed credentials: expected string email and password',
                AuthDriverException::CODE_MALFORMED_CREDENTIALS,
                $this->name(),
            );
        }

        $email = strtolower(trim($credentials['email']));
        $user = User::where('email', $email)->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw new AuthDriverException(
                'Invalid credentials',
                AuthDriverException::CODE_INVALID_CREDENTIALS,
                $this->name(),
            );
        }

        return new AuthDriverResult(
            user: $user,
            driverName: $this->name(),
            mustChangePassword: (bool) $user->must_change_password,
        );
    }
}
```

- [ ] **Step 4.2: Run test — verify it passes**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Auth/Drivers/LocalCredentialsAuthDriverTest.php"
```

Expected: 7/7 PASS.

- [ ] **Step 4.3: Run Pint (code style)**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Contracts/AuthDriverInterface.php app/Auth/Drivers/"
```

- [ ] **Step 4.4: Commit Tasks 1-4 atomically**

```bash
git add backend/app/Contracts/AuthDriverInterface.php \
        backend/app/Auth/Drivers/ \
        backend/tests/Feature/Auth/Drivers/LocalCredentialsAuthDriverTest.php
git commit -m "feat(auth): introduce AuthDriverInterface + LocalCredentialsAuthDriver

First step of the AuthDriver extension point (Phase 2 #1 of 8). Adds:

  - App\\Contracts\\AuthDriverInterface — the extension contract for
    pluggable identity providers.
  - App\\Auth\\Drivers\\AuthDriverResult — value object returned by
    drivers (User + metadata).
  - App\\Auth\\Drivers\\AuthDriverException — typed errors with stable
    integer codes (401/403/422/500).
  - App\\Auth\\Drivers\\LocalCredentialsAuthDriver — default CE driver
    for email/password authentication. Behavior matches the existing
    AuthController::login flow byte-for-byte.

No behavioral change yet: AuthController is not yet wired to call the
driver. That's a follow-up commit so the refactor lands in safe steps.

Tests: 7 Pest cases covering valid auth, must_change_password
surfacing, unknown email, wrong password, and malformed credentials."
```

---

## Task 5: Write the failing test for `AuthentikOidcAuthDriver`

**Files:**
- Create: `backend/tests/Feature/Auth/Drivers/AuthentikOidcAuthDriverTest.php`

- [ ] **Step 5.1: Inspect existing OIDC code first** to scope the refactor

```bash
cat backend/app/Http/Controllers/Api/V1/Auth/OidcController.php | head -60
ls backend/app/Services/Auth/Oidc/
```

The driver wraps the existing `OidcReconciliationService` + `OidcTokenValidator`. We do NOT rewrite OIDC logic — we wrap it.

- [ ] **Step 5.2: Failing test**

```php
<?php

use App\Auth\Drivers\AuthDriverException;
use App\Auth\Drivers\AuthDriverResult;
use App\Auth\Drivers\AuthentikOidcAuthDriver;
use App\Models\User;
use App\Services\Auth\Oidc\OidcReconciliationService;
use App\Services\Auth\Oidc\OidcTokenValidator;
use App\Services\Auth\Oidc\ValidatedClaims;
use Mockery as m;

beforeEach(function () {
    $this->validator = m::mock(OidcTokenValidator::class);
    $this->reconciler = m::mock(OidcReconciliationService::class);
    $this->driver = new AuthentikOidcAuthDriver($this->validator, $this->reconciler);
});

afterEach(fn() => m::close());

it('has the expected stable name', function () {
    expect($this->driver->name())->toBe('authentik-oidc');
});

it('reports unavailable when OIDC config is missing', function () {
    config()->set('services.authentik.client_id', null);
    expect($this->driver->isAvailable())->toBeFalse();
});

it('reports available when OIDC config is present', function () {
    config()->set('services.authentik.client_id', 'parthenon-client');
    config()->set('services.authentik.discovery_url', 'https://auth.example/.well-known');
    expect($this->driver->isAvailable())->toBeTrue();
});

it('resolves a user from a valid OIDC code', function () {
    $user = User::factory()->create([
        'email' => 'sso-user@acumenus.net',
    ]);

    $claims = new ValidatedClaims(
        sub: 'authentik|abc123',
        email: 'sso-user@acumenus.net',
        emailVerified: true,
        name: 'SSO User',
    );

    $this->validator->shouldReceive('validateAuthorizationCode')
        ->with('valid-code', 'state-xyz')
        ->andReturn($claims);

    $this->reconciler->shouldReceive('reconcile')
        ->with($claims)
        ->andReturn($user);

    $result = $this->driver->authenticate([
        'code' => 'valid-code',
        'state' => 'state-xyz',
    ]);

    expect($result->user->id)->toBe($user->id)
        ->and($result->driverName)->toBe('authentik-oidc')
        ->and($result->providerSubject)->toBe('authentik|abc123');
});

it('rejects an invalid OIDC code with 401', function () {
    $this->validator->shouldReceive('validateAuthorizationCode')
        ->andThrow(new \RuntimeException('invalid_grant'));

    expect(fn() => $this->driver->authenticate([
        'code' => 'bad-code',
        'state' => 'state-xyz',
    ]))->toThrow(AuthDriverException::class);
});

it('rejects malformed credentials with 422', function () {
    expect(fn() => $this->driver->authenticate([
        'code' => 'only-code-no-state',
    ]))->toThrow(AuthDriverException::class);
});
```

- [ ] **Step 5.3: Run test — verify it fails**

Expected: All tests fail with "Class App\Auth\Drivers\AuthentikOidcAuthDriver not found".

---

## Task 6: Implement `AuthentikOidcAuthDriver`

**Files:**
- Create: `backend/app/Auth/Drivers/AuthentikOidcAuthDriver.php`

- [ ] **Step 6.1: Implementation**

```php
<?php

namespace App\Auth\Drivers;

use App\Contracts\AuthDriverInterface;
use App\Services\Auth\Oidc\OidcReconciliationService;
use App\Services\Auth\Oidc\OidcTokenValidator;

class AuthentikOidcAuthDriver implements AuthDriverInterface
{
    public function __construct(
        private readonly OidcTokenValidator $validator,
        private readonly OidcReconciliationService $reconciler,
    ) {}

    public function name(): string
    {
        return 'authentik-oidc';
    }

    public function isAvailable(): bool
    {
        return !empty(config('services.authentik.client_id'))
            && !empty(config('services.authentik.discovery_url'));
    }

    public function authenticate(array $credentials): AuthDriverResult
    {
        if (!isset($credentials['code'], $credentials['state'])
            || !is_string($credentials['code'])
            || !is_string($credentials['state'])
        ) {
            throw new AuthDriverException(
                'Malformed credentials: expected string code and state',
                AuthDriverException::CODE_MALFORMED_CREDENTIALS,
                $this->name(),
            );
        }

        try {
            $claims = $this->validator->validateAuthorizationCode(
                $credentials['code'],
                $credentials['state'],
            );
        } catch (\Throwable $e) {
            throw new AuthDriverException(
                'OIDC validation failed',
                AuthDriverException::CODE_INVALID_CREDENTIALS,
                $this->name(),
                $e,
            );
        }

        $user = $this->reconciler->reconcile($claims);

        return new AuthDriverResult(
            user: $user,
            driverName: $this->name(),
            mustChangePassword: false, // OIDC users never have temp passwords
            providerSubject: $claims->sub,
            providerClaims: [
                'email' => $claims->email,
                'email_verified' => $claims->emailVerified,
                'name' => $claims->name,
            ],
        );
    }
}
```

- [ ] **Step 6.2: Run test — verify it passes**

Expected: 6/6 PASS.

- [ ] **Step 6.3: Pint + commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Auth/Drivers/AuthentikOidcAuthDriver.php"

git add backend/app/Auth/Drivers/AuthentikOidcAuthDriver.php \
        backend/tests/Feature/Auth/Drivers/AuthentikOidcAuthDriverTest.php
git commit -m "feat(auth): add AuthentikOidcAuthDriver

Wraps the existing OidcTokenValidator + OidcReconciliationService into
the AuthDriverInterface contract. The OIDC implementation itself is
unchanged — this is a thin adapter so AuthController can dispatch by
driver name uniformly.

Tests cover: name(), isAvailable() with/without config, valid OIDC code
resolution, invalid code rejection, malformed credentials."
```

---

## Task 7: AuthDriverRegistry, ServiceProvider, config

**Files:**
- Create: `backend/app/Auth/AuthDriverRegistry.php`
- Create: `backend/app/Providers/AuthDriverServiceProvider.php`
- Create: `backend/config/auth-drivers.php`
- Create: `backend/tests/Feature/Auth/AuthDriverRegistryTest.php`
- Create: `backend/tests/Feature/Auth/StubAuthDriver.php`
- Modify: `backend/bootstrap/providers.php`

- [ ] **Step 7.1: Stub driver for the test**

File: `backend/tests/Feature/Auth/StubAuthDriver.php`

```php
<?php

namespace Tests\Feature\Auth;

use App\Auth\Drivers\AuthDriverResult;
use App\Contracts\AuthDriverInterface;

/**
 * Test fixture: an alternate driver. Proves that the registry resolves
 * drivers other than the two CE defaults — i.e., the extension point
 * actually allows extension.
 */
class StubAuthDriver implements AuthDriverInterface
{
    public function name(): string { return 'stub-test-only'; }
    public function isAvailable(): bool { return true; }
    public function authenticate(array $credentials): AuthDriverResult
    {
        return new AuthDriverResult(
            user: \App\Models\User::factory()->create(),
            driverName: $this->name(),
        );
    }
}
```

- [ ] **Step 7.2: Failing registry test**

File: `backend/tests/Feature/Auth/AuthDriverRegistryTest.php`

```php
<?php

use App\Auth\AuthDriverRegistry;
use App\Auth\Drivers\AuthentikOidcAuthDriver;
use App\Auth\Drivers\LocalCredentialsAuthDriver;
use App\Contracts\AuthDriverInterface;
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
    expect(fn() => $this->registry->driver('nonexistent'))
        ->toThrow(InvalidArgumentException::class, 'Unknown auth driver');
});

it('lists registered driver names', function () {
    $names = $this->registry->names();
    expect($names)->toContain('local')->toContain('authentik-oidc');
});

it('accepts runtime-registered drivers (proves pluggability)', function () {
    $this->registry->register(new StubAuthDriver());
    expect($this->registry->driver('stub-test-only'))
        ->toBeInstanceOf(StubAuthDriver::class);
    expect($this->registry->names())->toContain('stub-test-only');
});

it('lists only available drivers', function () {
    config()->set('services.authentik.client_id', null);
    expect($this->registry->availableNames())->toContain('local');
    // authentik-oidc should be excluded because isAvailable() returns false
    expect($this->registry->availableNames())->not->toContain('authentik-oidc');
});
```

Expected: all 6 fail with "Class App\Auth\AuthDriverRegistry not found."

- [ ] **Step 7.3: Implement AuthDriverRegistry**

File: `backend/app/Auth/AuthDriverRegistry.php`

```php
<?php

namespace App\Auth;

use App\Contracts\AuthDriverInterface;
use InvalidArgumentException;

class AuthDriverRegistry
{
    /** @var array<string, AuthDriverInterface> */
    private array $drivers = [];

    public function register(AuthDriverInterface $driver): void
    {
        $this->drivers[$driver->name()] = $driver;
    }

    public function driver(string $name): AuthDriverInterface
    {
        if (!isset($this->drivers[$name])) {
            throw new InvalidArgumentException(
                "Unknown auth driver: '$name'. Registered drivers: "
                . implode(', ', $this->names())
            );
        }
        return $this->drivers[$name];
    }

    /** @return array<int, string> */
    public function names(): array
    {
        return array_keys($this->drivers);
    }

    /** @return array<int, string> Names of drivers reporting isAvailable() === true */
    public function availableNames(): array
    {
        return array_values(array_filter(
            $this->names(),
            fn(string $name) => $this->drivers[$name]->isAvailable(),
        ));
    }
}
```

- [ ] **Step 7.4: config/auth-drivers.php**

File: `backend/config/auth-drivers.php`

```php
<?php

use App\Auth\Drivers\AuthentikOidcAuthDriver;
use App\Auth\Drivers\LocalCredentialsAuthDriver;

return [
    /*
    |--------------------------------------------------------------------------
    | Built-in auth drivers
    |--------------------------------------------------------------------------
    |
    | Each driver implements App\Contracts\AuthDriverInterface. The
    | AuthDriverServiceProvider registers them at boot. Drivers from
    | Parthenon Enterprise Edition are registered by EE's own service
    | provider; this file is only for the Community Edition defaults.
    |
    */

    'drivers' => [
        'local' => LocalCredentialsAuthDriver::class,
        'authentik-oidc' => AuthentikOidcAuthDriver::class,
    ],
];
```

- [ ] **Step 7.5: AuthDriverServiceProvider**

File: `backend/app/Providers/AuthDriverServiceProvider.php`

```php
<?php

namespace App\Providers;

use App\Auth\AuthDriverRegistry;
use App\Contracts\AuthDriverInterface;
use Illuminate\Support\ServiceProvider;

class AuthDriverServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(AuthDriverRegistry::class);
    }

    public function boot(): void
    {
        /** @var AuthDriverRegistry $registry */
        $registry = $this->app->make(AuthDriverRegistry::class);

        foreach (config('auth-drivers.drivers', []) as $class) {
            /** @var AuthDriverInterface $driver */
            $driver = $this->app->make($class);
            $registry->register($driver);
        }
    }
}
```

- [ ] **Step 7.6: Register provider in bootstrap/providers.php**

```php
<?php

return [
    App\Providers\AppServiceProvider::class,
    App\Providers\AuthDriverServiceProvider::class,  // <-- ADD THIS LINE
    App\Providers\AuthServiceProvider::class,
    App\Providers\HorizonServiceProvider::class,
    // ... rest unchanged
];
```

- [ ] **Step 7.7: Run tests**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Auth/AuthDriverRegistryTest.php"
```

Expected: 6/6 PASS.

- [ ] **Step 7.8: Commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Auth/AuthDriverRegistry.php app/Providers/AuthDriverServiceProvider.php"

git add backend/app/Auth/AuthDriverRegistry.php \
        backend/app/Providers/AuthDriverServiceProvider.php \
        backend/config/auth-drivers.php \
        backend/bootstrap/providers.php \
        backend/tests/Feature/Auth/

git commit -m "feat(auth): wire AuthDriverRegistry + service provider

Registers all CE auth drivers from config/auth-drivers.php at boot via
AuthDriverServiceProvider (singleton-bound). Provides:

  - AuthDriverRegistry::driver(name) — resolve by name
  - AuthDriverRegistry::names() — list registered drivers
  - AuthDriverRegistry::availableNames() — only drivers with isAvailable()
  - AuthDriverRegistry::register(driver) — runtime registration (used by EE)

Tests prove driver resolution, error on unknown name, and runtime
registration works (StubAuthDriver fixture demonstrates pluggability)."
```

---

## Task 8: Refactor `AuthController::login` to use the driver

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/AuthController.php`

- [ ] **Step 8.1: Read the existing login method**

```bash
sed -n '65,92p' backend/app/Http/Controllers/Api/V1/AuthController.php
```

- [ ] **Step 8.2: Refactor login to delegate identity resolution**

Replace the body of the existing `login()` method (lines 65–92, exact line numbers may differ — re-read first) with:

```php
public function login(LoginRequest $request, AuthDriverRegistry $registry): JsonResponse
{
    try {
        $result = $registry->driver('local')->authenticate([
            'email' => $request->string('email'),
            'password' => $request->string('password'),
        ]);
    } catch (AuthDriverException $e) {
        // Map driver exception to HTTP status code while preserving
        // existing API contract (same JSON message keys).
        return response()->json(
            ApiMessage::payload('auth.invalid_credentials'),
            $e->getCode() === AuthDriverException::CODE_INVALID_CREDENTIALS ? 401 : 400,
        );
    }

    $token = $result->user->createToken('auth-token')->plainTextToken;
    $result->user->update(['last_login_at' => now()]);

    return response()->json([
        'token' => $token,
        'user' => $result->user->only(['id', 'name', 'email', 'must_change_password']),
        'must_change_password' => $result->mustChangePassword,
    ]);
}
```

Add imports at the top of `AuthController.php`:

```php
use App\Auth\AuthDriverRegistry;
use App\Auth\Drivers\AuthDriverException;
```

- [ ] **Step 8.3: Run existing AuthController tests — they MUST still pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Auth/ tests/Unit/Auth/"
```

Expected: ALL existing auth tests pass. Behavior must be byte-identical for users.

If any tests fail, the refactor changed behavior. Investigate the diff between the new method and the original. Common drift sources:
- Different status codes
- Different JSON shape
- Different audit log calls
- Different rate limiting

Match exactly. The driver pattern must be invisible to existing API consumers.

- [ ] **Step 8.4: Commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/AuthController.php"
git add backend/app/Http/Controllers/Api/V1/AuthController.php
git commit -m "refactor(auth): AuthController::login delegates to AuthDriverRegistry

login() resolves the user via AuthDriverRegistry::driver('local'); token
issuance + last_login_at update remain in the controller. API contract
unchanged: response shape, status codes, message keys, and rate limits
are byte-identical to the previous direct-Hash::check implementation.

Existing AuthController tests pass without modification, proving the
refactor preserves observable behavior."
```

---

## Task 9: Refactor `OidcController::callback` analogously

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/Auth/OidcController.php`

- [ ] **Step 9.1: Read the existing callback method**

```bash
grep -n "public function callback" backend/app/Http/Controllers/Api/V1/Auth/OidcController.php
sed -n '<line>,<line+50>p' backend/app/Http/Controllers/Api/V1/Auth/OidcController.php
```

(Replace `<line>` with actual line number from grep.)

- [ ] **Step 9.2: Replace the inline OIDC token-validation + reconciliation calls** with `$registry->driver('authentik-oidc')->authenticate(['code' => ..., 'state' => ...])`. Keep token issuance + redirect logic.

- [ ] **Step 9.3: Run existing OIDC tests — must still pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Auth/Oidc/ tests/Unit/Auth/Oidc/"
```

- [ ] **Step 9.4: Commit**

```bash
git commit -m "refactor(auth): OidcController::callback delegates to AuthDriverRegistry

OIDC callback resolves the user via AuthDriverRegistry::driver('authentik-oidc');
token issuance + post-login redirect remain in the controller. Behavior
unchanged: existing OidcController tests pass without modification.

Completes the AuthDriver extension point on the controller side."
```

---

## Task 10: Documentation

**Files:**
- Create: `docs/architecture/extension-points.md`
- Create: `docs/architecture/extension-points/auth-driver.md`

- [ ] **Step 10.1: Write `docs/architecture/extension-points.md`** (index page; will grow as Plan 02-02..02-08 land)

```markdown
# Parthenon CE Extension Points

Parthenon Community Edition exposes 8 extension-point seams that allow
drop-in alternative implementations without patching CE source. The
extension points are designed for two consumers:

1. **Parthenon Enterprise Edition** — proprietary drivers in the
   `enterprise/` overlay (Keycloak, SAML, multi-tenant resolver, FIPS
   crypto, signed audit, observability shippers, etc.).
2. **Community contributors** — anyone running their own niche driver
   for a specific deployment (e.g., a research consortium with custom
   audit retention rules).

Each extension point ships with:
  - A documented interface in `backend/app/Contracts/` (PHP) or
    appropriate per-language location.
  - A default CE implementation that preserves CE behavior byte-for-byte.
  - Tests that prove pluggability via at least one alternate driver.

## The 8 extension points

| # | Extension point | Interface | Detail page |
|---|---|---|---|
| 1 | Auth driver | `App\Contracts\AuthDriverInterface` | [auth-driver.md](extension-points/auth-driver.md) |
| 2 | Tenant resolver | `App\Contracts\TenantResolverInterface` | (Plan 02-02) |
| 3 | Crypto provider | `App\Contracts\CryptoProviderInterface` | (Plan 02-03) |
| 4 | Audit sink | `App\Contracts\AuditSinkInterface` | (Plan 02-04) |
| 5 | Observability shipper | `App\Contracts\ObservabilityShipperInterface` | (Plan 02-05) |
| 6 | Frontend feature flags + EnterpriseGate | `frontend/src/contracts/featureFlags.ts` | (Plan 02-06) |
| 7 | Acropolis installer phase registry | `installer/phases/Phase` (Python) | (Plan 02-07) |
| 8 | Compose composition contract | `docker-compose.yml` override conventions | (Plan 02-08) |

## How to add a custom driver (community)

1. Implement the relevant interface in your fork or sidecar package.
2. Register the driver in your project's service provider.
3. Configure the active driver via `config/<feature>-drivers.php` or
   the corresponding mechanism for that extension point.

See each extension point's detail page for examples.
```

- [ ] **Step 10.2: Write `docs/architecture/extension-points/auth-driver.md`** (full driver doc)

(Include: interface signature, what `AuthDriverResult` carries, how to register a new driver, error code semantics, examples for SAML and SCIM as reference.)

- [ ] **Step 10.3: Commit**

```bash
git add docs/architecture/extension-points.md docs/architecture/extension-points/auth-driver.md
git commit -m "docs(architecture): document AuthDriver extension point

Adds the extension-points index doc (will grow as Plans 02-02..02-08 land)
and the detailed AuthDriver page covering:

  - The AuthDriverInterface contract
  - AuthDriverResult value object semantics
  - Error codes and exception handling
  - How to register a driver from a service provider
  - CE-shipped drivers (local, authentik-oidc) as reference
  - Worked example of a hypothetical SCIM driver

Pairs with the AuthDriver implementation merged earlier in this PR
sequence."
```

---

## Task 11: PR

- [ ] **Step 11.1: Push branch**

```bash
git push -u origin feature/extension-point-auth-driver
```

- [ ] **Step 11.2: Open PR**

```bash
gh pr create --title "feat(auth): introduce AuthDriver extension point (Phase 2 #1 of 8)" \
  --body "$(cat <<'EOF'
## Summary

First of 8 CE extension-point PRs (Phase 2 of the CE/EE fork plan). Adds an `AuthDriverInterface` abstraction that decouples Parthenon's authentication flow from a specific identity provider. Existing local-credentials and Authentik OIDC flows are refactored into pluggable drivers behind the same interface.

This is the foundation for EE drivers (Keycloak, SAML, SCIM) which will live in `Acumenus-Data-Sciences/Parthenon-EE` `enterprise/backend/src/Auth/`.

## Behavioral changes

**None observable.** The refactor is a pure internal restructure. All existing auth API contracts (status codes, response shapes, error messages) are byte-identical. Existing AuthController and OidcController tests pass without modification.

## Files added (12)

- `backend/app/Contracts/AuthDriverInterface.php`
- `backend/app/Auth/Drivers/AuthDriverResult.php`
- `backend/app/Auth/Drivers/AuthDriverException.php`
- `backend/app/Auth/Drivers/LocalCredentialsAuthDriver.php`
- `backend/app/Auth/Drivers/AuthentikOidcAuthDriver.php`
- `backend/app/Auth/AuthDriverRegistry.php`
- `backend/app/Providers/AuthDriverServiceProvider.php`
- `backend/config/auth-drivers.php`
- `backend/tests/Feature/Auth/Drivers/LocalCredentialsAuthDriverTest.php` (7 cases)
- `backend/tests/Feature/Auth/Drivers/AuthentikOidcAuthDriverTest.php` (6 cases)
- `backend/tests/Feature/Auth/AuthDriverRegistryTest.php` (6 cases — including pluggability proof via StubAuthDriver)
- `backend/tests/Feature/Auth/StubAuthDriver.php`
- `docs/architecture/extension-points.md`
- `docs/architecture/extension-points/auth-driver.md`

## Files modified (3)

- `backend/app/Http/Controllers/Api/V1/AuthController.php` — `login()` delegates to registry; token issuance unchanged
- `backend/app/Http/Controllers/Api/V1/Auth/OidcController.php` — `callback()` delegates to registry; redirect logic unchanged
- `backend/bootstrap/providers.php` — registers `AuthDriverServiceProvider`

## Test plan

- [ ] CI green (Pint, PHPStan, Pest, all language test suites)
- [ ] Existing auth Pest tests pass without modification
- [ ] 19 new Pest cases pass (7 local + 6 OIDC + 6 registry)
- [ ] Integration smoke: log in as `admin@acumenus.net` against staging, verify token issued and `must_change_password` flag works
- [ ] OIDC smoke: complete an Authentik login round-trip on staging
- [ ] HIGHSEC §1, §2 still apply: viewer role on registration, sanctum 8h expiration, all auth routes still gated

## What this enables (next plans)

- Plan 04 (EE first-pass migration) can land `KeycloakAuthDriver`, `SamlAuthDriver`, `ScimSyncAuthDriver` against this interface in `Acumenus-Data-Sciences/Parthenon-EE` without modifying anything in this CE repo.

EOF
)"
```

- [ ] **Step 11.3: Wait for CI, address review, merge**

```bash
gh pr view --json statusCheckRollup
# When green and approved:
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

## Plan 02-01 completion checklist

- [ ] `App\Contracts\AuthDriverInterface` exists, documented
- [ ] `LocalCredentialsAuthDriver` and `AuthentikOidcAuthDriver` implement the interface
- [ ] `AuthDriverRegistry` resolves drivers by name and supports runtime registration
- [ ] `AuthController::login` and `OidcController::callback` delegate to the registry
- [ ] All existing auth tests pass without modification (proves no behavior change)
- [ ] 19 new Pest cases pass
- [ ] StubAuthDriver test proves pluggability
- [ ] Documentation: `extension-points.md` + `auth-driver.md` published
- [ ] PR merged into main, CI green

---

## Out of scope (deferred to other plans)

- **EE Keycloak/SAML/SCIM drivers** — Plan 04 (EE migration), in `Acumenus-Data-Sciences/Parthenon-EE`
- **Multi-driver login UI** (let users pick which driver to authenticate against) — separate plan; this PR keeps the existing single-flow UI
- **Driver-level rate limiting** — existing route-level rate limits stay; per-driver throttling is future work
- **Driver telemetry / metrics** — Plan 02-05 (ObservabilityShipper) provides the abstraction; per-driver telemetry comes after that lands

*End of Plan 02-01.*
