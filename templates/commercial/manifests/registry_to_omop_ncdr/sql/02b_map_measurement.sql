-- Phase 3 Plan 4C Task 4 (T-022C): NCDR hemodynamics -> MEASUREMENT.
-- EF + cardiac index are pre-procedure measurements; one row per
-- value per patient. measurement_date = procedure_date - 1 hour
-- approximation; v0.1 uses procedure_date (no time component on the
-- export). LOINC concept ids:
--   3015241 = Cardiac index
--   3027018 = Heart rate (informational; not in v0.1 column-map)
--   3038553 = Body weight (not in v0.1)
-- For EF we use SNOMED Standard 3027496 (Left ventricular ejection
-- fraction) per OMOP convention.

INSERT INTO ${parameters.cdm_schema}.measurement (
    person_id,
    measurement_concept_id,
    measurement_date,
    measurement_type_concept_id,
    value_as_number,
    measurement_source_value
)
-- LVEF
SELECT
    abs(hashtext(p.patient_id)),
    3027496 AS measurement_concept_id,
    p.procedure_date,
    32861 AS measurement_type_concept_id,
    p.ejection_fraction AS value_as_number,
    'NCDR:HemodynamicEjectionFraction' AS measurement_source_value
FROM ${parameters.source_schema}.fmt_ncdr_pci p

UNION ALL

-- Cardiac index
SELECT
    abs(hashtext(p.patient_id)),
    3015241 AS measurement_concept_id,
    p.procedure_date,
    32861 AS measurement_type_concept_id,
    p.cardiac_index AS value_as_number,
    'NCDR:HemodynamicCardiacIndex' AS measurement_source_value
FROM ${parameters.source_schema}.fmt_ncdr_pci p;
