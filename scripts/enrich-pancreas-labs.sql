-- ============================================================================
-- Pancreas CDM Lab Enrichment Script
-- ============================================================================
-- Increases measurement density and adds missing lab types for the 361-patient
-- pancreatic cancer corpus. Generates clinically plausible values anchored to
-- existing visit dates plus interpolated chemo-cycle draws.
--
-- Before: ~6.2 measurements per lab type, 15 lab types
-- After:  ~12-20 measurements per lab type, 32 lab types
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: Snapshot current state
-- ============================================================================
DO $$
DECLARE
  _before_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO _before_count FROM pancreas.measurement;
  RAISE NOTICE 'Measurements BEFORE enrichment: %', _before_count;
END $$;

-- ============================================================================
-- STEP 1: Create intermediate draw dates
-- ============================================================================
-- For each patient, generate additional lab draw dates between existing visits
-- to simulate chemo-cycle monitoring (every ~14-21 days).

CREATE TEMP TABLE patient_draw_dates AS
WITH visit_dates AS (
  -- All existing visit dates per patient
  SELECT person_id, visit_occurrence_id, visit_start_date,
    ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY visit_start_date) as rn,
    COUNT(*) OVER (PARTITION BY person_id) as total_visits,
    -- Lead to get next visit date for interpolation
    LEAD(visit_start_date) OVER (PARTITION BY person_id ORDER BY visit_start_date) as next_visit_date,
    LEAD(visit_occurrence_id) OVER (PARTITION BY person_id ORDER BY visit_start_date) as next_visit_id
  FROM pancreas.visit_occurrence
),
-- Generate interpolated dates between visits (every ~14-21 days)
interpolated AS (
  SELECT
    vd.person_id,
    NULL::integer as visit_occurrence_id,
    (vd.visit_start_date + (gs.n * 14 + FLOOR(RANDOM() * 7)::int) * INTERVAL '1 day')::date as draw_date
  FROM visit_dates vd
  CROSS JOIN generate_series(1, 10) gs(n)
  WHERE vd.next_visit_date IS NOT NULL
    AND (vd.visit_start_date + (gs.n * 14) * INTERVAL '1 day') < vd.next_visit_date - INTERVAL '7 days'
)
-- Combine: existing visit dates + interpolated chemo-cycle dates
SELECT person_id, visit_occurrence_id, visit_start_date as draw_date, 'visit' as source
FROM visit_dates
UNION ALL
SELECT person_id, visit_occurrence_id, draw_date, 'interpolated' as source
FROM interpolated
ORDER BY person_id, draw_date;

-- ============================================================================
-- STEP 2: Define lab reference ranges for pancreatic cancer patients
-- ============================================================================
-- Values use distributions skewed toward abnormal for cancer patients:
-- - Liver enzymes elevated (biliary obstruction common)
-- - Pancreatic enzymes often elevated
-- - Albumin/protein often low (cachexia)
-- - Inflammatory markers elevated
-- - Electrolytes can be deranged (chemo side effects)

CREATE TEMP TABLE lab_definitions (
  measurement_concept_id INTEGER,
  concept_name TEXT,
  unit_concept_id INTEGER,
  unit_source_value TEXT,
  range_low NUMERIC,
  range_high NUMERIC,
  -- Distribution parameters: we use (mean, stddev) for normal distribution
  -- then clamp to physiologic_min..physiologic_max
  mean_val NUMERIC,
  stddev_val NUMERIC,
  physiologic_min NUMERIC,
  physiologic_max NUMERIC,
  -- Whether this lab applies to all patients or subset
  patient_filter TEXT, -- 'all', 'diabetic', 'existing_only'
  measurement_source_value TEXT
);

