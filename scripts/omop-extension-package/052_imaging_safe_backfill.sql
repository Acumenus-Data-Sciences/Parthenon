\pset pager off
\echo 'Seeding safe modality mappings for first-pass imaging backfill'

INSERT INTO app.omop_imaging_modality_map (source_modality, modality_concept_id, notes)
VALUES
    ('CT', 4300757, 'Generic SNOMED computed tomography concept used for first-pass MI-CDM backfill'),
    ('MR', 4013636, 'Generic SNOMED magnetic resonance imaging concept used for first-pass MI-CDM backfill'),
    ('PT', 4305790, 'Generic SNOMED positron emission tomography concept used for first-pass MI-CDM backfill'),
    ('CR', 37523352, 'Generic CDISC digital radiography concept used for first-pass MI-CDM backfill'),
    ('US', 4037672, 'Generic SNOMED ultrasonography concept used for first-pass MI-CDM backfill')
ON CONFLICT (source_modality) DO UPDATE
SET modality_concept_id = EXCLUDED.modality_concept_id,
    notes = EXCLUDED.notes;

\echo 'Seeding deterministic safe imaging series mappings for Acumenus only'

WITH series AS (
    SELECT
        s.id AS series_id,
        s.study_id,
        st.person_id,
        st.study_date,
        upper(s.modality) AS modality,
        upper(coalesce(s.body_part_examined, '')) AS body_part_examined,
        coalesce(s.series_description, '') AS series_description
    FROM app.imaging_series s
    JOIN app.imaging_studies st ON st.id = s.study_id
    WHERE st.source_id = 47
      AND upper(s.modality) IN ('CT', 'PT', 'CR')
      AND st.person_id IS NOT NULL
      AND st.study_date IS NOT NULL
), proc AS (
    SELECT
        po.procedure_occurrence_id,
        po.person_id,
        po.procedure_date,
        po.procedure_concept_id,
        upper(coalesce(po.procedure_source_value, '')) AS procedure_source_value,
        po.visit_occurrence_id,
        CASE
            WHEN po.procedure_concept_id IN (4058335, 4061009, 606840) THEN 'CT'
            WHEN po.procedure_concept_id = 4305790 THEN 'PT'
            WHEN po.procedure_concept_id = 4163872 THEN 'CR'
            ELSE NULL
        END AS modality
    FROM omop.procedure_occurrence po
), safe AS (
    SELECT
        series.series_id,
        proc.procedure_occurrence_id,
        proc.visit_occurrence_id,
        map.modality_concept_id,
        NULL::integer AS anatomic_site_concept_id,
        count(*) OVER (PARTITION BY series.series_id) AS safe_candidate_count
    FROM series
    JOIN proc
      ON proc.person_id = series.person_id
     AND proc.procedure_date = series.study_date
     AND proc.modality = series.modality
    JOIN app.omop_imaging_modality_map map
      ON map.source_modality = series.modality
    WHERE
        series.modality = 'PT'
        OR (
            series.modality = 'CR'
            AND series.body_part_examined LIKE '%CHEST%'
            AND proc.procedure_source_value LIKE '%CHEST%'
        )
        OR (
            series.modality = 'CT'
            AND series.body_part_examined LIKE '%CHEST%'
            AND proc.procedure_source_value LIKE '%CHEST%'
        )
        OR (
            series.modality = 'CT'
            AND (
                series.body_part_examined LIKE '%ABD%'
                OR series.body_part_examined LIKE '%PELVIS%'
                OR series.body_part_examined LIKE '%PANCREAS%'
                OR series.body_part_examined LIKE '%LIVER%'
                OR series.body_part_examined LIKE '%BRZUSZNA%'
            )
            AND proc.procedure_source_value LIKE '%ABD%'
        )
)
INSERT INTO app.imaging_series_omop_xref (
    series_id,
    procedure_occurrence_id,
    visit_occurrence_id,
    modality_concept_id,
    anatomic_site_concept_id,
    mapping_status,
    notes
)
SELECT
    series_id,
    procedure_occurrence_id,
    visit_occurrence_id,
    modality_concept_id,
    anatomic_site_concept_id,
    'matched',
    'First-pass strict Acumenus imaging backfill candidate'
FROM safe
WHERE safe_candidate_count = 1
ON CONFLICT (series_id) DO UPDATE
SET procedure_occurrence_id = EXCLUDED.procedure_occurrence_id,
    visit_occurrence_id = EXCLUDED.visit_occurrence_id,
    modality_concept_id = EXCLUDED.modality_concept_id,
    anatomic_site_concept_id = EXCLUDED.anatomic_site_concept_id,
    mapping_status = EXCLUDED.mapping_status,
    notes = EXCLUDED.notes,
    updated_at = now();

\echo 'Inserting omop.image_occurrence rows for matched series that are not yet linked'

WITH inserted AS (
    INSERT INTO omop.image_occurrence (
        person_id,
        visit_occurrence_id,
        procedure_occurrence_id,
        wadors_uri,
        local_path,
        image_occurrence_date,
        image_study_uid,
        image_series_uid,
        modality_concept_id,
        anatomic_site_concept_id
    )
    SELECT
        st.person_id,
        x.visit_occurrence_id,
        x.procedure_occurrence_id,
        st.wadors_uri,
        coalesce(s.file_dir, st.file_dir),
        st.study_date,
        st.study_instance_uid,
        s.series_instance_uid,
        x.modality_concept_id,
        x.anatomic_site_concept_id
    FROM app.imaging_series_omop_xref x
    JOIN app.imaging_series s ON s.id = x.series_id
    JOIN app.imaging_studies st ON st.id = s.study_id
    WHERE x.mapping_status = 'matched'
      AND x.image_occurrence_id IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM omop.image_occurrence io
          WHERE io.image_study_uid = st.study_instance_uid
            AND io.image_series_uid = s.series_instance_uid
      )
    RETURNING image_occurrence_id, image_study_uid, image_series_uid
)
UPDATE app.imaging_series_omop_xref x
SET image_occurrence_id = io.image_occurrence_id,
    updated_at = now()
FROM inserted io
JOIN app.imaging_series s ON s.series_instance_uid = io.image_series_uid
JOIN app.imaging_studies st ON st.id = s.study_id AND st.study_instance_uid = io.image_study_uid
WHERE x.series_id = s.id;

\echo 'Backfilling xref rows for previously inserted image_occurrence records'

UPDATE app.imaging_series_omop_xref x
SET image_occurrence_id = io.image_occurrence_id,
    updated_at = now()
FROM app.imaging_series s
JOIN app.imaging_studies st ON st.id = s.study_id
JOIN omop.image_occurrence io
  ON io.image_study_uid = st.study_instance_uid
 AND io.image_series_uid = s.series_instance_uid
WHERE x.series_id = s.id
  AND x.mapping_status = 'matched'
  AND x.image_occurrence_id IS NULL;

\echo 'Updating app.imaging_series.image_occurrence_id from xref'

UPDATE app.imaging_series s
SET image_occurrence_id = x.image_occurrence_id
FROM app.imaging_series_omop_xref x
WHERE x.series_id = s.id
  AND x.image_occurrence_id IS NOT NULL
  AND s.image_occurrence_id IS DISTINCT FROM x.image_occurrence_id;
