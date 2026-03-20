"""Create inpatient_ext schema and Morpheus extension tables."""

revision = "002"
down_revision = "001"

from alembic import op


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS inpatient_ext")

    # --- Data Provenance (must be first — other tables FK to these) ---
    op.execute("""
        CREATE TABLE inpatient_ext.data_source (
            source_id       BIGSERIAL PRIMARY KEY,
            source_name     TEXT NOT NULL,
            vendor          TEXT CHECK (vendor IN ('Epic','Cerner','Meditech','FHIR','MIMIC','HL7v2','CSV')),
            connection_type TEXT,
            last_extract_dt TIMESTAMP,
            total_patients  INTEGER DEFAULT 0,
            dqd_score       NUMERIC(5,2),
            created_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.load_batch (
            batch_id            BIGSERIAL PRIMARY KEY,
            source_id           BIGINT REFERENCES inpatient_ext.data_source(source_id),
            source_name         TEXT,
            start_dt            TIMESTAMP NOT NULL DEFAULT NOW(),
            end_dt              TIMESTAMP,
            status              TEXT NOT NULL DEFAULT 'pending',
            rows_staged         INTEGER DEFAULT 0,
            rows_mapped         INTEGER DEFAULT 0,
            rows_rejected       INTEGER DEFAULT 0,
            mapping_coverage_pct NUMERIC(5,2),
            dqd_pass            BOOLEAN,
            stats               JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.dq_result (
            result_id       BIGSERIAL PRIMARY KEY,
            batch_id        BIGINT REFERENCES inpatient_ext.load_batch(batch_id),
            check_name      TEXT NOT NULL,
            check_level     TEXT,
            threshold       NUMERIC,
            result_value    NUMERIC,
            passed          BOOLEAN NOT NULL
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.concept_gap (
            gap_id              BIGSERIAL PRIMARY KEY,
            source_code         TEXT NOT NULL,
            source_vocabulary   TEXT NOT NULL,
            frequency           INTEGER DEFAULT 1,
            suggested_concept_id INTEGER,
            confidence_score    NUMERIC(5,4),
            reviewed_by         TEXT,
            accepted            BOOLEAN,
            created_at          TIMESTAMP DEFAULT NOW(),
            UNIQUE (source_code, source_vocabulary)
        )
    """)

    # --- Perioperative ---
    op.execute("""
        CREATE TABLE inpatient_ext.surgical_case (
            case_id                     BIGSERIAL PRIMARY KEY,
            person_id                   INTEGER NOT NULL,
            visit_occurrence_id         INTEGER,
            surgery_date                DATE,
            room_source_value           TEXT,
            primary_surgeon_provider_id INTEGER,
            service_concept_id          INTEGER,
            asa_rating                  TEXT,
            case_type_concept_id        INTEGER,
            case_class_concept_id       INTEGER,
            patient_class_concept_id    INTEGER,
            scheduled_start_datetime    TIMESTAMP,
            scheduled_duration_minutes  INTEGER,
            status_concept_id           INTEGER,
            cancellation_reason_concept_id INTEGER,
            source_system_id            INTEGER,
            load_batch_id               BIGINT
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.case_timeline (
            timeline_id             BIGSERIAL PRIMARY KEY,
            case_id                 BIGINT REFERENCES inpatient_ext.surgical_case(case_id),
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
            primary_procedure_concept_id INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.case_metrics (
            case_id                 BIGINT PRIMARY KEY REFERENCES inpatient_ext.surgical_case(case_id),
            turnover_minutes        NUMERIC,
            utilization_pct         NUMERIC(5,2),
            in_block_minutes        NUMERIC,
            out_of_block_minutes    NUMERIC,
            prime_time_minutes      NUMERIC,
            non_prime_time_minutes  NUMERIC,
            late_start_minutes      NUMERIC,
            early_finish_minutes    NUMERIC
        )
    """)

    # --- ICU ---
    op.execute("""
        CREATE TABLE inpatient_ext.icu_stay (
            icu_stay_id             BIGSERIAL PRIMARY KEY,
            visit_detail_id         INTEGER NOT NULL,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            hospital_admit_dt       TIMESTAMP,
            hospital_discharge_dt   TIMESTAMP,
            icu_admit_dt            TIMESTAMP,
            icu_discharge_dt        TIMESTAMP,
            icu_los_hours           NUMERIC,
            hospital_los_days       NUMERIC,
            care_site_name          TEXT,
            died_in_hospital        BOOLEAN DEFAULT FALSE,
            died_in_icu             BOOLEAN DEFAULT FALSE,
            readmission_48h         BOOLEAN DEFAULT FALSE,
            severity_score          NUMERIC,
            severity_system_concept_id INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.bundle_card (
            bundle_card_id          BIGSERIAL PRIMARY KEY,
            component               CHAR(1) NOT NULL CHECK (component IN ('A','B','C','D','E','F')),
            component_name          TEXT NOT NULL,
            assessment_concept_id   INTEGER,
            target_frequency_hours  NUMERIC,
            adherence_threshold     NUMERIC,
            sccm_guideline_version  TEXT
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.bundle_assessment (
            assessment_id           BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_detail_id         INTEGER,
            assessment_datetime     TIMESTAMP NOT NULL,
            bundle_component        CHAR(1) NOT NULL,
            assessment_concept_id   INTEGER,
            value_as_number         NUMERIC,
            value_as_concept_id     INTEGER,
            adherent_flag           BOOLEAN
        )
    """)

    # --- Patient Flow ---
    op.execute("""
        CREATE TABLE inpatient_ext.transport (
            transport_id            BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            transport_type          TEXT,
            location_from           TEXT,
            location_to             TEXT,
            status                  TEXT,
            planned_time            TIMESTAMP,
            actual_start            TIMESTAMP,
            actual_end              TIMESTAMP,
            assigned_provider_id    INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.bed_census (
            census_id               BIGSERIAL PRIMARY KEY,
            census_datetime         TIMESTAMP NOT NULL,
            location_id             INTEGER,
            location_name           TEXT,
            total_beds              INTEGER,
            occupied_beds           INTEGER,
            available_beds          INTEGER,
            pending_admits          INTEGER,
            pending_discharges      INTEGER,
            boarding_count          INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.care_milestone (
            milestone_id            BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            milestone_type          TEXT NOT NULL,
            status                  TEXT NOT NULL DEFAULT 'Pending',
            required                BOOLEAN DEFAULT TRUE,
            completed_at            TIMESTAMP,
            completed_by_provider_id INTEGER
        )
    """)

    # --- Safety & Quality ---
    op.execute("""
        CREATE TABLE inpatient_ext.safety_event (
            event_id                BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            event_type              TEXT NOT NULL,
            severity                TEXT CHECK (severity IN ('Low','Medium','High','Critical')),
            description             TEXT,
            event_datetime          TIMESTAMP,
            reporting_provider_id   INTEGER,
            acknowledged_by_provider_id INTEGER,
            acknowledged_at         TIMESTAMP,
            resolved_at             TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.quality_measure (
            measure_id              BIGSERIAL PRIMARY KEY,
            measure_name            TEXT NOT NULL,
            measure_set             TEXT,
            numerator_count         INTEGER,
            denominator_count       INTEGER,
            rate                    NUMERIC(7,4),
            period_start            DATE,
            period_end              DATE
        )
    """)

    # --- Microbiology ---
    op.execute("""
        CREATE TABLE inpatient_ext.antibiogram (
            antibiogram_id          BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            organism_concept_id     INTEGER,
            antibiotic_concept_id   INTEGER,
            susceptibility          TEXT CHECK (susceptibility IN ('S','I','R')),
            mic_value               NUMERIC,
            test_method             TEXT,
            specimen_concept_id     INTEGER,
            result_datetime         TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.infection_episode (
            episode_id              BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            infection_concept_id    INTEGER,
            onset_datetime          TIMESTAMP,
            resolution_datetime     TIMESTAMP,
            hai_flag                BOOLEAN DEFAULT FALSE,
            source_concept_id       INTEGER
        )
    """)

    # --- NLP ---
    op.execute("""
        CREATE TABLE inpatient_ext.note_section (
            section_id              BIGSERIAL PRIMARY KEY,
            note_id                 INTEGER NOT NULL,
            section_concept_id      INTEGER,
            section_text            TEXT,
            section_order           INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.note_assertion (
            assertion_id            BIGSERIAL PRIMARY KEY,
            note_id                 INTEGER NOT NULL,
            concept_id              INTEGER,
            assertion_type          TEXT CHECK (assertion_type IN ('present','absent','conditional','historical')),
            confidence_score        NUMERIC(5,4),
            extraction_model_version TEXT
        )
    """)

    # --- Process Mining ---
    op.execute("""
        CREATE TABLE inpatient_ext.process_event (
            event_id                BIGSERIAL PRIMARY KEY,
            event_type              TEXT NOT NULL,
            event_timestamp         TIMESTAMP NOT NULL,
            object_type             TEXT,
            object_id               TEXT,
            activity                TEXT,
            resource                TEXT,
            lifecycle_state         TEXT
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.process_model (
            model_id                BIGSERIAL PRIMARY KEY,
            model_type              TEXT,
            model_data              JSONB,
            cohort_id               INTEGER,
            created_at              TIMESTAMP DEFAULT NOW()
        )
    """)

    # --- Predictions ---
    op.execute("""
        CREATE TABLE inpatient_ext.prediction_model (
            model_id                BIGSERIAL PRIMARY KEY,
            model_name              TEXT NOT NULL,
            model_type              TEXT,
            version                 TEXT,
            target_outcome          TEXT,
            training_cohort_id      INTEGER,
            auc                     NUMERIC(5,4),
            auprc                   NUMERIC(5,4),
            feature_set             JSONB,
            onnx_artifact_path      TEXT,
            created_at              TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.prediction_score (
            score_id                BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_detail_id         INTEGER,
            model_id                BIGINT REFERENCES inpatient_ext.prediction_model(model_id),
            score_datetime          TIMESTAMP NOT NULL,
            predicted_probability   NUMERIC(7,6),
            risk_tier               TEXT CHECK (risk_tier IN ('Low','Medium','High','Critical')),
            explanation             JSONB
        )
    """)

    # Indexes
    op.execute("CREATE INDEX idx_ext_icu_person ON inpatient_ext.icu_stay (person_id)")
    op.execute("CREATE INDEX idx_ext_bundle_person ON inpatient_ext.bundle_assessment (person_id)")
    op.execute("CREATE INDEX idx_ext_census_dt ON inpatient_ext.bed_census (census_datetime)")
    op.execute("CREATE INDEX idx_ext_pred_person ON inpatient_ext.prediction_score (person_id)")
    op.execute("CREATE INDEX idx_ext_process_ts ON inpatient_ext.process_event (event_timestamp)")
    op.execute("CREATE INDEX idx_ext_concept_gap ON inpatient_ext.concept_gap (source_code, source_vocabulary)")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS inpatient_ext CASCADE")
