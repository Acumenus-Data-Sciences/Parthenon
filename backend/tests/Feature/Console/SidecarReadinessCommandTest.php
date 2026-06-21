<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;

/**
 * Contract test for `sidecars:readiness` (ADR — Phase 8 runtime readiness). Fakes
 * each sidecar endpoint and asserts the per-sidecar classification. Global exit
 * code is only asserted where a required HTTP sidecar deterministically forces it,
 * so the test does not depend on local Redis availability.
 */
beforeEach(function () {
    // Pin sidecar URLs so the host wildcards below match regardless of the
    // local test env's DARKSTAR_URL/AI_SERVICE_URL values.
    config([
        'services.darkstar.url' => 'http://darkstar.test:8787',
        'services.ai.url' => 'http://python-ai.test:8000',
        'services.hecate.url' => 'http://hecate.test:8080',
        'services.fhir_to_cdm.url' => 'http://fhir-to-cdm.test:8091',
        'services.dicomweb.base_url' => 'http://orthanc.test:8042',
        'services.templates.url' => 'http://templates.test:8000',
        'services.scispacy.url' => 'http://scispacy.test:5101',
        'services.anonymizer.url' => 'http://anonymizer.test:8080',
    ]);
});

it('classifies required sidecars ready on a 2xx health response', function () {
    Http::fake([
        '*darkstar*/health' => Http::response(['status' => 'ok'], 200),
        '*python-ai*/health' => Http::response(['status' => 'ok'], 200),
        '*' => Http::response('', 200),
    ]);

    Artisan::call('sidecars:readiness', ['--json' => true]);
    $out = json_decode(Artisan::output(), true);
    $byName = collect($out['sidecars'])->keyBy('name');

    expect($byName['darkstar (R/HADES)']['status'])->toBe('ready')
        ->and($byName['python-ai']['status'])->toBe('ready');
});

it('reports a required sidecar as degraded on a non-2xx health response and is not ready', function () {
    Http::fake([
        '*darkstar*/health' => Http::response('unavailable', 503),
        '*' => Http::response('', 200),
    ]);

    $exit = Artisan::call('sidecars:readiness', ['--json' => true]);
    $out = json_decode(Artisan::output(), true);
    $byName = collect($out['sidecars'])->keyBy('name');

    expect($byName['darkstar (R/HADES)']['status'])->toBe('degraded')
        ->and($out['ready'])->toBeFalse()
        ->and($exit)->toBe(1);
});

it('marks a sidecar unreachable when the connection fails', function () {
    Http::fake([
        '*python-ai*/health' => fn () => throw new ConnectionException('Connection refused'),
        '*' => Http::response('', 200),
    ]);

    Artisan::call('sidecars:readiness', ['--json' => true]);
    $out = json_decode(Artisan::output(), true);
    $byName = collect($out['sidecars'])->keyBy('name');

    expect($byName['python-ai']['status'])->toBe('unreachable');
});

it('treats optional sidecars as ready on any HTTP response (avoids wrong-health-path false negatives)', function () {
    Http::fake([
        '*orthanc*/system' => Http::response('Unauthorized', 401),
        '*' => Http::response('', 200),
    ]);

    Artisan::call('sidecars:readiness', ['--json' => true]);
    $out = json_decode(Artisan::output(), true);
    $byName = collect($out['sidecars'])->keyBy('name');

    expect($byName['orthanc (PACS)']['status'])->toBe('ready')
        ->and($byName['orthanc (PACS)']['detail'])->toContain('401');
});

it('probes the scispacy and anonymizer ingestion sidecars as optional', function () {
    Http::fake([
        '*scispacy*/health' => Http::response(['status' => 'ok'], 200),
        '*anonymizer*/health' => fn () => throw new ConnectionException('Connection refused'),
        '*' => Http::response('', 200),
    ]);

    Artisan::call('sidecars:readiness', ['--json' => true]);
    $out = json_decode(Artisan::output(), true);
    $byName = collect($out['sidecars'])->keyBy('name');

    expect($byName['scispacy']['status'])->toBe('ready')
        ->and($byName['scispacy']['required'])->toBeFalse()
        ->and($byName['anonymizer']['status'])->toBe('unreachable')
        ->and($byName['anonymizer']['required'])->toBeFalse();
});
