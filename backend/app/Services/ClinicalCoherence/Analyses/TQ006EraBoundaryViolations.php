<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * TQ006 – Era Boundary Violations
 *
 * Drug eras and condition eras are derived tables. Their dates should always
 * fall within a person's observation period and respect physiological limits.
 *
 * Six checks:
 *  1. Drug era start before observation period start
 *  2. Drug era end after observation period end
 *  3. Drug era exceeding 10 years (implausibly long continuous era)
 *  4. Condition era start before observation period start
 *  5. Condition era end after observation period end
 *  6. Condition era exceeding 20 years (implausibly long continuous era)
 *
 * obs_bounds uses the person's FULL observation envelope (min start, max end)
 * to be tolerant of multi-period patients.
 */
class TQ006EraBoundaryViolations implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string { return 'TQ006'; }

    public function analysisName(): string
    {
        return 'Era Boundary Violations';
    }

    public function category(): string { return 'Temporal Quality'; }

    public function description(): string
    {
        return 'Checks that drug_era and condition_era records fall within the observation period envelope for each person, and that era durations are physiologically plausible.';
    }

    public function severity(): string { return 'major'; }

    public function flagThreshold(): ?float { return 0.01; } // flag if >1% of eras have violations

    public function requiredTables(): array
    {
        return ['observation_period', 'drug_era', 'condition_era'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH obs_bounds AS (
                SELECT
                    person_id,
                    MIN(observation_period_start_date) AS earliest_start,
                    MAX(observation_period_end_date)   AS latest_end
                FROM {@cdmSchema}.observation_period
                GROUP BY person_id
            ),
            drug_era_total AS (
                SELECT COUNT(*) AS n FROM {@cdmSchema}.drug_era WHERE drug_concept_id != 0
            ),
            condition_era_total AS (
                SELECT COUNT(*) AS n FROM {@cdmSchema}.condition_era WHERE condition_concept_id != 0
            )

            -- 1. Drug era starts before observation
            SELECT
                'drug_era_before_observation'                                           AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                det.n                                                                   AS total_value,
                ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(det.n, 0), 6)                AS ratio_value,
                'Drug era start_date precedes the persons earliest observation period start' AS notes
            FROM {@cdmSchema}.drug_era de
            JOIN obs_bounds ob ON de.person_id = ob.person_id
            CROSS JOIN drug_era_total det
            WHERE de.drug_concept_id != 0
              AND de.drug_era_start_date < ob.earliest_start
            GROUP BY det.n
            HAVING COUNT(*) > 0

            UNION ALL

            -- 2. Drug era ends after observation
            SELECT
                'drug_era_after_observation'                                            AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                det.n                                                                   AS total_value,
                ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(det.n, 0), 6)                AS ratio_value,
                'Drug era end_date is after the persons latest observation period end' AS notes
            FROM {@cdmSchema}.drug_era de
            JOIN obs_bounds ob ON de.person_id = ob.person_id
            CROSS JOIN drug_era_total det
            WHERE de.drug_concept_id != 0
              AND de.drug_era_end_date > ob.latest_end
            GROUP BY det.n
            HAVING COUNT(*) > 0

            UNION ALL

            -- 3. Implausibly long drug eras (> 10 years = 3650 days)
            SELECT
                'drug_era_over_10_years'                                                AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                det.n                                                                   AS total_value,
                ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(det.n, 0), 6)                AS ratio_value,
                'Drug eras spanning more than 10 years (continuous era unlikely)'      AS notes
            FROM {@cdmSchema}.drug_era
            CROSS JOIN drug_era_total det
            WHERE drug_concept_id != 0
              AND drug_era_end_date - drug_era_start_date > 3650
            GROUP BY det.n
            HAVING COUNT(*) > 0

            UNION ALL

            -- 4. Condition era starts before observation
            SELECT
                'condition_era_before_observation'                                      AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                cet.n                                                                   AS total_value,
                ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(cet.n, 0), 6)                AS ratio_value,
                'Condition era start_date precedes the persons earliest observation period start' AS notes
            FROM {@cdmSchema}.condition_era ce
            JOIN obs_bounds ob ON ce.person_id = ob.person_id
            CROSS JOIN condition_era_total cet
            WHERE ce.condition_concept_id != 0
              AND ce.condition_era_start_date < ob.earliest_start
            GROUP BY cet.n
            HAVING COUNT(*) > 0

            UNION ALL

            -- 5. Condition era ends after observation
            SELECT
                'condition_era_after_observation'                                       AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                cet.n                                                                   AS total_value,
                ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(cet.n, 0), 6)                AS ratio_value,
                'Condition era end_date is after the persons latest observation period end' AS notes
            FROM {@cdmSchema}.condition_era ce
            JOIN obs_bounds ob ON ce.person_id = ob.person_id
            CROSS JOIN condition_era_total cet
            WHERE ce.condition_concept_id != 0
              AND ce.condition_era_end_date > ob.latest_end
            GROUP BY cet.n
            HAVING COUNT(*) > 0

            UNION ALL

            -- 6. Implausibly long condition eras (> 20 years = 7300 days)
            SELECT
                'condition_era_over_20_years'                                           AS stratum_1,
                NULL::VARCHAR                                                           AS stratum_2,
                NULL::VARCHAR                                                           AS stratum_3,
                COUNT(*)                                                                AS count_value,
                cet.n                                                                   AS total_value,
                ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(cet.n, 0), 6)                AS ratio_value,
                'Condition eras spanning more than 20 years (implausibly continuous era)' AS notes
            FROM {@cdmSchema}.condition_era
            CROSS JOIN condition_era_total cet
            WHERE condition_concept_id != 0
              AND condition_era_end_date - condition_era_start_date > 7300
            GROUP BY cet.n
            HAVING COUNT(*) > 0
            SQL;
    }
}
