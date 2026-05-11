-- REAL-PE Replication — ISTH and BARC 3b Major-Bleed Outcome Derivation
--
-- WHY A CUSTOM TEMPLATE:
--   Standard OHDSI/Circe cohort expressions cannot express value-based
--   joins across MEASUREMENT and PROCEDURE_OCCURRENCE. REAL-PE's
--   outcome definitions require:
--     ISTH   = (bleed dx code) OR (transfusion AND Hgb drop >= 2 g/dL)
--     BARC3b =  Hgb drop >= 5 g/dL  (regardless of transfusion)
--   where Hgb drop = (pre-procedure max Hgb) - (0-7d post-procedure nadir).
--
--   This template runs after the USCDT / MT cohorts have been generated
--   and produces a cohort-augmentation table that the results-explorer
--   can render alongside the native cohort counts.
--
-- INPUTS (supplied by the caller via Laravel bindings or Strategus params):
--   :target_cohort_id           -- USCDT cohort definition id
--   :comparator_cohort_id       -- MT cohort definition id
--   :isth_dx_cohort_id          -- ISTH dx-code sub-cohort (03-isth-*.json)
--   :cohort_schema              -- schema where cohort table lives (app)
--   :cdm_schema                 -- CDM clinical schema (e.g. omop)
--   :vocab_schema               -- vocabulary schema (vocab)
--   :hgb_concept_ids            -- array of Hgb LOINC concept_ids (hydrated)
--   :transfusion_concept_ids    -- array of transfusion procedure concept_ids
--
-- Parthenon SqlRender equivalent placeholders use @variable syntax.

SET search_path = @cdm_schema, @vocab_schema, public;

-- =============================================================================
-- Step 1: Snapshot each subject's pre/post Hgb trajectory
-- =============================================================================
-- For every person in either cohort, derive:
--   hgb_preindex_max : max Hgb value within 30 days BEFORE index procedure
--   hgb_postindex_nadir : min Hgb value within 0-7 days AFTER index procedure
--   hgb_drop : preindex_max - postindex_nadir (null if either side missing)

DROP TABLE IF EXISTS tmp_realpe_hgb_trajectory;
CREATE TEMP TABLE tmp_realpe_hgb_trajectory AS
WITH cohort_index AS (
    SELECT c.subject_id            AS person_id,
           c.cohort_start_date     AS index_date,
           c.cohort_definition_id  AS cohort_id
    FROM @cohort_schema.cohort c
    WHERE c.cohort_definition_id IN (:target_cohort_id, :comparator_cohort_id)
),
hgb_measurements AS (
    SELECT m.person_id,
           m.measurement_date,
           m.value_as_number AS hgb_value
    FROM measurement m
    WHERE m.measurement_concept_id = ANY (:hgb_concept_ids)
      AND m.value_as_number IS NOT NULL
      AND m.value_as_number BETWEEN 1 AND 25   -- sanity bounds (g/dL)
),
pre_hgb AS (
    SELECT ci.person_id,
           ci.cohort_id,
           ci.index_date,
           MAX(h.hgb_value) AS hgb_preindex_max
    FROM cohort_index ci
    LEFT JOIN hgb_measurements h
      ON h.person_id = ci.person_id
     AND h.measurement_date BETWEEN ci.index_date - INTERVAL '30 days'
                                AND ci.index_date
    GROUP BY ci.person_id, ci.cohort_id, ci.index_date
),
post_hgb AS (
    SELECT ci.person_id,
           ci.cohort_id,
           ci.index_date,
           MIN(h.hgb_value) AS hgb_postindex_nadir
    FROM cohort_index ci
    LEFT JOIN hgb_measurements h
      ON h.person_id = ci.person_id
     AND h.measurement_date BETWEEN ci.index_date
                                AND ci.index_date + INTERVAL '7 days'
    GROUP BY ci.person_id, ci.cohort_id, ci.index_date
)
SELECT pre.person_id,
       pre.cohort_id,
       pre.index_date,
       pre.hgb_preindex_max,
       post.hgb_postindex_nadir,
       (pre.hgb_preindex_max - post.hgb_postindex_nadir) AS hgb_drop
