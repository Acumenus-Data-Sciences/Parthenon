<?php

declare(strict_types=1);

use App\Models\App\Source;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('test-connection fails without source-key or host+database', function () {
    $this->artisan('omop:test-connection')->assertExitCode(1);
});

test('test-connection fails when source-key not found', function () {
    $this->artisan('omop:test-connection', [
        '--source-key' => 'NONEXISTENT',
    ])->assertExitCode(1);
});

test('test-connection succeeds against app database', function () {
    // Create a source pointing at the same PG that Laravel uses — always reachable in test env
    Source::create([
        'source_key' => 'EXT_SELF_TEST',
        'source_name' => 'Self test',
        'source_dialect' => 'postgresql',
        'source_connection' => 'dynamic',
        'db_host' => config('database.connections.pgsql.host', '127.0.0.1'),
        'db_port' => (int) config('database.connections.pgsql.port', 5432),
        'db_database' => config('database.connections.pgsql.database', 'parthenon'),
        'username' => config('database.connections.pgsql.username', 'parthenon'),
        'password' => config('database.connections.pgsql.password', ''),
        'is_cache_enabled' => false,
    ]);

    $this->artisan('omop:test-connection', [
        '--source-key' => 'EXT_SELF_TEST',
    ])->assertExitCode(0);
});
