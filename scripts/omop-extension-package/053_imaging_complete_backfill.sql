\pset pager off
\echo 'Creating derived imaging procedure sequence and audit xref'

CREATE SEQUENCE IF NOT EXISTS omop.derived_imaging_procedure_occurrence_seq
    START WITH 900000001
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE omop.derived_imaging_procedure_occurrence_seq
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

DO $$
DECLARE
    target_last_value bigint;
BEGIN
    SELECT greatest(
        900000000::bigint,
        coalesce(max(procedure_occurrence_id)::bigint, 0)
    )
    INTO target_last_value
    FROM omop.procedure_occurrence;

    IF target_last_value >= 2147483647 THEN
        RAISE EXCEPTION
            'Cannot seed derived imaging procedure sequence safely: current procedure_occurrence_id max % exceeds integer headroom',
            target_last_value;
    END IF;

    PERFORM setval(
        'omop.derived_imaging_procedure_occurrence_seq',
        target_last_value,
        true
    );
END
$$;

CREATE TABLE IF NOT EXISTS app.imaging_procedure_omop_xref (
    study_id bigint NOT NULL,
    modality varchar(20) NOT NULL,
    procedure_occurrence_id bigint NOT NULL UNIQUE,
    procedure_concept_id integer NOT NULL,
    procedure_type_concept_id integer NOT NULL,
    source_strategy varchar(30) NOT NULL,
    source_procedure_occurrence_id bigint,
    visit_occurrence_id bigint,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (study_id, modality)
);

COMMENT ON TABLE app.imaging_procedure_omop_xref IS
    'Audit table for procedure_occurrence rows linked or derived to support MI-CDM image_occurrence backfill.';

\echo 'Ensuring modality maps needed for complete acquisition-series imaging backfill'

INSERT INTO app.omop_imaging_modality_map (source_modality, modality_concept_id, notes)
VALUES
    ('CT', 4300757, 'Generic SNOMED computed tomography concept used for derived imaging procedures'),
    ('MR', 4013636, 'Generic SNOMED magnetic resonance imaging concept used for derived imaging procedures'),
    ('PT', 4305790, 'Generic SNOMED positron emission tomography concept used for derived imaging procedures'),
    ('CR', 37545436, 'Generic radiography concept used for derived imaging procedures'),
    ('US', 4037672, 'Generic SNOMED ultrasonography concept used for derived imaging procedures')
ON CONFLICT (source_modality) DO UPDATE
SET modality_concept_id = EXCLUDED.modality_concept_id,
    notes = EXCLUDED.notes;

\echo 'Creating derived procedure_occurrence rows for unresolved study+modality groups'

WITH unresolved_groups AS (
    SELECT DISTINCT
        st.id AS study_id,
        st.person_id,
        st.study_date,
        upper(s.modality) AS modality
    FROM app.imaging_studies st
    JOIN app.imaging_series s ON s.study_id = st.id
    WHERE st.source_id = 47
      AND st.person_id IS NOT NULL
      AND st.study_date IS NOT NULL
      AND s.image_occurrence_id IS NULL
      AND upper(s.modality) IN ('CT', 'MR', 'PT', 'CR', 'US')
), to_create AS (
    SELECT
        g.study_id,
        g.person_id,
        g.study_date,
        g.modality,
        map.modality_concept_id AS procedure_concept_id
    FROM unresolved_groups g
    JOIN app.omop_imaging_modality_map map
      ON map.source_modality = g.modality
    LEFT JOIN app.imaging_procedure_omop_xref x
      ON x.study_id = g.study_id
     AND x.modality = g.modality
    WHERE x.study_id IS NULL
), inserted AS (
    INSERT INTO omop.procedure_occurrence (
        procedure_occurrence_id,
        person_id,
        procedure_concept_id,
        procedure_date,
        procedure_datetime,
        procedure_end_date,
        procedure_end_datetime,
        procedure_type_concept_id,
        modifier_concept_id,
        quantity,
        provider_id,
        visit_occurrence_id,
        visit_detail_id,
        procedure_source_value,
        procedure_source_concept_id,
        modifier_source_value
    )
    SELECT
        nextval('omop.derived_imaging_procedure_occurrence_seq'),
        c.person_id,
        c.procedure_concept_id,
        c.study_date,
        NULL,
        c.study_date,
        NULL,
        32827,
        0,
        1,
        NULL,
        NULL,
        NULL,
        left('PARTH_IMG_ETL:' || c.study_id || ':' || c.modality, 50),
        0,
        'DICOM_ETL'
    FROM to_create c
    RETURNING procedure_occurrence_id, person_id, procedure_concept_id, procedure_date, procedure_source_value
)
INSERT INTO app.imaging_procedure_omop_xref (
    study_id,
    modality,
    procedure_occurrence_id,
    procedure_concept_id,
    procedure_type_concept_id,
    source_strategy,
    source_procedure_occurrence_id,
    visit_occurrence_id,
    notes
)
SELECT
    c.study_id,
    c.modality,
    i.procedure_occurrence_id,
    c.procedure_concept_id,
    32827,
    'derived',
    NULL,
    NULL,
    'Derived from app.imaging_studies/app.imaging_series for MI-CDM completion'
