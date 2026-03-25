-- =============================================================================
-- SynPUF OMOP CDM v5.4 — Index Optimization for Achilles Performance
-- =============================================================================
-- Non-destructive: CREATE INDEX CONCURRENTLY adds indexes without locking.
-- Safe to run while the database is in use.
-- Idempotent: IF NOT EXISTS prevents errors on re-run.
--
-- Run AFTER Achilles completes, BEFORE the next run.
-- Estimated time: 30-90 minutes depending on I/O (1.55B rows total).
--
-- Usage:
--   psql -h pgsql.acumenus.net -U smudoshi -d parthenon -f synpuf_optimize_indexes.sql
--
-- NOTE: CONCURRENTLY cannot run inside a transaction block.
--       Run with psql (not inside BEGIN/COMMIT).
-- =============================================================================

-- Show progress
\echo '=== SynPUF Index Optimization ==='
\echo 'Adding OHDSI-recommended indexes for Achilles performance'
\echo ''

-- ---------------------------------------------------------------------------
-- 1. COMPOSITE INDEXES: (person_id, concept_id)
--    Covers the dominant Achilles pattern: COUNT(DISTINCT person_id) GROUP BY concept_id
--    Enables index-only scans on the largest analyses.
-- ---------------------------------------------------------------------------

\echo '--- Composite indexes (person_id, concept_id) ---'

\echo 'condition_occurrence (303M rows)...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_cond_person_concept
    ON synpuf.condition_occurrence (person_id, condition_concept_id);

\echo 'drug_exposure (128M rows)...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_drug_person_concept
    ON synpuf.drug_exposure (person_id, drug_concept_id);

\echo 'procedure_occurrence (231M rows)...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_proc_person_concept
    ON synpuf.procedure_occurrence (person_id, procedure_concept_id);

\echo 'measurement (70M rows)...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_meas_person_concept
    ON synpuf.measurement (person_id, measurement_concept_id);

\echo 'visit_occurrence (112M rows)...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_visit_person_concept
    ON synpuf.visit_occurrence (person_id, visit_concept_id);

\echo 'observation (39M rows)...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_obs_person_concept
    ON synpuf.observation (person_id, observation_concept_id);

-- ---------------------------------------------------------------------------
-- 2. DATE INDEXES: Temporal distribution analyses (Achilles X11 patterns)
--    Used by EXTRACT(YEAR FROM date) and date range filtering.
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Date indexes for temporal analyses ---'

\echo 'condition_occurrence.condition_start_date...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_cond_start_date
    ON synpuf.condition_occurrence (condition_start_date);

\echo 'drug_exposure.drug_exposure_start_date...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_drug_start_date
    ON synpuf.drug_exposure (drug_exposure_start_date);

\echo 'procedure_occurrence.procedure_date...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_proc_date
    ON synpuf.procedure_occurrence (procedure_date);

\echo 'measurement.measurement_date...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_meas_date
    ON synpuf.measurement (measurement_date);

\echo 'observation.observation_date...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_obs_date
    ON synpuf.observation (observation_date);

\echo 'observation_period start/end dates...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_obsp_start_date
    ON synpuf.observation_period (observation_period_start_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_obsp_end_date
    ON synpuf.observation_period (observation_period_end_date);

-- ---------------------------------------------------------------------------
-- 3. COST TABLE INDEXES (659M rows)
--    Achilles cost analyses filter by domain then join to event tables.
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Cost table indexes (659M rows) ---'

\echo 'cost.cost_event_field_concept_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_cost_event_field
    ON synpuf.cost (cost_event_field_concept_id);

\echo 'cost (cost_event_field_concept_id, cost_event_id) composite...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_cost_eventfield_event
    ON synpuf.cost (cost_event_field_concept_id, cost_event_id);

\echo 'cost.cost_concept_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_cost_concept
    ON synpuf.cost (cost_concept_id);

-- ---------------------------------------------------------------------------
-- 4. TYPE CONCEPT INDEXES
--    Several analyses group by *_type_concept_id.
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Type concept indexes ---'

\echo 'visit_occurrence.visit_type_concept_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_visit_type
    ON synpuf.visit_occurrence (visit_type_concept_id);

\echo 'condition_occurrence.condition_type_concept_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_cond_type
    ON synpuf.condition_occurrence (condition_type_concept_id);

\echo 'drug_exposure.drug_type_concept_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_drug_type
    ON synpuf.drug_exposure (drug_type_concept_id);

\echo 'measurement.measurement_type_concept_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_meas_type
    ON synpuf.measurement (measurement_type_concept_id);

-- ---------------------------------------------------------------------------
-- 5. ACHILLES RESULTS TABLE INDEXES (synpuf_results schema)
--    Speeds up Ares frontend reads after Achilles writes.
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Achilles results table indexes ---'

\echo 'achilles_results.analysis_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_ar_analysis
    ON synpuf_results.achilles_results (analysis_id);

\echo 'achilles_results (analysis_id, stratum_1) composite...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_ar_analysis_s1
    ON synpuf_results.achilles_results (analysis_id, stratum_1);

\echo 'achilles_results_dist.analysis_id...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_ard_analysis
    ON synpuf_results.achilles_results_dist (analysis_id);

\echo 'achilles_results_dist (analysis_id, stratum_1) composite...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_ard_analysis_s1
    ON synpuf_results.achilles_results_dist (analysis_id, stratum_1);

-- ---------------------------------------------------------------------------
-- 6. ANALYZE — Update planner statistics after index creation
-- ---------------------------------------------------------------------------

\echo ''
\echo '--- Running ANALYZE on synpuf schema ---'

ANALYZE synpuf.person;
ANALYZE synpuf.observation_period;
ANALYZE synpuf.visit_occurrence;
ANALYZE synpuf.condition_occurrence;
ANALYZE synpuf.drug_exposure;
ANALYZE synpuf.procedure_occurrence;
ANALYZE synpuf.measurement;
ANALYZE synpuf.observation;
ANALYZE synpuf.death;
ANALYZE synpuf.cost;
ANALYZE synpuf.device_exposure;
ANALYZE synpuf.payer_plan_period;
ANALYZE synpuf.care_site;
ANALYZE synpuf.provider;
ANALYZE synpuf.location;

\echo ''
\echo '--- Running ANALYZE on synpuf_results schema ---'

ANALYZE synpuf_results.achilles_results;
ANALYZE synpuf_results.achilles_results_dist;

-- ---------------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------------

\echo ''
\echo '=== Done ==='
\echo 'New indexes added:'
SELECT schemaname, tablename, COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname IN ('synpuf', 'synpuf_results')
GROUP BY schemaname, tablename
ORDER BY schemaname, tablename;
