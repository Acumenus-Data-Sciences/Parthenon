<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * TQ003 – Drug Exposure Duration Anomalies
 *
 * Checks drug_exposure for three categories of temporal inconsistency:
 *
 *  1. Negative days_supply          — physically impossible
 *  2. days_supply > 365             — unusually long (possible for some long-term meds,
 *                                     but often indicates an error or placeholder value)
 *  3. Start/end/days_supply discord — ABS(actual_days - days_supply) > 30 days
 *                                     when all three fields are populated
 *  4. Null drug_exposure_end_date   — forces a 30-day default in Achilles; high rates
 *                                     indicate incomplete source data
 */
class TQ003DrugDurationAnomalies implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'TQ003';
    }

    public function analysisName(): string
    {
        return 'Drug Exposure Duration Anomalies';
    }

    public function category(): string
    {
        return 'Temporal Quality';
    }

    public function description(): string
    {
        return 'Identifies drug exposure records with duration anomalies: negative days_supply, days_supply > 365, discordance between start/end dates and days_supply, or missing end_date.';
    }

    public function severity(): string
    {
        return 'major';
    }

    public function flagThreshold(): ?float
    {
        return 0.02;
    } // flag if >2% of exposures are anomalous

    public function requiredTables(): array
    {
        return ['drug_exposure'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            -- 1. Negative days_supply
            SELECT
                'negative_days_supply'                                                  AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure WHERE drug_concept_id != 0) AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                                WHERE drug_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Drug exposures with days_supply < 0 (impossible)'                    AS notes
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
              AND days_supply IS NOT NULL
              AND days_supply < 0
            HAVING COUNT(*) > 0

            UNION ALL

            -- 2. Excessive days_supply (> 365 days)
            SELECT
                'excessive_days_supply'                                                 AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                    WHERE drug_concept_id != 0 AND days_supply IS NOT NULL)            AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                                WHERE drug_concept_id != 0 AND days_supply IS NOT NULL), 0),
                    6
                )                                                                       AS ratio_value,
                'Drug exposures with days_supply > 365 days'                          AS notes
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
              AND days_supply > 365
            HAVING COUNT(*) > 0

            UNION ALL

            -- 3. Start/end discordant with days_supply by > 30 days
            SELECT
                'start_end_days_supply_discordance'                                     AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                    WHERE drug_concept_id != 0
                      AND drug_exposure_end_date IS NOT NULL
                      AND days_supply IS NOT NULL)                                     AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                                WHERE drug_concept_id != 0
                                  AND drug_exposure_end_date IS NOT NULL
                                  AND days_supply IS NOT NULL), 0),
                    6
                )                                                                       AS ratio_value,
                'Drug exposures where |actual_duration - days_supply| > 30 days'      AS notes
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
              AND drug_exposure_end_date IS NOT NULL
              AND days_supply IS NOT NULL
              AND ABS(
                    (drug_exposure_end_date - drug_exposure_start_date)
                    - days_supply
                  ) > 30
            HAVING COUNT(*) > 0

            UNION ALL

            -- 4. Missing drug_exposure_end_date (Achilles defaults these to start + 30 days)
            SELECT
                'null_end_date'                                                         AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                (SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure WHERE drug_concept_id != 0) AS total_value,
                ROUND(
                    CAST(COUNT(*) AS NUMERIC) /
                    NULLIF((SELECT COUNT(*) FROM {@cdmSchema}.drug_exposure
                                WHERE drug_concept_id != 0), 0),
                    6
                )                                                                       AS ratio_value,
                'Drug exposures with no end_date (defaulted to start + 30 days by analysis engine)' AS notes
            FROM {@cdmSchema}.drug_exposure
            WHERE drug_concept_id != 0
              AND drug_exposure_end_date IS NULL
            HAVING COUNT(*) > 0
            SQL;
    }
}
