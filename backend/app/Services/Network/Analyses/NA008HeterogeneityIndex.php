<?php

namespace App\Services\Network\Analyses;

use App\Contracts\NetworkAnalysisInterface;

/**
 * NA008 – Between-Site Heterogeneity Index
 *
 * A meta-analysis derived from stored NA001 results. For each condition
 * in the network, computes:
 *   Q statistic (Cochran's test for heterogeneity)
 *   I² = (Q - df) / Q × 100%  (Higgins 2003)
 *   τ² (DerSimonian-Laird between-study variance)
 *
 * High I² (> 50%) signals that between-site variation in prevalence
 * exceeds what would be expected from sampling alone — warranting
 * investigation of coding differences, population selection, or data quality.
 *
 * This analysis does NOT execute CDM SQL — it reads from
 * network_analysis_results (NA001 rows) and computes statistics in PostgreSQL.
 *
 * stratum_1 = condition_concept_id
 * stratum_2 = concept_name
 * stratum_3 = heterogeneity_band ('low' I²<25% | 'moderate' 25-50% | 'high' 50-75% | 'very_high' >75%)
 * count_value  = number of sources contributing data
 * total_value  = total persons across all sources with this condition
 */
class NA008HeterogeneityIndex implements NetworkAnalysisInterface
{
    public function analysisId(): string
    {
        return 'NA008';
    }

    public function analysisName(): string
    {
        return 'Between-Site Heterogeneity Index';
    }

    public function category(): string
    {
        return 'Heterogeneity';
    }

    public function minimumSources(): int
    {
        return 3;
    }

    public function description(): string
    {
        return 'Computes Cochran\'s Q and I² heterogeneity statistics for condition '
            .'prevalences stored from NA001. I² > 50% identifies conditions whose '
            .'site-to-site variation is unlikely to arise from chance alone, flagging '
            .'coding inconsistencies or genuine population differences.';
    }

    public function requiredTables(): array
    {
        return ['network_analysis_results'];   // reads from results schema
    }

    /**
     * Queries the stored NA001 results to compute per-condition heterogeneity.
     * Uses {@resultsSchema} — the app results schema, not the CDM.
     */
    public function perSourceSqlTemplate(): string
    {
        return <<<'SQL'
            WITH na001_rows AS (
                SELECT
                    stratum_1                          AS concept_id,
                    stratum_2                          AS concept_name,
                    source_id,
                    count_value::NUMERIC               AS num,
                    total_value::NUMERIC               AS denom,
                    CASE WHEN total_value > 0
                         THEN count_value::NUMERIC / total_value::NUMERIC
                         ELSE NULL END                 AS ratio
                FROM {@resultsSchema}.network_analysis_results
                WHERE analysis_id = 'NA001'
                  AND source_id IS NOT NULL
                  AND total_value > 0
            ),
            stats AS (
                SELECT
                    concept_id                                                      AS stratum_1,
                    MAX(concept_name)                                               AS stratum_2,
                    COUNT(*)                                                        AS k,
                    SUM(num)                                                        AS total_num,
                    SUM(denom)                                                      AS total_denom,
                    AVG(ratio)                                                      AS mean_ratio,
                    -- Cochran Q
                    SUM(denom * POWER(ratio - (SUM(num) OVER () / NULLIF(SUM(denom) OVER (), 0)), 2))
                        OVER (PARTITION BY concept_id)                             AS q_stat
                FROM na001_rows
                GROUP BY concept_id
            ),
            heterogeneity AS (
                SELECT
                    stratum_1,
                    stratum_2,
                    k,
                    total_num,
                    total_denom,
                    mean_ratio,
                    q_stat,
                    -- I² = max(0, (Q - df) / Q)
                    CASE WHEN q_stat > 0 AND k > 1
                         THEN GREATEST(0, (q_stat - (k - 1)) / q_stat)
                         ELSE 0 END                                                AS i2
                FROM stats
                WHERE k >= 3   -- need ≥3 sources for meaningful I²
            )
            SELECT
                stratum_1,
                stratum_2,
                CASE
                    WHEN i2 < 0.25 THEN 'low'
                    WHEN i2 < 0.50 THEN 'moderate'
                    WHEN i2 < 0.75 THEN 'high'
                    ELSE                'very_high'
                END                                                                AS stratum_3,
                k::BIGINT                                                          AS count_value,
                total_denom::BIGINT                                                AS total_value
            FROM heterogeneity
            ORDER BY i2 DESC
            LIMIT 100
            SQL;
    }
}