INSERT INTO lab_definitions VALUES
  -- === NEW LABS: Basic Metabolic Panel ===
  (3016723, 'Creatinine', 8840, 'mg/dL', 0.6, 1.2, 1.05, 0.35, 0.3, 4.5, 'all', 'CREATININE'),
  (3013682, 'BUN', 8840, 'mg/dL', 7, 20, 18, 8, 3, 80, 'all', 'BUN'),
  (3004501, 'Glucose', 8840, 'mg/dL', 70, 100, 125, 40, 50, 450, 'all', 'GLUCOSE'),
  (3019550, 'Sodium', 9557, 'mEq/L', 136, 145, 138, 3, 120, 155, 'all', 'SODIUM'),
  (3023103, 'Potassium', 9557, 'mEq/L', 3.5, 5.0, 4.1, 0.5, 2.5, 6.5, 'all', 'POTASSIUM'),
  (3014576, 'Chloride', 9557, 'mEq/L', 98, 106, 101, 3, 85, 115, 'all', 'CHLORIDE'),
  (3015632, 'CO2', 8753, 'mmol/L', 23, 29, 24, 3, 12, 38, 'all', 'CO2'),
  (3006906, 'Calcium', 8840, 'mg/dL', 8.5, 10.5, 9.0, 0.7, 6.0, 13.0, 'all', 'CALCIUM'),

  -- === NEW LABS: Extended Hepatic ===
  (3035995, 'ALP', 8645, 'U/L', 44, 147, 165, 80, 20, 800, 'all', 'ALK PHOS'),
  (3026910, 'GGT', 8645, 'U/L', 9, 48, 85, 60, 5, 500, 'all', 'GGT'),
  (3020630, 'Total Protein', 8713, 'g/dL', 6.0, 8.3, 6.4, 0.8, 3.5, 9.5, 'all', 'TOTAL PROTEIN'),

  -- === NEW LABS: Pancreatic Enzymes (critical for pancreas corpus) ===
  (3004905, 'Lipase', 8645, 'U/L', 0, 160, 180, 120, 5, 2000, 'all', 'LIPASE'),
  (3016771, 'Amylase', 8645, 'U/L', 28, 100, 95, 55, 10, 1200, 'all', 'AMYLASE'),

  -- === NEW LABS: Inflammatory / Prognostic ===
  (3020460, 'CRP', 8751, 'mg/L', 0, 5, 28, 25, 0.1, 200, 'all', 'CRP'),
  (3016436, 'LDH', 8645, 'U/L', 140, 280, 265, 80, 80, 800, 'all', 'LDH'),

  -- === NEW LABS: Coagulation ===
  (3022217, 'INR', 0, NULL, 0.8, 1.1, 1.15, 0.25, 0.7, 4.0, 'all', 'INR'),

  -- === NEW LABS: Additional ===
  (3001420, 'Magnesium', 8840, 'mg/dL', 1.7, 2.2, 1.85, 0.3, 1.0, 3.5, 'all', 'MAGNESIUM');

-- ============================================================================
-- STEP 3: Insert new lab types at all draw dates
-- ============================================================================
-- Each new lab is generated for every draw date with patient-specific variation.
-- A per-patient offset creates longitudinal consistency (same patient trends
-- similarly across draws, rather than random noise at each point).

INSERT INTO pancreas.measurement (
  measurement_id,
  person_id,
  measurement_concept_id,
  measurement_date,
  measurement_datetime,
  measurement_type_concept_id,
  value_as_number,
  unit_concept_id,
  range_low,
  range_high,
  visit_occurrence_id,
  measurement_source_value,
  measurement_source_concept_id,
  unit_source_value
)
SELECT
  (24198 + ROW_NUMBER() OVER (ORDER BY dd.person_id, ld.measurement_concept_id, dd.draw_date))::integer as measurement_id,
  dd.person_id,
  ld.measurement_concept_id,
  dd.draw_date,
  dd.draw_date::timestamp + INTERVAL '8 hours' + (RANDOM() * INTERVAL '4 hours'),
  32817, -- EHR
  -- Value: patient baseline offset + per-draw noise, clamped to physiologic range
  ROUND(
    GREATEST(ld.physiologic_min,
      LEAST(ld.physiologic_max,
        ld.mean_val
        + (ld.stddev_val * 0.6 * (HASHTEXT(dd.person_id::text || ld.measurement_concept_id::text)::numeric / 2147483647.0)) -- patient-specific baseline shift
        + (ld.stddev_val * 0.4 * (RANDOM()::numeric * 2 - 1)) -- per-draw noise
        -- Trend: values tend to worsen over time for cancer patients
        + (ld.stddev_val * 0.15 * (dd.draw_date - first_draw.min_date)::numeric / GREATEST(1::numeric, (first_draw.max_date - first_draw.min_date)::numeric))
      )
    )::numeric
  , 2) as value_as_number,
  CASE WHEN ld.unit_concept_id = 0 THEN NULL ELSE ld.unit_concept_id END,
  ld.range_low,
  ld.range_high,
  dd.visit_occurrence_id,
  ld.measurement_source_value,
  0, -- measurement_source_concept_id
  ld.unit_source_value
