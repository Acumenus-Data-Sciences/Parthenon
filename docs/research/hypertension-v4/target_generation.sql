\timing on
SET work_mem='2GB';
SET max_parallel_workers_per_gather=12;
SET min_parallel_table_scan_size=0;
SET parallel_setup_cost=0;
SET parallel_tuple_cost=0;

-- 1. Exclusion codesets (1=CVD,2=thyroid,3=secondaryHTN,4=antihypertensive,5=kidney,6=eGFR) with descendants
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

-- 2. Elevated BP readings: ONE pass, parallel bitmap-heap/seq scan (force off plain index-scan random fetches).
--    Unlogged regular table so parallel scan is not disabled (temp tables disable it).
DROP TABLE IF EXISTS results._htn_v4_elev;
SET enable_indexscan=off;
CREATE UNLOGGED TABLE results._htn_v4_elev AS
SELECT person_id, measurement_date AS dt
FROM omop.measurement
WHERE (measurement_concept_id=3004249 AND value_as_number>=130)
   OR (measurement_concept_id=3012888 AND value_as_number>=80);
SET enable_indexscan=on;
CREATE INDEX ix_elev ON results._htn_v4_elev(person_id, dt);
ANALYZE results._htn_v4_elev;

-- 3. Op-qualified candidate index events (index >= op_start+365, <= op_end)
CREATE TEMP TABLE elev_primary AS
SELECT e.person_id, e.dt, op.observation_period_end_date AS op_end
FROM results._htn_v4_elev e
JOIN omop.observation_period op ON op.person_id=e.person_id
 AND e.dt >= op.observation_period_start_date + 365
 AND e.dt <= op.observation_period_end_date;
CREATE INDEX ix_ep ON elev_primary(person_id, dt);
ANALYZE elev_primary;

-- 4. Index = earliest op-qualified reading with a prior elevated reading in [index-365, index-1]
CREATE TEMP TABLE idx2 AS
SELECT DISTINCT firstq.person_id, firstq.dt AS index_date,
   (SELECT op.observation_period_end_date FROM omop.observation_period op
     WHERE op.person_id=firstq.person_id
       AND firstq.dt>=op.observation_period_start_date AND firstq.dt<=op.observation_period_end_date
     LIMIT 1) AS op_end
FROM (
  SELECT ep.person_id, MIN(ep.dt) AS dt
  FROM elev_primary ep
  WHERE EXISTS (SELECT 1 FROM results._htn_v4_elev e1
                WHERE e1.person_id=ep.person_id AND e1.dt < ep.dt AND e1.dt >= ep.dt - 365)
  GROUP BY ep.person_id
) firstq;
ANALYZE idx2;
DROP TABLE IF EXISTS results._htn_v4_elev;

-- 5. Exclusions + age>=18 -> results.cohort. End = LEAST(index+1825d, op_end).
DELETE FROM results.cohort WHERE cohort_definition_id=5441;
INSERT INTO results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
SELECT 5441, i.person_id, i.index_date, LEAST(i.index_date + 1825, i.op_end)
FROM idx2 i
JOIN omop.person p ON p.person_id=i.person_id
WHERE (date_part('year', i.index_date) - p.year_of_birth) >= 18
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=1))
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=2))
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=3))
  AND NOT EXISTS (SELECT 1 FROM omop.condition_occurrence c WHERE c.person_id=i.person_id AND c.condition_start_date<=i.index_date AND c.condition_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=5))
  AND NOT EXISTS (SELECT 1 FROM omop.drug_exposure d WHERE d.person_id=i.person_id AND d.drug_exposure_start_date<=i.index_date AND d.drug_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=4))
  AND NOT EXISTS (SELECT 1 FROM omop.measurement g WHERE g.person_id=i.person_id AND g.measurement_date<=i.index_date AND g.value_as_number<60 AND g.measurement_concept_id IN (SELECT concept_id FROM codesets WHERE codeset_id=6));

SELECT 'qualified_persons' AS step, count(*) AS n FROM idx2
UNION ALL
SELECT 'final_target_subjects', count(*) FROM results.cohort WHERE cohort_definition_id=5441;
