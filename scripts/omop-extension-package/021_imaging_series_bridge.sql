\pset pager off
\echo 'Creating series-level imaging bridge for lossless MI-CDM linkage'

ALTER TABLE app.imaging_series
    ADD COLUMN IF NOT EXISTS image_occurrence_id bigint;

CREATE INDEX IF NOT EXISTS idx_imaging_series_image_occurrence_id
    ON app.imaging_series (image_occurrence_id);

CREATE TABLE IF NOT EXISTS app.imaging_series_omop_xref (
    series_id bigint PRIMARY KEY,
    image_occurrence_id bigint UNIQUE,
    procedure_occurrence_id bigint,
    visit_occurrence_id bigint,
    modality_concept_id integer,
    anatomic_site_concept_id integer,
    backfill_run_id bigint,
    mapping_status varchar(30) NOT NULL DEFAULT 'planned',
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imaging_series_omop_xref_status
    ON app.imaging_series_omop_xref (mapping_status);

COMMENT ON COLUMN app.imaging_series.image_occurrence_id IS
    'OMOP image_occurrence_id for the specific imaging series. Preferred over imaging_studies.image_occurrence_id for MI-CDM fidelity.';

COMMENT ON TABLE app.imaging_series_omop_xref IS
    'Non-destructive mapping table from app.imaging_series to omop.image_occurrence at study+series grain.';
