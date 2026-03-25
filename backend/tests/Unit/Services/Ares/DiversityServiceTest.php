<?php

declare(strict_types=1);

use App\Models\App\Source;
use App\Services\Ares\DiversityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
    $this->service = app(DiversityService::class);
});

it('returns per-source demographics', function () {
    Source::factory()->count(2)->create();

    $diversity = $this->service->getDiversity();

    expect($diversity)->toBeArray();
    foreach ($diversity as $entry) {
        expect($entry)->toHaveKeys(['source_id', 'source_name', 'person_count', 'gender', 'race', 'ethnicity']);
    }
});

it('returns empty proportions when no data', function () {
    Source::factory()->create();

    $diversity = $this->service->getDiversity();

    expect($diversity)->toBeArray();
    // Sources with no Achilles data should have empty demographic arrays
    foreach ($diversity as $entry) {
        expect($entry['gender'])->toBeArray();
        expect($entry['race'])->toBeArray();
        expect($entry['ethnicity'])->toBeArray();
    }
});
