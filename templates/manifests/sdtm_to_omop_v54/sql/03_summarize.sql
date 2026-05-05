-- Phase 2 Plan 6 Task 12 (summarize step): row counts for E2E verification.

SELECT
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.person) AS persons,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.location) AS locations,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.condition_occurrence) AS conditions,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.drug_exposure) AS drug_exposures,
    (SELECT COUNT(*) FROM ${parameters.cdm_schema}.measurement) AS measurements;
