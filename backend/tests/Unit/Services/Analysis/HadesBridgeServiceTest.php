<?php

use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Services\Analysis\HadesBridgeService;
use Illuminate\Support\Facades\Http;

/**
 * Build an in-memory Source + SourceDaimon collection so buildSourceSpec() can run
 * without touching the database. Source::loadMissing('daimons') is a no-op when the
 * relation is already set on the model.
 *
 * @param  array<int, array{daimon_type: string, table_qualifier: string}>  $daimons
 */
function makeStubSource(array $attributes, array $daimons): Source
{
    $source = new Source($attributes);
    // Keep encrypted attributes from colliding with unsaved state.
    foreach (['password', 'username', 'db_host', 'db_port', 'db_database'] as $key) {
        if (array_key_exists($key, $attributes)) {
            $source->setAttribute($key, $attributes[$key]);
        }
    }
    $source->source_dialect = $attributes['source_dialect'] ?? 'postgresql';
    if (isset($attributes['source_connection'])) {
        $source->source_connection = $attributes['source_connection'];
    }

    $daimonModels = collect($daimons)->map(function (array $d) {
        $daimon = new SourceDaimon;
        $daimon->daimon_type = $d['daimon_type'];
        $daimon->table_qualifier = $d['table_qualifier'];

        return $daimon;
    });

    $source->setRelation('daimons', $daimonModels);

    return $source;
}

describe('HadesBridgeService::buildSourceSpec', function () {
    it('prefers Source model db_* fields over the Laravel connection config', function () {
        $source = makeStubSource(
            [
                'source_dialect' => 'postgresql',
                'db_host' => 'pg-test.local',
                'db_port' => 5433,
                'db_database' => 'parthenon_test',
                'username' => 'testuser',
                'password' => 'testpass',
            ],
            [
                ['daimon_type' => 'cdm', 'table_qualifier' => 'cdm'],
                ['daimon_type' => 'vocabulary', 'table_qualifier' => 'vocab'],
                ['daimon_type' => 'results', 'table_qualifier' => 'results'],
            ],
        );

        $spec = HadesBridgeService::buildSourceSpec($source);

        expect($spec['dbms'])->toBe('postgresql')
            ->and($spec['server'])->toBe('pg-test.local/parthenon_test')
            ->and($spec['port'])->toBe('5433')
            ->and($spec['user'])->toBe('testuser')
            ->and($spec['password'])->toBe('testpass')
            ->and($spec['cdm_schema'])->toBe('cdm')
            ->and($spec['vocab_schema'])->toBe('vocab')
            ->and($spec['results_schema'])->toBe('results')
            ->and($spec['cohort_table'])->toBe('results.cohort');
    });

    it('falls back to the Laravel config connection when Source has no db_host', function () {
        config()->set('database.connections.omop_stub', [
            'host' => 'pg-fallback.local',
            'port' => '5432',
            'database' => 'parthenon',
            'username' => 'parthenon',
            'password' => 'secret',
        ]);

        $source = makeStubSource(
            [
                'source_dialect' => 'postgresql',
                'source_connection' => 'omop_stub',
                'db_host' => null,
            ],
            [
                ['daimon_type' => 'cdm', 'table_qualifier' => 'cdm'],
                ['daimon_type' => 'results', 'table_qualifier' => 'results'],
            ],
        );

        $spec = HadesBridgeService::buildSourceSpec($source);

        expect($spec['server'])->toBe('pg-fallback.local/parthenon')
            ->and($spec['port'])->toBe('5432')
            ->and($spec['user'])->toBe('parthenon')
            ->and($spec['password'])->toBe('secret')
            ->and($spec['cdm_schema'])->toBe('cdm')
            ->and($spec['results_schema'])->toBe('results');
    });

    it('uses cdm_schema as the vocab_schema default when no vocabulary daimon is present', function () {
        $source = makeStubSource(
            [
                'source_dialect' => 'postgresql',
                'db_host' => 'x.local',
                'db_port' => 5432,
                'db_database' => 'db',
                'username' => 'u',
                'password' => 'p',
            ],
            [
                ['daimon_type' => 'cdm', 'table_qualifier' => 'cdm'],
                ['daimon_type' => 'results', 'table_qualifier' => 'results'],
            ],
        );

        $spec = HadesBridgeService::buildSourceSpec($source);

        // No vocabulary daimon → code path falls through; vocab_schema should equal cdm_schema.
        expect($spec['vocab_schema'])->toBe($spec['cdm_schema'])
            ->and($spec['cdm_schema'])->toBe('cdm');
    });

    it('defaults missing schemas to public when daimons are missing', function () {
        $source = makeStubSource(
            [
                'source_dialect' => 'postgresql',
                'db_host' => 'x.local',
                'db_port' => 5432,
                'db_database' => 'db',
                'username' => 'u',
                'password' => 'p',
            ],
            [],
        );

        $spec = HadesBridgeService::buildSourceSpec($source);

        expect($spec['cdm_schema'])->toBe('public')
            ->and($spec['vocab_schema'])->toBe('public')
            ->and($spec['results_schema'])->toBe('public')
            ->and($spec['cohort_table'])->toBe('public.cohort');
    });
});

describe('HadesBridgeService::healthCheck', function () {
    it('returns the JSON body when the R sidecar responds OK', function () {
        Http::fake([
            '*/study/health' => Http::response(['status' => 'ok', 'version' => '1.2.3'], 200),
        ]);

        $service = new HadesBridgeService;

        $result = $service->healthCheck();

        expect($result)->toMatchArray([
            'status' => 'ok',
            'version' => '1.2.3',
        ]);
    });

    it('returns a structured error when the sidecar throws', function () {
        Http::fake(function () {
            throw new RuntimeException('connection refused');
        });

        $service = new HadesBridgeService;

        $result = $service->healthCheck();

        expect($result['status'])->toBe('error')
            ->and($result['message'])->toContain('connection refused');
    });
});

describe('HadesBridgeService::synthesis', function () {
    it('POSTs estimates to /study/synthesis and returns decoded JSON', function () {
        Http::fake([
            '*/study/synthesis' => Http::response([
                'status' => 'ok',
                'pooled' => ['log_rr' => 0.12, 'se' => 0.05],
            ], 200),
        ]);

        $service = new HadesBridgeService;

        $estimates = [
            ['log_rr' => 0.1, 'se_log_rr' => 0.05],
            ['log_rr' => 0.2, 'se_log_rr' => 0.07],
        ];

        $result = $service->synthesis($estimates, 'random_effects');

        expect($result['status'])->toBe('ok')
            ->and($result['pooled']['log_rr'])->toBe(0.12);

        Http::assertSent(function ($request) {
            return str_ends_with($request->url(), '/study/synthesis')
                && $request['method'] === 'random_effects'
                && count($request['estimates']) === 2;
        });
    });

    it('returns a structured error for a non-2xx response', function () {
        Http::fake([
            '*/study/synthesis' => Http::response(['error' => 'bad request'], 422),
        ]);

        $service = new HadesBridgeService;

        $result = $service->synthesis([
            ['log_rr' => 0.1, 'se_log_rr' => 0.05],
        ]);

        expect($result['status'])->toBe('error')
            ->and($result['message'])->toContain('HTTP 422');
    });
});
