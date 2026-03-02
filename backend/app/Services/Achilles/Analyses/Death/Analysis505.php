<?php

namespace App\Services\Achilles\Analyses\Death;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 505: Number of death records by death_type_concept_id.
 */
class Analysis505 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 505;
    }

    public function analysisName(): string
    {
        return 'Number of death records by death type concept';
    }

    public function category(): string
    {
        return 'Death';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 505;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 505 AS analysis_id,
                CAST(death_type_concept_id AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.death
            GROUP BY death_type_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['death'];
    }
}
