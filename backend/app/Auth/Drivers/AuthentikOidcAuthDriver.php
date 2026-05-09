<?php

namespace App\Auth\Drivers;

use App\Contracts\AuthDriverInterface;
use App\Services\Auth\Oidc\OidcReconciliationService;
use App\Services\Auth\Oidc\ValidatedClaims;
use Throwable;

/**
 * Authentik OIDC identity-resolution driver.
 *
 * The full OIDC handshake (state → token endpoint → ID token validation)
 * lives in OidcController::callback. This driver wraps the IDENTITY
 * RESOLUTION step: given a set of validated OIDC claims, find or create
 * the corresponding Parthenon User.
 *
 * Credentials shape: ['claims' => ValidatedClaims]. The controller passes
 * already-validated claims; the driver delegates to the existing
 * OidcReconciliationService.
 */
class AuthentikOidcAuthDriver implements AuthDriverInterface
{
    public function __construct(
        private readonly OidcReconciliationService $reconciler,
    ) {}

    public function name(): string
    {
        return 'authentik-oidc';
    }

    public function isAvailable(): bool
    {
        return ! empty(config('services.oidc.client_id'))
            && ! empty(config('services.oidc.discovery_url'));
    }

    public function authenticate(array $credentials): AuthDriverResult
    {
        $claims = $credentials['claims'] ?? null;
        if (! $claims instanceof ValidatedClaims) {
            throw new AuthDriverException(
                'Malformed credentials: expected ValidatedClaims under "claims" key',
                AuthDriverException::CODE_MALFORMED_CREDENTIALS,
                $this->name(),
            );
        }

        try {
            $result = $this->reconciler->reconcile($claims);
        } catch (Throwable $e) {
            throw new AuthDriverException(
                'OIDC reconciliation failed',
                AuthDriverException::CODE_INVALID_CREDENTIALS,
                $this->name(),
                $e,
            );
        }

        return new AuthDriverResult(
            user: $result['user'],
            driverName: $this->name(),
            mustChangePassword: false, // OIDC users never have temp passwords
            providerSubject: $claims->sub,
            providerClaims: [
                'email' => $claims->email,
                'name' => $claims->name,
                'groups' => $claims->groups,
                'reason' => $result['reason'],
            ],
        );
    }
}
