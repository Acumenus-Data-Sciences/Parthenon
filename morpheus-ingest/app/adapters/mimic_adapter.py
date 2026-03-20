from sqlalchemy import text
from sqlalchemy.orm import Session

from app.adapters.base import SourceAdapter
from app.config import settings

EXT = settings.ext_schema
STG = settings.staging_schema
SRC = settings.mimic_schema


class MimicAdapter(SourceAdapter):
    """Adapter for MIMIC-IV demo data already loaded in mimiciv.* schema."""

    def create_batch(self, source_name: str = "MIMIC-IV Demo") -> int:
        result = self.session.execute(
            text(f"""
                INSERT INTO {EXT}.load_batch (source_name, status)
                VALUES (:name, 'staging')
                RETURNING batch_id
            """),
            {"name": source_name},
        )
        self.session.flush()
        return result.scalar()

    def stage_all(self) -> int:
        """Stage all MIMIC-IV data into canonical staging tables under one batch."""
        batch_id = self.create_batch("MIMIC-IV Demo")
        self._stage_patients(batch_id)
        self._stage_encounters(batch_id)
        self._stage_conditions(batch_id)
        self._stage_measurements(batch_id)
        self._stage_drugs(batch_id)
        self._stage_procedures(batch_id)
        self.session.flush()
        return batch_id

    def _stage_patients(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_patient
                    (person_source_value, birth_year, gender_source_value,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, anchor_year::int - anchor_age::int, gender,
                       :bid, 'patients', subject_id::text
                FROM {SRC}.patients
            """),
            {"bid": batch_id},
        )

    def _stage_encounters(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_encounter
                    (person_source_value, encounter_source_value, encounter_type,
                     admit_datetime, discharge_datetime, admit_source,
                     discharge_disposition, load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, admission_type,
                       admittime::timestamp, dischtime::timestamp,
                       admission_location, discharge_location,
                       :bid, 'admissions', hadm_id::text
                FROM {SRC}.admissions
            """),
            {"bid": batch_id},
        )

    def _stage_conditions(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_condition
                    (person_source_value, encounter_source_value,
                     condition_source_code, condition_source_vocab,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text,
                       -- MIMIC stores ICD codes without dots; OMOP expects dots after 3rd char
                       CASE WHEN length(icd_code) <= 3 THEN icd_code
                            ELSE left(icd_code, 3) || '.' || substring(icd_code from 4)
                       END,
                       CASE WHEN icd_version='9' THEN 'ICD9CM' ELSE 'ICD10CM' END,
                       :bid, 'diagnoses_icd',
                       subject_id::text||'-'||hadm_id::text||'-'||seq_num::text
                FROM {SRC}.diagnoses_icd
            """),
            {"bid": batch_id},
        )

    def _stage_measurements(self, batch_id: int) -> None:
        # Lab events
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_measurement
                    (person_source_value, encounter_source_value,
                     measurement_datetime, source_code, source_vocabulary,
                     value_as_number, value_as_text, unit_source_value,
                     range_low, range_high,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, charttime::timestamp,
                       itemid::text, 'MIMIC-labevents',
                       CASE WHEN valuenum ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN valuenum::numeric ELSE NULL END,
                       value, valueuom,
                       CASE WHEN ref_range_lower ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ref_range_lower::numeric ELSE NULL END,
                       CASE WHEN ref_range_upper ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ref_range_upper::numeric ELSE NULL END,
                       :bid, 'labevents', labevent_id::text
                FROM {SRC}.labevents
            """),
            {"bid": batch_id},
        )
        # Chart events (vitals, assessments)
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_measurement
                    (person_source_value, encounter_source_value,
                     measurement_datetime, source_code, source_vocabulary,
                     value_as_number, value_as_text, unit_source_value,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, charttime::timestamp,
                       itemid::text, 'MIMIC-chartevents',
                       CASE WHEN valuenum ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN valuenum::numeric ELSE NULL END,
                       value, valueuom,
                       :bid, 'chartevents',
                       subject_id::text||'-'||stay_id::text||'-'||charttime::text
                FROM {SRC}.chartevents
            """),
            {"bid": batch_id},
        )

    def _stage_drugs(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_drug
                    (person_source_value, encounter_source_value,
                     drug_source_code, drug_source_vocab, drug_name,
                     start_datetime, end_datetime, route_source_value,
                     dose_value, dose_unit,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text,
                       COALESCE(NULLIF(ndc,'0'), gsn, drug),
                       CASE WHEN ndc IS NOT NULL AND ndc != '0' AND ndc != '' THEN 'NDC'
                            ELSE 'MIMIC-prescriptions' END,
                       drug, starttime::timestamp, stoptime::timestamp, route,
                       dose_val_rx, dose_unit_rx,
                       :bid, 'prescriptions',
                       subject_id::text||'-'||hadm_id::text||'-'||COALESCE(starttime,'')||'-'||COALESCE(drug,'')
                FROM {SRC}.prescriptions
            """),
            {"bid": batch_id},
        )

    def _stage_procedures(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_procedure
                    (person_source_value, encounter_source_value,
                     procedure_source_code, procedure_source_vocab,
                     procedure_date,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text,
                       -- ICD9Proc: dot after 2nd char (39.61). ICD10PCS: no dots (7-char alpha).
                       CASE WHEN icd_version = '9' AND length(icd_code) > 2
                            THEN left(icd_code, 2) || '.' || substring(icd_code from 3)
                            ELSE icd_code END,
                       CASE WHEN icd_version='9' THEN 'ICD9Proc' ELSE 'ICD10PCS' END,
                       chartdate::date,
                       :bid, 'procedures_icd',
                       subject_id::text||'-'||hadm_id::text||'-'||icd_code
                FROM {SRC}.procedures_icd
            """),
            {"bid": batch_id},
        )
