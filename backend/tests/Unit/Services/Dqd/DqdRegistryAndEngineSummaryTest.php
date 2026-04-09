<?php

use App\Contracts\DqdCheckInterface;
use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Services\Dqd\DqdCheckRegistry;
use App\Services\Dqd\DqdEngineService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/**
 * Helper: build a Mockery mock that satisfies DqdCheckInterface for registry tests.
 */
function makeRegistryMockCheck(string $id, string $category, string $table): DqdCheckInterface
{
    $check = Mockery::mock(DqdCheckInterface::class);
    $check->shouldReceive('checkId')->andReturn($id);
    $check->shouldReceive('category')->andReturn($category);
    $check->shouldReceive('cdmTable')->andReturn($table);

    return $check;
}

describe('DqdCheckRegistry::byCategoryAndTable', function () {

    it('intersects category and table filters and returns nothing on a miss', function () {
        $registry = new DqdCheckRegistry;
        $registry->register(makeRegistryMockCheck('a', 'completeness', 'person'));
        $registry->register(makeRegistryMockCheck('b', 'completeness', 'person'));
        $registry->register(makeRegistryMockCheck('c', 'completeness', 'condition_occurrence'));
        $registry->register(makeRegistryMockCheck('d', 'plausibility', 'person'));

        $personCompleteness = $registry->byCategoryAndTable('completeness', 'person');
        $conditionPlausibility = $registry->byCategoryAndTable('plausibility', 'condition_occurrence');

        expect($personCompleteness)->toHaveCount(2)
            ->and($personCompleteness)->toHaveKey('a')
            ->and($personCompleteness)->toHaveKey('b');

        expect($conditionPlausibility)->toBe([]);
    });

    it('returns null from get() when checkId is unknown', function () {
        $registry = new DqdCheckRegistry;
        $registry->register(makeRegistryMockCheck('completeness_required_person_person_id', 'completeness', 'person'));

        expect($registry->get('does_not_exist'))->toBeNull();
        expect($registry->get('completeness_required_person_person_id'))->not->toBeNull();
    });
});

describe('DqdEngineService::getSummary', function () {

    it('returns a zeroed summary envelope when there are no DqdResults for the run', function () {
        $registry = new DqdCheckRegistry;
        $service = new DqdEngineService($registry);

        $fakeRunId = (string) Str::uuid();
        $summary = $service->getSummary($fakeRunId);

        expect($summary)->toMatchArray([
            'run_id' => $fakeRunId,
            'total_checks' => 0,
            'passed' => 0,
            'failed' => 0,
            'warnings' => 0,
            'errors' => 0,
            'by_category' => [],
        ]);
    });

    it('aggregates per-category counts and computes pass rates from DqdResult rows', function () {
        $registry = new DqdCheckRegistry;
        $service = new DqdEngineService($registry);

        $source = Source::factory()->create();
        $runId = (string) Str::uuid();

        // 2 completeness: 1 pass, 1 fail (warning)
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'comp_1',
            'category' => 'completeness',
            'cdm_table' => 'person',
            'severity' => 'error',
            'passed' => true,
            'violated_rows' => 0,
            'total_rows' => 100,
            'violation_percentage' => 0.0,
        ]);
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'comp_2',
            'category' => 'completeness',
            'cdm_table' => 'person',
            'severity' => 'warning',
            'passed' => false,
            'violated_rows' => 5,
            'total_rows' => 100,
            'violation_percentage' => 5.0,
        ]);

        // 1 conformance: fail (error)
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'conf_1',
            'category' => 'conformance',
            'cdm_table' => 'condition_occurrence',
            'severity' => 'error',
            'passed' => false,
            'violated_rows' => 7,
            'total_rows' => 100,
            'violation_percentage' => 7.0,
        ]);

        $summary = $service->getSummary($runId);

        expect($summary['run_id'])->toBe($runId)
            ->and($summary['total_checks'])->toBe(3)
            ->and($summary['passed'])->toBe(1)
            ->and($summary['failed'])->toBe(2)
            ->and($summary['warnings'])->toBe(1)
            ->and($summary['errors'])->toBe(1);

        // Order is not guaranteed but we expect both categories
        $byCategory = collect($summary['by_category'])->keyBy('category');

        expect($byCategory->has('completeness'))->toBeTrue()
            ->and($byCategory->has('conformance'))->toBeTrue();

        expect($byCategory['completeness']['total'])->toBe(2)
            ->and($byCategory['completeness']['passed'])->toBe(1)
            ->and($byCategory['completeness']['failed'])->toBe(1)
            ->and($byCategory['completeness']['pass_rate'])->toBe(50.0);

        expect($byCategory['conformance']['total'])->toBe(1)
            ->and($byCategory['conformance']['passed'])->toBe(0)
            ->and($byCategory['conformance']['failed'])->toBe(1)
            ->and($byCategory['conformance']['pass_rate'])->toBe(0.0);
    });
});

describe('DqdEngineService::getResults', function () {

    it('paginates results and applies category, table, severity, and passed filters', function () {
        $registry = new DqdCheckRegistry;
        $service = new DqdEngineService($registry);

        $source = Source::factory()->create();
        $runId = (string) Str::uuid();

        // 5 rows across categories/tables/severities
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'a',
            'category' => 'completeness',
            'cdm_table' => 'person',
            'severity' => 'error',
            'passed' => false,
        ]);
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'b',
            'category' => 'completeness',
            'cdm_table' => 'visit_occurrence',
            'severity' => 'warning',
            'passed' => true,
        ]);
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'c',
            'category' => 'conformance',
            'cdm_table' => 'person',
            'severity' => 'error',
            'passed' => false,
        ]);
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'd',
            'category' => 'plausibility',
            'cdm_table' => 'condition_occurrence',
            'severity' => 'warning',
            'passed' => false,
        ]);
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'run_id' => $runId,
            'check_id' => 'e',
            'category' => 'plausibility',
            'cdm_table' => 'person',
            'severity' => 'error',
            'passed' => true,
        ]);

        // Filter by category
        $completenessOnly = $service->getResults($runId, category: 'completeness');
        expect($completenessOnly['total'])->toBe(2);

        // Filter by category + table — only person+completeness
        $personCompleteness = $service->getResults($runId, category: 'completeness', table: 'person');
        expect($personCompleteness['total'])->toBe(1);

        // Failed only
        $failed = $service->getResults($runId, passed: false);
        expect($failed['total'])->toBe(3);

        // Severity error
        $errors = $service->getResults($runId, severity: 'error');
        expect($errors['total'])->toBe(3);

        // Pagination metadata
        $page = $service->getResults($runId, page: 1, perPage: 2);
        expect($page['per_page'])->toBe(2)
            ->and($page['total'])->toBe(5)
            ->and($page['current_page'])->toBe(1)
            ->and($page['last_page'])->toBe(3)
            ->and($page['data'])->toHaveCount(2);
    });
});
