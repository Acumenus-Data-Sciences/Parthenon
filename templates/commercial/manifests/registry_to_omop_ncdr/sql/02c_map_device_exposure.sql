-- Phase 3 Plan 4C Task 4 (T-022C): NCDR stents -> DEVICE_EXPOSURE.
-- Plan 4C is the first commercial-tier template to populate the OMOP
-- DEVICE_EXPOSURE table (PROCEDURE_OCCURRENCE + COST were the wedges
-- for T-021; DEVICE_EXPOSURE is the wedge for cardiology).
--
-- One row per stent in stent_udis. The UDI maps to an OMOP Device
-- concept via the FDA UDI -> SPL -> RxNorm-Extension Device path
-- (vocabulary_id = 'FDA_UDI'). For UDIs that don't resolve, we emit
-- device_concept_id=0 and preserve the source UDI in
-- device_source_value for downstream review.

INSERT INTO ${parameters.cdm_schema}.device_exposure (
    person_id,
    device_concept_id,
    device_exposure_start_date,
    device_type_concept_id,
    device_source_value,
    device_source_concept_id
)
SELECT
    abs(hashtext(p.patient_id)) AS person_id,
    COALESCE(dev.concept_id, 0) AS device_concept_id,
    p.procedure_date AS device_exposure_start_date,
    32861 AS device_type_concept_id,  -- 'Registry-derived'
    udi AS device_source_value,
    udi_src.concept_id AS device_source_concept_id
FROM ${parameters.source_schema}.fmt_ncdr_pci p
CROSS JOIN LATERAL unnest(COALESCE(p.stent_udis, ARRAY[]::TEXT[])) AS udi
LEFT JOIN ${parameters.vocab_schema}.concept udi_src
    ON udi_src.concept_code = udi AND udi_src.vocabulary_id = 'FDA_UDI'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = udi_src.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept dev
    ON dev.concept_id = cr.concept_id_2 AND dev.standard_concept = 'S';
