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
                CAST(yyyymm AS VARCHAR(255)) AS stratum_2,
                COUNT(*) AS count_value
            FROM (
                SELECT 'Condition' AS domain_name,
                    EXTRACT(YEAR FROM condition_start_date) * 100 + EXTRACT(MONTH FROM condition_start_date) AS yyyymm
                FROM {@cdmSchema}.condition_occurrence
                UNION ALL
                SELECT 'Drug',
                    EXTRACT(YEAR FROM drug_exposure_start_date) * 100 + EXTRACT(MONTH FROM drug_exposure_start_date)
                FROM {@cdmSchema}.drug_exposure
                UNION ALL
                SELECT 'Measurement',
                    EXTRACT(YEAR FROM measurement_date) * 100 + EXTRACT(MONTH FROM measurement_date)
                FROM {@cdmSchema}.measurement
                UNION ALL
                SELECT 'Observation',
                    EXTRACT(YEAR FROM observation_date) * 100 + EXTRACT(MONTH FROM observation_date)
                FROM {@cdmSchema}.observation
                UNION ALL
                SELECT 'Procedure',
                    EXTRACT(YEAR FROM procedure_date) * 100 + EXTRACT(MONTH FROM procedure_date)
                FROM {@cdmSchema}.procedure_occurrence
                UNION ALL
                SELECT 'Visit',
                    EXTRACT(YEAR FROM visit_start_date) * 100 + EXTRACT(MONTH FROM visit_start_date)
                FROM {@cdmSchema}.visit_occurrence
            ) t
            GROUP BY domain_name, yyyymm
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
