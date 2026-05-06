-- Phase 3 Plan 3 Tasks 4 + 5 (T-021C): NCPDP -> DRUG_EXPOSURE + COST.
--
-- Two passes:
--
-- 1. Project non-reversal claims (B1/B3) to DRUG_EXPOSURE rows. NDC ->
--    RxNorm via the standard OMOP vocabulary join: vocab.concept (the
--    NDC concept) + concept_relationship 'Maps to' (which RxNorm
--    standard concept it maps to). The standard concept_id is what
--    DRUG_EXPOSURE expects per OMOP CDM v5.4 §DRUG_EXPOSURE.
--
-- 2. Project reversal claims (B2) to compensating DRUG_EXPOSURE rows
--    with NEGATIVE quantity, mirroring the X12 835 reversal pattern
--    (ADR 0016 §"Remit reconciliation"). The original B1 row is
--    preserved; SUM(quantity) GROUP BY person_id, drug_concept_id
--    naturally nets to the post-reversal dispensed total.
--
-- Unmapped NDCs (no concept_relationship 'Maps to' edge) are logged
-- to ${app_schema}.unmapped_ndc for downstream T-024 ai_assisted_mapping
-- review. The DRUG_EXPOSURE row is still emitted but with
-- drug_concept_id=0 (OMOP convention for "no map") so HEOR queries
-- that join on standard concepts naturally exclude unmapped events.

-- Pass 1: B1/B3 -> DRUG_EXPOSURE (positive quantity)

INSERT INTO ${parameters.cdm_schema}.drug_exposure (
    person_id,
    drug_concept_id,
    drug_exposure_start_date,
    drug_exposure_end_date,
    drug_type_concept_id,
    quantity,
    days_supply,
    drug_source_value,
    drug_source_concept_id
)
SELECT
    -- Person identity is per-cardholder; we use a deterministic hash
    -- for v0.1 since proper person_id allocation requires a separate
    -- staging table (Phase 4 follow-up). For the validation E2E the
    -- person_ids stay stable across runs.
    abs(hashtext(c.cardholder_id)) AS person_id,
    COALESCE(rxnorm.concept_id, 0) AS drug_concept_id,
    c.date_of_service AS drug_exposure_start_date,
    c.date_of_service + (c.days_supply || ' days')::INTERVAL AS drug_exposure_end_date,
    -- 38000177 = 'Prescription dispensed in pharmacy' (NCPDP D.0 source)
    38000177 AS drug_type_concept_id,
    c.quantity_dispensed AS quantity,
    c.days_supply AS days_supply,
    c.ndc_code AS drug_source_value,
    ndc.concept_id AS drug_source_concept_id
FROM ${parameters.source_schema}.fmt_ncpdp_claim c
LEFT JOIN ${parameters.vocab_schema}.concept ndc
    ON ndc.concept_code = c.ndc_code AND ndc.vocabulary_id = 'NDC'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = ndc.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept rxnorm
    ON rxnorm.concept_id = cr.concept_id_2
       AND rxnorm.standard_concept = 'S'
WHERE c.is_reversal = FALSE;

-- Pass 2: B2 reversals -> compensating DRUG_EXPOSURE (negative quantity)

INSERT INTO ${parameters.cdm_schema}.drug_exposure (
    person_id,
    drug_concept_id,
    drug_exposure_start_date,
    drug_exposure_end_date,
    drug_type_concept_id,
    quantity,
    days_supply,
    drug_source_value,
    drug_source_concept_id
)
SELECT
    abs(hashtext(c.cardholder_id)) AS person_id,
    COALESCE(rxnorm.concept_id, 0) AS drug_concept_id,
    c.date_of_service AS drug_exposure_start_date,
    c.date_of_service + (c.days_supply || ' days')::INTERVAL AS drug_exposure_end_date,
    38000177 AS drug_type_concept_id,
    -c.quantity_dispensed AS quantity,  -- NEGATED: compensating row
    c.days_supply AS days_supply,
    c.ndc_code AS drug_source_value,
    ndc.concept_id AS drug_source_concept_id
FROM ${parameters.source_schema}.fmt_ncpdp_claim c
LEFT JOIN ${parameters.vocab_schema}.concept ndc
    ON ndc.concept_code = c.ndc_code AND ndc.vocabulary_id = 'NDC'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = ndc.concept_id AND cr.relationship_id = 'Maps to'
LEFT JOIN ${parameters.vocab_schema}.concept rxnorm
    ON rxnorm.concept_id = cr.concept_id_2
       AND rxnorm.standard_concept = 'S'
WHERE c.is_reversal = TRUE;

-- Pass 3: COST projection (mirrors 02d_project_cost for procedure lines).
-- One row per (charged, paid) kind. NCPDP doesn't carry an "allowed"
-- amount — that comes only from the 835 ERA, which arrives separately.
-- Reversals emit compensating rows with negated cost.

INSERT INTO ${parameters.cdm_schema}.cost (
    cost_event_id,
    cost_event_field_concept_id,
    cost_concept_id,
    currency_concept_id,
    cost,
    cost_source_value
)
SELECT
    de.drug_exposure_id AS cost_event_id,
    1147333 AS cost_event_field_concept_id,  -- drug_exposure
    31968 AS cost_concept_id,                -- Total charged
    44818668 AS currency_concept_id,         -- USD
    CASE WHEN c.is_reversal THEN -(c.ingredient_cost + c.dispensing_fee)
         ELSE  (c.ingredient_cost + c.dispensing_fee)
    END AS cost,
    CASE WHEN c.is_reversal THEN 'ncpdp_reversal' ELSE 'ncpdp_charged' END AS cost_source_value
FROM ${parameters.source_schema}.fmt_ncpdp_claim c
JOIN ${parameters.cdm_schema}.drug_exposure de
    ON de.drug_source_value = c.ndc_code
       AND de.drug_exposure_start_date = c.date_of_service
       AND de.person_id = abs(hashtext(c.cardholder_id))
       -- Match the sign on quantity to pair the reversal compensation
       -- row with its reversal NCPDP claim.
       AND ((c.is_reversal AND de.quantity < 0) OR (NOT c.is_reversal AND de.quantity > 0));

-- Pass 4: log unmapped NDCs to the review queue. ON CONFLICT updates
-- last_seen_at + extends the example list (capped at 5) so reviewers
-- see fresh signal across pipeline runs.

INSERT INTO ${parameters.app_schema}.unmapped_ndc (
    ndc_code,
    example_claim_ids,
    pharmacy_count,
    first_seen_at,
    last_seen_at
)
SELECT
    c.ndc_code,
    (ARRAY_AGG(c.id ORDER BY c.id))[1:5] AS example_claim_ids,
    COUNT(DISTINCT c.pharmacy_npi)::INT AS pharmacy_count,
    NOW() AS first_seen_at,
    NOW() AS last_seen_at
FROM ${parameters.source_schema}.fmt_ncpdp_claim c
LEFT JOIN ${parameters.vocab_schema}.concept ndc
    ON ndc.concept_code = c.ndc_code AND ndc.vocabulary_id = 'NDC'
LEFT JOIN ${parameters.vocab_schema}.concept_relationship cr
    ON cr.concept_id_1 = ndc.concept_id AND cr.relationship_id = 'Maps to'
WHERE cr.concept_id_2 IS NULL  -- no Maps-to edge => unmapped NDC
GROUP BY c.ndc_code
ON CONFLICT (ndc_code) DO UPDATE
SET last_seen_at = EXCLUDED.last_seen_at,
    pharmacy_count = EXCLUDED.pharmacy_count,
    example_claim_ids = EXCLUDED.example_claim_ids;
