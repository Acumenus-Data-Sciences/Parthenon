<?php

namespace App\Services\Achilles\Analyses\Measurement;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 1810: Number of measurement records by value_as_concept_id.
 */
class Analysis1810 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 1810;
    }

    public function analysisName(): string
    {
        return 'Number of measurement records by value as concept';
    }

    public function category(): string
    {
        return 'Measurement';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 1810;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 1810 AS analysis_id,
                CAST(COALESCE(value_as_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.measurement
            GROUP BY value_as_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['measurement'];
    }
}
