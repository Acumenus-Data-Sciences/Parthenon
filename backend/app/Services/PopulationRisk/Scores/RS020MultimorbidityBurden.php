<?php

namespace App\Services\PopulationRisk\Scores;

use App\Contracts\PopulationRiskScoreInterface;

class RS020MultimorbidityBurden implements PopulationRiskScoreInterface
{
    public function scoreId(): string
    {
        return 'RS020';
    }

    public function scoreName(): string
    {
        return 'Multimorbidity Burden Index';
    }

    public function category(): string
    {
        return 'Comorbidity Burden';
    }

    public function eligiblePopulation(): string
    {
        return 'All adult patients (≥18)';
    }

    public function description(): string
    {
        return 'Counts the number of distinct chronic condition domains (out of 20) that a patient has '
            .'at least one condition in. Domains span: cardiovascular, cerebrovascular, respiratory, '
            .'metabolic, renal, hepatic, musculoskeletal, mental health, cancer, neurological, '
            .'hematologic, gastrointestinal, endocrine, infectious, peripheral vascular, chronic pain, '
            .'sleep disorders, sensory, urological, and dermatological. Each domain is binary (0/1). '
            .'Score 0-20 reflects the breadth of chronic disease burden across organ systems. '
            .'Confidence is set to 0.75 as a baseline reflecting chronic condition under-coding, '
            .'especially for less severe or specialist-managed conditions. No labs required.';
    }

    public function requiredComponents(): array
    {
        return [
            'cardiovascular',
            'cerebrovascular',
            'respiratory',
            'metabolic',
            'renal',
            'hepatic',
            'musculoskeletal',
            'mental_health',
            'cancer',
            'neurological',
        ];
    }

