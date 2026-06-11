\timing on
SET max_parallel_workers_per_gather=8;

CREATE TEMP TABLE htn AS
SELECT DISTINCT concept_id FROM (
  SELECT unnest(ARRAY[312648,317898,320128,4034031,4058987,4083723,4148205,4159755,4180283,4215640,4217486,4263067,4269358,4302591,4321603,45757787]::bigint[]) AS concept_id
  UNION ALL
  SELECT ca.descendant_concept_id FROM vocab.concept_ancestor ca
  WHERE ca.ancestor_concept_id IN (312648,317898,320128,4034031,4058987,4083723,4148205,4159755,4180283,4215640,4217486,4263067,4269358,4302591,4321603,45757787)
) z;
CREATE INDEX ON htn(concept_id);
ANALYZE htn;

CREATE TEMP TABLE tgt AS
SELECT subject_id AS person_id, cohort_start_date AS index_date, cohort_end_date AS bp_end
FROM results.cohort WHERE cohort_definition_id=5441;
CREATE INDEX ON tgt(person_id);
ANALYZE tgt;

CREATE TEMP TABLE firstdx AS
SELECT t.person_id, MIN(co.condition_start_date) AS dx_date
FROM tgt t
JOIN omop.condition_occurrence co ON co.person_id=t.person_id
 AND co.condition_concept_id IN (SELECT concept_id FROM htn)
 AND co.condition_start_date >= t.index_date
GROUP BY t.person_id;
CREATE INDEX ON firstdx(person_id);
ANALYZE firstdx;

DELETE FROM results.cohort WHERE cohort_definition_id BETWEEN 5450 AND 5454;

-- G1-G4 (diagnosis-anchored): cohort_start = first HTN dx; end = LEAST(dx+1825, op_end)
INSERT INTO results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
SELECT
  CASE WHEN d.dx_date <= t.index_date + 90  THEN 5450
       WHEN d.dx_date <= t.index_date + 180 THEN 5451
       WHEN d.dx_date <= t.index_date + 365 THEN 5452
       ELSE 5453 END,
  t.person_id, d.dx_date,
  LEAST(d.dx_date + 1825,
        (SELECT op.observation_period_end_date FROM omop.observation_period op
          WHERE op.person_id=t.person_id AND d.dx_date BETWEEN op.observation_period_start_date AND op.observation_period_end_date
          LIMIT 1))
FROM tgt t JOIN firstdx d ON d.person_id=t.person_id;

-- Never-diagnosed (BP-index anchored): mirrors target start/end
INSERT INTO results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
SELECT 5454, t.person_id, t.index_date, t.bp_end
FROM tgt t LEFT JOIN firstdx d ON d.person_id=t.person_id
WHERE d.person_id IS NULL;

SELECT cohort_definition_id, count(*) AS subjects FROM results.cohort
WHERE cohort_definition_id BETWEEN 5450 AND 5454 GROUP BY 1 ORDER BY 1;
