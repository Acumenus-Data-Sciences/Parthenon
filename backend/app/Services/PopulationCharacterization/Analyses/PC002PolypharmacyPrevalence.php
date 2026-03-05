<?php

namespace App\Services\PopulationCharacterization\Analyses;

use App\Contracts\PopulationCharacterizationInterface;

/**
 * PC002 – Polypharmacy Prevalence
 *
 * Computes each person's peak concurrent drug-era count — the maximum number of
 * distinct drug ingredients active simultaneously at any point in their record.
 * Uses `drug_era` (already consolidated by ingredient) not `drug_exposure`.
 *
 * Two result sets are returned in a single query:
 *
 * 1. Overall population distribution of peak concurrent drug count:
 *    stratum_1 = concurrent_bucket ('1' | '2-4' | '5-9' | '10-14' | '15+')
 *    stratum_2 = 'overall'
 *
 * 2. Polypharmacy rate (≥5 concurrent) by observation year:
 *    stratum_1 = year (YYYY)
 *    stratum_2 = 'yearly_rate'
 *
 * count_value = persons in bucket
 * total_value = total persons with at least one drug era
 */
class PC002PolypharmacyPrevalence implements PopulationCharacterizationInterface
{
    public function analysisId(): string
    {
        return 'PC002';
    }

    public function analysisName(): string
    {
        return 'Polypharmacy Prevalence';
    }

    public function category(): string
    {
        return 'Medication';
    }

    public function requiresOptionalTables(): bool
    {
        return false;
    }

    public function description(): string
    {
        return 'Distribution of peak concurrent drug-era counts per person (using consolidated '
            .'drug eras by ingredient). Polypharmacy thresholds: ≥5 drugs (minor), ≥10 (major), '
            .'≥15 (severe). Includes a year-over-year polypharmacy rate trend.';
    }

    public function requiredTables(): array
    {
        return ['person', 'drug_era'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH total AS (
                SELECT COUNT(DISTINCT person_id) AS n FROM {@cdmSchema}.drug_era
            ),
            -- At each drug era start date, count overlapping eras for that person
            overlaps AS (
                SELECT
                    d1.person_id,
                    d1.drug_era_start_date,
                    COUNT(DISTINCT d2.drug_concept_id) AS concurrent
                FROM {@cdmSchema}.drug_era d1
                JOIN {@cdmSchema}.drug_era d2
                    ON d2.person_id         = d1.person_id
                   AND d2.drug_era_start_date <= d1.drug_era_start_date
                   AND d2.drug_era_end_date   >= d1.drug_era_start_date
                GROUP BY d1.person_id, d1.drug_era_start_date
            ),
            peak AS (
                SELECT person_id,
                       MAX(concurrent) AS peak_concurrent
                FROM overlaps
                GROUP BY person_id
            ),
            -- Overall distribution
            dist AS (
                SELECT
                    CASE WHEN peak_concurrent = 1    THEN '1'
                         WHEN peak_concurrent <= 4   THEN '2-4'
                         WHEN peak_concurrent <= 9   THEN '5-9'
                         WHEN peak_concurrent <= 14  THEN '10-14'
                         ELSE                             '15+'  END  AS stratum_1,
                    'overall'                                          AS stratum_2,
                    ''                                                 AS stratum_3,
                    COUNT(*)                                           AS count_value,
                    (SELECT n FROM total)                              AS total_value
                FROM peak
                GROUP BY stratum_1
            ),
            -- Yearly polypharmacy rate (≥5 concurrent drugs)
            poly_by_year AS (
                SELECT
                    EXTRACT(YEAR FROM d1.drug_era_start_date)::INT AS yr,
                    COUNT(DISTINCT d1.person_id)                   AS poly_persons
                FROM {@cdmSchema}.drug_era d1
                WHERE EXISTS (
                    SELECT 1
                    FROM {@cdmSchema}.drug_era d2
                    WHERE d2.person_id         = d1.person_id
                      AND d2.drug_era_start_date <= d1.drug_era_start_date
                      AND d2.drug_era_end_date   >= d1.drug_era_start_date
                    GROUP BY d2.person_id
                    HAVING COUNT(DISTINCT d2.drug_concept_id) >= 5
                )
                GROUP BY yr
            ),
            persons_by_year AS (
                SELECT EXTRACT(YEAR FROM drug_era_start_date)::INT AS yr,
                       COUNT(DISTINCT person_id)                   AS active_persons
                FROM {@cdmSchema}.drug_era
                GROUP BY yr
            ),
            yearly AS (
                SELECT
                    py.yr::TEXT   AS stratum_1,
                    'yearly_rate' AS stratum_2,
                    ''            AS stratum_3,
                    COALESCE(pb.poly_persons, 0) AS count_value,
                    py.active_persons            AS total_value
                FROM persons_by_year py
                LEFT JOIN poly_by_year pb ON pb.yr = py.yr
                WHERE py.yr BETWEEN 1990 AND EXTRACT(YEAR FROM CURRENT_DATE)::INT
            )
            SELECT * FROM dist
            UNION ALL
            SELECT * FROM yearly
            ORDER BY stratum_2, stratum_1
            SQL;
    }
}
