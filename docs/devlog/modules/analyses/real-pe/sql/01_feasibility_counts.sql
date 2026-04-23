-- REAL-PE Replication — Feasibility Counts
-- Target CDM: Acumenus (schema `omop`, shared vocab `vocab`)
-- Connection: `omop` (search_path = omop, vocab, php)
--
-- Run in psql:
--     docker compose exec postgres psql -U parthenon -d parthenon \
--       -v ON_ERROR_STOP=1 -f docs/devlog/modules/analyses/real-pe/sql/01_feasibility_counts.sql
--
-- These counts answer: does Acumenus CDM have enough USCDT and MT cases
-- to replicate REAL-PE (Truveta had 1,577 USCDT + 682 MT over 2009-2023)?
--
-- The Truveta study identified devices via UDI. In OMOP v5.4, the analog is
-- DEVICE_EXPOSURE.device_source_value or DEVICE_CONCEPT_ID. We also probe
-- CPT codes on PROCEDURE_OCCURRENCE as a fallback, since most production
-- OMOP ETLs do not preserve UDI.
--
-- Expected runtime: < 30s on Acumenus (adjust if larger).

SET search_path = omop, vocab, public;

\echo '==========================================================='
\echo '  REAL-PE Feasibility Counts — Acumenus CDM'
\echo '==========================================================='

-- ------------------------------------------------------------
-- 0. Global denominators
-- ------------------------------------------------------------
\echo '\n--- 0. Global denominators ---'
SELECT
    (SELECT COUNT(*) FROM person)                        AS total_persons,
    (SELECT COUNT(*) FROM visit_occurrence)              AS total_visits,
    (SELECT COUNT(*) FROM visit_occurrence
       WHERE visit_concept_id = 9201)                    AS inpatient_visits,
    (SELECT COUNT(*) FROM device_exposure)               AS device_exposure_rows,
    (SELECT COUNT(*) FROM procedure_occurrence)          AS procedure_rows,
    (SELECT MIN(visit_start_date) FROM visit_occurrence) AS earliest_visit,
    (SELECT MAX(visit_start_date) FROM visit_occurrence) AS latest_visit;

-- ------------------------------------------------------------
-- 1. Pulmonary embolism cohort sizing
--    Concept 4170894 "Pulmonary embolism" (SNOMED 59282003) + descendants
-- ------------------------------------------------------------
\echo '\n--- 1. PE diagnosis sizing ---'
WITH pe_concepts AS (
    SELECT descendant_concept_id AS concept_id
    FROM concept_ancestor
    WHERE ancestor_concept_id = 4170894
),
pe_people AS (
    SELECT DISTINCT co.person_id
    FROM condition_occurrence co
    JOIN pe_concepts p USING (concept_id)
    -- condition_concept_id aliased via the USING clause
    WHERE co.condition_concept_id IN (SELECT concept_id FROM pe_concepts)
)
SELECT
    (SELECT COUNT(*) FROM pe_people)                           AS persons_with_pe,
    (SELECT COUNT(*) FROM condition_occurrence co
       WHERE co.condition_concept_id IN (SELECT concept_id FROM pe_concepts)) AS pe_condition_rows,
    (SELECT COUNT(DISTINCT co.person_id) FROM condition_occurrence co
       JOIN visit_occurrence vo ON vo.visit_occurrence_id = co.visit_occurrence_id
       WHERE co.condition_concept_id IN (SELECT concept_id FROM pe_concepts)
         AND vo.visit_concept_id = 9201)                       AS pe_persons_inpatient,
    (SELECT COUNT(DISTINCT co.person_id) FROM condition_occurrence co
       WHERE co.condition_concept_id IN (SELECT concept_id FROM pe_concepts)
         AND co.condition_start_date >= DATE '2018-01-01')     AS pe_persons_2018_plus;

-- ------------------------------------------------------------
-- 2. USCDT candidates — EKOS / catheter-directed thrombolysis
--    Primary:   CPT 37211 (thrombolytic infusion, initial day, non-coronary)
--               CPT 37212 (venous), 37213/37214 (subsequent days)
--    Probe:     device_source_value / concept_name containing EKOS / EkoSonic
-- ------------------------------------------------------------
\echo '\n--- 2. USCDT candidate procedures ---'
SELECT 'CPT 37211-37214 procedures'::text AS source,
       COUNT(*) AS rows,
       COUNT(DISTINCT person_id) AS persons,
       MIN(procedure_date) AS earliest,
       MAX(procedure_date) AS latest
FROM procedure_occurrence po
JOIN concept c ON c.concept_id = po.procedure_concept_id
WHERE c.vocabulary_id = 'CPT4'
  AND c.concept_code IN ('37211','37212','37213','37214')
