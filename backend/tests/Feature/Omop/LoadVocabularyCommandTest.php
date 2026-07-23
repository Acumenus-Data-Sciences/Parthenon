<?php

declare(strict_types=1);

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Services\Vocabulary\VocabularyImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;

uses(RefreshDatabase::class);

test('load-vocabulary fails without source-key and zip', function () {
    $this->artisan('omop:load-vocabulary')->assertExitCode(1);
});

test('load-vocabulary fails without source-key', function () {
    $this->artisan('omop:load-vocabulary', [
        '--zip' => '/tmp/vocab.zip',
    ])->assertExitCode(1);
});

test('load-vocabulary fails without zip', function () {
    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'SOME_KEY',
    ])->assertExitCode(1);
});

test('load-vocabulary fails when source not found', function () {
    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'NONEXISTENT',
        '--zip' => '/tmp/vocab.zip',
    ])->assertExitCode(1);
});

test('load-vocabulary fails when zip file does not exist', function () {
    Source::create([
        'source_key' => 'EXT_VOCAB_TEST',
        'source_name' => 'Vocab Test',
        'source_dialect' => 'postgresql',
        'source_connection' => 'dynamic',
        'db_host' => 'db.example.com',
        'db_port' => 5432,
        'db_database' => 'omop_db',
        'is_cache_enabled' => false,
    ]);

    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'EXT_VOCAB_TEST',
        '--zip' => '/nonexistent/vocab.zip',
    ])->assertExitCode(1);
});

test('load-vocabulary refuses to report a real import without an operator audit id', function () {
    Source::create([
        'source_key' => 'EXT_VOCAB_VALID',
        'source_name' => 'Vocab Valid',
        'source_dialect' => 'postgresql',
        'source_connection' => 'dynamic',
        'db_host' => 'db.example.com',
        'db_port' => 5432,
        'db_database' => 'omop_db',
        'is_cache_enabled' => false,
    ]);

    $tempZip = tempnam(sys_get_temp_dir(), 'vocab_').'.zip';
    file_put_contents($tempZip, 'fake zip content');

    // Run and assert before cleanup so the file exists during command execution.
    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'EXT_VOCAB_VALID',
        '--zip' => $tempZip,
    ])->assertExitCode(1);

    if (file_exists($tempZip)) {
        unlink($tempZip);
    }
});

test('load-vocabulary preflight uses vocab daimon table qualifier as schema', function () {
    $source = Source::create([
        'source_key' => 'EXT_VOCAB_DAIMON',
        'source_name' => 'Vocab Daimon',
        'source_dialect' => 'postgresql',
        'source_connection' => 'dynamic',
        'db_host' => 'db.example.com',
        'db_port' => 5432,
        'db_database' => 'omop_db',
        'is_cache_enabled' => false,
    ]);

    SourceDaimon::create([
        'source_id' => $source->id,
        'daimon_type' => DaimonType::Vocabulary->value,
        'table_qualifier' => 'custom_vocab',
        'priority' => 0,
    ]);

    $tempZip = tempnam(sys_get_temp_dir(), 'vocab_').'.zip';
    file_put_contents($tempZip, 'fake zip content');

    $this->mock(VocabularyImportService::class, function (MockInterface $mock): void {
        $mock->shouldReceive('import')
            ->once()
            ->withArgs(fn ($connection, $path, $schema, $removeOmitted, $logger, $preflightOnly, $backupPath) => $schema === 'custom_vocab'
                && $removeOmitted === false
                && $preflightOnly === true
                && $backupPath === null)
            ->andReturn(['status' => 'preflight_passed']);
    });

    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'EXT_VOCAB_DAIMON',
        '--zip' => $tempZip,
        '--preflight-only' => true,
    ])
        ->expectsOutputToContain('custom_vocab')
        ->assertExitCode(0);

    unlink($tempZip);
});

test('load-vocabulary requires an explicit destructive confirmation', function () {
    Source::create([
        'source_key' => 'EXT_VOCAB_REMOVE',
        'source_name' => 'Vocab Remove',
        'source_dialect' => 'postgresql',
        'source_connection' => 'dynamic',
        'db_host' => 'db.example.com',
        'db_port' => 5432,
        'db_database' => 'omop_db',
        'is_cache_enabled' => false,
    ]);
    $tempZip = tempnam(sys_get_temp_dir(), 'vocab_').'.zip';
    file_put_contents($tempZip, 'fake zip content');

    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'EXT_VOCAB_REMOVE',
        '--zip' => $tempZip,
        '--preflight-only' => true,
        '--remove-omitted' => true,
    ])->assertExitCode(1);

    unlink($tempZip);
});
