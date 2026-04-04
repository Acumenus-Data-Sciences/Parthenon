<?php

/**
 * Curated OMOP CDM v5.4 schema reference for data interrogation prompts.
 *
 * This is a subset of the full CDM schema, optimized for token efficiency.
 * Only includes tables and columns commonly used in analytical queries.
 * The full schema is in config/cdm-schema-v54.php.
 */

return [
    'prompt_header' => <<<'SCHEMA'
You are Abby, a clinical data analyst with direct PostgreSQL access to an OMOP CDM v5.4 database.

DATABASE ACCESS:
- READ-ONLY on clinical schemas: omop (clinical tables), vocab (vocabulary/concepts), results (Achilles output)
- READ-WRITE on temp_abby schema: YOUR scratch workspace for intermediate tables, staging, and multi-step analyses
  You CAN: CREATE TABLE temp_abby.*, INSERT INTO temp_abby.*, DROP TABLE temp_abby.*, SELECT from temp_abby.*
  You CANNOT: INSERT/UPDATE/DELETE/DROP on omop, vocab, or results schemas

All clinical tables are in the "omop" schema (default search_path).
The cohort table is in the "results" schema: results.cohort.
Use temp_abby for intermediate tables when building multi-step analyses.

KEY CONVENTIONS:
- Every clinical table has a *_concept_id column that references omop.concept
- Always JOIN to omop.concept to get human-readable names
- concept_id = 0 means unmapped/unknown — exclude or label appropriately
- person_id is the universal patient identifier across all tables
- Dates are stored as DATE type (not timestamp)
- Use results.cohort for cohort membership (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
- Use temp_abby schema freely for CTEs materialized as tables, pivot staging, or any intermediate work
SCHEMA,

    'tables' => [
        'person' => [
            'description' => 'One row per patient. Demographics.',
            'columns' => 'person_id (PK), gender_concept_id (FK concept), year_of_birth, month_of_birth, day_of_birth, birth_datetime, race_concept_id (FK concept), ethnicity_concept_id (FK concept), location_id, care_site_id, person_source_value',
        ],
        'observation_period' => [
            'description' => 'Contiguous time ranges when a person has data. Use to define "at risk" windows.',
            'columns' => 'observation_period_id (PK), person_id (FK person), observation_period_start_date, observation_period_end_date, period_type_concept_id',
        ],
        'visit_occurrence' => [
            'description' => 'Healthcare encounters (inpatient, outpatient, ER, etc.).',
            'columns' => 'visit_occurrence_id (PK), person_id (FK person), visit_concept_id (FK concept), visit_start_date, visit_end_date, visit_type_concept_id, visit_source_value',
        ],
        'condition_occurrence' => [
            'description' => 'Diagnoses and conditions recorded for a patient.',
            'columns' => 'condition_occurrence_id (PK), person_id (FK person), condition_concept_id (FK concept), condition_start_date, condition_end_date, condition_type_concept_id, condition_source_value, condition_source_concept_id',
        ],
        'drug_exposure' => [
            'description' => 'Medication prescriptions and administrations.',
            'columns' => 'drug_exposure_id (PK), person_id (FK person), drug_concept_id (FK concept), drug_exposure_start_date, drug_exposure_end_date, drug_type_concept_id, quantity, days_supply, sig, drug_source_value, drug_source_concept_id',
        ],
        'procedure_occurrence' => [
            'description' => 'Clinical procedures performed on patients.',
            'columns' => 'procedure_occurrence_id (PK), person_id (FK person), procedure_concept_id (FK concept), procedure_date, procedure_type_concept_id, procedure_source_value, procedure_source_concept_id',
        ],
        'measurement' => [
            'description' => 'Lab results, vital signs, and other quantitative clinical data.',
            'columns' => 'measurement_id (PK), person_id (FK person), measurement_concept_id (FK concept), measurement_date, measurement_type_concept_id, value_as_number, value_as_concept_id, unit_concept_id (FK concept), range_low, range_high, measurement_source_value, measurement_source_concept_id, unit_source_value',
        ],
        'observation' => [
            'description' => 'Clinical observations that don\'t fit other domains (social history, family history, etc.).',
            'columns' => 'observation_id (PK), person_id (FK person), observation_concept_id (FK concept), observation_date, observation_type_concept_id, value_as_number, value_as_string, value_as_concept_id, qualifier_concept_id, unit_concept_id, observation_source_value, observation_source_concept_id',
        ],
        'death' => [
            'description' => 'Patient death records.',
            'columns' => 'person_id (PK, FK person), death_date, death_type_concept_id, cause_concept_id (FK concept), cause_source_value',
        ],
        'concept' => [
            'description' => 'Vocabulary lookup table. JOIN here to get concept_name for any *_concept_id.',
            'columns' => 'concept_id (PK), concept_name, domain_id, vocabulary_id, concept_class_id, standard_concept, concept_code',
        ],
        'concept_ancestor' => [
            'description' => 'Hierarchical relationships. Use to find descendants of a concept (e.g., all subtypes of diabetes).',
            'columns' => 'ancestor_concept_id (FK concept), descendant_concept_id (FK concept), min_levels_of_separation, max_levels_of_separation',
        ],
        'concept_relationship' => [
            'description' => 'Pairwise concept relationships (Maps to, Is a, etc.).',
            'columns' => 'concept_id_1, concept_id_2, relationship_id',
        ],
        'results.cohort' => [
            'description' => 'Cohort membership table. One row per person-period in a cohort.',
            'columns' => 'cohort_definition_id, subject_id (= person_id), cohort_start_date, cohort_end_date',
        ],
    ],

    'common_joins' => <<<'JOINS'
COMMON JOIN PATTERNS:
- Get condition name: JOIN omop.concept c ON c.concept_id = co.condition_concept_id
- Get drug name: JOIN omop.concept c ON c.concept_id = de.drug_concept_id
- Get measurement name + unit: JOIN omop.concept mc ON mc.concept_id = m.measurement_concept_id LEFT JOIN omop.concept uc ON uc.concept_id = m.unit_concept_id
- Get gender label: JOIN omop.concept gc ON gc.concept_id = p.gender_concept_id
- Get race label: JOIN omop.concept rc ON rc.concept_id = p.race_concept_id
- Find all descendants: JOIN omop.concept_ancestor ca ON ca.ancestor_concept_id = <parent_id> AND ca.descendant_concept_id = <table>.concept_id
- Age calculation: EXTRACT(YEAR FROM <reference_date>) - p.year_of_birth
JOINS,
];
