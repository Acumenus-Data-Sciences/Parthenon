-- migrate-irsf-schemas.sql
-- Isolate IRSF data into dedicated schemas (irsf, irsf_results)
-- and update source daimon pointers.
--
-- Non-destructive: uses ALTER TABLE SET SCHEMA (no DROP/DELETE/TRUNCATE).
-- Runs in a single transaction.

BEGIN;

-- =============================================================================
-- Step 1: Extract IRSF custom vocabulary to temp tables (for verification)
-- =============================================================================

CREATE TEMP TABLE _irsf_concepts AS SELECT * FROM omop.concept WHERE concept_id >= 2000000000;
SELECT 'irsf_concepts' AS tbl, count(*) FROM _irsf_concepts;

CREATE TEMP TABLE _irsf_concept_rel AS SELECT * FROM omop.concept_relationship WHERE concept_id_1 >= 2000000000 OR concept_id_2 >= 2000000000;
SELECT 'irsf_concept_rel' AS tbl, count(*) FROM _irsf_concept_rel;

CREATE TEMP TABLE _irsf_concept_ancestor AS SELECT * FROM omop.concept_ancestor WHERE ancestor_concept_id >= 2000000000 OR descendant_concept_id >= 2000000000;
SELECT 'irsf_concept_ancestor' AS tbl, count(*) FROM _irsf_concept_ancestor;

CREATE TEMP TABLE _irsf_vocabulary AS SELECT * FROM omop.vocabulary WHERE vocabulary_id = 'IRSF-NHS';
SELECT 'irsf_vocabulary' AS tbl, count(*) FROM _irsf_vocabulary;

CREATE TEMP TABLE _irsf_concept_class AS SELECT * FROM omop.concept_class WHERE concept_class_id = 'Clinical Observation';
SELECT 'irsf_concept_class' AS tbl, count(*) FROM _irsf_concept_class;

CREATE TEMP TABLE _irsf_stcm AS SELECT * FROM omop.source_to_concept_map WHERE source_vocabulary_id = 'IRSF-NHS' OR target_vocabulary_id = 'IRSF-NHS';
SELECT 'irsf_stcm' AS tbl, count(*) FROM _irsf_stcm;

-- =============================================================================
-- Step 2: Create irsf schema and move IRSF clinical + ETL staging tables
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS irsf;

-- Clinical tables
ALTER TABLE omop.person SET SCHEMA irsf;
ALTER TABLE omop.observation_period SET SCHEMA irsf;
ALTER TABLE omop.visit_occurrence SET SCHEMA irsf;
ALTER TABLE omop.visit_detail SET SCHEMA irsf;
ALTER TABLE omop.condition_occurrence SET SCHEMA irsf;
ALTER TABLE omop.drug_exposure SET SCHEMA irsf;
ALTER TABLE omop.measurement SET SCHEMA irsf;
ALTER TABLE omop.observation SET SCHEMA irsf;
ALTER TABLE omop.procedure_occurrence SET SCHEMA irsf;
ALTER TABLE omop.device_exposure SET SCHEMA irsf;
ALTER TABLE omop.death SET SCHEMA irsf;
ALTER TABLE omop.specimen SET SCHEMA irsf;
ALTER TABLE omop.note SET SCHEMA irsf;
ALTER TABLE omop.note_nlp SET SCHEMA irsf;
ALTER TABLE omop.drug_era SET SCHEMA irsf;
ALTER TABLE omop.condition_era SET SCHEMA irsf;
ALTER TABLE omop.dose_era SET SCHEMA irsf;
ALTER TABLE omop.cost SET SCHEMA irsf;
ALTER TABLE omop.payer_plan_period SET SCHEMA irsf;
ALTER TABLE omop.care_site SET SCHEMA irsf;
ALTER TABLE omop.provider SET SCHEMA irsf;
ALTER TABLE omop.location SET SCHEMA irsf;
ALTER TABLE omop.cdm_source SET SCHEMA irsf;
ALTER TABLE omop.fact_relationship SET SCHEMA irsf;
ALTER TABLE omop.episode SET SCHEMA irsf;
ALTER TABLE omop.episode_event SET SCHEMA irsf;
ALTER TABLE omop.source_to_concept_map SET SCHEMA irsf;

