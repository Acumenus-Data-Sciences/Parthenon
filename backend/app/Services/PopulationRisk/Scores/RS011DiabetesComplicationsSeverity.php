<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS011DiabetesComplicationsSeverity implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS011';
    }

    public function scoreName(): string
    {
        return 'Diabetes Complications Severity Index (DCSI)';
    }

    public function category(): string
    {
        return 'Endocrine';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with diabetes mellitus';
    }

    public function description(): string
    {
        return 'DCSI measures severity of diabetes-related complications across 7 domains: '
            . 'retinopathy, nephropathy, neuropathy, peripheral vascular disease, cardiovascular disease, '
            . 'cerebrovascular disease, and metabolic complications. Each domain contributes 1-2 points '
            . 'based on severity, with a maximum possible score of 13. Higher scores indicate greater '
            . 'complication burden. All components are derived from condition_occurrence records. '
            . 'Confidence is set to 0.80 baseline to reflect potential under-coding of diabetes complications.';
    }

    public function requiredComponents(): array
    {
        return [
            'diabetes_diagnosis',
            'retinopathy',
            'nephropathy',
            'neuropathy',
            'pvd',
            'cvd',
            'cerebrovascular',
            'metabolic_complication',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'no_complications' => [0, 1],
            'mild'             => [1, 4],
            'moderate'         => [4, 7],
            'severe'           => [7, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH diabetic_patients AS (
    SELECT DISTINCT p.person_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {cdmSchema}.person p
    INNER JOIN {cdmSchema}.condition_occurrence co
        ON co.person_id = p.person_id
        AND co.condition_concept_id IN (201826, 201254, 443238, 4193704)
),

complication_flags AS (
    SELECT
        dp.person_id,

        -- Retinopathy: 1 pt if any diabetic retinopathy present
        MAX(CASE WHEN co.condition_concept_id IN (379019, 4174977) THEN 1 ELSE 0 END) AS retinopathy_pts,

        -- Nephropathy: 2 pts for renal failure/CKD stage 4-5, 1 pt for CKD stage 1-3 or proteinuria
        CASE
            WHEN MAX(CASE WHEN co.condition_concept_id IN (443601) THEN 1 ELSE 0 END) = 1 THEN 2
            WHEN MAX(CASE WHEN co.condition_concept_id IN (443614, 4030518) THEN 1 ELSE 0 END) = 1 THEN 1
            ELSE 0
        END AS nephropathy_pts,

        -- Neuropathy: 1 pt if peripheral neuropathy present; 2 pt if stroke-level involvement
        CASE
            WHEN MAX(CASE WHEN co.condition_concept_id IN (443454) THEN 1 ELSE 0 END) = 1 THEN 2
            WHEN MAX(CASE WHEN co.condition_concept_id IN (4011630) THEN 1 ELSE 0 END) = 1 THEN 1
            ELSE 0
        END AS neuropathy_pts,

        -- PVD: 2 pts for amputation-level, 1 pt for PVD diagnosis
        CASE
            WHEN MAX(CASE WHEN co.condition_concept_id IN (443238) THEN 1 ELSE 0 END) = 1
              AND MAX(CASE WHEN co.condition_concept_id IN (4185932) THEN 1 ELSE 0 END) = 1 THEN 2
            WHEN MAX(CASE WHEN co.condition_concept_id IN (4185932) THEN 1 ELSE 0 END) = 1 THEN 1
            ELSE 0
        END AS pvd_pts,

        -- CVD: 2 pts for MI, 1 pt for angina
        CASE
            WHEN MAX(CASE WHEN co.condition_concept_id IN (312327) THEN 1 ELSE 0 END) = 1 THEN 2
            WHEN MAX(CASE WHEN co.condition_concept_id IN (315286) THEN 1 ELSE 0 END) = 1 THEN 1
            ELSE 0
        END AS cvd_pts,

        -- Cerebrovascular: 2 pts for stroke, 1 pt for TIA
        CASE
            WHEN MAX(CASE WHEN co.condition_concept_id IN (443454) THEN 1 ELSE 0 END) = 1 THEN 2
            WHEN MAX(CASE WHEN co.condition_concept_id IN (4110192) THEN 1 ELSE 0 END) = 1 THEN 1
            ELSE 0
        END AS cerebrovascular_pts,

        -- Metabolic: 1 pt for DKA
        MAX(CASE WHEN co.condition_concept_id IN (4096682) THEN 1 ELSE 0 END) AS metabolic_pts

    FROM diabetic_patients dp
    LEFT JOIN {cdmSchema}.condition_occurrence co
        ON co.person_id = dp.person_id
    GROUP BY dp.person_id
),

scored AS (
    SELECT
        person_id,
        (retinopathy_pts + nephropathy_pts + neuropathy_pts + pvd_pts
            + cvd_pts + cerebrovascular_pts + metabolic_pts) AS score_value,
        -- Confidence: 0.80 baseline for condition-based coding
        0.80 AS confidence,
        -- Completeness: all domains are condition-based, no labs missing
        1.0 AS completeness,
        -- Missing components JSON: no labs required
        '{}' AS missing_components_json
    FROM complication_flags
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value < 1  THEN 'no_complications'
            WHEN score_value < 4  THEN 'mild'
            WHEN score_value < 7  THEN 'moderate'
            ELSE 'severe'
        END AS risk_tier
    FROM scored
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
        '{}' AS missing_components
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
        WHEN 'no_complications' THEN 1
        WHEN 'mild'             THEN 2
        WHEN 'moderate'         THEN 3
        WHEN 'severe'           THEN 4
    END;
SQL;
    }
}
