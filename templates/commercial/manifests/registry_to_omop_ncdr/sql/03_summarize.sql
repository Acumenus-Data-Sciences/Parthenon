-- Phase 3 Plan 4C Task 7 (T-022C): summary post-condition artifact.

SELECT
    (SELECT COUNT(*) FROM ${parameters.source_schema}.fmt_ncdr_pci) AS ncdr_records,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.procedure_occurrence) AS procedure_occurrence_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.measurement) AS measurement_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.device_exposure) AS device_exposure_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence) AS condition_occurrence_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.episode) AS episode_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.procedure_occurrence WHERE procedure_concept_id = 0)
        AS unmapped_procedure_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.device_exposure WHERE device_concept_id = 0)
        AS unmapped_device_rows;
