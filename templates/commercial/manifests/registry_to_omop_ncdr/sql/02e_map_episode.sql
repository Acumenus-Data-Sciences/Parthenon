-- Phase 3 Plan 4C Task 4 (T-022C): NCDR -> EPISODE.
-- One Procedure-Anchored Episode per PCI. episode_source_value carries
-- canonical procedure code only (no PHI per HIGHSEC §7).

INSERT INTO ${parameters.cdm_schema}.episode (
    person_id,
    episode_concept_id,
    episode_start_date,
    episode_end_date,
    episode_type_concept_id,
    episode_source_value
)
SELECT
    abs(hashtext(p.patient_id)) AS person_id,
    32873 AS episode_concept_id,  -- 'Procedure-Anchored Episode'
    p.procedure_date AS episode_start_date,
    p.procedure_date + (p.length_of_stay || ' days')::INTERVAL AS episode_end_date,
    32861 AS episode_type_concept_id,
    ('PCI:' || p.primary_procedure_code) AS episode_source_value
FROM ${parameters.source_schema}.fmt_ncdr_pci p;
