# CE/EE Fork — Plan 02-03: CryptoProvider Extension Point

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. See [Plan 02-01](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md) for the canonical TDD pattern.

**Goal:** Add a `CryptoProviderInterface` abstraction that wraps `Hash`, `Crypt`, and signing operations so EE can swap in a FIPS 140-2-validated provider (BoringSSL / OpenSSL FIPS module) without patching CE.

**Architecture:** Thin adapter pattern. CE default `LaravelNativeCryptoProvider` delegates to `Hash::make`, `Hash::check`, `Crypt::encryptString`, `Crypt::decryptString`, `hash_hmac`. EE's `FipsCryptoProvider` calls into a FIPS-validated OpenSSL provider via PHP extension or sidecar daemon. The interface is intentionally minimal — only the operations Parthenon actually performs (password hashing, payload encryption, JWT signing, HMAC) are exposed.

**Tech Stack:** PHP 8.4, Laravel Hash/Crypt facades, OpenSSL.

**Spec reference:** Spec §5 row 3.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:** Plan 01 merged (AGPLv3). No dependency on 02-01 or 02-02 — independent.

---

## File structure

| Path | Purpose | LOC |
|---|---|---|
| `backend/app/Contracts/CryptoProviderInterface.php` | Extension contract | ~70 |
| `backend/app/Crypto/LaravelNativeCryptoProvider.php` | CE default | ~80 |
| `backend/app/Crypto/CryptoException.php` | Typed errors | ~30 |
| `backend/app/Providers/CryptoProviderServiceProvider.php` | Binds active provider | ~30 |
| `backend/config/crypto.php` | Active provider class | ~30 |
| `backend/tests/Feature/Crypto/LaravelNativeCryptoProviderTest.php` | Default tests | ~150 |
| `backend/tests/Feature/Crypto/StubFipsCryptoProvider.php` | Pluggability fixture | ~50 |
| `backend/tests/Feature/Crypto/CryptoProviderPluggabilityTest.php` | Stub tests | ~80 |
| `docs/architecture/extension-points/crypto-provider.md` | Detail doc | ~200 |

**Modified files:**
- `backend/bootstrap/providers.php` — register `CryptoProviderServiceProvider`
- `docs/architecture/extension-points.md` — mark row 3 done

---

## Task 1: Define CryptoProviderInterface + CryptoException

- [ ] **Step 1.1: Interface**

```php
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
     *   metadata (key id, algorithm version, nonce, auth tag) inside this
     *   string. The format is provider-specific; only the same provider
     *   that produced a ciphertext is required to decrypt it.
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
```

- [ ] **Step 1.2: CryptoException**

```php
<?php
namespace App\Crypto;

class CryptoException extends \RuntimeException {
    public const CODE_INVALID_CIPHERTEXT = 1;
    public const CODE_TAMPERED = 2;
    public const CODE_PROVIDER_UNAVAILABLE = 3;

    public function __construct(string $message, int $code, public readonly string $providerName, ?\Throwable $previous = null) {
        parent::__construct($message, $code, $previous);
    }
}
```

---

## Task 2: TDD — Write LaravelNativeCryptoProviderTest

- [ ] **Step 2.1: Failing test**

