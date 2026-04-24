<?php

use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Foundation\Testing\DatabaseTransactions;

uses(DatabaseTransactions::class);

test('register-source creates source and three daimons', function () {
    $this->artisan('omop:register-source', [
        '--source-key' => 'EXT_TEST',
        '--name' => 'Test External CDM',
        '--dialect' => 'postgresql',
        '--host' => 'db.example.com',
        '--port' => '5432',
        '--database' => 'omop_db',
        '--username' => 'reader',
        '--password' => 'secret',
        '--cdm-schema' => 'omop',
        '--vocab-schema' => 'vocab',
        '--results-schema' => 'results',
    ])->assertExitCode(0);

    $source = Source::where('source_key', 'EXT_TEST')->first();
    expect($source)->not->toBeNull();
    expect($source->source_name)->toBe('Test External CDM');

    $daimons = SourceDaimon::where('source_id', $source->id)->get();
    expect($daimons)->toHaveCount(3);
});

test('register-source is idempotent', function () {
    $this->artisan('omop:register-source', [
        '--source-key' => 'EXT_IDEM',
        '--name' => 'Test',
        '--dialect' => 'postgresql',
        '--host' => 'h',
        '--port' => '5432',
        '--database' => 'd',
    ])->assertExitCode(0);

    $this->artisan('omop:register-source', [
        '--source-key' => 'EXT_IDEM',
        '--name' => 'Test Updated',
        '--dialect' => 'postgresql',
        '--host' => 'h',
        '--port' => '5432',
        '--database' => 'd',
    ])->assertExitCode(0);

    expect(Source::where('source_key', 'EXT_IDEM')->count())->toBe(1);
    expect(Source::where('source_key', 'EXT_IDEM')->first()->source_name)->toBe('Test Updated');
    expect(SourceDaimon::whereHas('source', fn ($q) => $q->where('source_key', 'EXT_IDEM'))->count())->toBe(3);
});

test('register-source fails without source-key', function () {
    $this->artisan('omop:register-source')->assertExitCode(1);
});
