<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS016FRAXFractureRisk implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS016';
    }

    public function scoreName(): string
    {
        return 'FRAX-Inspired Fracture Risk (10-yr Major Osteoporotic)';
    }

    public function category(): string
    {
        return 'Musculoskeletal';
    }

    public function eligiblePopulation(): string
    {
        return 'Women ≥50 or men ≥60';
    }

    public function description(): string
    {
        return 'Simplified FRAX-inspired clinical risk score for 10-year major osteoporotic fracture risk. '
            .'FRAX normally uses country-specific lookup tables and optionally bone mineral density (BMD). '
            .'This implementation approximates the risk using OMOP-available clinical factors: age bands, '
            .'sex, prior fragility fracture (2 pts), current smoking, glucocorticoid use ≥3 months, '
            .'rheumatoid arthritis, secondary osteoporosis causes, low BMD proxy (osteoporosis/osteopenia '
            .'diagnosis), and alcohol use. Parental hip fracture history is not available in CDM and is '
            .'omitted. 10-year risk is estimated empirically from total score bands. '
            .'Confidence baseline 0.75 reflects missing BMD, country calibration, and parental history. '
            .'Note: this score is an approximation and should not substitute for formal FRAX calculation.';
    }

    public function requiredComponents(): array
    {
        return [
            'age',
            'sex',
            'prior_fracture',
            'glucocorticoid_use',
            'rheumatoid_arthritis',
            'osteoporosis',
            'smoking',
            'alcohol',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 3],
            'moderate' => [3, 6],
            'high' => [6, 10],
            'very_high' => [10, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'drug_exposure', 'concept_ancestor'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH eligible_patients AS (
    SELECT
        p.person_id,
        p.gender_concept_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {cdmSchema}.person p
    WHERE (
        -- Women >= 50
        (p.gender_concept_id = 8532 AND (EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) >= 50)
        OR
        -- Men >= 60
        (p.gender_concept_id = 8507 AND (EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) >= 60)
    )
),

-- Prior fragility fracture: vertebral, wrist, hip, osteoporotic fracture
prior_fracture AS (
    SELECT DISTINCT person_id, 1 AS has_fracture
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (4227085, 432439, 436945, 444132, 4059173, 4218106)
),

-- Glucocorticoid use >= 3 months cumulative: prednisone (1551099) or methylprednisolone (1506270)
glucocorticoid_use AS (
    SELECT
        de.person_id,
        CASE
            WHEN SUM(
                LEAST(de.drug_exposure_end_date, CURRENT_DATE)
                - de.drug_exposure_start_date
            ) >= 90 THEN 1
            ELSE 0
        END AS on_glucocorticoid
    FROM {cdmSchema}.drug_exposure de
    INNER JOIN {cdmSchema}.concept_ancestor ca
        ON ca.descendant_concept_id = de.drug_concept_id
    WHERE ca.ancestor_concept_id IN (1551099, 1506270)
    GROUP BY de.person_id
),

-- Rheumatoid arthritis
ra_diag AS (
    SELECT DISTINCT person_id, 1 AS has_ra
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (80809, 4179242)
),

-- Secondary osteoporosis causes: T1DM (201254), COPD (255573), hyperparathyroidism (4115776)
secondary_osteo AS (
    SELECT DISTINCT person_id, 1 AS has_secondary
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (201254, 255573, 4115776, 4064161)
),

-- Low BMD proxy: osteoporosis (80502) = 2 pts, osteopenia (77079) = 1 pt
bmd_proxy AS (
    SELECT
        person_id,
        MAX(CASE
            WHEN condition_concept_id = 80502 THEN 2
            WHEN condition_concept_id = 77079 THEN 1
            ELSE 0
        END) AS bmd_pts
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (80502, 77079)
    GROUP BY person_id
),

-- Smoking
smoking_flag AS (
    SELECT DISTINCT person_id, 1 AS is_smoker
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (436070, 442277)
),

-- Alcohol
alcohol_flag AS (
    SELECT DISTINCT person_id, 1 AS uses_alcohol
    FROM {cdmSchema}.condition_occurrence
    WHERE condition_concept_id IN (433753, 4030541, 196463)
),

frax_scored AS (
    SELECT
        ep.person_id,
        ep.gender_concept_id,
        ep.age,

        -- Age points: 1 if >= 65, 2 if >= 75
        CASE
            WHEN ep.age >= 75 THEN 2
            WHEN ep.age >= 65 THEN 1
            ELSE 0
        END AS pts_age,

        -- Female sex = 1
        CASE WHEN ep.gender_concept_id = 8532 THEN 1 ELSE 0 END AS pts_female,

        -- Prior fracture = 2 pts
        COALESCE(pf.has_fracture, 0) * 2 AS pts_fracture,

        -- Glucocorticoid use = 1 pt
        COALESCE(gc.on_glucocorticoid, 0) AS pts_glucocorticoid,

        -- Rheumatoid arthritis = 1 pt
        COALESCE(ra.has_ra, 0) AS pts_ra,

        -- Secondary osteoporosis = 1 pt
        COALESCE(so.has_secondary, 0) AS pts_secondary,

        -- BMD proxy (0, 1, or 2 pts)
        COALESCE(bmd.bmd_pts, 0) AS pts_bmd,

        -- Smoking = 1 pt
        COALESCE(sf.is_smoker, 0) AS pts_smoking,

        -- Alcohol = 1 pt
        COALESCE(af.uses_alcohol, 0) AS pts_alcohol

    FROM eligible_patients ep
    LEFT JOIN prior_fracture pf      ON pf.person_id = ep.person_id
    LEFT JOIN glucocorticoid_use gc  ON gc.person_id = ep.person_id
    LEFT JOIN ra_diag ra             ON ra.person_id = ep.person_id
    LEFT JOIN secondary_osteo so     ON so.person_id = ep.person_id
    LEFT JOIN bmd_proxy bmd          ON bmd.person_id = ep.person_id
    LEFT JOIN smoking_flag sf        ON sf.person_id = ep.person_id
    LEFT JOIN alcohol_flag af        ON af.person_id = ep.person_id
),

total_scores AS (
    SELECT
        person_id,
        (pts_age + pts_female + pts_fracture + pts_glucocorticoid
            + pts_ra + pts_secondary + pts_bmd + pts_smoking + pts_alcohol
        )::NUMERIC AS score_value,
        -- Confidence: 0.75 baseline (parental history, BMD, country calibration unavailable)
        0.75 AS confidence,
        -- Completeness: all components are condition/drug based (no labs)
        1.0 AS completeness,
        '{}' AS missing_components_json
    FROM frax_scored
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value < 3  THEN 'low'
            WHEN score_value < 6  THEN 'moderate'
            WHEN score_value < 10 THEN 'high'
            ELSE 'very_high'
        END AS risk_tier
    FROM total_scores
),

total_eligible AS (
    SELECT COUNT(DISTINCT person_id) AS n FROM tiered
),

aggregated AS (
    SELECT
        t.risk_tier,
        COUNT(t.person_id)                                                        AS patient_count,
        te.n                                                                       AS total_eligible,
        ROUND(AVG(t.score_value)::NUMERIC, 4)                                     AS mean_score,
        PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY t.score_value)               AS p25_score,
        PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY t.score_value)               AS median_score,
        PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY t.score_value)               AS p75_score,
        ROUND(AVG(t.confidence)::NUMERIC, 4)                                      AS mean_confidence,
        ROUND(AVG(t.completeness)::NUMERIC, 4)                                    AS mean_completeness,
        '{}'                                                                       AS missing_components
    FROM tiered t
    CROSS JOIN total_eligible te
    GROUP BY t.risk_tier, te.n
)

SELECT
    risk_tier,
    patient_count,
    total_eligible,
    mean_score,
    p25_score,
    median_score,
    p75_score,
    mean_confidence,
    mean_completeness,
    missing_components
FROM aggregated
ORDER BY
    CASE risk_tier
        WHEN 'low'       THEN 1
        WHEN 'moderate'  THEN 2
        WHEN 'high'      THEN 3
        WHEN 'very_high' THEN 4
    END;
SQL;
    }
}
