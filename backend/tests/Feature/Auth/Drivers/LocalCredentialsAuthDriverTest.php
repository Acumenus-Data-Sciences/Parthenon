<?php

use App\Auth\Drivers\AuthDriverException;
use App\Auth\Drivers\AuthDriverResult;
use App\Auth\Drivers\LocalCredentialsAuthDriver;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->driver = app(LocalCredentialsAuthDriver::class);
});

it('has the expected stable name', function () {
    expect($this->driver->name())->toBe('local');
});

it('reports availability', function () {
    expect($this->driver->isAvailable())->toBeTrue();
});

it('authenticates a user with valid email + password', function () {
    $user = User::factory()->create([
        'email' => 'researcher@acumenus.net',
        'password' => Hash::make('CorrectHorseBattery'),
        'must_change_password' => false,
    ]);

    $result = $this->driver->authenticate([
        'email' => 'researcher@acumenus.net',
        'password' => 'CorrectHorseBattery',
    ]);

    expect($result)->toBeInstanceOf(AuthDriverResult::class)
        ->and($result->user->id)->toBe($user->id)
        ->and($result->driverName)->toBe('local')
        ->and($result->mustChangePassword)->toBeFalse()
        ->and($result->mfaAuthenticated)->toBeFalse();
});

it('surfaces must_change_password from the user record', function () {
    User::factory()->create([
        'email' => 'newhire@acumenus.net',
        'password' => Hash::make('TempPass123'),
        'must_change_password' => true,
    ]);

    $result = $this->driver->authenticate([
        'email' => 'newhire@acumenus.net',
        'password' => 'TempPass123',
    ]);

    expect($result->mustChangePassword)->toBeTrue();
});

it('rejects an unknown email with 401', function () {
    expect(fn () => $this->driver->authenticate([
        'email' => 'nobody@nowhere.net',
        'password' => 'anything',
    ]))->toThrow(
        AuthDriverException::class,
        'Invalid credentials',
    );
});

it('rejects a wrong password with 401', function () {
    User::factory()->create([
        'email' => 'researcher@acumenus.net',
        'password' => Hash::make('CorrectHorseBattery'),
    ]);

    try {
        $this->driver->authenticate([
            'email' => 'researcher@acumenus.net',
            'password' => 'WrongPassword',
        ]);
        $this->fail('Expected AuthDriverException');
    } catch (AuthDriverException $e) {
        expect($e->getCode())->toBe(AuthDriverException::CODE_INVALID_CREDENTIALS)
            ->and($e->driverName)->toBe('local');
    }
});

it('rejects malformed credentials with 422', function () {
    expect(fn () => $this->driver->authenticate([
        'email' => 'a@b.com',
        // missing 'password' key
    ]))->toThrow(AuthDriverException::class);
});

it('lowercases and trims the email before lookup', function () {
    User::factory()->create([
        'email' => 'normalized@acumenus.net',
        'password' => Hash::make('TestPass123'),
    ]);

    $result = $this->driver->authenticate([
        'email' => '  Normalized@ACUMENUS.net  ',
        'password' => 'TestPass123',
    ]);

    expect($result->user->email)->toBe('normalized@acumenus.net');
});
