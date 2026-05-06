-- Phase 3 Plan 4A Task 4 (T-022A): NAACCR treatments -> EPISODE_EVENT.
--
-- Ported from OHDSI/CdmEtlNaaccr (Apache-2.0). Each non-NULL treatment
-- summary item (surgery / chemo / radiation / hormone) produces one
-- EPISODE_EVENT row keyed to the corresponding EPISODE via
-- episode_parent_id (resolved by joining on episode_source_value).
--
-- The Oncology Extension uses event_field_concept_id to identify which
-- table the event_id points at:
--   - 38000175 = procedure_occurrence (surgery / radiation)
--   - 38000179 = drug_exposure         (chemo / hormone)
--
-- For v0.1 we don't allocate procedure_occurrence_id / drug_exposure_id
-- — those staging tables come with the lis_lab_to_omop and
-- claims_to_omop pipelines, not the registry pipeline. The
-- EPISODE_EVENT row carries event_id=0 with the source code in
-- event_field_concept_id, exactly mirroring OHDSI's NAACCR ETL
-- behavior. Phase 4 will populate event_id once the cross-template
-- staging table lands.

WITH episode_lookup AS (
    SELECT
        e.episode_id,
        r.id AS naaccr_record_id,
        r.patient_id_number,
        r.tumor_record_number,
        r.date_of_diagnosis,
        r.rx_summary_surgery,
        r.rx_summary_chemo,
        r.rx_summary_radiation,
        r.rx_summary_hormone
    FROM ${parameters.source_schema}.fmt_naaccr_record r
    JOIN ${parameters.cdm_schema}.episode e
        ON e.person_id = abs(hashtext(r.patient_id_number))
           AND e.episode_start_date = r.date_of_diagnosis
           AND e.episode_source_value = (r.primary_site || '/' || r.histologic_type_icdo3)
    WHERE r.behavior_code_icdo3 IN ('3', '6')
)
INSERT INTO ${parameters.cdm_schema}.episode_event (
    episode_id,
    event_id,
    episode_event_field_concept_id
)
-- Surgery: NAACCR rx_summary_surgery (Item 1290) -> procedure_occurrence
SELECT episode_id, 0 AS event_id, 1147082 AS episode_event_field_concept_id
FROM episode_lookup
WHERE rx_summary_surgery IS NOT NULL AND rx_summary_surgery != ''
UNION ALL
-- Chemotherapy: rx_summary_chemo (1390) -> drug_exposure
SELECT episode_id, 0 AS event_id, 1147094 AS episode_event_field_concept_id
FROM episode_lookup
WHERE rx_summary_chemo IS NOT NULL AND rx_summary_chemo != ''
UNION ALL
-- Radiation: rx_summary_radiation (1360) -> procedure_occurrence
SELECT episode_id, 0 AS event_id, 1147082 AS episode_event_field_concept_id
FROM episode_lookup
WHERE rx_summary_radiation IS NOT NULL AND rx_summary_radiation != ''
UNION ALL
-- Hormone therapy: rx_summary_hormone (1410) -> drug_exposure
SELECT episode_id, 0 AS event_id, 1147094 AS episode_event_field_concept_id
FROM episode_lookup
WHERE rx_summary_hormone IS NOT NULL AND rx_summary_hormone != '';
