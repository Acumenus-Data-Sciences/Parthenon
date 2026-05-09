<?php

namespace App\Contracts;

/**
 * Cryptographic operations abstraction. CE default delegates to Laravel
 * native Hash/Crypt; EE uses a FIPS 140-2-validated provider.
 *
 * Operations are intentionally minimal: only what Parthenon actually
 * needs for password storage, audit log signing, and small-payload
 * encryption. Long-term file encryption and large-payload streaming
 * are out of scope; for those use the storage adapter pattern.
 *
 * Implementations MUST:
 *   - Use bcrypt (cost ≥12) or argon2id for password hashes.
 *   - Use AES-256-GCM or equivalent AEAD for symmetric encryption.
 *   - Use HMAC-SHA-256 minimum for HMAC.
 *   - Be safe to call concurrently (no shared mutable state).
 */
interface CryptoProviderInterface
{
    public function name(): string;

    /** Whether this provider is currently functional (e.g., FIPS module loaded). */
    public function isAvailable(): bool;

    /** One-way password hashing. */
    public function hashPassword(#[\SensitiveParameter] string $plain): string;

    /** Verify password against a previously hashed value. */
    public function verifyPassword(#[\SensitiveParameter] string $plain, string $hash): bool;

    /** Whether a hash was produced under outdated parameters and should be rehashed on next login. */
    public function needsRehash(string $hash): bool;

    /**
     * Symmetric AEAD encryption of a small payload (R3).
     *
     * @return string Base64-encoded ciphertext. Implementations MAY embed
     *                metadata (key id, algorithm version, nonce, auth tag) inside this
     *                string. The format is provider-specific; only the same provider
     *                that produced a ciphertext is required to decrypt it.
     *
     *   Implementations supporting key rotation MUST encode the active
     *   key id in the ciphertext so decrypt() can pick the historical key
     *   when needed. EE's FipsCryptoProvider does this; CE's
     *   LaravelNativeCryptoProvider inherits Laravel's Crypt facade behavior
     *   which already encodes a key reference.
     */
    public function encrypt(#[\SensitiveParameter] string $plaintext): string;

    /**
     * Decrypt a payload produced by encrypt(). Throws CryptoException on tamper.
     *
     * Implementations MUST handle ciphertexts produced by past key rotations
     * of the same provider, falling back to historical keys as needed. A
     * customer who rotates their data-encryption key should be able to
     * read records encrypted under the old key for the lifetime of those
     * records.
     */
    public function decrypt(string $ciphertext): string;

    /** HMAC-SHA-256 (minimum). Returns hex digest. */
    public function hmac(string $key, string $message): string;

    /** Verify an HMAC produced by hmac(). Constant-time. */
    public function verifyHmac(string $key, string $message, string $expected): bool;
}
