\pset pager off
\echo 'Validation: extension table presence in omop'

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
      'concept_numeric'
  )
ORDER BY 1;

\echo 'Validation: measurement oncology support columns'
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'omop'
  AND table_name = 'measurement'
  AND column_name IN ('modifier_of_event_id', 'modifier_of_field_concept_id')
ORDER BY 1;

\echo 'Validation: imaging row counts and app linkage'
SELECT 'omop.image_occurrence' AS metric, count(*) AS value FROM omop.image_occurrence
UNION ALL
SELECT 'omop.image_feature', count(*) FROM omop.image_feature
UNION ALL
SELECT 'app.imaging_studies', count(*) FROM app.imaging_studies
UNION ALL
SELECT 'app.imaging_features', count(*) FROM app.imaging_features
UNION ALL
SELECT 'app.imaging_studies.linked_image_occurrence_id', count(*) FROM app.imaging_studies WHERE image_occurrence_id IS NOT NULL
UNION ALL
SELECT 'app.imaging_features.linked_image_feature_id', count(*) FROM app.imaging_features WHERE image_feature_id IS NOT NULL;

\echo 'Validation: genomics row counts and app linkage'
SELECT 'omop.genomic_test' AS metric, count(*) AS value FROM omop.genomic_test
UNION ALL
SELECT 'omop.target_gene', count(*) FROM omop.target_gene
UNION ALL
SELECT 'omop.variant_occurrence', count(*) FROM omop.variant_occurrence
UNION ALL
SELECT 'omop.variant_annotation', count(*) FROM omop.variant_annotation
UNION ALL
SELECT 'app.genomic_uploads', count(*) FROM app.genomic_uploads
UNION ALL
SELECT 'app.genomic_variants', count(*) FROM app.genomic_variants
UNION ALL
SELECT 'app.genomic_variants.linked_omop_measurement_id', count(*) FROM app.genomic_variants WHERE omop_measurement_id IS NOT NULL;

\echo 'Validation: GIS row counts'
SELECT 'omop.location_history' AS metric, count(*) AS value FROM omop.location_history
UNION ALL
SELECT 'omop.external_exposure', count(*) FROM omop.external_exposure
UNION ALL
SELECT 'app.location_history', count(*) FROM app.location_history
UNION ALL
SELECT 'app.external_exposure', count(*) FROM app.external_exposure;

\echo 'Validation: unresolved crosswalks'
SELECT 'app.imaging_study_omop_xref.unresolved' AS metric, count(*) AS value
FROM app.imaging_study_omop_xref
WHERE image_occurrence_id IS NULL
UNION ALL
SELECT 'app.imaging_feature_omop_xref.unresolved', count(*)
FROM app.imaging_feature_omop_xref
WHERE image_feature_id IS NULL
UNION ALL
SELECT 'app.omop_genomic_test_map.unresolved', count(*)
FROM app.omop_genomic_test_map
WHERE genomic_test_id IS NULL
UNION ALL
SELECT 'app.genomic_variant_omop_xref.unresolved', count(*)
FROM app.genomic_variant_omop_xref
WHERE variant_occurrence_id IS NULL;

\echo 'Validation: null-rate checks on required imaging/genomics fields'
SELECT 'omop.image_occurrence.person_id_is_null' AS metric, count(*) AS value
FROM omop.image_occurrence
WHERE person_id IS NULL
UNION ALL
SELECT 'omop.image_occurrence.procedure_occurrence_id_is_null', count(*)
FROM omop.image_occurrence
WHERE procedure_occurrence_id IS NULL
UNION ALL
SELECT 'omop.image_occurrence.modality_concept_id_is_null', count(*)
FROM omop.image_occurrence
WHERE modality_concept_id IS NULL
UNION ALL
SELECT 'omop.image_feature.image_feature_concept_id_is_null', count(*)
FROM omop.image_feature
WHERE image_feature_concept_id IS NULL
UNION ALL
SELECT 'omop.variant_occurrence.specimen_id_is_null', count(*)
FROM omop.variant_occurrence
WHERE specimen_id IS NULL
UNION ALL
SELECT 'omop.variant_occurrence.procedure_occurrence_id_is_null', count(*)
FROM omop.variant_occurrence
WHERE procedure_occurrence_id IS NULL;
