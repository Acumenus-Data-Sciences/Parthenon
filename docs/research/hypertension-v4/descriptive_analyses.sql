-- HTN v4 — descriptive analyses the protocol promises but the standard analysis
-- types don't produce: (A) two diagnostic-latency intervals, (B) treatment
-- utilization, (C) under-diagnosis prevalence. Person-scoped to the 109,763
-- target subjects (index = 2nd consecutive elevated BP), so the measurement and
-- drug scans ride the person_id index (no full-table value scan needed).
\timing on
SET work_mem='1GB';
SET max_parallel_workers_per_gather=8;

-- target subjects + index date
CREATE TEMP TABLE _tgt AS
SELECT subject_id AS person_id, cohort_start_date AS index_date
FROM results.cohort WHERE cohort_definition_id=5441;
CREATE INDEX ix_tgt ON _tgt(person_id);
ANALYZE _tgt;

-- antihypertensive codeset (codeset 4 from cd 5441), with descendants
CREATE TEMP TABLE _antihtn AS
WITH base AS (
  SELECT (it->'concept'->>'CONCEPT_ID')::bigint AS concept_id,
         COALESCE((it->>'includeDescendants')::boolean,false) AS inc_desc
  FROM app.cohort_definitions cd,
       jsonb_array_elements(cd.expression_json->'ConceptSets') cs,
       jsonb_array_elements(cs->'expression'->'items') it
  WHERE cd.id=5441 AND (cs->>'id')::int=4 AND COALESCE((it->>'isExcluded')::boolean,false)=false
)
SELECT DISTINCT concept_id FROM (
  SELECT concept_id FROM base
  UNION ALL
  SELECT ca.descendant_concept_id FROM base b JOIN vocab.concept_ancestor ca ON b.inc_desc AND ca.ancestor_concept_id=b.concept_id
) z;
CREATE INDEX ix_antihtn ON _antihtn(concept_id);
ANALYZE _antihtn;

-- essential-HTN concept set (codeset 0 from cd 5441), with descendants — for dx date
CREATE TEMP TABLE _htndx AS
WITH base AS (
  SELECT (it->'concept'->>'CONCEPT_ID')::bigint AS concept_id,
         COALESCE((it->>'includeDescendants')::boolean,false) AS inc_desc
  FROM app.cohort_definitions cd,
       jsonb_array_elements(cd.expression_json->'ConceptSets') cs,
       jsonb_array_elements(cs->'expression'->'items') it
  WHERE cd.id=5441 AND (cs->>'id')::int=0 AND COALESCE((it->>'isExcluded')::boolean,false)=false
)
SELECT DISTINCT concept_id FROM (
  SELECT concept_id FROM base
  UNION ALL
  SELECT ca.descendant_concept_id FROM base b JOIN vocab.concept_ancestor ca ON b.inc_desc AND ca.ancestor_concept_id=b.concept_id
) z;
CREATE INDEX ix_htndx ON _htndx(concept_id);
ANALYZE _htndx;

-- (A) Interval 1->2 elevated BP: index_date - latest elevated reading strictly before index within 365d.
CREATE TEMP TABLE _int_a AS
SELECT t.person_id, (t.index_date - MAX(m.measurement_date)) AS days
FROM _tgt t
JOIN omop.measurement m ON m.person_id=t.person_id
 AND m.measurement_date < t.index_date AND m.measurement_date >= t.index_date - 365
 AND ((m.measurement_concept_id=3004249 AND m.value_as_number>=130)
   OR (m.measurement_concept_id=3012888 AND m.value_as_number>=80))
GROUP BY t.person_id, t.index_date;

-- first HTN dx on/after index
CREATE TEMP TABLE _dx AS
SELECT t.person_id, MIN(c.condition_start_date) AS dx_date, t.index_date
FROM _tgt t
JOIN omop.condition_occurrence c ON c.person_id=t.person_id
 AND c.condition_start_date >= t.index_date
 AND c.condition_concept_id IN (SELECT concept_id FROM _htndx)
GROUP BY t.person_id, t.index_date;

-- first antihypertensive on/after index
CREATE TEMP TABLE _tx AS
SELECT t.person_id, MIN(d.drug_exposure_start_date) AS tx_date, t.index_date
FROM _tgt t
JOIN omop.drug_exposure d ON d.person_id=t.person_id
 AND d.drug_exposure_start_date >= t.index_date
 AND d.drug_concept_id IN (SELECT concept_id FROM _antihtn)
GROUP BY t.person_id, t.index_date;

\echo '===== (A) Interval first->second elevated BP (days) ====='
SELECT count(*) AS n,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY days) AS median,
       percentile_cont(0.25) WITHIN GROUP (ORDER BY days) AS q1,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY days) AS q3
FROM _int_a;

\echo '===== (B) Interval second elevated BP -> HTN diagnosis (days), diagnosed only ====='
SELECT count(*) AS n_diagnosed,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY (dx_date-index_date)) AS median,
       percentile_cont(0.25) WITHIN GROUP (ORDER BY (dx_date-index_date)) AS q1,
       percentile_cont(0.75) WITHIN GROUP (ORDER BY (dx_date-index_date)) AS q3
FROM _dx;

