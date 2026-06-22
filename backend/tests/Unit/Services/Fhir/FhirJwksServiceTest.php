<?php

declare(strict_types=1);

use App\Services\Fhir\FhirJwksService;

/**
 * Generate a fresh 2048-bit RSA keypair and return its private key PEM.
 */
function generatePrivateKeyPem(): string
{
    $resource = openssl_pkey_new([
        'private_key_bits' => 2048,
        'private_key_type' => OPENSSL_KEYTYPE_RSA,
    ]);

    expect($resource)->not->toBeFalse();

    $pem = '';
    openssl_pkey_export($resource, $pem);

    return $pem;
}

it('derives an RSA JWK from a private key PEM', function () {
    $service = new FhirJwksService;
    $pem = generatePrivateKeyPem();

    $jwk = $service->jwkFromPrivateKeyPem($pem);

    expect($jwk)->not->toBeNull();
    expect($jwk['kty'])->toBe('RSA');
    expect($jwk['use'])->toBe('sig');
    expect($jwk['alg'])->toBe('RS384');
    expect($jwk['n'])->toBeString()->not->toBe('');
    // 65537 (0x010001) is the universal standard RSA public exponent → "AQAB".
    expect($jwk['e'])->toBe('AQAB');
    expect($jwk['kid'])->toBeString()->not->toBe('');
});

it('produces a stable kid for the same key (idempotent)', function () {
    $service = new FhirJwksService;
    $pem = generatePrivateKeyPem();

    $first = $service->jwkFromPrivateKeyPem($pem);
    $second = $service->jwkFromPrivateKeyPem($pem);

    expect($first['kid'])->toBe($second['kid']);
});

it('produces different kids for different keys', function () {
    $service = new FhirJwksService;

    $a = $service->jwkFromPrivateKeyPem(generatePrivateKeyPem());
    $b = $service->jwkFromPrivateKeyPem(generatePrivateKeyPem());

    expect($a['kid'])->not->toBe($b['kid']);
});

it('returns null for an invalid PEM', function () {
    $service = new FhirJwksService;

    expect($service->jwkFromPrivateKeyPem('not-a-pem'))->toBeNull();
});

it('computes a deterministic RFC 7638 thumbprint that is base64url', function () {
    $service = new FhirJwksService;

    $n = 'some-modulus-value';
    $e = 'AQAB';

    $first = $service->thumbprint($n, $e);
    $second = $service->thumbprint($n, $e);

    expect($first)->toBe($second);
    // base64url alphabet only: no +, /, or = padding.
    expect($first)->not->toContain('+');
    expect($first)->not->toContain('/');
    expect($first)->not->toContain('=');
    expect($first)->toMatch('/^[A-Za-z0-9_-]+$/');
});

it('base64url-encodes raw bytes without padding or unsafe chars', function () {
    $service = new FhirJwksService;

    // Bytes that force + and / under standard base64 (0xFB 0xFF 0xBF).
    $encoded = $service->base64url("\xFB\xFF\xBF");

    expect($encoded)->not->toContain('+');
    expect($encoded)->not->toContain('/');
    expect($encoded)->not->toContain('=');
    expect($encoded)->toBe('-_-_');
});