UNION ALL
SELECT 'EKOS text hit in procedure_source_value'::text,
       COUNT(*), COUNT(DISTINCT person_id),
       MIN(procedure_date), MAX(procedure_date)
FROM procedure_occurrence
WHERE procedure_source_value ILIKE '%ekos%'
   OR procedure_source_value ILIKE '%ekosonic%';

\echo '\n--- 2b. USCDT via DEVICE_EXPOSURE (UDI path) ---'
SELECT 'EKOS text hit in device_source_value'::text AS source,
       COUNT(*) AS rows,
       COUNT(DISTINCT person_id) AS persons
FROM device_exposure
WHERE device_source_value ILIKE '%ekos%'
   OR device_source_value ILIKE '%ekosonic%'
   OR device_source_value ILIKE '%endowave%';

-- ------------------------------------------------------------
-- 3. MT candidates — FlowTriever / percutaneous mechanical thrombectomy
--    Primary:   CPT 37187 (percutaneous transluminal mechanical thrombectomy,
--               vein(s), including intraprocedural pharmacological thrombolytic
--               injections and fluoroscopic guidance)
--    Probe:     device_source_value hits for FlowTriever / Inari / ClotTriever
-- ------------------------------------------------------------
\echo '\n--- 3. MT candidate procedures ---'
SELECT 'CPT 37187 procedures'::text AS source,
       COUNT(*) AS rows,
       COUNT(DISTINCT person_id) AS persons,
       MIN(procedure_date) AS earliest,
       MAX(procedure_date) AS latest
FROM procedure_occurrence po
JOIN concept c ON c.concept_id = po.procedure_concept_id
WHERE c.vocabulary_id = 'CPT4'
  AND c.concept_code = '37187'
UNION ALL
SELECT 'FlowTriever/Inari text hit in procedure_source_value'::text,
       COUNT(*), COUNT(DISTINCT person_id),
       MIN(procedure_date), MAX(procedure_date)
FROM procedure_occurrence
WHERE procedure_source_value ILIKE '%flowtriever%'
   OR procedure_source_value ILIKE '%clottriever%'
   OR procedure_source_value ILIKE '%inari%';

\echo '\n--- 3b. MT via DEVICE_EXPOSURE (UDI path) ---'
SELECT 'FlowTriever/Inari text hit in device_source_value'::text AS source,
       COUNT(*) AS rows,
       COUNT(DISTINCT person_id) AS persons
FROM device_exposure
WHERE device_source_value ILIKE '%flowtriever%'
   OR device_source_value ILIKE '%clottriever%'
   OR device_source_value ILIKE '%inari%';

-- ------------------------------------------------------------
-- 4. Study-eligible intersection: PE + procedure + inpatient context
--    Mirrors the Truveta Figure 1 funnel:
--      a. Device/procedure rows
--      b. Tied to an encounter
--      c. Inpatient encounter (visit_concept_id = 9201 OR admit <=24h after)
--      d. PE diagnosis within 30d before or 1d after procedure
-- ------------------------------------------------------------
\echo '\n--- 4. Study-eligible USCDT intersection (CPT path) ---'
WITH pe_concepts AS (
    SELECT descendant_concept_id AS concept_id
    FROM concept_ancestor
    WHERE ancestor_concept_id = 4170894
),
uscdt_procs AS (
    SELECT po.person_id, po.procedure_date, po.visit_occurrence_id
    FROM procedure_occurrence po
    JOIN concept c ON c.concept_id = po.procedure_concept_id
    WHERE c.vocabulary_id = 'CPT4'
      AND c.concept_code IN ('37211','37212','37213','37214')
),
uscdt_inpatient AS (
    SELECT up.person_id, up.procedure_date, up.visit_occurrence_id
    FROM uscdt_procs up
    JOIN visit_occurrence vo ON vo.visit_occurrence_id = up.visit_occurrence_id
    WHERE vo.visit_concept_id = 9201
),
uscdt_with_pe AS (
    SELECT DISTINCT ui.person_id, ui.procedure_date
    FROM uscdt_inpatient ui
    JOIN condition_occurrence co
      ON co.person_id = ui.person_id
     AND co.condition_concept_id IN (SELECT concept_id FROM pe_concepts)
     AND co.condition_start_date BETWEEN ui.procedure_date - INTERVAL '30 days'
                                     AND ui.procedure_date + INTERVAL '1 day'
)
SELECT
    (SELECT COUNT(DISTINCT person_id) FROM uscdt_procs)      AS step_1_cpt_patients,
    (SELECT COUNT(DISTINCT person_id) FROM uscdt_inpatient)  AS step_2_inpatient_patients,
    (SELECT COUNT(*)                 FROM uscdt_with_pe)     AS step_3_with_pe_diagnosis;

