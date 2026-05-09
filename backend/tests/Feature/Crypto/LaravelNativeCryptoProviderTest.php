<?php

use App\Crypto\CryptoException;
use App\Crypto\LaravelNativeCryptoProvider;

beforeEach(function () {
    $this->provider = app(LaravelNativeCryptoProvider::class);
});

it('has the expected stable name and is available', function () {
    expect($this->provider->name())->toBe('laravel-native')
        ->and($this->provider->isAvailable())->toBeTrue();
});

it('hashes a password and verifies it', function () {
    $hash = $this->provider->hashPassword('CorrectHorseBattery');
    expect($hash)->not->toBe('CorrectHorseBattery')
        ->and(strlen($hash))->toBeGreaterThan(20)
        ->and($this->provider->verifyPassword('CorrectHorseBattery', $hash))->toBeTrue()
        ->and($this->provider->verifyPassword('Wrong', $hash))->toBeFalse();
});

it('reports needsRehash for old-cost hashes', function () {
    // Force a low-cost bcrypt hash; current config rounds (>= 10 in stock Laravel) trigger rehash.
    $low = password_hash('x', PASSWORD_BCRYPT, ['cost' => 6]);
    expect($this->provider->needsRehash($low))->toBeTrue();
});

it('encrypts and decrypts symmetrically', function () {
    $plain = 'sensitive-payload-7chars';
    $cipher = $this->provider->encrypt($plain);
    expect($cipher)->not->toBe($plain)
        ->and($this->provider->decrypt($cipher))->toBe($plain);
});

it('throws CryptoException on tampered ciphertext', function () {
    $cipher = $this->provider->encrypt('hello');
    $tampered = substr($cipher, 0, -2).'XX';
    expect(fn () => $this->provider->decrypt($tampered))
        ->toThrow(CryptoException::class);
});

it('encrypts non-deterministically (each call produces a unique ciphertext)', function () {
    $a = $this->provider->encrypt('same');
    $b = $this->provider->encrypt('same');
    expect($a)->not->toBe($b);
});

it('produces a stable HMAC', function () {
    $h = $this->provider->hmac('k', 'm');
    expect($h)->toMatch('/^[0-9a-f]{64}$/')
        ->and($h)->toBe($this->provider->hmac('k', 'm'));
});

it('verifies a correct HMAC', function () {
    $h = $this->provider->hmac('k', 'm');
    expect($this->provider->verifyHmac('k', 'm', $h))->toBeTrue();
});

it('rejects mismatched HMAC verification', function () {
    $h = $this->provider->hmac('k', 'm');
    expect($this->provider->verifyHmac('k', 'tampered', $h))->toBeFalse();
});

it('verifyHmac returns false on length-mismatched input (no early-exit oracle)', function () {
    expect($this->provider->verifyHmac('k', 'm', 'short'))->toBeFalse()
        ->and($this->provider->verifyHmac('k', 'm', str_repeat('x', 256)))->toBeFalse();
});
