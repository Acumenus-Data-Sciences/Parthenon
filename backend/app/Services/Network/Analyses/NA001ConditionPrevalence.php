<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA001 – Cross-Site Condition Prevalence Comparison
 *
 * For each of the top 50 conditions (by max prevalence across any single source)
 * returns the per-source prevalence (% of CDM persons with ≥1 occurrence).
 * Network aggregate computes mean prevalence, SD, and I² heterogeneity index,
 * enabling researchers to identify conditions that vary significantly across sites.
 *
 * stratum_1 = condition_concept_id
 * stratum_2 = concept_name (short label for UI)
 * stratum_3 = ''
 * count_value = persons with ≥1 condition occurrence
 * total_value = total persons in CDM
 */
class NA001ConditionPrevalence implements NetworkAnalysisInterface
{
    public function analysisId(): string    { return 'NA001'; }
    public function analysisName(): string  { return 'Cross-Site Condition Prevalence'; }
    public function category(): string      { return 'Prevalence'; }
    public function minimumSources(): int   { return 2; }

    public function description(): string
    {
        return 'Compares prevalence of top conditions across all connected CDM sources. '
            . 'Highlights conditions with high between-site heterogeneity (I² > 0.50) '
            . 'that may indicate coding variation, population differences, or data quality issues.';
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept'];
    }

    public function perSourceSqlTemplate(): string
    {
        return <<<'SQL'
            WITH total_persons AS (
                SELECT COUNT(*) AS n FROM {@cdmSchema}.person
            ),
            top_conditions AS (
                SELECT co.condition_concept_id,
                       COUNT(DISTINCT co.person_id) AS person_count
                FROM {@cdmSchema}.condition_occurrence co
                WHERE co.condition_concept_id != 0
                GROUP BY co.condition_concept_id
                ORDER BY person_count DESC
                LIMIT 50
            )
            SELECT
                tc.condition_concept_id::TEXT                      AS stratum_1,
                COALESCE(c.concept_name, 'Unknown')                AS stratum_2,
                ''                                                 AS stratum_3,
                tc.person_count                                    AS count_value,
                tp.n                                               AS total_value
            FROM top_conditions tc
            CROSS JOIN total_persons tp
            LEFT JOIN {@cdmSchema}.concept c ON c.concept_id = tc.condition_concept_id
            ORDER BY tc.person_count DESC
            SQL;
    }
}
