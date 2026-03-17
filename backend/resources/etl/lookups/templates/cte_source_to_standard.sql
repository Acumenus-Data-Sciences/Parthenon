-- Source to Standard vocabulary lookup CTE
-- {vocab_schema} = source's vocabulary schema name
-- {vocabulary_filter} = vocabulary-specific WHERE clause (concept join branch)
-- {stcm_vocabulary_filter} = vocabulary-specific WHERE clause (source_to_concept_map branch)
Source_to_Standard AS (
    SELECT
        c.concept_code     AS SOURCE_CODE,
        c.concept_id       AS SOURCE_CONCEPT_ID,
        c.concept_name     AS SOURCE_CODE_DESCRIPTION,
        c.vocabulary_id    AS SOURCE_VOCABULARY_ID,
        c.domain_id        AS SOURCE_DOMAIN_ID,
        c.concept_class_id AS SOURCE_CONCEPT_CLASS_ID,
        c.valid_start_date AS SOURCE_VALID_START_DATE,
        c.valid_end_date   AS SOURCE_VALID_END_DATE,
        c.invalid_reason   AS SOURCE_INVALID_REASON,
        c2.concept_id      AS TARGET_CONCEPT_ID,
        c2.concept_name    AS TARGET_CONCEPT_NAME,
        c2.vocabulary_id   AS TARGET_VOCABULARY_ID,
        c2.domain_id       AS TARGET_DOMAIN_ID,
        c2.concept_class_id AS TARGET_CONCEPT_CLASS_ID,
        c2.invalid_reason  AS TARGET_INVALID_REASON,
        c2.standard_concept AS TARGET_STANDARD_CONCEPT
    FROM {vocab_schema}.concept c
    JOIN {vocab_schema}.concept_relationship cr
        ON c.concept_id = cr.concept_id_1
        AND cr.relationship_id = 'Maps to'
        AND cr.invalid_reason IS NULL
    JOIN {vocab_schema}.concept c2
        ON cr.concept_id_2 = c2.concept_id
        AND c2.standard_concept = 'S'
        AND c2.invalid_reason IS NULL
    WHERE c.invalid_reason IS NULL
    {vocabulary_filter}

    UNION

    SELECT
        stcm.source_code               AS SOURCE_CODE,
        stcm.source_concept_id          AS SOURCE_CONCEPT_ID,
        stcm.source_code_description    AS SOURCE_CODE_DESCRIPTION,
        stcm.source_vocabulary_id       AS SOURCE_VOCABULARY_ID,
        NULL                            AS SOURCE_DOMAIN_ID,
        NULL                            AS SOURCE_CONCEPT_CLASS_ID,
        stcm.valid_start_date           AS SOURCE_VALID_START_DATE,
        stcm.valid_end_date             AS SOURCE_VALID_END_DATE,
        stcm.invalid_reason             AS SOURCE_INVALID_REASON,
        c2.concept_id                   AS TARGET_CONCEPT_ID,
        c2.concept_name                 AS TARGET_CONCEPT_NAME,
        c2.vocabulary_id                AS TARGET_VOCABULARY_ID,
        c2.domain_id                    AS TARGET_DOMAIN_ID,
        c2.concept_class_id             AS TARGET_CONCEPT_CLASS_ID,
        c2.invalid_reason               AS TARGET_INVALID_REASON,
        c2.standard_concept             AS TARGET_STANDARD_CONCEPT
    FROM {vocab_schema}.source_to_concept_map stcm
    JOIN {vocab_schema}.concept c2
        ON stcm.target_concept_id = c2.concept_id
        AND c2.standard_concept = 'S'
        AND c2.invalid_reason IS NULL
    WHERE stcm.invalid_reason IS NULL
    {stcm_vocabulary_filter}
)
