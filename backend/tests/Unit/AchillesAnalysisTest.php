<?php

use App\Contracts\AchillesAnalysisInterface;
use App\Services\Achilles\Analyses\Person\Analysis0;
use App\Services\Achilles\Analyses\Person\Analysis2;
use App\Services\Achilles\Analyses\Person\Analysis3;
use App\Services\Achilles\Analyses\Person\Analysis4;
use App\Services\Achilles\Analyses\Person\Analysis5;
use App\Services\Achilles\Analyses\Condition\Analysis400;
use App\Services\Achilles\Analyses\Condition\Analysis401;
use App\Services\Achilles\Analyses\Condition\Analysis402;
use App\Services\Achilles\Analyses\Condition\Analysis404;
use App\Services\Achilles\Analyses\Condition\Analysis411;
use App\Services\Achilles\Analyses\ObservationPeriod\Analysis105;
use App\Services\Achilles\Analyses\Visit\Analysis211;
use App\Services\Achilles\Analyses\DataDensity\Analysis2000;

describe('AchillesAnalysis classes', function () {

    // ------------------------------------------------------------------
    // Person analyses
    // ------------------------------------------------------------------

    it('has valid analysis IDs for all person analyses', function () {
        $analyses = [
            new Analysis0,
            new Analysis2,
            new Analysis3,
            new Analysis4,
            new Analysis5,
        ];

        $expectedIds = [0, 2, 3, 4, 5];

        foreach ($analyses as $i => $analysis) {
            expect($analysis)->toBeInstanceOf(AchillesAnalysisInterface::class)
                ->and($analysis->analysisId())->toBe($expectedIds[$i])
                ->and($analysis->category())->toBe('Person');
        }
    });

    // ------------------------------------------------------------------
    // Condition analyses
    // ------------------------------------------------------------------

    it('has valid analysis IDs for condition analyses', function () {
        $analyses = [
            new Analysis400,
            new Analysis401,
            new Analysis402,
            new Analysis404,
            new Analysis411,
        ];

        $expectedIds = [400, 401, 402, 404, 411];

        foreach ($analyses as $i => $analysis) {
            expect($analysis)->toBeInstanceOf(AchillesAnalysisInterface::class)
                ->and($analysis->analysisId())->toBe($expectedIds[$i])
                ->and($analysis->category())->toBe('Condition');
        }
    });

    // ------------------------------------------------------------------
    // SQL template validation
    // ------------------------------------------------------------------

    it('generates valid SQL templates with placeholders', function () {
        $analyses = [
            new Analysis0,
            new Analysis400,
            new Analysis2000,
        ];

        foreach ($analyses as $analysis) {
            $sql = $analysis->sqlTemplate();

            // SQL should not be empty
            expect($sql)->not->toBeEmpty();

            // Should contain schema placeholders
            expect($sql)->toContain('{@resultsSchema}')
                ->and($sql)->toContain('{@cdmSchema}');

            // Should reference the analysis_id
            expect($sql)->toContain((string) $analysis->analysisId());
        }
    });

    // ------------------------------------------------------------------
    // Distribution flag
    // ------------------------------------------------------------------

    it('correctly identifies distribution analyses', function () {
        // Analysis105 (observation period duration) is a distribution analysis
        $dist = new Analysis105;
        expect($dist->isDistribution())->toBeTrue();

        // Analysis0 (person count) is NOT a distribution
        $nonDist = new Analysis0;
        expect($nonDist->isDistribution())->toBeFalse();

        // Analysis400 (condition count) is NOT a distribution
        $nonDist2 = new Analysis400;
        expect($nonDist2->isDistribution())->toBeFalse();
    });

    // ------------------------------------------------------------------
    // Required tables
    // ------------------------------------------------------------------

    it('has non-empty required tables', function () {
        $analyses = [
            new Analysis0,
            new Analysis2,
            new Analysis400,
            new Analysis105,
            new Analysis2000,
        ];

        foreach ($analyses as $analysis) {
            $tables = $analysis->requiredTables();

            expect($tables)->not->toBeEmpty()
                ->and($tables)->toBeArray();

            // Each entry should be a non-empty string
            foreach ($tables as $table) {
                expect($table)->toBeString()
                    ->and($table)->not->toBeEmpty();
            }
        }

        // Verify specific table expectations
        expect((new Analysis0)->requiredTables())->toBe(['person']);
        expect((new Analysis400)->requiredTables())->toBe(['condition_occurrence']);
        expect((new Analysis105)->requiredTables())->toBe(['observation_period']);

        // Analysis2000 requires multiple tables
        $dataDensityTables = (new Analysis2000)->requiredTables();
        expect($dataDensityTables)->toContain('person')
            ->and($dataDensityTables)->toContain('condition_occurrence')
            ->and($dataDensityTables)->toContain('drug_exposure')
            ->and(count($dataDensityTables))->toBeGreaterThan(5);
    });

    // ------------------------------------------------------------------
    // Category names
    // ------------------------------------------------------------------

    it('has valid category names', function () {
        $validCategories = [
            'Person',
            'Observation Period',
            'Visit',
            'Condition',
            'Death',
            'Procedure',
            'Drug',
            'Observation',
            'Drug Era',
            'Condition Era',
            'Measurement',
            'Data Density',
        ];

        $analyses = [
            new Analysis0,
            new Analysis105,
            new Analysis211,
            new Analysis400,
            new Analysis2000,
        ];

        foreach ($analyses as $analysis) {
            $category = $analysis->category();

            expect($category)->toBeString()
                ->and($category)->not->toBeEmpty()
                ->and($validCategories)->toContain($category);
        }
    });
});