    public function riskTiers(): array
    {
        return [
            'no_multimorbidity' => [0, 1],
            'low' => [1, 3],
            'moderate' => [3, 6],
            'high' => [6, 10],
            'very_high' => [10, null],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
WITH adult_patients AS (
    SELECT
        p.person_id
    FROM {@cdmSchema}.person p
    WHERE (EXTRACT(YEAR FROM CURRENT_DATE) - p.year_of_birth) >= 18
),

condition_flags AS (
    SELECT
        ap.person_id,

        -- Domain 1: Cardiovascular (MI, CHF, AF, HTN, angina, cardiomyopathy)
        MAX(CASE WHEN co.condition_concept_id IN (
            312327, 316139, 314378, 313217, 316866, 315286, 4108832, 4228901,
            4305831, 432867
        ) THEN 1 ELSE 0 END) AS dom_cardiovascular,

        -- Domain 2: Cerebrovascular (stroke, TIA, intracranial hemorrhage)
        MAX(CASE WHEN co.condition_concept_id IN (
            443454, 4110192, 375557, 439847, 4148906, 432923, 4168001
        ) THEN 1 ELSE 0 END) AS dom_cerebrovascular,

        -- Domain 3: Respiratory (COPD, asthma, pulmonary fibrosis, bronchiectasis)
        MAX(CASE WHEN co.condition_concept_id IN (
            255573, 317009, 4063381, 4132811, 4051466, 256448
        ) THEN 1 ELSE 0 END) AS dom_respiratory,

        -- Domain 4: Metabolic (DM type 1&2, obesity, metabolic syndrome, gout)
        MAX(CASE WHEN co.condition_concept_id IN (
            201826, 201254, 443238, 433736, 436583, 4119134, 4193704, 195590
        ) THEN 1 ELSE 0 END) AS dom_metabolic,

        -- Domain 5: Renal (CKD, ESRD, renal failure, nephrotic syndrome)
        MAX(CASE WHEN co.condition_concept_id IN (
            443614, 443601, 4030518, 197320, 192359, 435515, 4307440
        ) THEN 1 ELSE 0 END) AS dom_renal,

        -- Domain 6: Hepatic (cirrhosis, liver disease, viral hepatitis, NAFLD)
        MAX(CASE WHEN co.condition_concept_id IN (
            4064161, 197508, 4195780, 196262, 194990, 4212540, 4245975
        ) THEN 1 ELSE 0 END) AS dom_hepatic,

        -- Domain 7: Musculoskeletal (RA, OA, osteoporosis, ankylosing spondylitis, gout)
        MAX(CASE WHEN co.condition_concept_id IN (
            80809, 4044250, 80502, 77079, 433734, 73560, 81943
        ) THEN 1 ELSE 0 END) AS dom_musculoskeletal,

        -- Domain 8: Mental health (depression, anxiety, bipolar, psychosis, schizophrenia)
        MAX(CASE WHEN co.condition_concept_id IN (
            438409, 432867, 436096, 4282096, 4154290, 444100, 4340386,
            373921, 4263377, 432876
        ) THEN 1 ELSE 0 END) AS dom_mental_health,

        -- Domain 9: Cancer (any malignancy — using broad OMOP oncology concepts)
        MAX(CASE WHEN co.condition_concept_id IN (
            4111921, 443392, 4103769, 40486433, 40491316, 4338805, 197508,
            434327, 4180790, 40486925, 4180783, 432851, 4111921
        ) THEN 1 ELSE 0 END) AS dom_cancer,

        -- Domain 10: Neurological (dementia, PD, MS, epilepsy, ALS, neuropathy)
        MAX(CASE WHEN co.condition_concept_id IN (
            374919, 4182210, 374919, 4110192, 375258, 376065, 443454,
            4011630, 381270, 4213398, 4249003
        ) THEN 1 ELSE 0 END) AS dom_neurological,

        -- Domain 11: Hematologic (anemia, coagulation disorders, thrombocytopenia)
        MAX(CASE WHEN co.condition_concept_id IN (
            439777, 4281417, 432570, 4228101, 436956, 443390, 432572
        ) THEN 1 ELSE 0 END) AS dom_hematologic,

        -- Domain 12: Gastrointestinal (IBD, Crohn's, UC, PUD, GERD, diverticulosis)
        MAX(CASE WHEN co.condition_concept_id IN (
            80809, 81893, 201606, 192671, 4170143, 4270024, 198799,
            200219, 4056270, 444413
        ) THEN 1 ELSE 0 END) AS dom_gastrointestinal,

        -- Domain 13: Endocrine (thyroid disorders, adrenal disorders, pituitary)
        MAX(CASE WHEN co.condition_concept_id IN (
            4115776, 4058702, 40480893, 437541, 4218381, 4058383, 36714927,
            4149843, 374184
        ) THEN 1 ELSE 0 END) AS dom_endocrine,

        -- Domain 14: Infectious chronic (HIV, hepatitis B/C, TB, chronic osteomyelitis)
        MAX(CASE WHEN co.condition_concept_id IN (
            439727, 196262, 194990, 434621, 4062163, 40480893, 441542
        ) THEN 1 ELSE 0 END) AS dom_infectious,

        -- Domain 15: Peripheral vascular (PVD, PAD, claudication, varicose veins)
        MAX(CASE WHEN co.condition_concept_id IN (
            4185932, 443238, 4130920, 321052, 40481989, 4166231
        ) THEN 1 ELSE 0 END) AS dom_peripheral_vascular,

        -- Domain 16: Chronic pain (fibromyalgia, chronic back pain, neuropathic pain)
        MAX(CASE WHEN co.condition_concept_id IN (
            434203, 4115276, 4108116, 134736, 81151, 4285732
        ) THEN 1 ELSE 0 END) AS dom_chronic_pain,

        -- Domain 17: Sleep disorders (sleep apnea, insomnia, hypersomnia, narcolepsy)
        MAX(CASE WHEN co.condition_concept_id IN (
            40480893, 4215376, 436962, 4163735, 374996, 4173837
        ) THEN 1 ELSE 0 END) AS dom_sleep,

        -- Domain 18: Sensory (blindness, low vision, deafness, hearing loss)
        MAX(CASE WHEN co.condition_concept_id IN (
            379019, 374035, 373994, 432553, 377526, 437523, 4064547
        ) THEN 1 ELSE 0 END) AS dom_sensory,

        -- Domain 19: Urological (BPH, chronic urinary incontinence, neurogenic bladder)
        MAX(CASE WHEN co.condition_concept_id IN (
            194997, 192671, 199192, 4201028, 4296651, 4279605
        ) THEN 1 ELSE 0 END) AS dom_urological,

        -- Domain 20: Dermatological (psoriasis, eczema, chronic wound, alopecia areata)
        MAX(CASE WHEN co.condition_concept_id IN (
            200971, 317009, 4152280, 141095, 136831, 4183510
        ) THEN 1 ELSE 0 END) AS dom_dermatological

    FROM adult_patients ap
    LEFT JOIN {@cdmSchema}.condition_occurrence co
        ON co.person_id = ap.person_id
    GROUP BY ap.person_id
),

scored AS (
    SELECT
        person_id,
        (
            dom_cardiovascular
            + dom_cerebrovascular
            + dom_respiratory
            + dom_metabolic
            + dom_renal
            + dom_hepatic
            + dom_musculoskeletal
            + dom_mental_health
            + dom_cancer
            + dom_neurological
            + dom_hematologic
            + dom_gastrointestinal
            + dom_endocrine
            + dom_infectious
            + dom_peripheral_vascular
            + dom_chronic_pain
            + dom_sleep
            + dom_sensory
            + dom_urological
            + dom_dermatological
        )::NUMERIC AS score_value,
        -- Confidence: 0.75 baseline acknowledging condition under-coding
        0.75 AS confidence,
        -- Completeness: all from structured condition data
        1.0 AS completeness,
        '{}' AS missing_components_json
    FROM condition_flags
),

tiered AS (
    SELECT
        person_id,
        score_value,
        confidence,
        completeness,
        missing_components_json,
        CASE
            WHEN score_value < 1  THEN 'no_multimorbidity'
            WHEN score_value < 3  THEN 'low'
            WHEN score_value < 6  THEN 'moderate'
            WHEN score_value < 10 THEN 'high'
            ELSE 'very_high'
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
        WHEN 'no_multimorbidity' THEN 1
        WHEN 'low'               THEN 2
        WHEN 'moderate'          THEN 3
        WHEN 'high'              THEN 4
        WHEN 'very_high'         THEN 5
    END;
SQL;
    }
}
