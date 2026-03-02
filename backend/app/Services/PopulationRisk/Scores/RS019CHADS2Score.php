<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS019CHADS2Score implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS019';
    }

    public function scoreName(): string
    {
        return 'CHADS₂ Score (Stroke Risk in AF)';
    }

    public function category(): string
    {
        return 'Cardiovascular';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with atrial fibrillation';
    }

    public function description(): string
    {
        return 'CHADS₂ Score estimates annual stroke risk in patients with non-valvular atrial fibrillation. '
            . 'Components: C=Congestive heart failure (1 pt), H=Hypertension (1 pt), A=Age ≥75 (1 pt), '
            . 'D=Diabetes mellitus (1 pt), S₂=Prior stroke or TIA (2 pts). Maximum score 6. '
            . 'Approximate annual stroke rates by score: 0→1.9%, 1→2.8%, 2→4.0%, 3→5.9%, 4→8.5%, '
            . '5→12.5%, 6→18.2%. All components are derived from structured condition_occurrence data. '
            . 'Confidence is set to 0.85 as a baseline acknowledging potential under-coding of conditions. '
            . 'No laboratory components are required. Eligible population: patients with AF diagnosis (313217).';
    }

    public function requiredComponents(): array
    {
        return [
            'af_diagnosis',
            'heart_failure',
            'hypertension',
            'age',
            'diabetes',
            'stroke_tia',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low'      => [0, 1],
            'moderate' => [1, 2],
            'high'     => [2, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH af_patients AS (
    SELECT DISTINCT
        p.person_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {cdmSchema}.person p
    INNER JOIN {cdmSchema}.condition_occurrence co
        ON co.person_id = p.person_id
        AND co.condition_concept_id = 313217
),

chads2_flags AS (
    SELECT
        ap.person_id,
        ap.age,

        -- C: Congestive heart failure
        MAX(CASE WHEN co.condition_concept_id IN (316139, 314378, 4229440) THEN 1 ELSE 0 END) AS has_chf,

        -- H: Hypertension
        MAX(CASE WHEN co.condition_concept_id = 316866 THEN 1 ELSE 0 END) AS has_htn,

        -- D: Diabetes mellitus
        MAX(CASE WHEN co.condition_concept_id IN (201826, 201254, 443238) THEN 1 ELSE 0 END) AS has_dm,

        -- S2: Prior stroke or TIA (2 pts)
        MAX(CASE WHEN co.condition_concept_id IN (443454, 4110192, 375557, 439847) THEN 1 ELSE 0 END) AS has_stroke

    FROM af_patients ap
    LEFT JOIN {cdmSchema}.condition_occurrence co
        ON co.person_id = ap.person_id
    GROUP BY ap.person_id, ap.age
),

scored AS (
    SELECT
        person_id,
        age,
        has_chf,
        has_htn,
        has_dm,
        has_stroke,
        -- CHADS2 score
        (has_chf
         + has_htn
         + CASE WHEN age >= 75 THEN 1 ELSE 0 END
         + has_dm
         + has_stroke * 2
        )::NUMERIC AS score_value,
        -- Confidence: 0.85 baseline for condition-coded data (no labs)
        0.85 AS confidence,
        -- Completeness: all components are condition-based, no labs to miss
        1.0 AS completeness,
        '{}' AS missing_components_json
    FROM chads2_flags
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value < 1  THEN 'low'
            WHEN score_value < 2  THEN 'moderate'
            ELSE 'high'
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
        WHEN 'low'      THEN 1
        WHEN 'moderate' THEN 2
        WHEN 'high'     THEN 3
    END;
SQL;
    }
}
