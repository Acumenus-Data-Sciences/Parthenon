<?php

declare(strict_types=1);

use App\Services\FinnGen\Exceptions\FinnGenSourceDisabledException;
use App\Services\FinnGen\Exceptions\FinnGenSourceNotFoundException;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use Database\Seeders\Testing\FinnGenTestingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenTestingSeeder::class);
});

it('builds an RO envelope for the eunomia source', function () {
    $envelope = app(FinnGenSourceContextBuilder::class)->build('EUNOMIA', FinnGenSourceContextBuilder::ROLE_RO);

    expect($envelope)->toHaveKey('source_key', 'EUNOMIA');
    expect($envelope['connection']['user'])->toBe('parthenon_finngen_ro');
    expect($envelope['connection'])->toHaveKeys(['server', 'port', 'user', 'password']);
    expect($envelope['schemas'])->toHaveKeys(['cdm', 'vocab', 'results', 'cohort']);
    expect($envelope['dbms'])->toBe('postgresql');
});

it('switches the connection user when role is RW', function () {
    $envelope = app(FinnGenSourceContextBuilder::class)->build('EUNOMIA', FinnGenSourceContextBuilder::ROLE_RW);
    expect($envelope['connection']['user'])->toBe('parthenon_finngen_rw');
});

it('defaults vocab schema to "vocab" when no daimon is configured', function () {
    $envelope = app(FinnGenSourceContextBuilder::class)->build('EUNOMIA', FinnGenSourceContextBuilder::ROLE_RO);
    // FinnGenTestingSeeder does not seed source_daimons, so defaults apply.
    expect($envelope['schemas']['vocab'])->toBe('vocab');
    expect($envelope['schemas']['cdm'])->toBe('eunomia');
    expect($envelope['schemas']['results'])->toBe('eunomia_results');
    expect($envelope['schemas']['cohort'])->toBe('eunomia_results');
});

it('throws FinnGenSourceNotFoundException for unknown source', function () {
    app(FinnGenSourceContextBuilder::class)->build('NONEXISTENT_SOURCE', FinnGenSourceContextBuilder::ROLE_RO);
})->throws(FinnGenSourceNotFoundException::class);

it('throws FinnGenSourceDisabledException for soft-deleted source', function () {
    app(FinnGenSourceContextBuilder::class)->build('FINNGEN_TEST_DISABLED', FinnGenSourceContextBuilder::ROLE_RO);
})->throws(FinnGenSourceDisabledException::class);

it('includes label from source_name column', function () {
    $envelope = app(FinnGenSourceContextBuilder::class)->build('EUNOMIA', FinnGenSourceContextBuilder::ROLE_RO);
    expect($envelope['label'])->toBe('Eunomia (demo)');
});

it('uses the configured finngen pg_ro_password for RO role', function () {
    config(['finngen.pg_ro_password' => 'test-ro-secret']);
    $envelope = app(FinnGenSourceContextBuilder::class)->build('EUNOMIA', FinnGenSourceContextBuilder::ROLE_RO);
    expect($envelope['connection']['password'])->toBe('test-ro-secret');
});

it('uses the configured finngen pg_rw_password for RW role', function () {
    config(['finngen.pg_rw_password' => 'test-rw-secret']);
    $envelope = app(FinnGenSourceContextBuilder::class)->build('EUNOMIA', FinnGenSourceContextBuilder::ROLE_RW);
    expect($envelope['connection']['password'])->toBe('test-rw-secret');
});