```php
<?php
use App\Crypto\CryptoException;
use App\Crypto\LaravelNativeCryptoProvider;

beforeEach(fn() => $this->p = app(LaravelNativeCryptoProvider::class));

it('has the expected name and is available', function () {
    expect($this->p->name())->toBe('laravel-native')
        ->and($this->p->isAvailable())->toBeTrue();
});

it('hashes a password and verifies it', function () {
    $hash = $this->p->hashPassword('CorrectHorseBattery');
    expect($hash)->not->toBe('CorrectHorseBattery')
        ->and($this->p->verifyPassword('CorrectHorseBattery', $hash))->toBeTrue()
        ->and($this->p->verifyPassword('Wrong', $hash))->toBeFalse();
});

it('reports needsRehash for old-cost hashes', function () {
    $low = password_hash('x', PASSWORD_BCRYPT, ['cost' => 6]);
    config(['hashing.bcrypt.rounds' => 12]);
    expect($this->p->needsRehash($low))->toBeTrue();
});

it('encrypts and decrypts symmetrically', function () {
    $plain = 'sensitive-payload-7chars';
    $cipher = $this->p->encrypt($plain);
    expect($cipher)->not->toBe($plain)
        ->and($this->p->decrypt($cipher))->toBe($plain);
});

it('throws on tampered ciphertext', function () {
    $cipher = $this->p->encrypt('hello');
    $tampered = substr($cipher, 0, -2) . 'XX';
    expect(fn() => $this->p->decrypt($tampered))
        ->toThrow(CryptoException::class);
});

it('encrypts non-deterministically (each call produces a unique ciphertext)', function () {
    $a = $this->p->encrypt('same');
    $b = $this->p->encrypt('same');
    expect($a)->not->toBe($b);
});

it('produces a stable HMAC', function () {
    $h = $this->p->hmac('k', 'm');
    expect($h)->toMatch('/^[0-9a-f]{64}$/')
        ->and($h)->toBe($this->p->hmac('k', 'm'));
});

it('rejects mismatched HMAC verification', function () {
    $h = $this->p->hmac('k', 'm');
    expect($this->p->verifyHmac('k', 'm', $h))->toBeTrue()
        ->and($this->p->verifyHmac('k', 'tampered', $h))->toBeFalse();
});

it('verifyHmac is constant-time-friendly (no early exit on length)', function () {
    expect($this->p->verifyHmac('k', 'm', 'short'))->toBeFalse()
        ->and($this->p->verifyHmac('k', 'm', str_repeat('x', 256)))->toBeFalse();
});
```

- [ ] **Step 2.2: Run — all fail**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Crypto/LaravelNativeCryptoProviderTest.php"
```

---

## Task 3: Implement LaravelNativeCryptoProvider

- [ ] **Step 3.1: Implementation**

```php
<?php
namespace App\Crypto;

use App\Contracts\CryptoProviderInterface;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

class LaravelNativeCryptoProvider implements CryptoProviderInterface
{
    public function name(): string { return 'laravel-native'; }

    public function isAvailable(): bool {
        return function_exists('hash_hmac')
            && extension_loaded('openssl')
            && extension_loaded('hash');
    }

    public function hashPassword(#[\SensitiveParameter] string $plain): string {
        return Hash::make($plain);
    }

    public function verifyPassword(#[\SensitiveParameter] string $plain, string $hash): bool {
        return Hash::check($plain, $hash);
    }

    public function needsRehash(string $hash): bool {
        return Hash::needsRehash($hash);
    }

    public function encrypt(#[\SensitiveParameter] string $plaintext): string {
        try {
            return Crypt::encryptString($plaintext);
        } catch (\Throwable $e) {
            throw new CryptoException('Encryption failed', CryptoException::CODE_PROVIDER_UNAVAILABLE, $this->name(), $e);
        }
    }

    public function decrypt(string $ciphertext): string {
        try {
            return Crypt::decryptString($ciphertext);
        } catch (\Illuminate\Contracts\Encryption\DecryptException $e) {
            throw new CryptoException('Ciphertext invalid or tampered', CryptoException::CODE_TAMPERED, $this->name(), $e);
        }
    }

    public function hmac(string $key, string $message): string {
        return hash_hmac('sha256', $message, $key);
    }

    public function verifyHmac(string $key, string $message, string $expected): bool {
        $actual = $this->hmac($key, $message);
        return hash_equals($actual, $expected);
    }
}
```

- [ ] **Step 3.2: Pass tests**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Crypto/LaravelNativeCryptoProviderTest.php"
```

Expected: 9/9 PASS.

- [ ] **Step 3.3: Commit**

```bash
git commit -m "feat(crypto): CryptoProviderInterface + LaravelNativeCryptoProvider"
```

---

## Task 4: ServiceProvider, config, pluggability proof

- [ ] **Step 4.1: config/crypto.php**

```php
<?php

use App\Crypto\LaravelNativeCryptoProvider;

return [
    'provider' => env('CRYPTO_PROVIDER', LaravelNativeCryptoProvider::class),
];
```

- [ ] **Step 4.2: CryptoProviderServiceProvider**

```php
<?php
namespace App\Providers;

use App\Contracts\CryptoProviderInterface;
use Illuminate\Support\ServiceProvider;

class CryptoProviderServiceProvider extends ServiceProvider {
    public function register(): void {
        $this->app->singleton(CryptoProviderInterface::class, fn() => app(config('crypto.provider')));
    }
}
```

- [ ] **Step 4.3: Register in `bootstrap/providers.php`**

