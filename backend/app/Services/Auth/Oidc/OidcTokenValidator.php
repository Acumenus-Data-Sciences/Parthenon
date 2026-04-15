<?php

namespace App\Services\Auth\Oidc;

use App\Services\Auth\Oidc\Exceptions\OidcTokenInvalidException;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;

/**
 * Validates an Authentik-issued ID token by JWKS signature, issuer,
 * audience, expiry, and (when provided) nonce. On success returns a
 * ValidatedClaims DTO with the subset of claims the rest of the OIDC
 * pipeline cares about.
 */
class OidcTokenValidator
{
    public function __construct(
        private readonly OidcDiscoveryService $discovery,
        private readonly string $audience,
    ) {}

    /**
     * @throws OidcTokenInvalidException
     */
    public function validate(string $idToken, ?string $expectedNonce = null): ValidatedClaims
    {
        $keys = JWK::parseKeySet($this->discovery->jwks());

        try {
            $payload = (array) JWT::decode($idToken, $keys);
        } catch (\Throwable $e) {
            throw new OidcTokenInvalidException('signature_invalid', $e->getMessage(), $e);
        }

        $issuer = (string) ($payload['iss'] ?? '');
        if ($issuer !== $this->discovery->issuer()) {
            throw new OidcTokenInvalidException('issuer_mismatch',
                "Expected '{$this->discovery->issuer()}', got '{$issuer}'");
        }

        $audience = $payload['aud'] ?? null;
        $audienceList = is_array($audience) ? array_map('strval', $audience) : [(string) $audience];
        if (! in_array($this->audience, $audienceList, true)) {
            throw new OidcTokenInvalidException('audience_mismatch',
                "Token audience does not include '{$this->audience}'");
        }

        if ($expectedNonce !== null) {
            $tokenNonce = (string) ($payload['nonce'] ?? '');
            if (! hash_equals($expectedNonce, $tokenNonce)) {
                throw new OidcTokenInvalidException('nonce_mismatch', 'Token nonce does not match stored nonce');
            }
        }

        foreach (['sub', 'email', 'name'] as $required) {
            if (! isset($payload[$required]) || ! is_string($payload[$required]) || $payload[$required] === '') {
                throw new OidcTokenInvalidException('missing_claim', "Required claim '$required' missing or empty");
            }
        }

        $groups = [];
        if (isset($payload['groups']) && is_array($payload['groups'])) {
            foreach ($payload['groups'] as $g) {
                if (is_string($g)) {
                    $groups[] = $g;
                }
            }
        }

        return new ValidatedClaims(
            sub: (string) $payload['sub'],
            email: (string) $payload['email'],
            name: (string) $payload['name'],
            groups: $groups,
        );
    }
}
