<?php

declare(strict_types=1);

use App\Models\App\Source;
use App\Services\Ares\CoverageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
    $this->service = app(CoverageService::class);
});

it('returns sources, domains, and matrix keys', function () {
    Source::factory()->count(2)->create();

    $matrix = $this->service->getMatrix();

    expect($matrix)
        ->toHaveKey('sources')
        ->toHaveKey('domains')
        ->toHaveKey('matrix');
    expect($matrix['sources'])->toBeArray();
    expect($matrix['domains'])->toBeArray();
});

it('returns standard CDM domains', function () {
    Source::factory()->create();

    $matrix = $this->service->getMatrix();

    $expectedDomains = ['person', 'condition_occurrence', 'drug_exposure', 'procedure_occurrence',
        'measurement', 'observation', 'visit_occurrence', 'death'];
    foreach ($expectedDomains as $domain) {
        expect($matrix['domains'])->toContain($domain);
    }
});

it('returns cells with expected structure', function () {
    Source::factory()->create();

    $matrix = $this->service->getMatrix();

    foreach ($matrix['matrix'] as $row) {
        foreach ($row as $cell) {
            expect($cell)->toHaveKeys(['record_count', 'has_data', 'density_per_person']);
        }
    }
});
