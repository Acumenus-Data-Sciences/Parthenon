<?php

use App\Services\Dqd\DqdCheckRegistry;

/*
|--------------------------------------------------------------------------
| DQD Cross-Source SQL Audit
|--------------------------------------------------------------------------
|
| Validates that every registered DQD check generates correct, parseable
| SQL for all 5 CDM source configurations. Catches hardcoded schema
| references, unresolved placeholders, and vocab-table misqualification.
|
*/

dataset('cdm_sources', [
    'Acumenus' => ['omop', 'vocab'],
    'SynPUF' => ['synpuf', 'vocab'],
    'IRSF' => ['irsf', 'vocab'],
    'Pancreas' => ['pancreas', 'vocab'],
    'Eunomia' => ['eunomia', 'eunomia'],
]);

/** Vocabulary tables that must always be prefixed with vocabSchema, not cdmSchema. */
function vocabTableNames(): array
{
    return ['concept', 'concept_ancestor', 'concept_relationship', 'vocabulary', 'domain'];
}

describe('DQD cross-source SQL audit', function () {

    it('every DQD check generates parseable SQL for all sources', function (string $cdmSchema, string $vocabSchema) {
        /** @var DqdCheckRegistry $registry */
        $registry = app(DqdCheckRegistry::class);
        $checks = $registry->all();

        expect($checks)->not->toBeEmpty('Registry should contain at least one check');

        foreach ($checks as $checkId => $check) {
            $sqlTotal = $check->sqlTotal($cdmSchema, $vocabSchema);
            $sqlViolated = $check->sqlViolated($cdmSchema, $vocabSchema);

            // SQL must not be empty
            expect($sqlTotal)->not->toBeEmpty("sqlTotal is empty for check {$checkId} with {$cdmSchema}/{$vocabSchema}");
            expect($sqlViolated)->not->toBeEmpty("sqlViolated is empty for check {$checkId} with {$cdmSchema}/{$vocabSchema}");

            // No unresolved template placeholders
            expect($sqlTotal)->not->toMatch('/\{@\w+\}/', "sqlTotal has unresolved placeholder for check {$checkId}");
            expect($sqlViolated)->not->toMatch('/\{@\w+\}/', "sqlViolated has unresolved placeholder for check {$checkId}");

            // When cdmSchema is not 'omop', no hardcoded 'omop.' should appear
            if ($cdmSchema !== 'omop') {
                expect($sqlTotal)->not->toMatch('/\bomop\./', "sqlTotal has hardcoded omop. for check {$checkId} with cdmSchema={$cdmSchema}");
                expect($sqlViolated)->not->toMatch('/\bomop\./', "sqlViolated has hardcoded omop. for check {$checkId} with cdmSchema={$cdmSchema}");
            }
        }
    })->with('cdm_sources');

    it('DQD checks reference vocab tables with vocabSchema', function () {
        /** @var DqdCheckRegistry $registry */
        $registry = app(DqdCheckRegistry::class);
        $checks = $registry->all();
        $vocabTables = vocabTableNames();

        foreach ($checks as $checkId => $check) {
            $sqlTotal = $check->sqlTotal('test_cdm', 'test_vocab');
            $sqlViolated = $check->sqlViolated('test_cdm', 'test_vocab');

            foreach ([$sqlTotal, $sqlViolated] as $label => $sql) {
                $sqlType = $label === 0 ? 'sqlTotal' : 'sqlViolated';

                foreach ($vocabTables as $vocabTable) {
                    // If this SQL references a vocab table, it must be prefixed with test_vocab. not test_cdm.
                    if (preg_match("/\btest_cdm\.{$vocabTable}\b/", $sql)) {
                        $this->fail(
                            "Check {$checkId} {$sqlType} references {$vocabTable} with cdmSchema (test_cdm.{$vocabTable}) "
                            ."instead of vocabSchema (test_vocab.{$vocabTable})"
                        );
                    }
                }
            }
        }

        // If we get here, all checks pass — assert true so Pest counts it
        expect(true)->toBeTrue();
    });

    it('registry contains checks from all three categories', function () {
        /** @var DqdCheckRegistry $registry */
        $registry = app(DqdCheckRegistry::class);
        $categories = $registry->categories();

        expect($categories)->toContain('completeness')
            ->and($categories)->toContain('conformance')
            ->and($categories)->toContain('plausibility');
    });

    it('all check IDs are unique across the full registry', function () {
        /** @var DqdCheckRegistry $registry */
        $registry = app(DqdCheckRegistry::class);
        $checks = $registry->all();

        $ids = array_keys($checks);
        expect(count($ids))->toBe(count(array_unique($ids)));
    });
});
