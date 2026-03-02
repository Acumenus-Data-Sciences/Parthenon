<?php

namespace App\Services\Achilles\Analyses\DataDensity;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 2000: Total record counts by domain.
 *
 * stratum_1 = domain name
 * count_value = total number of records in that domain table
 */
class Analysis2000 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 2000;
    }

    public function analysisName(): string
    {
        return 'Number of records by domain';
    }

    public function category(): string
    {
        return 'Data Density';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 2000;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Person' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.person;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Observation Period' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.observation_period;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Visit' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.visit_occurrence;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Condition' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.condition_occurrence;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Drug' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Procedure' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.procedure_occurrence;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Measurement' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Observation' AS stratum_1, COUNT(*) AS count_value
            FROM {@cdmSchema}.observation;

            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 2000 AS analysis_id, 'Death' AS stratum_1, COUNT(*) AS count_value
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
            'person',
            'observation_period',
            'visit_occurrence',
            'condition_occurrence',
            'drug_exposure',
            'procedure_occurrence',
            'measurement',
            'observation',
            'death',
        ];
    }
}