FROM pre_hgb pre
LEFT JOIN post_hgb post USING (person_id, cohort_id, index_date);

-- =============================================================================
-- Step 2: Transfusion flag within 7d post-index
-- =============================================================================
DROP TABLE IF EXISTS tmp_realpe_transfusion;
CREATE TEMP TABLE tmp_realpe_transfusion AS
WITH cohort_index AS (
    SELECT c.subject_id           AS person_id,
           c.cohort_start_date    AS index_date,
           c.cohort_definition_id AS cohort_id
    FROM @cohort_schema.cohort c
    WHERE c.cohort_definition_id IN (:target_cohort_id, :comparator_cohort_id)
)
SELECT ci.person_id,
       ci.cohort_id,
       ci.index_date,
       BOOL_OR(TRUE) AS received_transfusion
FROM cohort_index ci
JOIN procedure_occurrence po
  ON po.person_id = ci.person_id
 AND po.procedure_date BETWEEN ci.index_date
                           AND ci.index_date + INTERVAL '7 days'
 AND po.procedure_concept_id = ANY (:transfusion_concept_ids)
GROUP BY ci.person_id, ci.cohort_id, ci.index_date;

-- =============================================================================
-- Step 3: Diagnosis-code bleed arm (ISTH dx sub-cohort generation)
-- =============================================================================
-- Assumes cohort_definition_id = :isth_dx_cohort_id has been generated with
-- cohort_start_date on the bleed event. We restrict to within 7d post-index.
DROP TABLE IF EXISTS tmp_realpe_dx_bleed;
CREATE TEMP TABLE tmp_realpe_dx_bleed AS
WITH cohort_index AS (
    SELECT c.subject_id           AS person_id,
           c.cohort_start_date    AS index_date,
           c.cohort_definition_id AS cohort_id
    FROM @cohort_schema.cohort c
    WHERE c.cohort_definition_id IN (:target_cohort_id, :comparator_cohort_id)
)
SELECT ci.person_id,
       ci.cohort_id,
       ci.index_date,
       BOOL_OR(TRUE) AS has_bleed_dx
FROM cohort_index ci
JOIN @cohort_schema.cohort bleed
  ON bleed.subject_id = ci.person_id
 AND bleed.cohort_definition_id = :isth_dx_cohort_id
 AND bleed.cohort_start_date BETWEEN ci.index_date
                                 AND ci.index_date + INTERVAL '7 days'
GROUP BY ci.person_id, ci.cohort_id, ci.index_date;

-- =============================================================================
-- Step 4: Compose outcome flags per subject
-- =============================================================================
DROP TABLE IF EXISTS tmp_realpe_outcomes;
CREATE TEMP TABLE tmp_realpe_outcomes AS
SELECT h.person_id,
       h.cohort_id,
       h.index_date,
       h.hgb_preindex_max,
       h.hgb_postindex_nadir,
       h.hgb_drop,
       (h.hgb_drop >= 2)                              AS hgb_drop_gte_2,
       (h.hgb_drop >= 5)                              AS hgb_drop_gte_5,
       COALESCE(t.received_transfusion, FALSE)        AS received_transfusion,
       COALESCE(d.has_bleed_dx, FALSE)                AS has_bleed_dx,
       -- ISTH-modeled major bleed:
       --   dx code  OR  (transfusion AND Hgb drop >= 2)
       (COALESCE(d.has_bleed_dx, FALSE)
         OR (COALESCE(t.received_transfusion, FALSE)
             AND COALESCE(h.hgb_drop >= 2, FALSE)))   AS isth_major_bleed,
       -- BARC 3b modeled major bleed: Hgb drop >= 5 regardless of transfusion
       COALESCE(h.hgb_drop >= 5, FALSE)               AS barc_3b_major_bleed
