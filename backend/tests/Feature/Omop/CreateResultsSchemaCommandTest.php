<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
});

test('create-results-schema calls R API and succeeds', function () {
    Http::fake([
        '*/omop/create-results-schema' => Http::response(
            ['status' => 'ok', 'message' => 'Results schema created: results'],
            200
        ),
    ]);

    $this->artisan('omop:create-results-schema', [
        '--dialect' => 'postgresql',
        '--host' => 'db.example.com',
        '--port' => '5432',
        '--database' => 'omop_db',
        '--username' => 'reader',
        '--password' => 'secret',
        '--results-schema' => 'results',
    ])->assertExitCode(0);

    Http::assertSent(fn ($req) => str_contains($req->url(), 'omop/create-results-schema'));
});

test('create-results-schema fails when R API returns error status', function () {
    Http::fake([
        '*/omop/create-results-schema' => Http::response(
            ['status' => 'error', 'message' => 'schema already exists'],
            200
        ),
    ]);

    $this->artisan('omop:create-results-schema', [
        '--host' => 'db.example.com',
        '--database' => 'omop_db',
        '--results-schema' => 'results',
    ])->assertExitCode(1);
});

test('create-results-schema fails on HTTP error', function () {
    Http::fake([
        '*/omop/create-results-schema' => Http::response('Internal Server Error', 500),
    ]);

    $this->artisan('omop:create-results-schema', [
        '--host' => 'db.example.com',
        '--database' => 'omop_db',
    ])->assertExitCode(1);
});

test('create-results-schema fails without host and database', function () {
    $this->artisan('omop:create-results-schema')->assertExitCode(1);
});
