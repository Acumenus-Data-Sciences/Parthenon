<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

/**
 * RS010 – CURB-65 Pneumonia Severity Score
 *
 * Predicts 30-day mortality in community-acquired pneumonia (CAP).
 * Five binary criteria, each = 1 point (range 0–5).
 * Validated by British Thoracic Society (BTS) 2009 guidelines.
 *
 * Criteria:
 *   C – Confusion / altered mental status (condition 373995)           = 1
 *   U – Urea (BUN) > 19 mg/dL                                         = 1
 *       OMOP concepts: 3013682 (BUN), 3035995, 3004295 (BUN variants)
 *   R – Respiratory rate ≥ 30 breaths/min                             = 1
 *       OMOP concept: 3024171 (Respiratory rate, LOINC 9279-1)
 *   B – Blood pressure: SBP < 90 OR DBP ≤ 60 mmHg                    = 1
 *       OMOP concepts: 3004249 (SBP, LOINC 8480-6),
 *                      3012888 (DBP, LOINC 8462-4)
 *   65 – Age ≥ 65                                                      = 1
 *
 * Score 0 → very low 30-day mortality (~1.5%), 1–2 → low-intermediate (~5–9%),
 * ≥3 → severe (~17–22%), typically requiring hospital admission ± ICU.
 *
 * Eligible: patients with pneumonia diagnosis:
 *   255848  – Pneumonia
 *   4185711 – Bacterial pneumonia
 *   257315  – Viral pneumonia
 *   46273443 – COVID-19 pneumonia (OMOP standard)
 *
 * Confidence: age always known (1), BUN/RR/BP measurable (3 labs):
 *   confidence = (1 + bun_present + rr_present + sbp_present) / 4
 *   (confusion from conditions assumed absent if no record; weighted as always queryable)
 *
 * Missing components: BUN, respiratory_rate, blood_pressure (SBP proxy)
 *
 * OMOP concepts:
 *   373995  – Delirium / confusion
 *   3013682 – Urea nitrogen [Mass/vol] in Serum or Plasma (BUN)
 *   3035995 – Urea nitrogen [Mass/vol] in Blood (BUN variant)
 *   3004295 – Urea nitrogen [Mass/vol] in Blood by Colorimetric method
 *   3024171 – Respiratory rate (LOINC 9279-1)
 *   3004249 – Systolic blood pressure (LOINC 8480-6)
 *   3012888 – Diastolic blood pressure (LOINC 8462-4)
 */
