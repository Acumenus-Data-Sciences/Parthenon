-- HTN v4 — Recording-comparable normotensive comparator (cohort_definition_id 5455)
-- Sensitivity arm for OQ-5: mirrors the elevated-BP target (5441) exactly, swapping
-- "2nd consecutive elevated reading" for "2nd normal reading among the never-elevated".
-- Recording-comparable by construction (same >=2-BP-reading screening footprint) so the
-- propensity model is not separable — the fix for the S5 overlap failure of G4-vs-G1.
--
-- Same hand-tuned parallel-bitmap-scan technique as target_generation.sql: the 710M-row
-- omop.measurement value filter is I/O-pathological via plain index scans, so force a
-- parallel seq/bitmap pass into an unlogged scratch table.
\timing on
SET work_mem='2GB';
SET max_parallel_workers_per_gather=12;
SET min_parallel_table_scan_size=0;
SET parallel_setup_cost=0;
SET parallel_tuple_cost=0;

-- 1. Exclusion codesets — identical to target 5441 (1=CVD,2=thyroid,3=secondaryHTN,4=antihypertensive,5=kidney,6=eGFR), with descendants.
CREATE TEMP TABLE _csbase AS
SELECT (cs->>'id')::int AS codeset_id,
       (it->'concept'->>'CONCEPT_ID')::bigint AS concept_id,
       COALESCE((it->>'includeDescendants')::boolean,false) AS inc_desc
FROM app.cohort_definitions cd,
     jsonb_array_elements(cd.expression_json->'ConceptSets') cs,
     jsonb_array_elements(cs->'expression'->'items') it
WHERE cd.id=5441 AND COALESCE((it->>'isExcluded')::boolean,false)=false
  AND (cs->>'id')::int BETWEEN 1 AND 6;
CREATE TEMP TABLE codesets AS
SELECT DISTINCT codeset_id, concept_id FROM (
  SELECT codeset_id, concept_id FROM _csbase
  UNION ALL
  SELECT b.codeset_id, ca.descendant_concept_id
  FROM _csbase b JOIN vocab.concept_ancestor ca ON b.inc_desc AND ca.ancestor_concept_id=b.concept_id
) z;
CREATE INDEX ix_codesets ON codesets(codeset_id, concept_id);
ANALYZE codesets;

-- 2. ALL BP reading person-dates with an "elevated" flag (one parallel pass).
--    A date is elevated if any component that day was SBP>=130 or DBP>=80.
DROP TABLE IF EXISTS results._htn_v4_bp;
SET enable_indexscan=off;
CREATE UNLOGGED TABLE results._htn_v4_bp AS
SELECT person_id, measurement_date AS dt,
       bool_or((measurement_concept_id=3004249 AND value_as_number>=130)
            OR (measurement_concept_id=3012888 AND value_as_number>=80)) AS elevated
FROM omop.measurement
WHERE measurement_concept_id IN (3004249,3012888)
  AND value_as_number IS NOT NULL
GROUP BY person_id, measurement_date;
SET enable_indexscan=on;
CREATE INDEX ix_bp ON results._htn_v4_bp(person_id, dt);
ANALYZE results._htn_v4_bp;

-- 3. Op-qualified normal reading dates among NEVER-elevated persons only.
CREATE TEMP TABLE norm_primary AS
SELECT b.person_id, b.dt, op.observation_period_end_date AS op_end
FROM results._htn_v4_bp b
JOIN omop.observation_period op ON op.person_id=b.person_id
 AND b.dt >= op.observation_period_start_date + 365
 AND b.dt <= op.observation_period_end_date
WHERE NOT EXISTS (SELECT 1 FROM results._htn_v4_bp e WHERE e.person_id=b.person_id AND e.elevated);
CREATE INDEX ix_np ON norm_primary(person_id, dt);
ANALYZE norm_primary;

-- 4. Index = earliest op-qualified normal reading with a prior normal reading in [index-365, index-1].
CREATE TEMP TABLE idxn AS
SELECT DISTINCT firstq.person_id, firstq.dt AS index_date,
   (SELECT op.observation_period_end_date FROM omop.observation_period op
     WHERE op.person_id=firstq.person_id
       AND firstq.dt>=op.observation_period_start_date AND firstq.dt<=op.observation_period_end_date
     LIMIT 1) AS op_end
FROM (
  SELECT np.person_id, MIN(np.dt) AS dt
  FROM norm_primary np
  WHERE EXISTS (SELECT 1 FROM results._htn_v4_bp b1
                WHERE b1.person_id=np.person_id AND b1.dt < np.dt AND b1.dt >= np.dt - 365)
  GROUP BY np.person_id
) firstq;
ANALYZE idxn;
DROP TABLE IF EXISTS results._htn_v4_bp;

-- 5. Identical exclusions + age>=18 -> results.cohort 5455. End = LEAST(index+1825d, op_end).
DELETE FROM results.cohort WHERE cohort_definition_id=5455;
INSERT INTO results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
SELECT 5455, i.person_id, i.index_date, LEAST(i.index_date + 1825, i.op_end)
FROM idxn i
JOIN omop.person p ON p.person_id=i.person_id
WHERE (date_part('year', i.index_date) - p.year_of_birth) >= 18
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=1))
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=2))
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=3))
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=5))
  AND NOT EXISTS (SELECT 1 FROM omop.drug_exposure d WHERE d.person_id=i.person_id AND d.drug_exposure_start_date<=i.index_date AND d.drug_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=4))
  AND NOT EXISTS (SELECT 1 FROM omop.measurement g WHERE g.person_id=i.person_id AND g.measurement_date<=i.index_date AND g.value_as_number<60 AND g.measurement_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=6));

SELECT 'normo_qualified' AS step, count(*) AS n FROM idxn
UNION ALL
SELECT 'final_normo_subjects', count(*) FROM results.cohort WHERE cohort_definition_id=5455;
