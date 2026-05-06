-- Phase 2 Plan 4 Task 7: VISIT_OCCURRENCE + VISIT_DETAIL mappers (Stage 4).
-- admissions → VISIT_OCCURRENCE (one per hadm_id).
-- transfers + icustays → VISIT_DETAIL.

INSERT INTO ${parameters.target_schema}.visit_occurrence (
    visit_occurrence_id,
    person_id,
    visit_concept_id,
    visit_start_date,
    visit_start_datetime,
    visit_end_date,
    visit_end_datetime,
    visit_type_concept_id,
    care_site_id,
    visit_source_value,
    admitted_from_source_value,
    discharged_to_source_value
)
SELECT
    a.hadm_id AS visit_occurrence_id,
    a.subject_id AS person_id,
    CASE a.admission_type
        WHEN 'EW EMER.' THEN 9203  -- Emergency Room Visit
        WHEN 'URGENT' THEN 9203
        WHEN 'ELECTIVE' THEN 9201  -- Inpatient Visit
        WHEN 'OBSERVATION ADMIT' THEN 9201
        WHEN 'AMBULATORY OBSERVATION' THEN 9202  -- Outpatient Visit
        ELSE 9201
    END AS visit_concept_id,
    DATE(a.admittime),
    a.admittime,
    DATE(COALESCE(a.dischtime, a.admittime)),
    a.dischtime,
    32817 AS visit_type_concept_id,  -- 'EHR'
    1 AS care_site_id,
    CAST(a.hadm_id AS VARCHAR),
    a.admission_location,
    a.discharge_location
FROM mimic_iv_source.fmt_admissions a
ON CONFLICT (visit_occurrence_id) DO NOTHING;

-- VISIT_DETAIL: ICU stays first, then transfers.
INSERT INTO ${parameters.target_schema}.visit_detail (
    person_id,
    visit_detail_concept_id,
    visit_detail_start_date,
    visit_detail_start_datetime,
    visit_detail_end_date,
    visit_detail_end_datetime,
    visit_detail_type_concept_id,
    care_site_id,
    visit_detail_source_value,
    visit_occurrence_id
)
SELECT
    s.subject_id,
    581379,  -- 'Inpatient Critical Care Facility'
    DATE(s.intime),
    s.intime,
    DATE(COALESCE(s.outtime, s.intime)),
    s.outtime,
    32817,
    1,
    s.first_careunit,
    s.hadm_id
FROM mimic_iv_source.fmt_icustays s
WHERE s.hadm_id IS NOT NULL;
