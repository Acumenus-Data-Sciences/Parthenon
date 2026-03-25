<?php

declare(strict_types=1);

use App\Models\App\Source;
use App\Services\Ares\NetworkComparisonService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->service = app(NetworkComparisonService::class);
});

it('returns per-source structure for compare concept', function () {
    Source::factory()->count(2)->create();

    $result = $this->service->compareConcept(201826);

    expect($result)->toBeArray();
    foreach ($result as $entry) {
        expect($entry)->toHaveKeys(['source_id', 'source_name', 'count', 'rate_per_1000', 'person_count']);
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

    expect($result)->toBeArray();
    foreach ($result as $entry) {
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
