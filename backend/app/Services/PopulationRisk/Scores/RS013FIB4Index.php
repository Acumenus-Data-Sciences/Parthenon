<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS013FIB4Index implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS013';
    }

    public function scoreName(): string
    {
        return 'FIB-4 Hepatic Fibrosis Index';
    }

    public function category(): string
    {
        return 'Hepatic';
    }

    public function eligiblePopulation(): string
    {
        return 'Patients with chronic liver disease or metabolic risk factors';
    }

    public function description(): string
    {
        return 'FIB-4 = (Age × AST [U/L]) / (Platelet count [10⁹/L] × √ALT [U/L]). '
            .'A non-invasive index for estimating hepatic fibrosis severity. '
            .'Eligible patients are those with at least AST and ALT measurements available '
            .'(broad inclusion as a screening tool). Standard thresholds: <1.30 low risk (F0-F1), '
            .'1.30–2.67 indeterminate, >2.67 high risk (F3-F4). '
            .'All three labs (AST, ALT, platelets) are required for computation; '
            .'patients missing any are still included but assigned to low tier with reduced confidence. '
            .'Confidence reflects the fraction of the three required labs that are available.';
    }

    public function requiredComponents(): array
    {
        return [
            'age',
            'ast',
            'alt',
            'platelets',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'low' => [null, 1.3],
            'indeterminate' => [1.3, 2.67],
            'high' => [2.67, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'measurement'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH adult_patients AS (
    SELECT
        p.person_id,
        EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth AS age
    FROM {@cdmSchema}.person p
    WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) >= 18
),

-- Most recent AST (concept 3013721, LOINC 1920-8), U/L
latest_ast AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS ast_ul
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3013721
      AND value_as_number IS NOT NULL
      AND value_as_number > 0
    ORDER BY person_id, measurement_date DESC
),

-- Most recent ALT (concept 3006923, LOINC 1742-6), U/L
latest_alt AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS alt_ul
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3006923
      AND value_as_number IS NOT NULL
      AND value_as_number > 0
    ORDER BY person_id, measurement_date DESC
),

-- Most recent platelet count (concept 3024929, LOINC 777-3), 10⁹/L
latest_plt AS (
    SELECT DISTINCT ON (person_id)
        person_id,
        value_as_number AS plt_bil
    FROM {@cdmSchema}.measurement
    WHERE measurement_concept_id = 3024929
      AND value_as_number IS NOT NULL
      AND value_as_number > 0
    ORDER BY person_id, measurement_date DESC
),

-- Restrict to patients with at least AST + ALT available (broad screening inclusion)
eligible AS (
    SELECT ap.person_id, ap.age
    FROM adult_patients ap
    INNER JOIN latest_ast ast ON ast.person_id = ap.person_id
    INNER JOIN latest_alt alt ON alt.person_id = ap.person_id
),

labs_joined AS (
    SELECT
        e.person_id,
        e.age,
        ast.ast_ul,
        alt.alt_ul,
        plt.plt_bil,
        (CASE WHEN ast.ast_ul IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN alt.alt_ul IS NOT NULL THEN 1 ELSE 0 END
         + CASE WHEN plt.plt_bil IS NOT NULL THEN 1 ELSE 0 END) AS available_labs
    FROM eligible e
    LEFT JOIN latest_ast ast ON ast.person_id = e.person_id
    LEFT JOIN latest_alt alt ON alt.person_id = e.person_id
    LEFT JOIN latest_plt plt ON plt.person_id = e.person_id
),

scored AS (
    SELECT
        person_id,
        age,
        ast_ul,
        alt_ul,
        plt_bil,
        available_labs,
        -- FIB-4 = (age × AST) / (platelets × SQRT(ALT))
        CASE
            WHEN ast_ul IS NOT NULL
              AND alt_ul IS NOT NULL
              AND plt_bil IS NOT NULL
              AND plt_bil > 0
              AND alt_ul > 0
            THEN ROUND(
                ((age * ast_ul) / (plt_bil * SQRT(alt_ul)))::NUMERIC,
                4
            )
            ELSE NULL
        END AS score_value,
        ROUND((available_labs::NUMERIC / 3.0), 4) AS confidence,
        ROUND((available_labs::NUMERIC / 3.0), 4) AS completeness,
        '{"ast":' || (CASE WHEN ast_ul IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"alt":' || (CASE WHEN alt_ul IS NULL THEN 1 ELSE 0 END)::TEXT
        || ',"platelets":' || (CASE WHEN plt_bil IS NULL THEN 1 ELSE 0 END)::TEXT
        || '}' AS missing_components_json
    FROM labs_joined
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value IS NULL  THEN 'low'
            WHEN score_value < 1.30   THEN 'low'
            WHEN score_value <= 2.67  THEN 'indeterminate'
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
        '{"ast":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"ast":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"alt":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"alt":1%' THEN 1 ELSE 0 END)::TEXT
            || ',"platelets":'
            || SUM(CASE WHEN t.missing_components_json LIKE '%"platelets":1%' THEN 1 ELSE 0 END)::TEXT
            || '}'                                                                 AS missing_components
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
        WHEN 'low'           THEN 1
        WHEN 'indeterminate' THEN 2
        WHEN 'high'          THEN 3
    END;
SQL;
    }
}
