<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
});

test('create-cdm-schema calls R Plumber API and succeeds', function () {
    Http::fake([
        '*/omop/create-cdm-schema' => Http::response(
            ['status' => 'ok', 'message' => 'CDM schema created: omop'],
            200
        ),
    ]);

    $this->artisan('omop:create-cdm-schema', [
        '--dialect' => 'postgresql',
        '--host' => 'db.example.com',
        '--port' => '5432',
        '--database' => 'omop_db',
        '--username' => 'reader',
        '--password' => 'secret',
        '--cdm-schema' => 'omop',
    ])->assertExitCode(0);

    Http::assertSentCount(1);
});

test('create-cdm-schema fails when R API returns error status', function () {
    Http::fake([
        '*/omop/create-cdm-schema' => Http::response(
            ['status' => 'error', 'message' => 'Connection refused'],
            200
        ),
    ]);

    $this->artisan('omop:create-cdm-schema', [
        '--dialect' => 'postgresql',
        '--host' => 'db.example.com',
        '--port' => '5432',
        '--database' => 'omop_db',
        '--cdm-schema' => 'omop',
    ])->assertExitCode(1);
});

test('create-cdm-schema fails when R API HTTP error', function () {
    Http::fake([
        '*/omop/create-cdm-schema' => Http::response('Internal Server Error', 500),
    ]);

    $this->artisan('omop:create-cdm-schema', [
        '--host' => 'db.example.com',
        '--database' => 'omop_db',
    ])->assertExitCode(1);
});

test('create-cdm-schema fails without host and database', function () {
    $this->artisan('omop:create-cdm-schema')->assertExitCode(1);
});
