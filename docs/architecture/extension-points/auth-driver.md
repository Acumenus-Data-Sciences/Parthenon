---
doc_type: spec
status: historical
date: 2026-05-09
owner: acumenus
module: extension-points
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Contracts/AuthDriverInterface.php
related_prs: []
---
# Extension Point: Auth Driver

**Interface:** `App\Contracts\AuthDriverInterface`
**Registry:** `App\Auth\AuthDriverRegistry`
**Service provider:** `App\Providers\AuthDriverServiceProvider`
**Config:** `backend/config/auth-drivers.php`
**Status:** Live since [Phase 2 #1](../../superpowers/plans/2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md)

## Purpose

Decouple Parthenon's authentication flow from a specific identity provider. The driver pattern abstracts the **identity-resolution step**: given some credentials, find or create the corresponding `App\Models\User`. Token issuance (Sanctum), session setup, audit logging, and HTTP response shaping all stay in the controllers — drivers only resolve identity.

## The contract

```php
interface AuthDriverInterface
{
    public function name(): string;
    public function isAvailable(): bool;
    public function authenticate(array $credentials): AuthDriverResult;
}
```

### `name()` — stable string identifier

Must match the key under which the driver is registered in `config/auth-drivers.php`. Used by the registry and by feature flags. Convention: lowercase + dot-separated (`local`, `authentik-oidc`, `keycloak`, `saml`, `scim`).

### `isAvailable()` — runtime availability check

Returns `true` if the driver can serve a real request right now. CE's `LocalCredentialsAuthDriver` always returns `true` (no external dependency). `AuthentikOidcAuthDriver` checks for Authentik client config + discovery URL. The registry's `availableNames()` excludes drivers that report unavailable; the login UI uses this to hide unconfigured providers.

### `authenticate(array $credentials): AuthDriverResult`

Driver-specific credential shape. Drivers throw `AuthDriverException` on failure with stable codes:

- **401** (`CODE_INVALID_CREDENTIALS`) — bad credentials, unknown user
- **403** (`CODE_ACCOUNT_DISABLED`) — account exists but is disabled / not provisioned
- **422** (`CODE_MALFORMED_CREDENTIALS`) — wrong shape (missing keys, wrong types)
- **500** (`CODE_PROVIDER_UNREACHABLE`) — IdP is down or unreachable

Some upstream domain exceptions (e.g. `OidcAccessDeniedException` carrying a specific `reason` for a 403 OIDC error) **pass through unchanged** so controllers can map them to provider-specific HTTP responses. Drivers document their pass-through types in their PHPDoc.

## `AuthDriverResult`

```php
final readonly class AuthDriverResult
{
    public User $user;
    public string $driverName;
    public bool $mustChangePassword = false;
    public ?string $providerSubject = null;
    public array $providerClaims = [];
    public bool $mfaAuthenticated = false;
}
```

- `user` — the resolved User (loaded but **not** eager-loaded; controllers do their own `->load(...)` for what they need).
- `driverName` — echoes back the driver's `name()` for logging/auditing.
- `mustChangePassword` — surfaces the `must_change_password` flag for the temp-password flow.
- `providerSubject` — IdP's `sub` claim or equivalent, for cross-IdP user linking.
- `providerClaims` — driver-specific metadata (groups, email_verified, AMR, etc.). Controllers may persist or audit selected fields.
- `mfaAuthenticated` — set true when the IdP asserted a second factor in this auth event (SAML AuthnContext, OIDC `amr` claim with MFA value). Downstream RBAC may require step-up for sensitive operations. CE's `local` and `authentik-oidc` drivers default this to false.

## CE-shipped drivers

### `local` — `App\Auth\Drivers\LocalCredentialsAuthDriver`

Wraps the existing email/password flow. Credentials shape:

```php
['email' => string, 'password' => string]
```

Email is lowercased + trimmed. `Hash::check()` against `users.password`. Surfaces `must_change_password`. Same generic "invalid_credentials" message for unknown email AND wrong password (HIGHSEC §1: enumeration protection).

### `authentik-oidc` — `App\Auth\Drivers\AuthentikOidcAuthDriver`

Wraps `App\Services\Auth\Oidc\OidcReconciliationService`. Credentials shape:

```php
['claims' => \App\Services\Auth\Oidc\ValidatedClaims]
```

Note that the **OIDC handshake itself** (state validation, code-token exchange, ID-token validation, nonce check) lives in `App\Http\Controllers\Api\V1\Auth\OidcController::callback`. The controller validates the ID token and produces `ValidatedClaims`, then dispatches to this driver for identity reconciliation. This shape is intentional: the driver wraps only the pluggable step (resolving claims to a User), not the protocol-specific dance.

`OidcAccessDeniedException` (raised by the reconciler when an authenticated IdP user is not provisioned in Parthenon) **passes through unchanged** so the controller can return a 403 with the OIDC reason claim.

## How to register a custom driver

Pick one of two patterns:

### Pattern A — config-driven (CE convention)

Add the driver class to `config/auth-drivers.php`:

```php
return [
    'drivers' => [
        'local' => LocalCredentialsAuthDriver::class,
        'authentik-oidc' => AuthentikOidcAuthDriver::class,
        'my-custom-idp' => \App\Auth\Drivers\MyCustomIdpDriver::class,
    ],
];
```

The `AuthDriverServiceProvider` instantiates each at boot and registers with the singleton registry.

### Pattern B — runtime registration (EE convention)

EE's `EnterpriseServiceProvider::boot()` does this:

```php
$registry = $this->app->make(AuthDriverRegistry::class);
$registry->register($this->app->make(KeycloakAuthDriver::class));
$registry->register($this->app->make(SamlAuthDriver::class));
```

This is preferred when registration depends on runtime conditions (license entitlements, tenant config). The registry is a singleton, so registrations from any service provider are visible to all consumers.

## Hypothetical EE drivers (Plan 04)

For reference — these are the EE drivers Plan 04 builds against this interface:

```php
'keycloak' => Acumenus\Parthenon\Enterprise\Auth\KeycloakAuthDriver::class,
'saml' => Acumenus\Parthenon\Enterprise\Auth\SamlAuthDriver::class,
'scim' => Acumenus\Parthenon\Enterprise\Auth\ScimSyncAuthDriver::class,
```

EE registers them only when the corresponding entitlement is present in the customer license. Without entitlement, the driver isn't registered → `auth.keycloak` feature flag is `false` → admin UI doesn't show the Keycloak option.

## Worked example: hypothetical SCIM driver

SCIM is server-to-server; the IdP POSTs to our SCIM endpoints rather than calling our login flow. So the SCIM "driver" is a thin wrapper that the SCIM controller delegates to:

```php
class ScimSyncAuthDriver implements AuthDriverInterface
{
    public function name(): string { return 'scim'; }
    public function isAvailable(): bool { return ! empty(config('scim.bearer_tokens')); }

    public function authenticate(array $credentials): AuthDriverResult
    {
        // credentials = ['scim_payload' => array, 'op' => 'create'|'update'|'delete']
        // ... validate + upsert User from SCIM resource ...
        return new AuthDriverResult(user: $user, driverName: $this->name(), ...);
    }
}
```

## Testing patterns

- **Unit tests for the driver itself:** mock `OidcReconciliationService` (or whatever upstream service the driver wraps); verify the driver returns the right `AuthDriverResult` shape and throws the right exception types. See `tests/Feature/Auth/Drivers/`.
- **Pluggability proof:** register a `StubAuthDriver` at runtime and verify the registry resolves it. See `tests/Feature/Auth/StubAuthDriver.php` + `AuthDriverRegistryTest.php`.
- **End-to-end:** existing `tests/Feature/Api/V1/AuthTest.php` exercises the full login flow through the controller → driver → registry.

## Security notes

- **HIGHSEC §1.1** — newly-provisioned SSO users (Keycloak, SAML, OIDC) MUST receive the `viewer` role baseline before any group→role mapping promotes. EE drivers MUST call `$user->assignRole(['viewer'])` on `$user->wasRecentlyCreated`. CE drivers create no users (`local` validates an existing user; `authentik-oidc` delegates to `OidcReconciliationService` which has its own role-assignment policy).
- **HIGHSEC §1.2** — token expiration (8h) is enforced in `config/sanctum.php` and is unchanged by this extension point. Drivers do not issue tokens.
- **Enumeration protection** — `LocalCredentialsAuthDriver` returns the same exception for unknown email and wrong password. The controller flattens the driver's 422 (malformed) to 401 in the response, so external API consumers see a single "invalid_credentials" reply for any auth failure.
