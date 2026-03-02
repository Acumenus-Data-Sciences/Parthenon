<?php

namespace App\Services\Achilles\Analyses\DataDensity;

use App\Contracts\AchillesAnalysisInterface;

/**
 * Analysis 2001: Number of distinct concept IDs per person, by domain.
 *
 * stratum_1: domain name (Condition, Drug, Measurement, Observation, Procedure, Visit).
 */
class Analysis2001 implements AchillesAnalysisInterface
{
    public function analysisId(): int
    {
        return 2001;
    }

    public function analysisName(): string
    {
        return 'Number of distinct concept IDs per person by domain';
    }

    public function category(): string
    {
        return 'Data Density';
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            DELETE FROM {@resultsSchema}.achilles_results_dist WHERE analysis_id = 2001;
            INSERT INTO {@resultsSchema}.achilles_results_dist
                (analysis_id, stratum_1, count_value, min_value, max_value, avg_value, stdev_value, median_value, p10_value, p25_value, p75_value, p90_value)
            SELECT
                2001 AS analysis_id,
                domain_name AS stratum_1,
                COUNT(*) AS count_value,
                MIN(concept_count) AS min_value,
                MAX(concept_count) AS max_value,
                ROUND(AVG(CAST(concept_count AS NUMERIC)), 2) AS avg_value,
                ROUND(CAST(STDDEV(CAST(concept_count AS NUMERIC)) AS NUMERIC), 2) AS stdev_value,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY concept_count) AS median_value,
                PERCENTILE_DISC(0.10) WITHIN GROUP (ORDER BY concept_count) AS p10_value,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY concept_count) AS p25_value,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY concept_count) AS p75_value,
                PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY concept_count) AS p90_value
            FROM (
                SELECT 'Condition' AS domain_name, person_id, COUNT(DISTINCT condition_concept_id) AS concept_count
                FROM {@cdmSchema}.condition_occurrence GROUP BY person_id
                UNION ALL
                SELECT 'Drug', person_id, COUNT(DISTINCT drug_concept_id)
                FROM {@cdmSchema}.drug_exposure GROUP BY person_id
                UNION ALL
                SELECT 'Measurement', person_id, COUNT(DISTINCT measurement_concept_id)
                FROM {@cdmSchema}.measurement GROUP BY person_id
                UNION ALL
                SELECT 'Observation', person_id, COUNT(DISTINCT observation_concept_id)
                FROM {@cdmSchema}.observation GROUP BY person_id
                UNION ALL
                SELECT 'Procedure', person_id, COUNT(DISTINCT procedure_concept_id)
                FROM {@cdmSchema}.procedure_occurrence GROUP BY person_id
                UNION ALL
                SELECT 'Visit', person_id, COUNT(DISTINCT visit_concept_id)
                FROM {@cdmSchema}.visit_occurrence GROUP BY person_id
            ) t
            GROUP BY domain_name
            SQL;
    }

    public function isDistribution(): bool
    {
        return true;
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'drug_exposure', 'measurement', 'observation', 'procedure_occurrence', 'visit_occurrence'];
    }
}