FROM patient_draw_dates dd
CROSS JOIN lab_definitions ld
JOIN (
  SELECT person_id, MIN(draw_date) as min_date, MAX(draw_date) as max_date
  FROM patient_draw_dates
  GROUP BY person_id
) first_draw ON first_draw.person_id = dd.person_id
WHERE ld.patient_filter = 'all';

-- ============================================================================
-- STEP 4: Increase density of EXISTING lab types
-- ============================================================================
-- The existing 11 numeric labs have ~6.2 measurements per patient. Add draws at
-- interpolated dates (ones not already covered by existing measurements).

INSERT INTO pancreas.measurement (
  measurement_id,
  person_id,
  measurement_concept_id,
  measurement_date,
  measurement_datetime,
  measurement_type_concept_id,
  value_as_number,
  unit_concept_id,
  range_low,
  range_high,
  visit_occurrence_id,
  measurement_source_value,
  measurement_source_concept_id,
  unit_source_value
)
WITH existing_labs AS (
  -- Get the distinct lab types with their stats per patient
  SELECT
    m.person_id,
    m.measurement_concept_id,
    m.unit_concept_id,
    m.range_low,
    m.range_high,
    m.measurement_source_value,
    m.unit_source_value,
    AVG(m.value_as_number) as patient_mean,
    STDDEV(m.value_as_number) as patient_stddev,
    MIN(m.measurement_date) as first_date,
    MAX(m.measurement_date) as last_date
  FROM pancreas.measurement m
  WHERE m.value_as_number IS NOT NULL  -- only numeric labs
    AND m.measurement_concept_id NOT IN (3026497, 3012200, 1988360, 3009106) -- exclude genomic
  GROUP BY m.person_id, m.measurement_concept_id, m.unit_concept_id,
           m.range_low, m.range_high, m.measurement_source_value, m.unit_source_value
),
-- Find interpolated draw dates that don't already have this lab
new_draws AS (
  SELECT
    dd.person_id,
    dd.draw_date,
    dd.visit_occurrence_id,
    el.measurement_concept_id,
    el.unit_concept_id,
    el.range_low,
    el.range_high,
    el.measurement_source_value,
    el.unit_source_value,
    el.patient_mean,
    COALESCE(el.patient_stddev, el.patient_mean * 0.1) as patient_stddev,
    el.first_date,
    el.last_date
  FROM patient_draw_dates dd
  JOIN existing_labs el ON el.person_id = dd.person_id
  WHERE dd.source = 'interpolated'
    AND dd.draw_date >= el.first_date
    AND dd.draw_date <= el.last_date
    -- Don't duplicate: no existing measurement within 3 days
    AND NOT EXISTS (
      SELECT 1 FROM pancreas.measurement em
      WHERE em.person_id = dd.person_id
        AND em.measurement_concept_id = el.measurement_concept_id
        AND ABS(em.measurement_date - dd.draw_date) <= 3
    )
)
SELECT
  ((SELECT MAX(measurement_id) FROM pancreas.measurement) + ROW_NUMBER() OVER (ORDER BY nd.person_id, nd.measurement_concept_id, nd.draw_date))::integer,
  nd.person_id,
  nd.measurement_concept_id,
  nd.draw_date,
  nd.draw_date::timestamp + INTERVAL '8 hours' + (RANDOM() * INTERVAL '4 hours'),
  32817,
  ROUND(
    GREATEST(
      nd.patient_mean * 0.3,  -- floor at 30% of patient mean
      LEAST(
        nd.patient_mean * 2.5,  -- ceiling at 250% of patient mean
        nd.patient_mean
        + (nd.patient_stddev * 0.5 * (RANDOM()::numeric * 2 - 1))  -- noise within patient's own range
        + (nd.patient_stddev * 0.1 * (nd.draw_date - nd.first_date)::numeric / GREATEST(1::numeric, (nd.last_date - nd.first_date)::numeric))  -- mild worsening trend
      )
    )::numeric
  , 2),
  nd.unit_concept_id,
  nd.range_low,
  nd.range_high,
  nd.visit_occurrence_id,
  nd.measurement_source_value,
  0,
  nd.unit_source_value