FROM tmp_realpe_hgb_trajectory h
LEFT JOIN tmp_realpe_transfusion t USING (person_id, cohort_id, index_date)
LEFT JOIN tmp_realpe_dx_bleed    d USING (person_id, cohort_id, index_date);

-- =============================================================================
-- Step 5: Aggregate — reproduces REAL-PE Central Illustration counts
-- =============================================================================
\echo '--- REAL-PE Central Illustration counts (n, %) ---'

SELECT
    cohort_id,
    COUNT(*) AS n_subjects,
    COUNT(*) FILTER (WHERE received_transfusion)
        AS transfusion_7d,
    ROUND(100.0 * COUNT(*) FILTER (WHERE received_transfusion) / NULLIF(COUNT(*),0), 1)
        AS transfusion_pct,
    COUNT(*) FILTER (WHERE hgb_drop_gte_2)
        AS hgb_drop_gte_2_n,
    ROUND(100.0 * COUNT(*) FILTER (WHERE hgb_drop_gte_2) / NULLIF(COUNT(*),0), 1)
        AS hgb_drop_gte_2_pct,
    COUNT(*) FILTER (WHERE hgb_drop_gte_5)
        AS hgb_drop_gte_5_n,
    ROUND(100.0 * COUNT(*) FILTER (WHERE hgb_drop_gte_5) / NULLIF(COUNT(*),0), 1)
        AS hgb_drop_gte_5_pct,
    COUNT(*) FILTER (WHERE has_bleed_dx)
        AS bleed_dx_n,
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_bleed_dx) / NULLIF(COUNT(*),0), 1)
        AS bleed_dx_pct,
    COUNT(*) FILTER (WHERE isth_major_bleed)
        AS isth_major_bleed_n,
    ROUND(100.0 * COUNT(*) FILTER (WHERE isth_major_bleed) / NULLIF(COUNT(*),0), 1)
        AS isth_major_bleed_pct,
    COUNT(*) FILTER (WHERE barc_3b_major_bleed)
        AS barc_3b_major_bleed_n,
    ROUND(100.0 * COUNT(*) FILTER (WHERE barc_3b_major_bleed) / NULLIF(COUNT(*),0), 1)
        AS barc_3b_major_bleed_pct
FROM tmp_realpe_outcomes
GROUP BY cohort_id
ORDER BY cohort_id;

-- =============================================================================
-- Step 6: Chi-square input for USCDT vs MT comparison
--   Output as a 2x2 table per outcome; the analyses module can run
--   the chi-square test via R or Python FastAPI.
-- =============================================================================
\echo '--- 2x2 contingency: ISTH major bleed by cohort ---'
SELECT cohort_id,
       COUNT(*) FILTER (WHERE isth_major_bleed)       AS outcome_yes,
       COUNT(*) FILTER (WHERE NOT isth_major_bleed)   AS outcome_no
FROM tmp_realpe_outcomes
GROUP BY cohort_id
ORDER BY cohort_id;

\echo '--- 2x2 contingency: BARC 3b major bleed by cohort ---'
SELECT cohort_id,
       COUNT(*) FILTER (WHERE barc_3b_major_bleed)     AS outcome_yes,
       COUNT(*) FILTER (WHERE NOT barc_3b_major_bleed) AS outcome_no
FROM tmp_realpe_outcomes
GROUP BY cohort_id
ORDER BY cohort_id;

-- =============================================================================
-- Step 7 (optional): Persist to a named results table for the explorer
-- =============================================================================
-- DROP TABLE IF EXISTS results.real_pe_outcomes;
-- CREATE TABLE results.real_pe_outcomes AS SELECT * FROM tmp_realpe_outcomes;
-- GRANT SELECT ON results.real_pe_outcomes TO parthenon_app;
