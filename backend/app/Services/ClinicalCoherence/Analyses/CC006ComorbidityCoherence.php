<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * CC006 – Comorbidity Coherence
 *
 * For the 20 most prevalent conditions in the CDM, computes the
 * observed / expected co-occurrence ratio for every pairwise combination.
 *
 * Expected co-occurrence (under independence):
 *   E(A ∩ B) = (count_A × count_B) / N
 *
 * Flags pairs where:
 *  - ratio > 1.5  → stronger-than-expected comorbidity (positive association)
 *  - ratio < 0.5  → weaker-than-expected co-occurrence (negative association / mutual exclusion)
 *
 * No hardcoded concept IDs — fully data-driven.
 */
class CC006ComorbidityCoherence implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'CC006';
    }

    public function analysisName(): string
    {
        return 'Comorbidity Coherence (Observed / Expected)';
    }

    public function category(): string
    {
        return 'Population Coherence';
    }

    public function description(): string
    {
        return 'Computes observed vs expected co-occurrence ratios for the top 20 condition pairs. Flags pairs with significantly higher (positive comorbidity) or lower (mutual exclusion) co-occurrence than chance.';
    }

    public function severity(): string
    {
        return 'informational';
    }

    /**
     * ratio_value here is O/E ratio; flag when outside [0.5, 1.5].
     * The engine flags ratio >= threshold so we set a sentinel value;
     * actual flagging logic uses both directions (handled by category check in UI).
     * We set threshold to 1.5 to flag positive associations; negative associations
     * (ratio < 0.5) are flagged separately via the engine's count_value > 0 check
     * when flagThreshold is null, but we want threshold-based here.
     */
    public function flagThreshold(): ?float
    {
        return 1.5;
    }

    public function requiredTables(): array
    {
        return ['condition_occurrence', 'person', 'concept'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH total_patients AS (
                SELECT COUNT(DISTINCT person_id) AS n
                FROM {@cdmSchema}.person
            ),
            top_conditions AS (
                SELECT condition_concept_id,
                       COUNT(DISTINCT person_id) AS patient_count
                FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id != 0
                GROUP BY condition_concept_id
                ORDER BY patient_count DESC
                LIMIT 20
            ),
            cooccurrence AS (
                SELECT
                    a.condition_concept_id AS concept_a,
                    b.condition_concept_id AS concept_b,
                    COUNT(DISTINCT a.person_id) AS observed
                FROM {@cdmSchema}.condition_occurrence a
                JOIN {@cdmSchema}.condition_occurrence b
                    ON  a.person_id = b.person_id
                    AND a.condition_concept_id < b.condition_concept_id
                JOIN top_conditions ta ON a.condition_concept_id = ta.condition_concept_id
                JOIN top_conditions tb ON b.condition_concept_id = tb.condition_concept_id
                GROUP BY a.condition_concept_id, b.condition_concept_id
            ),
            enriched AS (
                SELECT
                    co.concept_a,
                    co.concept_b,
                    co.observed,
                    ta.patient_count                                         AS count_a,
                    tb.patient_count                                         AS count_b,
                    tp.n                                                     AS total_n,
                    ROUND(
                        CAST(ta.patient_count AS NUMERIC) *
                        CAST(tb.patient_count AS NUMERIC) / NULLIF(tp.n, 0),
                        0
                    )                                                        AS expected,
                    ca.concept_name                                          AS name_a,
                    cb.concept_name                                          AS name_b
                FROM cooccurrence co
                JOIN top_conditions ta ON co.concept_a = ta.condition_concept_id
                JOIN top_conditions tb ON co.concept_b = tb.condition_concept_id
                CROSS JOIN total_patients tp
                JOIN {@cdmSchema}.concept ca ON co.concept_a = ca.concept_id
                JOIN {@cdmSchema}.concept cb ON co.concept_b = cb.concept_id
            )
            SELECT
                CASE
                    WHEN ROUND(CAST(observed AS NUMERIC) / NULLIF(expected, 0), 4) >= 1.5
                        THEN 'positive_comorbidity'
                    WHEN ROUND(CAST(observed AS NUMERIC) / NULLIF(expected, 0), 4) <= 0.5
                        THEN 'negative_comorbidity'
                    ELSE 'neutral'
                END                                                          AS stratum_1,
                name_a || ' + ' || name_b                                    AS stratum_2,
                NULL::VARCHAR                                                AS stratum_3,
                observed                                                     AS count_value,
                total_n                                                      AS total_value,
                ROUND(CAST(observed AS NUMERIC) / NULLIF(expected, 0), 6)   AS ratio_value,
                'Observed/Expected co-occurrence ratio (> 1.5 = positive comorbidity, < 0.5 = mutual exclusion)' AS notes
            FROM enriched
            WHERE observed != expected
              AND (
                  ROUND(CAST(observed AS NUMERIC) / NULLIF(expected, 0), 4) >= 1.5
                  OR ROUND(CAST(observed AS NUMERIC) / NULLIF(expected, 0), 4) <= 0.5
              )
            ORDER BY ratio_value DESC
            SQL;
    }
}
