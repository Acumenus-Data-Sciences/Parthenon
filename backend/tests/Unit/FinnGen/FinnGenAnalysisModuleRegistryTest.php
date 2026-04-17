<?php

declare(strict_types=1);

use App\Models\App\FinnGen\AnalysisModule;
use App\Services\FinnGen\Exceptions\FinnGenUnknownAnalysisTypeException;
use App\Services\FinnGen\FinnGenAnalysisModuleRegistry;
use Database\Seeders\FinnGenAnalysisModuleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(FinnGenAnalysisModuleSeeder::class);
    Cache::forget('finngen:analysis-modules:enabled');
    $this->registry = app(FinnGenAnalysisModuleRegistry::class);
});

it('all() returns the seeded modules keyed by key', function () {
    $modules = $this->registry->all();

    // SP1-3: 4 CO2 modules + 2 romopapi modules.
    // SP4 Phase D added cohort.match; Polish 2 added cohort.materialize.
    // Genomics #2 added endpoint.generate.
    expect(array_keys($modules))->toEqualCanonicalizing([
        'co2.codewas',
        'co2.time_codewas',
        'co2.overlaps',
        'co2.demographics',
        'romopapi.report',
        'romopapi.setup',
        'cohort.match',
        'cohort.materialize',
        'endpoint.generate',
    ]);
    expect($modules['co2.codewas'])->toBeInstanceOf(AnalysisModule::class);
});

it('find() returns the AnalysisModule for a known key', function () {
    $module = $this->registry->find('co2.codewas');

    expect($module)->toBeInstanceOf(AnalysisModule::class);
    expect($module->key)->toBe('co2.codewas');
    expect($module->darkstar_endpoint)->toBe('/finngen/co2/codewas');
});

it('find() returns null for an unknown key', function () {
    expect($this->registry->find('does-not-exist'))->toBeNull();
});

it('assertEnabled() throws FinnGenUnknownAnalysisTypeException for unknown keys', function () {
    $this->registry->assertEnabled('nonexistent.module');
})->throws(FinnGenUnknownAnalysisTypeException::class);

it('assertEnabled() returns the module for a known enabled key', function () {
    $module = $this->registry->assertEnabled('co2.demographics');
    expect($module->key)->toBe('co2.demographics');
});

it('find() hides disabled modules', function () {
    AnalysisModule::where('key', 'co2.codewas')->update(['enabled' => false]);
    Cache::forget('finngen:analysis-modules:enabled');

    expect($this->registry->find('co2.codewas'))->toBeNull();
});

it('all() cache is refreshed after flush()', function () {
    // Prime cache with only 4 rows
    $this->registry->all();

    // Insert a new row directly (bypassing the cache)
    AnalysisModule::create([
        'key' => 'co2.test.extra',
        'label' => 'Test Extra',
        'description' => 'For cache-flush test',
        'darkstar_endpoint' => '/finngen/co2/test-extra',
        'enabled' => true,
        'min_role' => 'researcher',
    ]);

    // Without flush, cache still shows 9 (4 CO2 + 2 romopapi + cohort.match + cohort.materialize + endpoint.generate)
    expect($this->registry->all())->toHaveCount(9);

    $this->registry->flush();

    // After flush, new row is visible
    expect($this->registry->all())->toHaveCount(10);
});

it('validateParams() passes for enabled module + arbitrary params (SP1 stub)', function () {
    // No exception expected
    $this->registry->validateParams('co2.codewas', ['anything' => 'goes']);
    expect(true)->toBeTrue();
});

it('validateParams() rejects unknown analysis type', function () {
    $this->registry->validateParams('nonexistent.module', []);
})->throws(FinnGenUnknownAnalysisTypeException::class);
