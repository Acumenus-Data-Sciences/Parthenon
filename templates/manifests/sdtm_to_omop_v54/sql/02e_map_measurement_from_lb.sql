-- Phase 2 Plan 6 Task 11: LB → MEASUREMENT.
-- Same pattern as VS, plus LBORNRLO/LBORNRHI → range_low/range_high.

INSERT INTO ${parameters.cdm_schema}.measurement (
    person_id,
    measurement_concept_id,
    measurement_date,
    measurement_type_concept_id,
    value_as_number,
    unit_concept_id,
    range_low,
    range_high,
    measurement_source_value,
    unit_source_value,
    value_source_value
)
SELECT
    p.person_id,
    COALESCE(c.concept_id, 0) AS measurement_concept_id,
    NULLIF(lb.LBDTC, '')::DATE AS measurement_date,
    32856 AS measurement_type_concept_id,
    NULLIF(REGEXP_REPLACE(lb.LBORRES, '[^0-9.\-]', '', 'g'), '')::NUMERIC AS value_as_number,
    COALESCE(
        (SELECT concept_id FROM ${parameters.vocab_schema}.concept
         WHERE vocabulary_id = 'UCUM' AND concept_code = lb.LBORRESU LIMIT 1),
        0
    ) AS unit_concept_id,
    NULLIF(lb.LBORNRLO, '')::NUMERIC AS range_low,
    NULLIF(lb.LBORNRHI, '')::NUMERIC AS range_high,
    lb.LBTESTCD AS measurement_source_value,
    lb.LBORRESU AS unit_source_value,
    lb.LBORRES AS value_source_value
FROM sdtm_source.fmt_lb lb
JOIN ${parameters.cdm_schema}.person p ON p.person_source_value = lb.USUBJID
LEFT JOIN ${parameters.vocab_schema}.concept c
    ON c.vocabulary_id = 'LOINC'
    AND c.concept_name ILIKE lb.LBTEST
    AND c.standard_concept = 'S'
WHERE NULLIF(lb.LBDTC, '') IS NOT NULL;