FROM to_create c
JOIN inserted i
  ON i.person_id = c.person_id
 AND i.procedure_date = c.study_date
 AND i.procedure_concept_id = c.procedure_concept_id
 AND i.procedure_source_value = left('PARTH_IMG_ETL:' || c.study_id || ':' || c.modality, 50)
ON CONFLICT (study_id, modality) DO NOTHING;

\echo 'Updating unresolved imaging series xref rows to use derived procedures'

WITH unresolved_series AS (
    SELECT
        s.id AS series_id,
        st.id AS study_id,
        upper(s.modality) AS modality,
        x.procedure_occurrence_id,
        x.visit_occurrence_id,
        map.modality_concept_id
    FROM app.imaging_series s
    JOIN app.imaging_studies st ON st.id = s.study_id
    JOIN app.imaging_procedure_omop_xref x
      ON x.study_id = st.id
     AND x.modality = upper(s.modality)
    JOIN app.omop_imaging_modality_map map
      ON map.source_modality = upper(s.modality)
    WHERE st.source_id = 47
      AND st.person_id IS NOT NULL
      AND st.study_date IS NOT NULL
      AND s.image_occurrence_id IS NULL
      AND upper(s.modality) IN ('CT', 'MR', 'PT', 'CR', 'US')
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
    NULL,
    'derived',
    'Derived imaging procedure for MI-CDM completion'
FROM unresolved_series
ON CONFLICT (series_id) DO UPDATE
SET procedure_occurrence_id = EXCLUDED.procedure_occurrence_id,
    visit_occurrence_id = EXCLUDED.visit_occurrence_id,
    modality_concept_id = EXCLUDED.modality_concept_id,
    mapping_status = EXCLUDED.mapping_status,
    notes = EXCLUDED.notes,
    updated_at = now();

\echo 'Inserting omop.image_occurrence rows for remaining unresolved acquisition series'

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
    WHERE x.mapping_status IN ('matched', 'derived')
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

\echo 'Backfilling xref rows for any pre-existing image_occurrence rows'

UPDATE app.imaging_series_omop_xref x
SET image_occurrence_id = io.image_occurrence_id,
    updated_at = now()
FROM app.imaging_series s
JOIN app.imaging_studies st ON st.id = s.study_id
JOIN omop.image_occurrence io
  ON io.image_study_uid = st.study_instance_uid
 AND io.image_series_uid = s.series_instance_uid
WHERE x.series_id = s.id
  AND x.mapping_status IN ('matched', 'derived')
  AND x.image_occurrence_id IS NULL;

\echo 'Updating app.imaging_series.image_occurrence_id from xref'

UPDATE app.imaging_series s
SET image_occurrence_id = x.image_occurrence_id
FROM app.imaging_series_omop_xref x
WHERE x.series_id = s.id
  AND x.image_occurrence_id IS NOT NULL
  AND s.image_occurrence_id IS DISTINCT FROM x.image_occurrence_id;

\echo 'Updating study-level compatibility field only where a study has exactly one linked series'

WITH study_series AS (
    SELECT
        st.id AS study_id,
        count(*) AS total_series,
        count(*) FILTER (WHERE s.image_occurrence_id IS NOT NULL) AS linked_series,
        min(s.image_occurrence_id) FILTER (WHERE s.image_occurrence_id IS NOT NULL) AS only_image_occurrence_id
    FROM app.imaging_studies st
    JOIN app.imaging_series s ON s.study_id = st.id
    GROUP BY st.id
)
UPDATE app.imaging_studies st
SET image_occurrence_id = ss.only_image_occurrence_id
FROM study_series ss
WHERE ss.study_id = st.id
  AND ss.total_series = 1
  AND ss.linked_series = 1
  AND st.image_occurrence_id IS DISTINCT FROM ss.only_image_occurrence_id;
