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
    /**
     * @param  array<string, mixed>  $providerClaims
     */
    public function __construct(
        public User $user,
        public string $driverName,
        public bool $mustChangePassword = false,
        public ?string $providerSubject = null,
        public array $providerClaims = [],
        /**
         * Whether the upstream provider asserted MFA in this authentication
         * event (R1). Drivers like SAML/Keycloak set this true when the
         * AuthnContext / amr claim indicates step-up auth. Downstream RBAC
         * may use this to require step-up for sensitive operations.
         * Default false preserves CE local + authentik-oidc behavior.
         */
        public bool $mfaAuthenticated = false,
    ) {}
}
