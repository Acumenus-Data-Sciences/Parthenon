\pset pager off
\echo 'Applying additive core/oncology support changes in omop'

ALTER TABLE omop.measurement
    ADD COLUMN IF NOT EXISTS modifier_of_event_id bigint,
    ADD COLUMN IF NOT EXISTS modifier_of_field_concept_id integer;

COMMENT ON COLUMN omop.measurement.modifier_of_event_id IS
    'Additive oncology-oriented support column for linking a measurement modifier to an upstream event.';

COMMENT ON COLUMN omop.measurement.modifier_of_field_concept_id IS
    'Additive oncology-oriented support column for recording the CDM table concept of the upstream modifier event.';

CREATE TABLE IF NOT EXISTS omop.concept_numeric (
    concept_id integer PRIMARY KEY,
    value_as_number numeric,
    unit_concept_id integer,
    value_source_value varchar(100),
    unit_source_value varchar(50)
);

COMMENT ON TABLE omop.concept_numeric IS
    'Optional additive support table for numeric concept values used by some Oncology WG examples. Review against pinned public spec before production promotion.';

CREATE INDEX IF NOT EXISTS idx_concept_numeric_unit_concept_id
    ON omop.concept_numeric (unit_concept_id);
