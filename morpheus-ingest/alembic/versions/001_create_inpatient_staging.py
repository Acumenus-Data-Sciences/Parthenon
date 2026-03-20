"""Create inpatient_staging schema and tables."""

revision = "001"
down_revision = None

from alembic import op


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS inpatient_staging")

    op.execute("""
        CREATE TABLE inpatient_staging.stg_patient (
            staging_id          BIGSERIAL PRIMARY KEY,
            person_source_value TEXT NOT NULL,
            birth_year          INTEGER,
            gender_source_value TEXT,
            race_source_value   TEXT,
            ethnicity_source_value TEXT,
            death_date          DATE,
            death_datetime      TIMESTAMP,
            source_system_id    INTEGER,
            load_batch_id       INTEGER NOT NULL,
            source_table        TEXT,
            source_row_id       TEXT,
            dq_flags            JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_encounter (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT NOT NULL,
            encounter_type          TEXT,
            admit_datetime          TIMESTAMP,
            discharge_datetime      TIMESTAMP,
            admit_source            TEXT,
            discharge_disposition   TEXT,
            care_site_source_value  TEXT,
            preceding_encounter_source_value TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_condition (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            condition_source_code   TEXT NOT NULL,
            condition_source_vocab  TEXT,
            condition_start_date    DATE,
            condition_start_datetime TIMESTAMP,
            condition_end_date      DATE,
            condition_type          TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_procedure (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            procedure_source_code   TEXT NOT NULL,
            procedure_source_vocab  TEXT,
            procedure_date          DATE,
            procedure_datetime      TIMESTAMP,
            procedure_type          TEXT,
            quantity                INTEGER,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_drug (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            drug_source_code        TEXT NOT NULL,
            drug_source_vocab       TEXT,
            drug_name               TEXT,
            start_datetime          TIMESTAMP,
            end_datetime            TIMESTAMP,
            route_source_value      TEXT,
            dose_value              TEXT,
            dose_unit               TEXT,
            quantity                NUMERIC,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_measurement (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            measurement_datetime    TIMESTAMP,
            source_code             TEXT NOT NULL,
            source_vocabulary       TEXT,
            value_as_number         NUMERIC,
            value_as_text           TEXT,
            unit_source_value       TEXT,
            range_low               NUMERIC,
            range_high              NUMERIC,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_note (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            note_datetime           TIMESTAMP,
            note_type               TEXT,
            note_text               TEXT,
            note_class              TEXT,
            encoding_concept_id     INTEGER,
            language_concept_id     INTEGER,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_device (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            device_source_code      TEXT NOT NULL,
            device_source_vocab     TEXT,
            start_datetime          TIMESTAMP,
            end_datetime            TIMESTAMP,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_specimen (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            specimen_source_code    TEXT NOT NULL,
            specimen_source_vocab   TEXT,
            specimen_datetime       TIMESTAMP,
            quantity                NUMERIC,
            unit_source_value       TEXT,
            anatomic_site_source    TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_microbiology (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            specimen_datetime       TIMESTAMP,
            specimen_source_code    TEXT,
            specimen_source_desc    TEXT,
            test_source_code        TEXT,
            test_name               TEXT,
            organism_source_code    TEXT,
            organism_name           TEXT,
            antibiotic_source_code  TEXT,
            antibiotic_name         TEXT,
            susceptibility          TEXT,
            dilution_value          NUMERIC,
            dilution_comparison     TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_surgical_case (
            staging_id                  BIGSERIAL PRIMARY KEY,
            person_source_value         TEXT NOT NULL,
            encounter_source_value      TEXT,
            surgery_date                DATE,
            scheduled_start_datetime    TIMESTAMP,
            scheduled_duration_minutes  INTEGER,
            primary_procedure_code      TEXT,
            primary_procedure_vocab     TEXT,
            service_source_value        TEXT,
            asa_rating                  TEXT,
            case_type                   TEXT,
            case_class                  TEXT,
            patient_class               TEXT,
            status                      TEXT,
            cancellation_reason         TEXT,
            source_system_id            INTEGER,
            load_batch_id               INTEGER NOT NULL,
            source_table                TEXT,
            source_row_id               TEXT,
            dq_flags                    JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_case_timeline (
            staging_id              BIGSERIAL PRIMARY KEY,
            case_source_value       TEXT NOT NULL,
            periop_arrival_dt       TIMESTAMP,
            preop_in_dt             TIMESTAMP,
            preop_out_dt            TIMESTAMP,
            or_in_dt                TIMESTAMP,
            anesthesia_start_dt     TIMESTAMP,
            procedure_start_dt      TIMESTAMP,
            procedure_close_dt      TIMESTAMP,
            procedure_end_dt        TIMESTAMP,
            or_out_dt               TIMESTAMP,
            anesthesia_end_dt       TIMESTAMP,
            pacu_in_dt              TIMESTAMP,
            pacu_out_dt             TIMESTAMP,
            destination             TEXT,
            primary_procedure_code  TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_transport (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            transport_type          TEXT,
            location_from           TEXT,
            location_to             TEXT,
            status                  TEXT,
            planned_time            TIMESTAMP,
            actual_start            TIMESTAMP,
            actual_end              TIMESTAMP,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_safety_event (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            event_type              TEXT,
            severity                TEXT,
            description             TEXT,
            event_datetime          TIMESTAMP,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_bed_census (
            staging_id              BIGSERIAL PRIMARY KEY,
            census_datetime         TIMESTAMP NOT NULL,
            location_source_value   TEXT NOT NULL,
            total_beds              INTEGER,
            occupied_beds           INTEGER,
            available_beds          INTEGER,
            pending_admits          INTEGER,
            pending_discharges      INTEGER,
            boarding_count          INTEGER,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    # Indexes
    op.execute("CREATE INDEX idx_stg_patient_psv ON inpatient_staging.stg_patient (person_source_value)")
    op.execute("CREATE INDEX idx_stg_encounter_psv ON inpatient_staging.stg_encounter (person_source_value)")
    op.execute("CREATE INDEX idx_stg_encounter_esv ON inpatient_staging.stg_encounter (encounter_source_value)")
    op.execute("CREATE INDEX idx_stg_measurement_psv ON inpatient_staging.stg_measurement (person_source_value)")
    op.execute("CREATE INDEX idx_stg_condition_psv ON inpatient_staging.stg_condition (person_source_value)")
    op.execute("CREATE INDEX idx_stg_drug_psv ON inpatient_staging.stg_drug (person_source_value)")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS inpatient_staging CASCADE")
