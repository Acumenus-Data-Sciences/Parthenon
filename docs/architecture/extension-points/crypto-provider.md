# Extension Point: Crypto Provider

**Interface:** `App\Contracts\CryptoProviderInterface`
**Default driver (CE):** `App\Crypto\LaravelNativeCryptoProvider`
**Service provider:** `App\Providers\CryptoProviderServiceProvider`
**Config:** `backend/config/crypto.php`
**Status:** Live since [Phase 2 #3](../../superpowers/plans/2026-05-09-ce-ee-fork-plan-02-03-crypto-provider.md)

## Purpose

Decouple Parthenon's cryptographic primitives from a specific implementation so EE can ship a FIPS 140-2-validated provider (PBKDF2-HMAC-SHA-256 password hashes, AES-256-GCM via FIPS-validated OpenSSL, explicit keyId encoding for key rotation) without patching CE.

The interface is intentionally **minimal** — only the operations Parthenon actually performs:

- Password hashing (one-way) + verification + needsRehash signal
- Symmetric AEAD encryption + decryption (small payloads)
- HMAC + verification

Long-term file encryption and large-payload streaming are deliberately out of scope; for those, use the storage adapter pattern.

## The contract

```php
interface CryptoProviderInterface
{
    public function name(): string;
    public function isAvailable(): bool;

    public function hashPassword(#[\SensitiveParameter] string $plain): string;
    public function verifyPassword(#[\SensitiveParameter] string $plain, string $hash): bool;
    public function needsRehash(string $hash): bool;

    public function encrypt(#[\SensitiveParameter] string $plaintext): string;
    public function decrypt(string $ciphertext): string;

    public function hmac(string $key, string $message): string;
    public function verifyHmac(string $key, string $message, string $expected): bool;
}
```

### Algorithm requirements (R3)

Implementations MUST:

- Use **bcrypt cost ≥ 12** or **argon2id** for password hashes
- Use **AES-256-GCM** or equivalent AEAD for symmetric encryption
- Use **HMAC-SHA-256 minimum** (SHA-512 OK, weaker prohibited)
- Be safe to call concurrently (no shared mutable state)

### Ciphertext metadata + key rotation (R3)

`encrypt()` returns a base64-encoded string. **Implementations MAY embed metadata** (key id, algorithm version, nonce, auth tag) inside the ciphertext. The format is provider-specific; only the **same provider** that produced a ciphertext is required to decrypt it.

**Implementations supporting key rotation MUST encode the active key id in the ciphertext** so `decrypt()` can fall back to a historical key when needed. EE's `FipsCryptoProvider` does this explicitly. CE's `LaravelNativeCryptoProvider` inherits Laravel's `Crypt` facade behavior, which already encodes a key reference (the APP_KEY id), enabling APP_KEY rotation.

`decrypt()` MUST handle ciphertexts produced by past key rotations of the same provider. A customer who rotates their data-encryption key should be able to read records encrypted under the old key for the lifetime of those records.

### `needsRehash` signal

Surfaced on every login. When `needsRehash()` returns true, the controller should re-hash the password with current parameters and persist. This handles:

- Hash cost upgrades (bcrypt 10 → 12)
- Algorithm migrations (bcrypt → argon2id)
- Provider migrations (CE LaravelNative → EE FIPS)

## CE-shipped provider

### `LaravelNativeCryptoProvider`

- `hashPassword` → `Hash::make` (bcrypt by default; cost from `config('hashing')`)
- `verifyPassword` → `Hash::check`
- `needsRehash` → `Hash::needsRehash`
- `encrypt` → `Crypt::encryptString` (AES-256-GCM in Laravel 11; encodes APP_KEY id automatically)
- `decrypt` → `Crypt::decryptString` (throws `CryptoException::CODE_TAMPERED` on tamper)
- `hmac` → `hash_hmac('sha256', ...)`
- `verifyHmac` → `hash_equals(...)` (constant-time)

`isAvailable()` checks for the `openssl` and `hash` PHP extensions plus the `hash_hmac` function. CE always passes; if not, the install is broken.

## How to register a custom provider

### Pattern A — config-driven (CE convention)

Set `CRYPTO_PROVIDER` in `.env` to your class:

```bash
CRYPTO_PROVIDER=Acumenus\Parthenon\Enterprise\Crypto\FipsCryptoProvider
```

`CryptoProviderServiceProvider` reads `config/crypto.php` and binds `CryptoProviderInterface` to the configured class as a singleton.

### Pattern B — service provider override (EE convention)

EE's `EnterpriseServiceProvider::register()` does:

```php
if ($licenseService->hasEntitlement('crypto.fips')) {
    $this->app->bind(
        \App\Contracts\CryptoProviderInterface::class,
        \Acumenus\Parthenon\Enterprise\Crypto\FipsCryptoProvider::class,
    );
}
```

This pattern is preferred when binding depends on runtime state (license entitlements, FIPS module availability check at boot).

## Hypothetical EE `FipsCryptoProvider`

```php
class FipsCryptoProvider implements CryptoProviderInterface
{
    public function name(): string { return 'fips-openssl'; }

    public function isAvailable(): bool {
        return getenv('OPENSSL_FIPS') === '1' && extension_loaded('openssl');
    }

    public function hashPassword(string $plain): string {
        // bcrypt is not FIPS-approved; PBKDF2-HMAC-SHA256 with 600k iterations.
        $salt = random_bytes(16);
        $hash = hash_pbkdf2('sha256', $plain, $salt, 600_000, 32, true);
        return 'pbkdf2$'.base64_encode($salt).'$'.base64_encode($hash);
    }

    public function encrypt(string $plaintext): string {
        $key = $this->getActiveKey();
        $nonce = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
        return base64_encode($this->activeKeyId."|".$nonce."|".$tag."|".$cipher);
    }

    public function decrypt(string $ciphertext): string {
        $parts = explode('|', base64_decode($ciphertext), 4);
        [$keyId, $nonce, $tag, $cipher] = $parts;
        $key = $this->getKeyById($keyId);  // historical key fallback
        return openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag)
            ?: throw new CryptoException('Decryption failed', CryptoException::CODE_TAMPERED, $this->name());
    }

    // ... hmac/verifyHmac use sha256 or sha512 ...
}
```

## CryptoException

Three stable codes:

- `CODE_INVALID_CIPHERTEXT` (1) — wrong format, can't even attempt decrypt
- `CODE_TAMPERED` (2) — auth tag verification failed
- `CODE_PROVIDER_UNAVAILABLE` (3) — provider can't operate (e.g., FIPS module not loaded)

Each exception carries the `providerName` so logs/traces can identify which provider failed.

## Testing patterns

- **Unit tests for the provider:** see `tests/Feature/Crypto/LaravelNativeCryptoProviderTest.php` (10 cases). Cover name/availability, hash+verify roundtrip, needsRehash for stale parameters, encrypt/decrypt roundtrip, tamper detection, non-deterministic encryption, HMAC stability + verification + length-mismatch.
- **Pluggability proof:** see `tests/Feature/Crypto/StubFipsCryptoProvider.php` + `CryptoProviderPluggabilityTest.php` (3 cases). Demonstrates the contract by binding an alternate provider with a different ciphertext format and verifying roundtrip + contract-equivalence.

## Future integrations (not in this PR)

- **AuthDriver wiring:** `LocalCredentialsAuthDriver` currently calls `Hash::check` directly. A follow-up refactor routes it through `CryptoProviderInterface::verifyPassword` so EE FIPS deployments use FIPS-validated PBKDF2 for password verification. Behavior preserved (LaravelNativeCryptoProvider's `verifyPassword` delegates to `Hash::check`).
- **Audit chain HMAC:** Plan 02-04's SignedAuditSink uses `CryptoProviderInterface::hmac` for the chain-signing HMAC. EE FIPS deployments get FIPS-validated HMAC-SHA-512 automatically.
- **Field-level encryption:** future Eloquent cast migrating from Laravel's `encrypted:array` cast to a CryptoProvider-backed cast. Decision pending.

## Security notes

- `verifyPassword` uses Laravel `Hash::check` which is constant-time-safe (bcrypt's compare).
- `verifyHmac` uses `hash_equals` which is constant-time.
- `hashPassword` and `encrypt` accept `#[\SensitiveParameter]` so PHP's stack traces and error messages don't leak secrets.
- Key rotation: when rotating APP_KEY, retain the old key in `APP_PREVIOUS_KEYS` (Laravel's standard env var) until all encrypted records have been re-encrypted with the new key.
- HSM/KMS integration: CE doesn't ship one. EE customers needing HSM-backed keys use `FipsCryptoProvider` configured with a PKCS#11 module — separate concern from this interface.

## Out of scope (deferred)

- HSM (Hardware Security Module) integration — future EE feature
- Per-tenant encryption keys — future (depends on Plan 02-02 + EE)
- Key rotation tooling (CLI for "rotate APP_KEY and re-encrypt") — future
- Asymmetric crypto (RSA/Ed25519 sign/verify) — out of scope; use a separate signer interface if needed
