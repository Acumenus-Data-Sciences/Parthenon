-- Phase 3 Plan 4A Task 6 (T-022A): summary query for the registry_to_omop_naaccr post-condition.
--
-- Materializes one JSON artifact carrying the row counts the validation
-- pack (Task 8) checks against.

SELECT
    (SELECT COUNT(*) FROM ${parameters.source_schema}.fmt_naaccr_record) AS naaccr_records,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence) AS condition_occurrence_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.episode) AS episode_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.episode_event) AS episode_event_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.episode WHERE episode_object_concept_id = 0)
        AS unmapped_episode_rows,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence WHERE condition_concept_id = 0)
        AS unmapped_condition_rows;
