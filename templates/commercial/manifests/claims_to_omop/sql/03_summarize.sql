-- Phase 3 Plan 1 Task 9: claims_to_omop summary artifact.
--
-- Returned to the runner as ``claims_to_omop_summary.json``. Reports
-- claim / line / visit / procedure / condition / cost row counts plus
-- the count of UNMAPPED concept IDs (concept_id = 0 means the
-- vocabulary join failed). The post_conditions in manifest.yaml gate
-- the run on summary.min_rows = 1.

SELECT
    (SELECT COUNT(*) FROM ${parameters.source_schema}.fmt_837_claim) AS source_claims,
    (SELECT COUNT(*) FROM ${parameters.source_schema}.fmt_837_line)  AS source_lines,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.visit_occurrence) AS visits,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.procedure_occurrence) AS procedures,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence) AS conditions,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.cost) AS cost_rows,
    (
        SELECT COUNT(*) FROM ${parameters.cdm_schema}.procedure_occurrence
        WHERE procedure_concept_id = 0
    ) AS unmapped_procedures,
    (
        SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence
        WHERE condition_concept_id = 0
    ) AS unmapped_conditions;