FROM new_draws nd;

-- ============================================================================
-- STEP 5: Add HbA1c for diabetic patients who may be missing draws
-- ============================================================================
-- HbA1c is measured every 3 months for diabetics. Currently 3.9/patient avg.
-- Add draws to bring closer to quarterly cadence.

INSERT INTO pancreas.measurement (
  measurement_id,
  person_id,
  measurement_concept_id,
  measurement_date,
  measurement_datetime,
  measurement_type_concept_id,
  value_as_number,
  unit_concept_id,
  range_low,
  range_high,
  visit_occurrence_id,
  measurement_source_value,
  measurement_source_concept_id,
  unit_source_value
)
WITH diabetic_patients AS (
  SELECT DISTINCT co.person_id
  FROM pancreas.condition_occurrence co
  WHERE co.condition_concept_id IN (
    SELECT c.concept_id FROM vocab.concept c
    WHERE c.concept_name ILIKE '%diabetes%'
      AND c.domain_id = 'Condition'
      AND c.standard_concept = 'S'
  )
),
patient_hba1c_stats AS (
  SELECT m.person_id,
    AVG(m.value_as_number) as avg_a1c,
    STDDEV(m.value_as_number) as stddev_a1c,
    MIN(m.measurement_date) as first_a1c,
    MAX(m.measurement_date) as last_a1c,
    COUNT(*) as existing_count
  FROM pancreas.measurement m
  WHERE m.measurement_concept_id = 3004410
  GROUP BY m.person_id
),
-- Generate quarterly dates within each patient's observation period
quarterly_dates AS (
  SELECT
    dp.person_id,
    ps.avg_a1c,
    COALESCE(ps.stddev_a1c, 0.5) as stddev_a1c,
    (obs.observation_period_start_date + (gs.n * 90 + FLOOR(RANDOM() * 14)::int) * INTERVAL '1 day')::date as draw_date
  FROM diabetic_patients dp
  JOIN pancreas.observation_period obs ON obs.person_id = dp.person_id
  LEFT JOIN patient_hba1c_stats ps ON ps.person_id = dp.person_id
  CROSS JOIN generate_series(0, 6) gs(n)
  WHERE (obs.observation_period_start_date + gs.n * 90 * INTERVAL '1 day') <= obs.observation_period_end_date
)
SELECT
  ((SELECT MAX(measurement_id) FROM pancreas.measurement) + ROW_NUMBER() OVER (ORDER BY qd.person_id, qd.draw_date))::integer,
  qd.person_id,
  3004410, -- HbA1c
  qd.draw_date,
  qd.draw_date::timestamp + INTERVAL '9 hours',
  32817,
  ROUND(
    GREATEST(5.5::numeric,
      LEAST(12.0::numeric,
        COALESCE(qd.avg_a1c, 7.5 + RANDOM()::numeric * 2)
        + (COALESCE(qd.stddev_a1c, 0.5::numeric) * (RANDOM()::numeric * 2 - 1))
      )
    )
  , 1),
  8554, -- percent
  4.0,
  5.6,
  NULL, -- HbA1c doesn't need to be tied to a specific visit
  'HBA1C',
  0,
  '%'
FROM quarterly_dates qd
WHERE NOT EXISTS (
  SELECT 1 FROM pancreas.measurement em
  WHERE em.person_id = qd.person_id
    AND em.measurement_concept_id = 3004410
    AND ABS(em.measurement_date - qd.draw_date) <= 30  -- no existing A1c within a month
);

-- ============================================================================
-- STEP 6: Report final state
-- ============================================================================
DO $$
DECLARE
  _after_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO _after_count FROM pancreas.measurement;
  RAISE NOTICE 'Measurements AFTER enrichment: %', _after_count;
END $$;

COMMIT;
