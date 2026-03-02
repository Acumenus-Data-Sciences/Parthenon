<?php

namespace App\Services\Achilles\Analyses\DataDensity;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 117: Number of persons with at least one record by domain.
 *
 * stratum_1 = domain name (e.g., 'Condition', 'Drug', 'Procedure', etc.)
 */
class Analysis117 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 117;
    }

    public function analysisName(): string
    {
        return 'Number of persons with at least one record by domain';
    }

    public function category(): string
    {
        return 'Data Density';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 117;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 117 AS analysis_id, 'Condition' AS stratum_1, COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.condition_occurrence;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 117 AS analysis_id, 'Drug' AS stratum_1, COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.drug_exposure;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 117 AS analysis_id, 'Procedure' AS stratum_1, COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.procedure_occurrence;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 117 AS analysis_id, 'Measurement' AS stratum_1, COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.measurement;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 117 AS analysis_id, 'Observation' AS stratum_1, COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.observation;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 117 AS analysis_id, 'Visit' AS stratum_1, COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.visit_occurrence;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 117 AS analysis_id, 'Death' AS stratum_1, COUNT(DISTINCT person_id) AS count_value
            FROM {@cdmSchema}.death
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return [
            'condition_occurrence',
            'drug_exposure',
            'procedure_occurrence',
            'measurement',
            'observation',
            'visit_occurrence',
            'death',
        ];
    }
}
