<?php

namespace App\Crypto;

use App\Contracts\CryptoProviderInterface;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Throwable;

/**
 * CE default crypto provider — delegates to Laravel native facades:
 *
 *   - Hash::make / Hash::check (bcrypt by default; cost from config('hashing'))
 *   - Crypt::encryptString / Crypt::decryptString (AES-256-GCM by default
 *     in Laravel 11; encodes APP_KEY id automatically so key rotation works)
 *   - hash_hmac('sha256', ...) for HMAC-SHA-256
 *
 * EE replaces this binding with FipsCryptoProvider (PBKDF2-HMAC-SHA-256
 * for passwords; AES-256-GCM via FIPS-validated OpenSSL; explicit keyId
 * encoding for key rotation).
 */
class LaravelNativeCryptoProvider implements CryptoProviderInterface
{
    public function name(): string
    {
        return 'laravel-native';
    }

    public function isAvailable(): bool
    {
        return function_exists('hash_hmac')
            && extension_loaded('openssl')
            && extension_loaded('hash');
    }

    public function hashPassword(#[\SensitiveParameter] string $plain): string
    {
        return Hash::make($plain);
    }

    public function verifyPassword(#[\SensitiveParameter] string $plain, string $hash): bool
    {
        if ($hash === '') {
            return false;
        }

        return Hash::check($plain, $hash);
    }

    public function needsRehash(string $hash): bool
    {
        return Hash::needsRehash($hash);
    }

    public function encrypt(#[\SensitiveParameter] string $plaintext): string
    {
        try {
            return Crypt::encryptString($plaintext);
        } catch (Throwable $e) {
            throw new CryptoException(
                'Encryption failed',
                CryptoException::CODE_PROVIDER_UNAVAILABLE,
                $this->name(),
                $e,
            );
        }
    }

    public function decrypt(string $ciphertext): string
    {
        try {
            return Crypt::decryptString($ciphertext);
        } catch (DecryptException $e) {
            throw new CryptoException(
                'Ciphertext invalid or tampered',
                CryptoException::CODE_TAMPERED,
                $this->name(),
                $e,
            );
        }
    }

    public function hmac(string $key, string $message): string
    {
        return hash_hmac('sha256', $message, $key);
    }

    public function verifyHmac(string $key, string $message, string $expected): bool
    {
        $actual = $this->hmac($key, $message);

        return hash_equals($actual, $expected);
    }
}
