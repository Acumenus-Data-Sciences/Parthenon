-- Phase 2 Plan 4 Task 12: OBSERVATION mapper (Stage 6c — selected chartevents).
-- Allowlist of itemids that map to OMOP observations not already covered by
-- labevents — e.g., GCS Total, Pain Score, Code Status. The full chartevents
-- table is too large to map indiscriminately; the allowlist is the
-- HIPAA-friendly + performance-friendly cut.

-- The MIMIC-IV `d_items` dictionary is loaded into this lookup at template-
-- run time by the customer (or via a future bootstrap step).
DROP TABLE IF EXISTS mimic_iv_source.lkp_chartevent_allowlist;
CREATE TABLE mimic_iv_source.lkp_chartevent_allowlist AS
SELECT * FROM (VALUES
    (220739, 4093836, 'GCS Total'),
    (223900, 4093836, 'GCS Verbal Response'),
    (223901, 4093836, 'GCS Motor Response'),
    (220734, 4163049, 'Pain Score'),
    (228332, 4253945, 'Code Status'),
    (224054, 36659407, 'Glucose finger stick')
) AS t(itemid, observation_concept_id, label);

INSERT INTO ${parameters.target_schema}.observation (
    person_id,
    observation_concept_id,
    observation_date,
    observation_datetime,
    observation_type_concept_id,
    value_as_number,
    value_as_string,
    visit_occurrence_id,
    observation_source_value
)
SELECT
    ce.subject_id,
    aw.observation_concept_id,
    DATE(ce.charttime),
    ce.charttime,
    32817,  -- 'EHR'
    ce.valuenum,
    ce.value,
    ce.hadm_id,
    aw.label
FROM mimic_iv_source.fmt_chartevents ce
JOIN mimic_iv_source.lkp_chartevent_allowlist aw ON aw.itemid = ce.itemid;