-- ETL staging tables
ALTER TABLE omop.all_visits SET SCHEMA irsf;
ALTER TABLE omop.assign_all_visit_ids SET SCHEMA irsf;
ALTER TABLE omop.final_visit_ids SET SCHEMA irsf;
ALTER TABLE omop.claims SET SCHEMA irsf;
ALTER TABLE omop.claims_transactions SET SCHEMA irsf;
ALTER TABLE omop.source_to_source_vocab_map SET SCHEMA irsf;
ALTER TABLE omop.source_to_standard_vocab_map SET SCHEMA irsf;
ALTER TABLE omop.states_map SET SCHEMA irsf;
ALTER TABLE omop.cohort SET SCHEMA irsf;
ALTER TABLE omop.cohort_definition SET SCHEMA irsf;
ALTER TABLE omop.metadata SET SCHEMA irsf;

-- Concept embeddings (empty, belongs to CDM not shared vocab)
ALTER TABLE omop.concept_embeddings SET SCHEMA irsf;

-- =============================================================================
-- Step 3: Create irsf_results schema and move all results tables
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS irsf_results;

ALTER TABLE results.achilles_analysis SET SCHEMA irsf_results;
ALTER TABLE results.achilles_performance SET SCHEMA irsf_results;
ALTER TABLE results.achilles_result_concept_count SET SCHEMA irsf_results;
ALTER TABLE results.achilles_results SET SCHEMA irsf_results;
ALTER TABLE results.achilles_results_dist SET SCHEMA irsf_results;
ALTER TABLE results.cohort SET SCHEMA irsf_results;
ALTER TABLE results.cohort_inclusion_stats SET SCHEMA irsf_results;
ALTER TABLE results.dqd_results SET SCHEMA irsf_results;

-- =============================================================================
-- Step 4: Update source daimons
-- =============================================================================

-- Source 57 (IRSF): point to new schemas
UPDATE app.source_daimons SET table_qualifier = 'irsf' WHERE id = 34;
UPDATE app.source_daimons SET table_qualifier = 'vocab' WHERE id = 35;
UPDATE app.source_daimons SET table_qualifier = 'irsf_results' WHERE id = 36;

-- Source 47 (Acumenus CDM): vocab -> vocab
UPDATE app.source_daimons SET table_qualifier = 'vocab' WHERE id = 14;

-- Sources 48, 50 (SynPUF): vocab -> vocab
UPDATE app.source_daimons SET table_qualifier = 'vocab' WHERE id = 17;
UPDATE app.source_daimons SET table_qualifier = 'vocab' WHERE id = 20;

-- =============================================================================
-- Step 5: Verification queries
-- =============================================================================

SELECT 'irsf.person' AS tbl, count(*) FROM irsf.person;
SELECT 'irsf.measurement' AS tbl, count(*) FROM irsf.measurement;
SELECT 'irsf.observation' AS tbl, count(*) FROM irsf.observation;
SELECT 'irsf.drug_exposure' AS tbl, count(*) FROM irsf.drug_exposure;
SELECT 'irsf_results.achilles_results' AS tbl, count(*) FROM irsf_results.achilles_results;

-- Updated source daimons for sources 46-57
SELECT sd.id, s.source_name, sd.daimon_type, sd.table_qualifier
FROM app.source_daimons sd JOIN app.sources s ON s.id = sd.source_id
WHERE sd.source_id BETWEEN 46 AND 57
ORDER BY sd.source_id, sd.daimon_type;

-- Remaining omop tables (should be vocab tables only)
SELECT tablename FROM pg_tables WHERE schemaname='omop' ORDER BY tablename;

COMMIT;
