<?php

declare(strict_types=1);

use App\Services\FinnGen\Exceptions\FinnGenUnknownAnalysisTypeException;
use App\Services\FinnGen\FinnGenAnalysisModuleRegistry;
use Database\Seeders\FinnGenAnalysisModuleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenAnalysisModuleSeeder::class);
    $this->registry = app(FinnGenAnalysisModuleRegistry::class);
    $this->registry->flush();
});

it('accepts valid CodeWAS params', function () {
    $result = $this->registry->validateParams('co2.codewas', [
        'case_cohort_id' => 1,
        'control_cohort_id' => 2,
        'min_cell_count' => 5,
    ]);

    expect($result['valid'])->toBeTrue();
    expect($result['errors'])->toBeEmpty();
});

it('rejects CodeWAS params missing required fields', function () {
    $result = $this->registry->validateParams('co2.codewas', [
        'min_cell_count' => 5,
    ]);

    expect($result['valid'])->toBeFalse();
    expect($result['errors'])->not->toBeEmpty();
});

it('rejects CodeWAS params with out-of-range min_cell_count', function () {
    $result = $this->registry->validateParams('co2.codewas', [
        'case_cohort_id' => 1,
        'control_cohort_id' => 2,
        'min_cell_count' => 200, // max is 100
    ]);

    expect($result['valid'])->toBeFalse();
});

it('accepts valid Overlaps params', function () {
    $result = $this->registry->validateParams('co2.overlaps', [
        'cohort_ids' => [1, 2, 3],
    ]);

    expect($result['valid'])->toBeTrue();
});

it('rejects Overlaps params with too few cohorts', function () {
    $result = $this->registry->validateParams('co2.overlaps', [
        'cohort_ids' => [1], // minItems is 2
    ]);

    expect($result['valid'])->toBeFalse();
});

it('throws FinnGenUnknownAnalysisTypeException for unknown module', function () {
    $this->registry->validateParams('nonexistent.module', []);
})->throws(FinnGenUnknownAnalysisTypeException::class);

it('accepts any params for modules without settings_schema (backward compat)', function () {
    // romopapi.report has no settings_schema — should accept anything
    $result = $this->registry->validateParams('romopapi.report', [
        'concept_id' => 201826,
        'extra_field' => 'ignored',
    ]);

    expect($result['valid'])->toBeTrue();
});
