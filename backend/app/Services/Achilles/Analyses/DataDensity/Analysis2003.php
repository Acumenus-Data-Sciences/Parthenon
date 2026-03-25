<?php

namespace App\Services\Achilles\Analyses\DataDensity;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 2003: Number of CDM records per calendar month, by domain.
 *
 * stratum_1: domain name, stratum_2: YYYYMM.
 */
class Analysis2003 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 2003;
    }

    public function analysisName(): string
    {
        return 'Number of CDM records per month by domain';
    }

    public function category(): string
    {
        return 'Data Density';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results WHERE analysis_id = 2003;
            INSERT INTO {@resultsSchema}.achilles_results (analysis_id, stratum_1, stratum_2, count_value)
            SELECT 2003 AS analysis_id,
                domain_name AS stratum_1,
                TO_CHAR(month_start, 'YYYYMM') AS stratum_2,
                COUNT(*) AS count_value
            FROM (
                SELECT 'Condition' AS domain_name,
                    date_trunc('month', condition_start_date) AS month_start
                FROM {@cdmSchema}.condition_occurrence
                UNION ALL
                SELECT 'Drug',
                    date_trunc('month', drug_exposure_start_date)
                FROM {@cdmSchema}.drug_exposure
                UNION ALL
                SELECT 'Measurement',
                    date_trunc('month', measurement_date)
                FROM {@cdmSchema}.measurement
                UNION ALL
                SELECT 'Observation',
                    date_trunc('month', observation_date)
                FROM {@cdmSchema}.observation
                UNION ALL
                SELECT 'Procedure',
                    date_trunc('month', procedure_date)
                FROM {@cdmSchema}.procedure_occurrence
                UNION ALL
                SELECT 'Visit',
                    date_trunc('month', visit_start_date)
                FROM {@cdmSchema}.visit_occurrence
            ) t
            GROUP BY domain_name, month_start
            SQL;
    }

    public function isDistribution(): bool
    {
        return false;
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'drug_exposure', 'measurement', 'observation', 'procedure_occurrence', 'visit_occurrence'];
    }
}
