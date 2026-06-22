<?php

declare(strict_types=1);

use App\Models\App\FhirConnection;
use App\Models\App\FhirSyncRun;
use App\Services\Fhir\FhirAuthService;
use App\Services\Fhir\FhirBulkExportService;
use Illuminate\Support\Facades\Http;

/**
 * Task 6.1 — the default $export _type set must include the six new Medgnosis-parity
 * resource types so a connection with no explicit export_resource_types still pulls them.
 */
it('requests the new resource types by default when export_resource_types is unset', function () {
    Http::fake([
        '*' => Http::response('', 202, ['Content-Location' => 'https://ehr.example/fhir/bulk/poll/1']),
    ]);

    $auth = Mockery::mock(FhirAuthService::class);
    $auth->shouldReceive('getAccessToken')->andReturn(['access_token' => 'tok']);

    $conn = new FhirConnection;
    $conn->site_key = 'sandbox';
    $conn->fhir_base_url = 'https://ehr.example/fhir';
    $conn->export_resource_types = null;
    $conn->incremental_enabled = false;

    $service = new FhirBulkExportService($auth);
    $pollingUrl = $service->startExport($conn, new FhirSyncRun);

    expect($pollingUrl)->toBe('https://ehr.example/fhir/bulk/poll/1');

    Http::assertSent(function ($request) {
        // The six new types plus a couple of originals (no regression).
        $required = [
            'DocumentReference', 'Coverage', 'ServiceRequest', 'CarePlan', 'Goal', 'CareTeam',
            'Patient', 'Condition',
        ];
        foreach ($required as $type) {
            if (! str_contains($request->url(), $type)) {
                return false;
            }
        }

        return true;
    });
});

it('honors an explicit export_resource_types over the default', function () {
    Http::fake([
        '*' => Http::response('', 202, ['Content-Location' => 'https://ehr.example/fhir/bulk/poll/2']),
    ]);

    $auth = Mockery::mock(FhirAuthService::class);
    $auth->shouldReceive('getAccessToken')->andReturn(['access_token' => 'tok']);

    $conn = new FhirConnection;
    $conn->site_key = 'sandbox';
    $conn->fhir_base_url = 'https://ehr.example/fhir';
    $conn->export_resource_types = 'Patient,Observation';
    $conn->incremental_enabled = false;

    (new FhirBulkExportService($auth))->startExport($conn, new FhirSyncRun);

    Http::assertSent(fn ($request) => str_contains($request->url(), 'Observation')
        && ! str_contains($request->url(), 'CareTeam'));
});