\echo '===== (C) Prevalence ====='
SELECT (SELECT count(*) FROM _tgt) AS target_total,
       (SELECT count(*) FROM _dx) AS ever_diagnosed,
       (SELECT count(*) FROM _tgt) - (SELECT count(*) FROM _dx) AS never_diagnosed,
       round(100.0*((SELECT count(*) FROM _tgt)-(SELECT count(*) FROM _dx))/(SELECT count(*) FROM _tgt),1) AS never_dx_pct;

\echo '===== (D) Treatment utilization ====='
SELECT (SELECT count(*) FROM _tx) AS ever_treated,
       round(100.0*(SELECT count(*) FROM _tx)/(SELECT count(*) FROM _tgt),1) AS ever_treated_pct,
       (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (tx_date-index_date)) FROM _tx) AS median_days_to_tx,
       (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY (tx_date-index_date)) FROM _tx) AS q1_days_to_tx,
       (SELECT percentile_cont(0.75) WITHIN GROUP (ORDER BY (tx_date-index_date)) FROM _tx) AS q3_days_to_tx;

\echo '===== (E) Treatment among the diagnosed (any antihypertensive ever) ====='
SELECT count(DISTINCT d.person_id) AS diagnosed,
       count(DISTINCT tx.person_id) AS diagnosed_and_treated,
       round(100.0*count(DISTINCT tx.person_id)/NULLIF(count(DISTINCT d.person_id),0),1) AS treated_pct_of_diagnosed
FROM _dx d LEFT JOIN _tx tx ON tx.person_id=d.person_id;

-- ── (F) Persist as a study_synthesis row the ManuscriptComposer reads ─────────
-- synthesis_type='descriptive_summary'; tied to study 165, citing the
-- characterization (269) and incidence (270) executions as inputs.
\echo '===== (F) Upsert descriptive_summary into study_synthesis ====='
DELETE FROM app.study_synthesis WHERE study_id=165 AND synthesis_type='descriptive_summary';
INSERT INTO app.study_synthesis
  (study_id, study_analysis_id, synthesis_type, input_result_ids, method_settings, output, generated_at, generated_by, created_at, updated_at)
SELECT 165, NULL, 'descriptive_summary', '[269,270]'::jsonb,
  jsonb_build_object('source','docs/research/hypertension-v4/descriptive_analyses.sql','scope','target 5441','intervals','days'),
  jsonb_build_object(
    'prevalence', jsonb_build_object(
      'target_total', (SELECT count(*) FROM _tgt),
      'ever_diagnosed', (SELECT count(*) FROM _dx),
      'never_diagnosed', (SELECT count(*) FROM _tgt)-(SELECT count(*) FROM _dx),
      'never_dx_pct', round(100.0*((SELECT count(*) FROM _tgt)-(SELECT count(*) FROM _dx))/NULLIF((SELECT count(*) FROM _tgt),0),1)),
    'delay_strata', jsonb_build_object(
      'G1_timely_le90d', (SELECT count(*) FROM results.cohort WHERE cohort_definition_id=5450),
      'G2_91_180d',      (SELECT count(*) FROM results.cohort WHERE cohort_definition_id=5451),
      'G3_181_365d',     (SELECT count(*) FROM results.cohort WHERE cohort_definition_id=5452),
      'G4_delayed_gt365d',(SELECT count(*) FROM results.cohort WHERE cohort_definition_id=5453),
      'never_diagnosed', (SELECT count(*) FROM results.cohort WHERE cohort_definition_id=5454)),
    'latency_first_to_second_elevated_bp_days', (SELECT jsonb_build_object(
      'n', count(*),
      'median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::numeric),
      'q1', round(percentile_cont(0.25) WITHIN GROUP (ORDER BY days)::numeric),
      'q3', round(percentile_cont(0.75) WITHIN GROUP (ORDER BY days)::numeric)) FROM _int_a),
    'latency_second_elevated_to_diagnosis_days', (SELECT jsonb_build_object(
      'n', count(*),
      'median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (dx_date-index_date))::numeric),
      'q1', round(percentile_cont(0.25) WITHIN GROUP (ORDER BY (dx_date-index_date))::numeric),
      'q3', round(percentile_cont(0.75) WITHIN GROUP (ORDER BY (dx_date-index_date))::numeric)) FROM _dx),
    'treatment_utilization', (SELECT jsonb_build_object(
      'ever_treated', count(*),
      'ever_treated_pct', round(100.0*count(*)/NULLIF((SELECT count(*) FROM _tgt),0),1),
      'median_days_to_first_tx', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY (tx_date-index_date))::numeric),
      'q1_days_to_first_tx', round(percentile_cont(0.25) WITHIN GROUP (ORDER BY (tx_date-index_date))::numeric),
      'q3_days_to_first_tx', round(percentile_cont(0.75) WITHIN GROUP (ORDER BY (tx_date-index_date))::numeric),
      'treated_pct_of_diagnosed', (SELECT round(100.0*count(DISTINCT tx.person_id)/NULLIF(count(DISTINCT d.person_id),0),1)
                                   FROM _dx d LEFT JOIN _tx tx ON tx.person_id=d.person_id)) FROM _tx)
  ),
  now(), 117, now(), now();
