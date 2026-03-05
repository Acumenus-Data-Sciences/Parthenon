<?php

namespace App\Services\ClinicalCoherence\Analyses;

use App\Contracts\ClinicalCoherenceAnalysisInterface;

/**
 * CC005 – Lab Value Clinical Plausibility
 *
 * Detects measurement values that fall outside physiologically possible ranges.
 * Uses standard LOINC concept IDs as mapped in OMOP vocabulary:
 *
 *  3027018 – Heart rate (LOINC 8867-4)
 *  3004249 – Systolic blood pressure (LOINC 8480-6)
 *  3012888 – Diastolic blood pressure (LOINC 8462-4)
 *  3023166 – Body weight (LOINC 29463-7)
 *  3036277 – Body height (LOINC 8302-2)
 *  3038553 – BMI (LOINC 39156-5)
 *  3000963 – Hemoglobin [Mass/volume] in Blood (LOINC 718-7)
 *  3016723 – Creatinine [Mass/volume] in Serum (LOINC 2160-0)
 *  3004501 – Glucose [Mass/volume] in Serum (LOINC 2345-7)
 *  3013682 – Body temperature (LOINC 8310-5)
 *  3019900 – Respiratory rate (LOINC 9279-1)
 *  3027801 – Oxygen saturation (LOINC 2708-6)
 */
class CC005LabValuePlausibility implements ClinicalCoherenceAnalysisInterface
{
    public function analysisId(): string
    {
        return 'CC005';
    }

    public function analysisName(): string
    {
        return 'Lab Value Clinical Plausibility';
    }

    public function category(): string
    {
        return 'Measurement Quality';
    }

    public function description(): string
    {
        return 'Identifies measurement values that fall outside physiologically possible ranges for common vital signs and laboratory tests (e.g. heart rate = 0, hemoglobin > 25 g/dL).';
    }

    public function severity(): string
    {
        return 'critical';
    }

    public function flagThreshold(): ?float
    {
        return 0.01;
    } // flag if >1% of values are impossible

    public function requiredTables(): array
    {
        return ['measurement', 'concept'];
    }

    public function sqlTemplate(): string
    {
        return <<<'SQL'
            WITH bounds AS (
                SELECT concept_id, lo, hi, label
                FROM (VALUES
                    (3027018,    1,  300, 'Heart rate: valid 1–300 bpm'),
                    (3004249,   40,  300, 'Systolic BP: valid 40–300 mmHg'),
                    (3012888,   20,  200, 'Diastolic BP: valid 20–200 mmHg'),
                    (3023166,    1,  700, 'Body weight: valid 1–700 kg'),
                    (3036277,   20,  300, 'Body height: valid 20–300 cm'),
                    (3038553,    5,  200, 'BMI: valid 5–200 kg/m²'),
                    (3000963,    1,   25, 'Hemoglobin: valid 1–25 g/dL'),
                    (3016723,  0.1,   25, 'Creatinine: valid 0.1–25 mg/dL'),
                    (3004501,   20, 1500, 'Glucose: valid 20–1500 mg/dL'),
                    (3013682,   25,   45, 'Body temperature: valid 25–45 °C'),
                    (3019900,    1,   80, 'Respiratory rate: valid 1–80 /min'),
                    (3027801,   50,  100, 'O₂ saturation: valid 50–100 %')
                ) AS t(concept_id, lo, hi, label)
            ),
            impossible AS (
                SELECT
                    m.measurement_concept_id,
                    c.concept_name,
                    b.label                                     AS violation_type,
                    COUNT(*)                                    AS impossible_count,
                    SUM(COUNT(*)) OVER (
                        PARTITION BY m.measurement_concept_id
                    )                                           AS total_for_concept
                FROM {@cdmSchema}.measurement m
                JOIN bounds b ON m.measurement_concept_id = b.concept_id
                JOIN {@cdmSchema}.concept c ON m.measurement_concept_id = c.concept_id
                WHERE m.value_as_number IS NOT NULL
                  AND (m.value_as_number < b.lo OR m.value_as_number > b.hi)
                GROUP BY m.measurement_concept_id, c.concept_name, b.label
            )
            SELECT
                'impossible_value'                              AS stratum_1,
                CAST(i.measurement_concept_id AS VARCHAR(255)) AS stratum_2,
                i.concept_name                                  AS stratum_3,
                i.impossible_count                              AS count_value,
                i.total_for_concept                             AS total_value,
                ROUND(
                    CAST(i.impossible_count AS NUMERIC) /
                    NULLIF(i.total_for_concept, 0),
                    6
                )                                               AS ratio_value,
                i.violation_type                                AS notes
            FROM impossible i
            WHERE i.impossible_count > 0
            ORDER BY ratio_value DESC
            SQL;
    }
}
