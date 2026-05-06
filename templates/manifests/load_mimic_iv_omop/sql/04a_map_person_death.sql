-- Phase 2 Plan 4 Task 5: PERSON + DEATH mappers (Stage 3a).
-- subject_id → person_id; gender M/F → 8507/8532; race → SNOMED via concept lookup.

INSERT INTO ${parameters.target_schema}.person (
    person_id,
    gender_concept_id,
    year_of_birth,
    race_concept_id,
    ethnicity_concept_id,
    person_source_value,
    gender_source_value,
    race_source_value
)
SELECT
    p.subject_id AS person_id,
    CASE p.gender
        WHEN 'M' THEN 8507
        WHEN 'F' THEN 8532
        ELSE 0
    END AS gender_concept_id,
    p.anchor_year - p.anchor_age AS year_of_birth,
    COALESCE(
        (SELECT concept_id FROM ${parameters.vocab_schema}.concept
         WHERE vocabulary_id = 'Race' AND concept_name ILIKE a.race LIMIT 1),
        0
    ) AS race_concept_id,
    0 AS ethnicity_concept_id,
    CAST(p.subject_id AS VARCHAR) AS person_source_value,
    p.gender AS gender_source_value,
    a.race AS race_source_value
FROM mimic_iv_source.fmt_patients p
LEFT JOIN LATERAL (
    SELECT race FROM mimic_iv_source.fmt_admissions WHERE subject_id = p.subject_id
    ORDER BY admittime LIMIT 1
) a ON TRUE
ON CONFLICT (person_id) DO NOTHING;

-- DEATH: rows where dod IS NOT NULL.
INSERT INTO ${parameters.target_schema}.death (
    person_id,
    death_date,
    death_type_concept_id
)
SELECT
    p.subject_id AS person_id,
    p.dod AS death_date,
    32817 AS death_type_concept_id  -- 'EHR'
FROM mimic_iv_source.fmt_patients p
WHERE p.dod IS NOT NULL
ON CONFLICT (person_id) DO NOTHING;
