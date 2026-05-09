<?php

namespace Tests\Feature\Crypto;

use App\Contracts\CryptoProviderInterface;
use App\Crypto\CryptoException;

/**
 * Test fixture: alternate crypto provider with a different ciphertext format.
 * Demonstrates the contract that EE's FipsCryptoProvider fulfills.
 *
 * NOT cryptographically strong — for pluggability proof only.
 */
class StubFipsCryptoProvider implements CryptoProviderInterface
{
    public function name(): string
    {
        return 'stub-fips';
    }

    public function isAvailable(): bool
    {
        return true;
    }

    public function hashPassword(#[\SensitiveParameter] string $plain): string
    {
        return 'STUB:'.sha1($plain);
    }

    public function verifyPassword(#[\SensitiveParameter] string $plain, string $hash): bool
    {
        return hash_equals('STUB:'.sha1($plain), $hash);
    }

    public function needsRehash(string $hash): bool
    {
        return ! str_starts_with($hash, 'STUB:');
    }

    public function encrypt(#[\SensitiveParameter] string $plaintext): string
    {
        return 'STUB-ENC:'.base64_encode($plaintext);
    }

    public function decrypt(string $ciphertext): string
    {
        if (! str_starts_with($ciphertext, 'STUB-ENC:')) {
            throw new CryptoException(
                'Not a stub ciphertext',
                CryptoException::CODE_INVALID_CIPHERTEXT,
                $this->name(),
            );
        }

        return base64_decode(substr($ciphertext, 9));
    }

    public function hmac(string $key, string $message): string
    {
        return hash_hmac('sha512', $message, $key);
    }

    public function verifyHmac(string $key, string $message, string $expected): bool
    {
        return hash_equals($this->hmac($key, $message), $expected);
    }
}
