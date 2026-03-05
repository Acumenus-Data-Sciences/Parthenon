<?php

namespace App\Services\PopulationCharacterization\Analyses;

use App\Contracts\PopulationCharacterizationInterface;

/**
 * PC004 – Provider Practice Pattern Variance
 *
 * Measures between-provider coding variation within each clinical domain.
 * For each domain, computes the coefficient of variation (CV = SD/mean) in
 * records-per-patient across providers. High CV indicates practice variation
 * that may reflect documentation style differences, not just clinical complexity.
 *
 * Requires `provider_id` to be populated in domain tables (optional CDM field).
 * Returns gracefully with zero rows if no provider data exists.
 *
 * stratum_1 = domain ('condition' | 'drug' | 'measurement' | 'procedure')
 * stratum_2 = variance_band ('low' CV<0.5 | 'moderate' 0.5-1.0 | 'high' >1.0)
 * stratum_3 = '' (CV × 1000 stored in count_value for precision)
 * count_value = CV × 1000 (integer encoding; divide by 1000 in UI)
 * total_value = number of distinct providers with ≥10 patients in this domain
 */
class PC004ProviderPracticeVariance implements PopulationCharacterizationInterface
{
    public function analysisId(): string
    {
        return 'PC004';
    }

    public function analysisName(): string
    {
        return 'Provider Practice Pattern Variance';
    }

    public function category(): string
    {
        return 'Provider';
    }

    public function requiresOptionalTables(): bool
    {
        return true;
    }

    public function description(): string
    {
        return 'Coefficient of variation in domain record rates across providers '
            .'(requires provider_id to be populated). High CV (> 1.0) indicates '
            .'significant between-provider coding variation beyond patient-mix differences.';
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'drug_exposure', 'measurement',
            'procedure_occurrence', 'visit_occurrence'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH provider_domain_rates AS (
                -- Condition records per patient per provider
                SELECT 'condition' AS domain,
                       vo.provider_id,
                       COUNT(co.condition_occurrence_id)::NUMERIC / COUNT(DISTINCT co.person_id) AS rate
                FROM {@cdmSchema}.visit_occurrence vo
                JOIN {@cdmSchema}.condition_occurrence co
                    ON co.person_id = vo.person_id
                WHERE vo.provider_id IS NOT NULL
                GROUP BY vo.provider_id
                HAVING COUNT(DISTINCT co.person_id) >= 10

                UNION ALL

                SELECT 'drug', vo.provider_id,
                       COUNT(de.drug_exposure_id)::NUMERIC / COUNT(DISTINCT de.person_id)
                FROM {@cdmSchema}.visit_occurrence vo
                JOIN {@cdmSchema}.drug_exposure de
                    ON de.person_id = vo.person_id
                WHERE vo.provider_id IS NOT NULL
                GROUP BY vo.provider_id
                HAVING COUNT(DISTINCT de.person_id) >= 10

                UNION ALL

                SELECT 'measurement', vo.provider_id,
                       COUNT(m.measurement_id)::NUMERIC / COUNT(DISTINCT m.person_id)
                FROM {@cdmSchema}.visit_occurrence vo
                JOIN {@cdmSchema}.measurement m
                    ON m.person_id = vo.person_id
                WHERE vo.provider_id IS NOT NULL
                GROUP BY vo.provider_id
                HAVING COUNT(DISTINCT m.person_id) >= 10

                UNION ALL

                SELECT 'procedure', vo.provider_id,
                       COUNT(po.procedure_occurrence_id)::NUMERIC / COUNT(DISTINCT po.person_id)
                FROM {@cdmSchema}.visit_occurrence vo
                JOIN {@cdmSchema}.procedure_occurrence po
                    ON po.person_id = vo.person_id
                WHERE vo.provider_id IS NOT NULL
                GROUP BY vo.provider_id
                HAVING COUNT(DISTINCT po.person_id) >= 10
            ),
            cv_stats AS (
                SELECT domain,
                       STDDEV(rate) / NULLIF(AVG(rate), 0) AS cv,
                       COUNT(*)                             AS provider_count
                FROM provider_domain_rates
                GROUP BY domain
            )
            SELECT
                domain                                          AS stratum_1,
                CASE WHEN cv < 0.5  THEN 'low'
                     WHEN cv < 1.0  THEN 'moderate'
                     ELSE                'high' END             AS stratum_2,
                ''                                              AS stratum_3,
                ROUND(COALESCE(cv, 0) * 1000)::BIGINT           AS count_value,
                provider_count                                  AS total_value
            FROM cv_stats
            ORDER BY domain
            SQL;
    }
}
