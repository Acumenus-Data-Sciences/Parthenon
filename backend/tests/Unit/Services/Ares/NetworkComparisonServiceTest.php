<?php

declare(strict_types=1);

use App\Context\SourceContext;
use App\Models\App\Source;
use App\Services\Ares\NetworkComparisonService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    $source = Source::factory()->create(['source_connection' => 'omop']);

    // Register ctx_* connections required by SourceAware trait.
    // In tests, all three map to the shared local connections (omop / results).
    foreach (['ctx_cdm' => 'omop', 'ctx_results' => 'results', 'ctx_vocab' => 'omop'] as $ctxName => $base) {
        config(["database.connections.{$ctxName}" => config("database.connections.{$base}", [])]);
        DB::purge($ctxName);
    }

    $ctx = new SourceContext(
        source: $source,
        cdmSchema: 'omop',
        resultsSchema: 'results',
        vocabSchema: 'omop',
    );
    app()->instance(SourceContext::class, $ctx);

    $this->service = app(NetworkComparisonService::class);
});

it('returns per-source structure for compare concept', function () {
    Source::factory()->count(2)->create();

    $result = $this->service->compareConcept(201826);

    expect($result)->toBeArray()
        ->toHaveKey('sources')
        ->toHaveKey('benchmark_rate');
    foreach ($result['sources'] as $entry) {
        expect($entry)->toHaveKeys(['source_id', 'source_name', 'count', 'rate_per_1000', 'person_count', 'ci_lower', 'ci_upper']);
    }
});

it('returns keyed results for batch comparison', function () {
    $result = $this->service->compareBatch([201826, 320128]);

    expect($result)->toBeArray()
        ->toHaveKey(201826)
        ->toHaveKey(320128);
});

it('returns empty results for nonexistent concept', function () {
    Source::factory()->create();

    $result = $this->service->compareConcept(999999999);

    expect($result)->toBeArray()->toHaveKey('sources');
    foreach ($result['sources'] as $entry) {
        expect($entry['count'])->toBe(0);
    }
});

it('returns array for concept search', function () {
    $result = $this->service->searchConcepts('diabetes');

    expect($result)->toBeArray();
});

it('returns empty array for short search query', function () {
    $result = $this->service->searchConcepts('a');

    expect($result)->toBeArray()->toBeEmpty();
});
