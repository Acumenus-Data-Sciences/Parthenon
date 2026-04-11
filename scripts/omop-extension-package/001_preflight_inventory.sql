\pset pager off
\echo 'OMOP extension preflight inventory'

SELECT current_database() AS database_name,
       current_user AS database_user,
       version() AS postgres_version;

SELECT cdm_source_name,
       cdm_version,
       source_release_date,
       cdm_holder
FROM omop.cdm_source;

\echo 'Core extension table presence in omop'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'omop'
  AND table_name IN (
      'image_occurrence',
      'image_feature',
      'genomic_test',
      'target_gene',
      'variant_occurrence',
      'variant_annotation',
      'location_history',
      'external_exposure',
      'episode',
      'episode_event',
      'concept_numeric'
  )
ORDER BY 1;

\echo 'Oncology support columns on omop.measurement'
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'omop'
  AND table_name = 'measurement'
  AND column_name IN ('modifier_of_event_id', 'modifier_of_field_concept_id')
ORDER BY 1;

\echo 'Estimated row counts for relevant omop tables'
SELECT relname AS table_name,
       reltuples::bigint AS estimated_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'omop'
  AND relname IN (
      'person',
      'procedure_occurrence',
      'measurement',
      'observation',
      'specimen',
      'episode',
      'episode_event'
  )
ORDER BY 1;

\echo 'App-layer precursor counts'
SELECT table_name,
       (xpath('/row/cnt/text()',
              query_to_xml(format('select count(*) as cnt from app.%I', table_name), true, true, '')))[1]::text AS row_count
FROM (
    VALUES
      ('imaging_studies'),
      ('imaging_series'),
      ('imaging_features'),
      ('genomic_uploads'),
      ('genomic_variants'),
      ('location_history'),
      ('external_exposure')
) AS t(table_name)
ORDER BY 1;

\echo 'Unlinked app-layer rows that motivate backfill'
SELECT 'app.imaging_studies.image_occurrence_id_is_null' AS metric,
       count(*) AS row_count
FROM app.imaging_studies
WHERE image_occurrence_id IS NULL
UNION ALL
SELECT 'app.imaging_features.image_feature_id_is_null',
       count(*)
FROM app.imaging_features
WHERE image_feature_id IS NULL
UNION ALL
SELECT 'app.genomic_variants.omop_measurement_id_is_null',
       count(*)
FROM app.genomic_variants
WHERE omop_measurement_id IS NULL;
