<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use App\Models\App\FhirConnection;
use Throwable;

/**
 * Derives a public JWKS (JSON Web Key Set) from the RSA private keys of active
 * FHIR connections so EHRs using SMART Backend Services can discover and verify
 * our client-assertion signing keys via a hosted JWKS URL.
 *
 * @see https://hl7.org/fhir/smart-app-launch/backend-services.html
 * @see https://datatracker.ietf.org/doc/html/rfc7638  (JWK thumbprint → kid)
 */
class FhirJwksService
{
    /**
     * Base64url-encode raw bytes (RFC 4648 §5): no padding, URL-safe alphabet.
     */
    public function base64url(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    /**
     * Build a public RSA JWK from a private key PEM. Returns null if the PEM is
     * not a loadable RSA private key.
     *
     * @return array{kty: string, use: string, alg: string, kid: string, n: string, e: string}|null
     */
    public function jwkFromPrivateKeyPem(string $pem): ?array
    {
        $key = openssl_pkey_get_private($pem);
        if ($key === false) {
            return null;
        }

        $details = openssl_pkey_get_details($key);
        if ($details === false || ($details['type'] ?? null) !== OPENSSL_KEYTYPE_RSA) {
            return null;
        }

        $n = $this->base64url($details['rsa']['n']);
        $e = $this->base64url($details['rsa']['e']);

        return [
            'kty' => 'RSA',
            'use' => 'sig',
            'alg' => 'RS384',
            'kid' => $this->thumbprint($n, $e),
            'n' => $n,
            'e' => $e,
        ];
    }

    /**
     * RFC 7638 JWK thumbprint used as the stable `kid`. The canonical JSON
     * contains only the required RSA members in lexicographic order (e, kty, n)
     * with no whitespace; the SHA-256 of that, base64url-encoded, is the kid.
     */
    public function thumbprint(string $n, string $e): string
    {
        $canonical = '{"e":"'.$e.'","kty":"RSA","n":"'.$n.'"}';

        return $this->base64url(hash('sha256', $canonical, true));
    }

    /**
     * Resolve the JWKS `kid` for a single connection's signing key, or null when
     * no usable RSA private key is present.
     */
    public function kidForConnection(FhirConnection $conn): ?string
    {
        $pem = $conn->private_key_pem;
        if ($pem === null || $pem === '') {
            return null;
        }

        $jwk = $this->jwkFromPrivateKeyPem($pem);

        return $jwk['kid'] ?? null;
    }

    /**
     * Build the full public JWKS from all active connections, deduplicated by
     * kid. A bad or undecryptable key is skipped, never fatal.
     *
     * @return array{keys: list<array{kty: string, use: string, alg: string, kid: string, n: string, e: string}>}
     */
    public function jwks(): array
    {
        $connections = FhirConnection::query()
            ->where('is_active', true)
            ->whereNotNull('private_key_pem')
            ->get();

        $deduped = [];

        foreach ($connections as $conn) {
            try {
                $pem = $conn->private_key_pem;
                if ($pem === null || $pem === '') {
                    continue;
                }

                $jwk = $this->jwkFromPrivateKeyPem($pem);
                if ($jwk === null) {
                    continue;
                }

                $deduped[$jwk['kid']] = $jwk;
            } catch (Throwable) {
                // A single bad/undecryptable key must not break key discovery.
                continue;
            }
        }

        return ['keys' => array_values($deduped)];
    }
}