- [ ] **Step 4.4: StubFipsCryptoProvider fixture + pluggability test**

```php
<?php
namespace Tests\Feature\Crypto;

use App\Contracts\CryptoProviderInterface;

class StubFipsCryptoProvider implements CryptoProviderInterface {
    public function name(): string { return 'stub-fips'; }
    public function isAvailable(): bool { return true; }
    public function hashPassword(string $plain): string { return 'STUB:' . sha1($plain); }
    public function verifyPassword(string $plain, string $hash): bool { return $hash === 'STUB:' . sha1($plain); }
    public function needsRehash(string $hash): bool { return !str_starts_with($hash, 'STUB:'); }
    public function encrypt(string $plaintext): string { return 'STUB:' . base64_encode($plaintext); }
    public function decrypt(string $ciphertext): string {
        if (!str_starts_with($ciphertext, 'STUB:')) {
            throw new \App\Crypto\CryptoException('not stub format', 1, $this->name());
        }
        return base64_decode(substr($ciphertext, 5));
    }
    public function hmac(string $key, string $message): string { return hash_hmac('sha512', $message, $key); }
    public function verifyHmac(string $key, string $message, string $expected): bool { return hash_equals($this->hmac($key, $message), $expected); }
}
```

```php
<?php
use App\Contracts\CryptoProviderInterface;
use Tests\Feature\Crypto\StubFipsCryptoProvider;

it('honors a runtime-bound alternate crypto provider', function () {
    app()->bind(CryptoProviderInterface::class, StubFipsCryptoProvider::class);
    $p = app(CryptoProviderInterface::class);
    expect($p->name())->toBe('stub-fips')
        ->and($p->hashPassword('x'))->toStartWith('STUB:')
        ->and($p->verifyPassword('x', $p->hashPassword('x')))->toBeTrue();
});
```

- [ ] **Step 4.5: Commit**

```bash
git commit -m "feat(crypto): service provider + config + pluggability proof"
```

---

## Task 5: Optional — wire AuthDriver to use CryptoProvider

If Plan 02-01 has merged, refactor `LocalCredentialsAuthDriver` to call `CryptoProviderInterface::verifyPassword` instead of `Hash::check` directly. Otherwise, defer to a follow-up PR. Behavior must remain identical.

```php
// backend/app/Auth/Drivers/LocalCredentialsAuthDriver.php
public function __construct(private CryptoProviderInterface $crypto) {}
// in authenticate():
if (!$user || !$this->crypto->verifyPassword($credentials['password'], $user->password)) {
    throw new AuthDriverException(...);
}
```

Existing AuthDriverTests still pass.

---

## Task 6: Documentation

- [ ] Write `docs/architecture/extension-points/crypto-provider.md` covering: interface contract, FIPS rationale, supported algorithms, how EE plugs in, key rotation considerations.
- [ ] Update extension-points.md to link.
- [ ] Commit.

---

## Task 7: PR

```bash
gh pr create --title "feat(crypto): CryptoProvider extension point (Phase 2 #3 of 8)" \
  --body "$(cat <<'EOF'
## Summary

Third of 8 CE extension points. Wraps Hash/Crypt/HMAC behind CryptoProviderInterface so EE can swap in a FIPS 140-2-validated provider in `enterprise/backend/src/Crypto/FipsCryptoProvider.php`.

## Behavioral changes
None — LaravelNativeCryptoProvider is a thin pass-through to Hash::make / Crypt::encryptString / hash_hmac.

## Test plan
- [ ] CI green, license-guard green
- [ ] 9 LaravelNativeCryptoProviderTest cases pass
- [ ] StubFipsCryptoProvider pluggability test passes
- [ ] All existing auth tests still pass (no behavior change)
EOF
)"
```

---

## Plan 02-03 completion checklist

- [ ] CryptoProviderInterface published, documented
- [ ] LaravelNativeCryptoProvider passes 9 Pest cases
- [ ] Provider bound from config/crypto.php
- [ ] StubFipsCryptoProvider proves pluggability
- [ ] Doc page published
- [ ] PR merged

## Out of scope

- EE FipsCryptoProvider implementation — Plan 04
- Hardware Security Module (HSM) integration — future
- Per-tenant encryption keys — future (depends on Plan 02-02 + EE)
- Key rotation tooling — future

*End of Plan 02-03.*
