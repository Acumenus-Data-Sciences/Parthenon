<?php

use App\Contracts\CryptoProviderInterface;
use App\Crypto\LaravelNativeCryptoProvider;
use Tests\Feature\Crypto\StubFipsCryptoProvider;

it('binds LaravelNativeCryptoProvider as the CE default', function () {
    $bound = app(CryptoProviderInterface::class);
    expect($bound)->toBeInstanceOf(LaravelNativeCryptoProvider::class)
        ->and($bound->name())->toBe('laravel-native');
});

it('honors a runtime-bound alternate crypto provider (proves pluggability)', function () {
    app()->bind(CryptoProviderInterface::class, StubFipsCryptoProvider::class);
    $bound = app(CryptoProviderInterface::class);
    expect($bound)->toBeInstanceOf(StubFipsCryptoProvider::class)
        ->and($bound->name())->toBe('stub-fips');

    // Roundtrip works through the alternate provider's format.
    $hash = $bound->hashPassword('secret');
    expect($hash)->toStartWith('STUB:')
        ->and($bound->verifyPassword('secret', $hash))->toBeTrue()
        ->and($bound->verifyPassword('wrong', $hash))->toBeFalse();

    $cipher = $bound->encrypt('hello');
    expect($cipher)->toStartWith('STUB-ENC:')
        ->and($bound->decrypt($cipher))->toBe('hello');
});

it('LaravelNative and Stub providers implement the same contract', function () {
    /** @var CryptoProviderInterface $native */
    $native = app(LaravelNativeCryptoProvider::class);
    /** @var CryptoProviderInterface $stub */
    $stub = new StubFipsCryptoProvider;

    foreach ([$native, $stub] as $provider) {
        expect($provider->isAvailable())->toBeTrue()
            ->and(strlen($provider->hmac('k', 'm')))->toBeGreaterThan(0);

        $hash = $provider->hashPassword('p');
        expect($provider->verifyPassword('p', $hash))->toBeTrue()
            ->and($provider->verifyPassword('q', $hash))->toBeFalse();

        $cipher = $provider->encrypt('payload');
        expect($provider->decrypt($cipher))->toBe('payload');
    }
});
