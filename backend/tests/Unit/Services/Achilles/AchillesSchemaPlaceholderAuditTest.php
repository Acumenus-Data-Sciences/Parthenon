<?php

use App\Services\Achilles\AchillesAnalysisRegistry;

/**
 * Schema placeholder audit for all registered Achilles analyses.
 *
 * Ensures every SQL template uses the correct schema prefix:
 * - {@resultsSchema} for writes to achilles_results / achilles_results_dist
 * - {@cdmSchema} for reads from CDM clinical tables
 * - {@vocabSchema} for joins on vocabulary tables (never {@cdmSchema})
 */
describe('Achilles SQL template schema placeholders', function () {

    // CDM clinical tables that MUST use {@cdmSchema}
    $cdmTables = [
        'person',
        'visit_occurrence',
        'condition_occurrence',
        'drug_exposure',
        'procedure_occurrence',
        'measurement',
        'observation',
        'death',
        'condition_era',
        'drug_era',
        'observation_period',
        'payer_plan_period',
        'device_exposure',
        'note',
        'specimen',
    ];

    // Vocabulary tables that MUST use {@vocabSchema}
    $vocabTables = [
        'concept',
        'concept_ancestor',
        'concept_relationship',
        'vocabulary',
        'domain',
        'concept_class',
    ];

    it('uses {@resultsSchema} for all result table writes', function () {
        /** @var AchillesAnalysisRegistry $registry */
        $registry = app(AchillesAnalysisRegistry::class);
        $analyses = $registry->all();
        expect($analyses)->not->toBeEmpty();

        $violations = [];

        foreach ($analyses as $id => $analysis) {
            $sql = $analysis->sqlTemplate();

            // Match INSERT INTO / DELETE FROM / UPDATE on achilles_results* without {@resultsSchema} prefix
            // Look for these keywords followed by a table name that starts with achilles_results
            // but is NOT preceded by {@resultsSchema}.
            if (preg_match_all(
                '/\b(INSERT\s+INTO|DELETE\s+FROM|UPDATE)\s+(?!\{@resultsSchema\}\.)([\w.]*achilles_results\w*)/i',
                $sql,
                $matches,
                PREG_SET_ORDER,
            )) {
                foreach ($matches as $match) {
                    $violations[] = "Analysis {$id} ({$analysis->analysisName()}): {$match[1]} {$match[2]} missing {@resultsSchema} prefix";
                }
            }
        }

        expect($violations)->toBeEmpty(
            "Result table writes without {@resultsSchema} prefix:\n".implode("\n", $violations),
        );
    });

    it('uses {@cdmSchema} for all clinical table reads', function () use ($cdmTables) {
        /** @var AchillesAnalysisRegistry $registry */
        $registry = app(AchillesAnalysisRegistry::class);
        $analyses = $registry->all();

        $violations = [];

        foreach ($analyses as $id => $analysis) {
            $sql = $analysis->sqlTemplate();

            foreach ($cdmTables as $table) {
                // Match FROM/JOIN followed by a CDM table name without any {@...Schema} prefix
                // This catches: FROM person, JOIN person, FROM omop.person, etc.
                // But allows: FROM {@cdmSchema}.person, FROM {@resultsSchema}.person (if applicable)
                if (preg_match_all(
                    '/\b(FROM|JOIN)\s+(?!\{@\w+Schema\}\.)\b('.preg_quote($table, '/').')\b/i',
                    $sql,
                    $matches,
                    PREG_SET_ORDER,
                )) {
                    foreach ($matches as $match) {
                        $violations[] = "Analysis {$id} ({$analysis->analysisName()}): {$match[1]} {$match[2]} missing {@cdmSchema} prefix";
                    }
                }
            }
        }

        expect($violations)->toBeEmpty(
            "CDM table reads without schema prefix:\n".implode("\n", $violations),
        );
    });

    it('uses {@vocabSchema} not {@cdmSchema} for vocabulary table joins', function () use ($vocabTables) {
        /** @var AchillesAnalysisRegistry $registry */
        $registry = app(AchillesAnalysisRegistry::class);
        $analyses = $registry->all();

        $violations = [];

        foreach ($analyses as $id => $analysis) {
            $sql = $analysis->sqlTemplate();

            foreach ($vocabTables as $table) {
                // Match {@cdmSchema}.concept, {@cdmSchema}.concept_ancestor, etc.
                if (preg_match_all(
                    '/\{@cdmSchema\}\.'.preg_quote($table, '/').'\b/i',
                    $sql,
                    $matches,
                )) {
                    foreach ($matches as $match) {
                        $violations[] = "Analysis {$id} ({$analysis->analysisName()}): {$match[0]} should use {@vocabSchema} not {@cdmSchema}";
                    }
                }
            }
        }

        expect($violations)->toBeEmpty(
            "Vocabulary tables using {@cdmSchema} instead of {@vocabSchema}:\n".implode("\n", $violations),
        );
    });
});
