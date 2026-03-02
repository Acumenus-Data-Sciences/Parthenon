<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA005 – Vocabulary & Concept Usage Comparison
 *
 * Reports top vocabularies in use per source and the unmapped concept rate
 * (concept_id = 0) per domain. High unmapped rates indicate ETL gaps that
 * will silently exclude patients from condition/drug/measurement analyses.
 *
 * stratum_1 = domain ('condition' | 'drug' | 'measurement' | 'procedure' | 'observation')
 * stratum_2 = 'vocabulary:' + vocabulary_id  OR  'unmapped'
 * stratum_3 = ''
 * count_value = record count for this stratum
 * total_value = total records in domain
 */
class NA005VocabularyUsage implements NetworkAnalysisInterface
{
    public function analysisId(): string    { return 'NA005'; }
    public function analysisName(): string  { return 'Vocabulary & Concept Usage'; }
    public function category(): string      { return 'Coverage'; }
    public function minimumSources(): int   { return 1; }

    public function description(): string
    {
        return 'Identifies vocabulary mix and unmapped concept rates per domain per source. '
            . 'High unmapped rates (concept_id = 0) indicate ETL gaps; vocabulary mix '
            . 'differences across sites may affect concept-set portability.';
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'drug_exposure', 'measurement',
                'procedure_occurrence', 'observation', 'concept'];
    }

    public function perSourceSqlTemplate(): string
    {
        return <<<'SQL'
            WITH domain_records AS (
                -- Condition
                SELECT 'condition' AS domain, condition_concept_id AS concept_id
                FROM {@cdmSchema}.condition_occurrence
                UNION ALL
                SELECT 'drug', drug_concept_id FROM {@cdmSchema}.drug_exposure
                UNION ALL
                SELECT 'measurement', measurement_concept_id FROM {@cdmSchema}.measurement
                UNION ALL
                SELECT 'procedure', procedure_concept_id FROM {@cdmSchema}.procedure_occurrence
                UNION ALL
                SELECT 'observation', observation_concept_id FROM {@cdmSchema}.observation
            ),
            domain_totals AS (
                SELECT domain, COUNT(*) AS total_records
                FROM domain_records
                GROUP BY domain
            ),
            unmapped AS (
                SELECT domain, 'unmapped' AS stratum_2, COUNT(*) AS n
                FROM domain_records
                WHERE concept_id = 0
                GROUP BY domain
            ),
            vocab_usage AS (
                SELECT dr.domain,
                       'vocabulary:' || COALESCE(c.vocabulary_id, 'unknown') AS stratum_2,
                       COUNT(*) AS n
                FROM domain_records dr
                LEFT JOIN {@cdmSchema}.concept c ON c.concept_id = dr.concept_id
                WHERE dr.concept_id != 0
                GROUP BY dr.domain, c.vocabulary_id
            ),
            combined AS (
                SELECT domain AS stratum_1, stratum_2, n FROM unmapped
                UNION ALL
                SELECT domain, stratum_2, n
                FROM (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY domain ORDER BY n DESC) AS rn
                    FROM vocab_usage
                ) ranked
                WHERE rn <= 5  -- top 5 vocabularies per domain
            )
            SELECT
                c.stratum_1,
                c.stratum_2,
                ''                AS stratum_3,
                c.n               AS count_value,
                dt.total_records  AS total_value
            FROM combined c
            JOIN domain_totals dt ON dt.domain = c.stratum_1
            ORDER BY c.stratum_1, c.n DESC
            SQL;
    }
}
