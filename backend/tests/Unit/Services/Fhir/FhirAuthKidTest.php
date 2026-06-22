<?php

declare(strict_types=1);

use App\Models\App\FhirConnection;
use App\Services\Fhir\FhirAuthService;
use App\Services\Fhir\FhirJwksService;

/**
 * Base64url-decode a JWT segment (no padding).
 */
function decodeJwtSegment(string $segment): string
{
    $padded = str_pad($segment, intdiv(strlen($segment) + 3, 4) * 4, '=', STR_PAD_RIGHT);

    return base64_decode(strtr($padded, '-_', '+/'));
}

it('embeds the JWKS kid in the signed client assertion header', function () {
    $jwks = new FhirJwksService;
    $auth = new FhirAuthService($jwks);

    $resource = openssl_pkey_new([
        'private_key_bits' => 2048,
        'private_key_type' => OPENSSL_KEYTYPE_RSA,
    ]);
    $pem = '';
    openssl_pkey_export($resource, $pem);

    // Build an unsaved connection (no DB needed for buildClientAssertion).
    $conn = new FhirConnection([
        'client_id' => 'test-client-id',
        'token_endpoint' => 'https://ehr.example.org/oauth2/token',
    ]);
    $conn->private_key_pem = $pem;

    $assertion = $auth->buildClientAssertion($conn);

    [$headerSegment] = explode('.', $assertion);
    $header = json_decode(decodeJwtSegment($headerSegment), true);

    expect($header)->toHaveKey('kid');
    expect($header['alg'])->toBe('RS384');
    expect($header['typ'])->toBe('JWT');

    // The crux: the JWT header kid must match the JWKS kid for the same key,
    // so the verifier can select the right published public key.
    expect($header['kid'])->toBe($jwks->kidForConnection($conn));
});
