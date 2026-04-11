\pset pager off
\echo 'Creating heavy oncology support indexes on omop.measurement'

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'omop'
          AND table_name = 'measurement'
          AND column_name = 'modifier_of_event_id'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_measurement_modifier_of_event_id
                 ON omop.measurement (modifier_of_event_id)';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'omop'
          AND table_name = 'measurement'
          AND column_name = 'modifier_of_field_concept_id'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_measurement_modifier_of_field_concept_id
                 ON omop.measurement (modifier_of_field_concept_id)';
    END IF;
END $$;