\echo '\n--- 5. Study-eligible MT intersection (CPT path) ---'
WITH pe_concepts AS (
    SELECT descendant_concept_id AS concept_id
    FROM concept_ancestor
    WHERE ancestor_concept_id = 4170894
),
mt_procs AS (
    SELECT po.person_id, po.procedure_date, po.visit_occurrence_id
    FROM procedure_occurrence po
    JOIN concept c ON c.concept_id = po.procedure_concept_id
    WHERE c.vocabulary_id = 'CPT4'
      AND c.concept_code = '37187'
),
mt_inpatient AS (
    SELECT mp.person_id, mp.procedure_date, mp.visit_occurrence_id
    FROM mt_procs mp
    JOIN visit_occurrence vo ON vo.visit_occurrence_id = mp.visit_occurrence_id
    WHERE vo.visit_concept_id = 9201
),
mt_with_pe AS (
    SELECT DISTINCT mi.person_id, mi.procedure_date
    FROM mt_inpatient mi
    JOIN condition_occurrence co
      ON co.person_id = mi.person_id
     AND co.condition_concept_id IN (SELECT concept_id FROM pe_concepts)
     AND co.condition_start_date BETWEEN mi.procedure_date - INTERVAL '30 days'
                                     AND mi.procedure_date + INTERVAL '1 day'
)
SELECT
    (SELECT COUNT(DISTINCT person_id) FROM mt_procs)      AS step_1_cpt_patients,
    (SELECT COUNT(DISTINCT person_id) FROM mt_inpatient)  AS step_2_inpatient_patients,
    (SELECT COUNT(*)                 FROM mt_with_pe)     AS step_3_with_pe_diagnosis;

-- ------------------------------------------------------------
-- 6. Hemoglobin measurement availability (needed for ISTH/BARC outcomes)
--    LOINC 718-7  = Hemoglobin [Mass/volume] in Blood (US standard)
--    LOINC 30350-3 = Hemoglobin [Mass/volume] in Venous blood (Truveta)
--    LOINC 30351-1 = Hemoglobin [Mass/volume] in Arterial blood
-- ------------------------------------------------------------
\echo '\n--- 6. Hemoglobin measurement coverage ---'
SELECT c.concept_id,
       c.concept_name,
       c.concept_code,
       COUNT(*)                  AS measurement_rows,
       COUNT(DISTINCT m.person_id) AS distinct_persons,
       COUNT(*) FILTER (WHERE m.value_as_number IS NOT NULL) AS with_numeric_value
FROM measurement m
JOIN concept c ON c.concept_id = m.measurement_concept_id
WHERE c.vocabulary_id = 'LOINC'
  AND c.concept_code IN ('718-7','30350-3','30351-1','20509-6')
GROUP BY c.concept_id, c.concept_name, c.concept_code
ORDER BY measurement_rows DESC;

-- ------------------------------------------------------------
-- 7. Transfusion capture (CPT 36430 in Truveta)
--    Parthenon should also check ancestry under concept 4048742
--    "Transfusion of blood product" and HCPCS P-codes for blood products.
-- ------------------------------------------------------------
\echo '\n--- 7. Transfusion procedure availability ---'
SELECT 'CPT 36430 exact match'::text AS source,
       COUNT(*) AS rows,
       COUNT(DISTINCT person_id) AS persons
FROM procedure_occurrence po
JOIN concept c ON c.concept_id = po.procedure_concept_id
WHERE c.vocabulary_id = 'CPT4'
  AND c.concept_code = '36430'
UNION ALL
SELECT 'Descendants of 4048742 (transfusion of blood product)'::text,
       COUNT(*), COUNT(DISTINCT person_id)
FROM procedure_occurrence po
JOIN concept_ancestor ca
  ON ca.descendant_concept_id = po.procedure_concept_id
WHERE ca.ancestor_concept_id = 4048742;

-- ------------------------------------------------------------
-- 8. Intracranial hemorrhage capture (outcome)
--    Concept 432923 "Intracranial hemorrhage" + descendants
-- ------------------------------------------------------------
\echo '\n--- 8. Intracranial hemorrhage condition coverage ---'
SELECT COUNT(*) AS condition_rows,
       COUNT(DISTINCT co.person_id) AS distinct_persons
FROM condition_occurrence co
JOIN concept_ancestor ca
  ON ca.descendant_concept_id = co.condition_concept_id
WHERE ca.ancestor_concept_id = 432923;

\echo '\n==========================================================='
\echo '  Decision rule:'
\echo '   - If USCDT and MT step_3 counts > 100 each: proceed natively'
\echo '   - If 30-100: frame as feasibility/methods demo, pool with SynPUF'
\echo '   - If < 30:  use MIMIC-IV or Eunomia for methods demo only'
\echo '==========================================================='
