<?php

use Illuminate\Support\Facades\Artisan;

test('db:audit command runs successfully', function () {
    $this->artisan('db:audit')
        ->assertExitCode(0);
});

test('db:audit --json entries have expected keys', function () {
    Artisan::call('db:audit', ['--json' => true]);
    $output = Artisan::output();

    $decoded = json_decode(trim($output), true);
    expect($decoded)->toBeArray();

    foreach ($decoded as $entry) {
        expect($entry)->toHaveKeys(['connection', 'schema', 'tables', 'rows', 'status']);
    }
});

test('db:audit --json outputs valid JSON', function () {
    Artisan::call('db:audit', ['--json' => true]);
    $output = Artisan::output();

    $decoded = json_decode(trim($output), true);
    expect($decoded)->toBeArray();
    expect($decoded)->not->toBeEmpty();

    // Each entry should have the expected keys
    expect($decoded[0])->toHaveKeys(['connection', 'schema', 'tables', 'rows', 'status']);
});

test('db:audit --connection filters to single connection', function () {
    Artisan::call('db:audit', ['--json' => true, '--connection' => 'pgsql']);
    $output = Artisan::output();

    $decoded = json_decode(trim($output), true);
    expect($decoded)->toBeArray();
    expect($decoded)->toHaveCount(1);
    expect($decoded[0]['connection'])->toBe('pgsql');
});

test('db:audit handles connection failure gracefully', function () {
    // Override a connection to point to a non-existent host
    config(['database.connections.gis.host' => '192.0.2.1']); // RFC 5737 TEST-NET
    config(['database.connections.gis.connect_timeout' => 1]);

    $this->artisan('db:audit --connection=gis')
        ->expectsOutputToContain('FAIL')
        ->assertExitCode(0); // informational tool, never fails
});
