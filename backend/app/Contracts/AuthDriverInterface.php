<?php

namespace App\Contracts;

use App\Auth\Drivers\AuthDriverException;
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
     * @param  array<string, mixed>  $credentials  Driver-specific shape.
     *                                             For "local": ['email' => string, 'password' => string]
     *                                             For "authentik-oidc": ['code' => string, 'state' => string]
     *
     * @throws AuthDriverException on auth failure.
     *                             The exception's getCode() returns one of:
     *                             - 401 (invalid credentials)
     *                             - 403 (account disabled / not provisioned)
     *                             - 422 (malformed credentials)
     *                             - 500 (provider unreachable)
     */
    public function authenticate(array $credentials): AuthDriverResult;

    /**
     * Whether this driver is currently usable (e.g., Authentik
     * configured, network reachable). Used for health checks and to
     * exclude unavailable drivers from login UI.
     */
    public function isAvailable(): bool;
}
