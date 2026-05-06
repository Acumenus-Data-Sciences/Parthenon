-- Phase 3 Plan 4B Task 7 (T-022B): summary query for the post-condition.

SELECT
    (SELECT COUNT(*) FROM ${parameters.source_schema}.fmt_sts_surgery) AS sts_records,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.procedure_occurrence) AS procedure_occurrence_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence) AS condition_occurrence_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.episode) AS episode_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.procedure_occurrence WHERE procedure_concept_id = 0)
        AS unmapped_procedure_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence WHERE condition_concept_id = 0)
        AS unmapped_condition_rows;
