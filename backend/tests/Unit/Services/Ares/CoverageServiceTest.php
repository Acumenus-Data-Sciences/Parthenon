<?php

declare(strict_types=1);

use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Services\Ares\CoverageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
    $this->service = app(CoverageService::class);
});

function createCoverageMatrixSource(): Source
{
    $source = Source::factory()->create();
    SourceDaimon::factory()
        ->results()
        ->for($source)
        ->create();

    return $source;
}

it('returns sources, domains, and matrix keys', function () {
    createCoverageMatrixSource();
    createCoverageMatrixSource();

    $matrix = $this->service->getMatrix();

    expect($matrix)
        ->toHaveKey('sources')
        ->toHaveKey('domains')
        ->toHaveKey('matrix');
    expect($matrix['sources'])->toBeArray();
    expect($matrix['domains'])->toBeArray();
});

it('returns standard CDM domains', function () {
    createCoverageMatrixSource();

    $matrix = $this->service->getMatrix();

    $expectedDomains = ['person', 'condition_occurrence', 'drug_exposure', 'procedure_occurrence',
        'measurement', 'observation', 'visit_occurrence', 'death'];
    foreach ($expectedDomains as $domain) {
        expect($matrix['domains'])->toContain($domain);
    }
});

it('returns cells with expected structure', function () {
    createCoverageMatrixSource();

    $matrix = $this->service->getMatrix();

    expect($matrix['matrix'])->not->toBeEmpty();
    foreach ($matrix['matrix'] as $row) {
        foreach ($row as $cell) {
            expect($cell)->toHaveKeys(['record_count', 'has_data', 'density_per_person']);
        }
    }
});
