<?php

namespace App\Services\Achilles\Analyses\Drug;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 707: Number of drug exposure records by visit_concept_id (care setting).
 */
class Analysis707 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 707;
    }

    public function analysisName(): string
    {
        return 'Number of drug exposure records by visit concept (care setting)';
    }

    public function category(): string
    {
        return 'Drug';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 707;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, count_value)
            SELECT 707 AS analysis_id,
                CAST(COALESCE(vo.visit_concept_id, 0) AS VARCHAR(255)) AS stratum_1,
                COUNT(*) AS count_value
            FROM {@cdmSchema}.drug_exposure de
            LEFT JOIN {@cdmSchema}.visit_occurrence vo
                ON de.visit_occurrence_id = vo.visit_occurrence_id
            GROUP BY vo.visit_concept_id
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['drug_exposure', 'visit_occurrence'];
    }
}
