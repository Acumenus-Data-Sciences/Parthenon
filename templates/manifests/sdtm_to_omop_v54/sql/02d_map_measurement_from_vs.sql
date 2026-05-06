-- Phase 2 Plan 6 Task 10: VS → MEASUREMENT.
-- VSTESTCD (e.g., 'SYSBP', 'DIABP', 'PULSE', 'TEMP') → LOINC concept_id via lookup.
-- VSORRES → value_as_number; VSORRESU → unit_concept_id (UCUM).

INSERT INTO ${parameters.cdm_schema}.measurement (
    person_id,
    measurement_concept_id,
    measurement_date,
    measurement_type_concept_id,
    value_as_number,
    unit_concept_id,
    measurement_source_value,
    unit_source_value,
    value_source_value
)
SELECT
    p.person_id,
    COALESCE(c.concept_id, 0) AS measurement_concept_id,
    NULLIF(v.VSDTC, '')::DATE AS measurement_date,
    32856 AS measurement_type_concept_id,
    NULLIF(REGEXP_REPLACE(v.VSORRES, '[^0-9.\-]', '', 'g'), '')::NUMERIC AS value_as_number,
    COALESCE(
        (SELECT concept_id FROM ${parameters.vocab_schema}.concept
         WHERE vocabulary_id = 'UCUM' AND concept_code = v.VSORRESU LIMIT 1),
        0
    ) AS unit_concept_id,
    v.VSTESTCD AS measurement_source_value,
    v.VSORRESU AS unit_source_value,
    v.VSORRES AS value_source_value
FROM sdtm_source.fmt_vs v
JOIN ${parameters.cdm_schema}.person p ON p.person_source_value = v.USUBJID
LEFT JOIN ${parameters.vocab_schema}.concept c
    ON c.vocabulary_id = 'LOINC'
    AND (c.concept_code ILIKE v.VSTESTCD || '%' OR c.concept_name ILIKE v.VSTEST)
    AND c.standard_concept = 'S'
WHERE NULLIF(v.VSDTC, '') IS NOT NULL;