class RS010CURB65 implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS010';
    }

    public function scoreName(): string
    {
        return 'CURB-65 (Pneumonia Severity)';
    }

    public function category(): string
    {
        return 'Pulmonary';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with pneumonia diagnosis';
    }

    public function description(): string
    {
        return 'CURB-65 score for community-acquired pneumonia (CAP) severity stratification per BTS 2009 guidelines. Five binary criteria: Confusion, Urea (BUN) > 19 mg/dL, Respiratory rate ≥30/min, low Blood pressure (SBP<90 or DBP≤60), and age ≥65. Score 0 = low (outpatient); 1-2 = intermediate (hospital); ≥3 = severe (ICU consideration).';
    }

    public function requiredComponents(): array
    {
        return [
            'pneumonia_diagnosis',
            'age',
            'confusion',
            'bun',
            'respiratory_rate',
            'blood_pressure',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 1],
            'intermediate' => [1, 3],
            'severe' => [3, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'measurement'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH pneumonia_patients AS (
                -- Eligible: patients with at least one pneumonia diagnosis
                SELECT DISTINCT p.person_id,
                       EXTRACT(YEAR FROM AGE(CURRENT_DATE,
                           MAKE_DATE(p.year_of_birth,
                               COALESCE(p.month_of_birth, 7),
                               COALESCE(p.day_of_birth, 1))))::INT AS age
                FROM {@cdmSchema}.person p
                WHERE EXISTS (
                    SELECT 1 FROM {@cdmSchema}.condition_occurrence co
                    WHERE co.person_id = p.person_id
                      AND co.condition_concept_id IN (255848, 4185711, 257315, 46273443)
                )
            ),
            -- C: Confusion / delirium
            confusion AS (
                SELECT DISTINCT person_id FROM {@cdmSchema}.condition_occurrence
                WHERE condition_concept_id = 373995
            ),
            -- U: BUN > 19 mg/dL (Blood Urea Nitrogen)
            latest_bun AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS bun
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id IN (3013682, 3035995, 3004295)
                  AND value_as_number > 0
                ORDER BY person_id, measurement_date DESC
            ),
            -- R: Respiratory rate (breaths/min)
            latest_rr AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS respiratory_rate
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3024171
                  AND value_as_number BETWEEN 1 AND 100
                ORDER BY person_id, measurement_date DESC
            ),
            -- B: Systolic blood pressure
            latest_sbp AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS sbp
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3004249
                  AND value_as_number BETWEEN 40 AND 300
                ORDER BY person_id, measurement_date DESC
            ),
            -- B: Diastolic blood pressure
            latest_dbp AS (
                SELECT DISTINCT ON (person_id) person_id, value_as_number AS dbp
                FROM {@cdmSchema}.measurement
                WHERE measurement_concept_id = 3012888
                  AND value_as_number BETWEEN 20 AND 200
                ORDER BY person_id, measurement_date DESC
            ),
            components AS (
                SELECT
                    pp.person_id,
                    pp.age,
                    -- C: Confusion
                    CASE WHEN conf.person_id IS NOT NULL THEN 1 ELSE 0 END     AS c_confusion,
                    -- U: BUN > 19
                    CASE WHEN bun.bun > 19              THEN 1 ELSE 0 END      AS u_bun,
                    -- R: RR >= 30
                    CASE WHEN rr.respiratory_rate >= 30  THEN 1 ELSE 0 END     AS r_rr,
                    -- B: SBP < 90 OR DBP <= 60
                    CASE WHEN sbp.sbp < 90
                           OR dbp.dbp <= 60             THEN 1 ELSE 0 END      AS b_bp,
                    -- 65: Age >= 65
                    CASE WHEN pp.age >= 65              THEN 1 ELSE 0 END      AS age65,
                    -- Raw values for missing_components accounting
                    bun.bun,
                    rr.respiratory_rate,
                    sbp.sbp,
                    -- Presence flags for confidence
                    CASE WHEN bun.bun              IS NOT NULL THEN 1 ELSE 0 END AS bun_present,
                    CASE WHEN rr.respiratory_rate  IS NOT NULL THEN 1 ELSE 0 END AS rr_present,
                    CASE WHEN sbp.sbp              IS NOT NULL THEN 1 ELSE 0 END AS sbp_present
                FROM pneumonia_patients pp
                LEFT JOIN confusion    conf ON pp.person_id = conf.person_id
                LEFT JOIN latest_bun   bun  ON pp.person_id = bun.person_id
                LEFT JOIN latest_rr    rr   ON pp.person_id = rr.person_id
                LEFT JOIN latest_sbp   sbp  ON pp.person_id = sbp.person_id
                LEFT JOIN latest_dbp   dbp  ON pp.person_id = dbp.person_id
            ),
            scored AS (
                SELECT *,
                    (c_confusion + u_bun + r_rr + b_bp + age65) AS curb65_score,
                    -- Confidence: age always known, 3 measurable labs
                    ROUND((1 + bun_present + rr_present + sbp_present)::NUMERIC / 4, 4) AS confidence,
                    ROUND((1 + bun_present + rr_present + sbp_present)::NUMERIC / 4, 4) AS completeness
                FROM components
            ),
            tiered AS (
                SELECT *,
                    CASE
                        WHEN curb65_score >= 3 THEN 'severe'
                        WHEN curb65_score >= 1 THEN 'intermediate'
                        ELSE 'low'
                    END AS risk_tier
                FROM scored
            )
            SELECT
                risk_tier,
                COUNT(*)                                                                            AS patient_count,
                (SELECT COUNT(*) FROM pneumonia_patients)                                           AS total_eligible,
                ROUND(AVG(curb65_score), 4)                                                         AS mean_score,
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY curb65_score)                          AS p25_score,
                PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY curb65_score)                          AS median_score,
                PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY curb65_score)                          AS p75_score,
                ROUND(AVG(confidence)::NUMERIC, 4)                                                  AS mean_confidence,
                ROUND(AVG(completeness)::NUMERIC, 4)                                                AS mean_completeness,
                '{"bun":'              || SUM(CASE WHEN bun              IS NULL THEN 1 ELSE 0 END) ||
                ',"respiratory_rate":' || SUM(CASE WHEN respiratory_rate IS NULL THEN 1 ELSE 0 END) ||
                ',"blood_pressure":'   || SUM(CASE WHEN sbp              IS NULL THEN 1 ELSE 0 END) ||
                '}'                                                                                 AS missing_components
            FROM tiered
            GROUP BY risk_tier
            HAVING COUNT(*) > 0
            ORDER BY CASE risk_tier WHEN 'severe' THEN 1 WHEN 'intermediate' THEN 2
                                    WHEN 'low'    THEN 3 ELSE 4 END
            SQL;
    }
}
