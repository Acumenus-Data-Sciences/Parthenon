<?php

declare(strict_types=1);

use App\Models\App\Source;
use App\Services\Ares\CostService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::flush();
    $this->service = app(CostService::class);
});

it('returns boolean from hasCostData', function () {
    $source = Source::factory()->create();

    $result = $this->service->hasCostData($source);

    expect($result)->toBeBool();
});

it('returns expected structure from getSummary', function () {
    $source = Source::factory()->create();

    $summary = $this->service->getSummary($source);

    expect($summary)
        ->toHaveKey('has_cost_data')
        ->toHaveKey('domains');
    expect($summary['has_cost_data'])->toBeBool();
    expect($summary['domains'])->toBeArray();
});

it('returns expected structure from getTrends', function () {
    $source = Source::factory()->create();

    $trends = $this->service->getTrends($source);

    expect($trends)
        ->toHaveKey('has_cost_data')
        ->toHaveKey('months');
    expect($trends['months'])->toBeArray();
});

it('returns expected structure from getDomainDetail', function () {
    $source = Source::factory()->create();

    $detail = $this->service->getDomainDetail($source, 'drug_exposure');

    expect($detail)
        ->toHaveKey('has_cost_data')
        ->toHaveKey('concepts');
    expect($detail['concepts'])->toBeArray();
});

it('returns sources array from getNetworkCost', function () {
    Source::factory()->count(2)->create();

    $result = $this->service->getNetworkCost();

    expect($result)->toHaveKey('sources');
    expect($result['sources'])->toBeArray();
});

it('handles missing cost table gracefully in getSummary', function () {
    $source = Source::factory()->create();

    $summary = $this->service->getSummary($source);

    expect($summary['has_cost_data'])->toBeFalse();
    expect($summary['domains'])->toBeEmpty();
});

it('handles missing cost table gracefully in getTrends', function () {
    $source = Source::factory()->create();

    $trends = $this->service->getTrends($source);

    expect($trends['has_cost_data'])->toBeFalse();
    expect($trends['months'])->toBeEmpty();
});

it('handles missing cost table gracefully in getDomainDetail', function () {
    $source = Source::factory()->create();

    $detail = $this->service->getDomainDetail($source, 'procedure_occurrence');

    expect($detail['has_cost_data'])->toBeFalse();
    expect($detail['concepts'])->toBeEmpty();
});
