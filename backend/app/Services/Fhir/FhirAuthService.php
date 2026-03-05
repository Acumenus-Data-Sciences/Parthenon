<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use App\Models\App\FhirConnection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class FhirAuthService
{
    /**
     * Obtain an access token via SMART Backend Services (client_credentials + signed JWT).
     *
     * @return array{access_token: string, expires_in: int}
     */
    public function getAccessToken(FhirConnection $connection): array
    {
        $assertion = $this->buildClientAssertion($connection);

        $response = Http::asForm()->timeout(15)->post($connection->token_endpoint, [
            'grant_type'            => 'client_credentials',
            'client_assertion_type' => 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            'client_assertion'      => $assertion,
            'scope'                 => $connection->scopes,
        ]);

        if ($response->failed()) {
            throw new RuntimeException(
                "Token exchange failed: HTTP {$response->status()} — " . Str::limit($response->body(), 300)
            );
        }

        return [
            'access_token' => $response->json('access_token'),
            'expires_in'   => (int) $response->json('expires_in', 300),
        ];
    }

    /**
     * Build a signed JWT assertion for SMART Backend Services auth.
     *
     * @see https://hl7.org/fhir/smart-app-launch/backend-services.html
     */
    public function buildClientAssertion(FhirConnection $conn): string
    {
        $now = time();
        $header = ['alg' => 'RS384', 'typ' => 'JWT'];

        $payload = [
            'iss' => $conn->client_id,
            'sub' => $conn->client_id,
            'aud' => $conn->token_endpoint,
            'exp' => $now + 300,
            'iat' => $now,
            'jti' => Str::uuid()->toString(),
        ];

        $headerEncoded  = rtrim(strtr(base64_encode(json_encode($header)), '+/', '-_'), '=');
        $payloadEncoded = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');

        $signingInput = $headerEncoded . '.' . $payloadEncoded;

        $privateKey = openssl_pkey_get_private($conn->private_key_pem);
        if ($privateKey === false) {
            throw new RuntimeException('Failed to load private key for JWT signing');
        }

        $signature = '';
        $signed = openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA384);
        if (!$signed) {
            throw new RuntimeException('JWT signing failed');
        }

        $signatureEncoded = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

        return $signingInput . '.' . $signatureEncoded;
    }
}
