-- Phase 2 Plan 4 Task 14: SUMMARIZE — emit per-CDM-table row counts.
-- The validation pack at validation/expected/post_conditions.yaml carries
-- the ±2% acceptance threshold against the OHDSI demo reference numbers.

SELECT
    (SELECT COUNT(*) FROM ${parameters.target_schema}.person) AS persons,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.death) AS deaths,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.visit_occurrence) AS visits,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.visit_detail) AS visit_details,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.condition_occurrence) AS conditions,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.procedure_occurrence) AS procedures,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.measurement) AS measurements,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.drug_exposure) AS drug_exposures,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.observation) AS observations,
    (SELECT COUNT(*) FROM ${parameters.target_schema}.note) AS notes;
