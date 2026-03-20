from sqlalchemy import text

from app.adapters.mimic_adapter import MimicAdapter
from app.mapper.person_mapper import map_persons
from app.mapper.visit_mapper import map_visits
from app.mapper.condition_mapper import map_conditions
from app.mapper.drug_mapper import map_drugs
from app.mapper.measurement_mapper import map_measurements
from app.mapper.procedure_mapper import map_procedures
from app.mapper.domain_router import log_concept_gaps


def _setup_base(db_session):
    """Stage MIMIC data and map persons + visits (prerequisite for clinical mappers)."""
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    map_persons(db_session, batch_id)
    map_visits(db_session, batch_id)
    return batch_id


def test_map_conditions(db_session):
    batch_id = _setup_base(db_session)
    count = map_conditions(db_session, batch_id)
    assert count > 0, "Expected conditions to be mapped"
    # MIMIC demo has ~4500 diagnoses
    assert count > 1000, f"Expected >1000 conditions, got {count}"


def test_conditions_have_valid_person(db_session):
    batch_id = _setup_base(db_session)
    map_conditions(db_session, batch_id)
    result = db_session.execute(text("""
        SELECT count(*) FROM inpatient.condition_occurrence co
        WHERE NOT EXISTS (
            SELECT 1 FROM inpatient.person p WHERE p.person_id = co.person_id
        )
    """))
    assert result.scalar() == 0


def test_map_drugs(db_session):
    batch_id = _setup_base(db_session)
    count = map_drugs(db_session, batch_id)
    assert count > 0, "Expected drugs to be mapped"


def test_map_measurements(db_session):
    batch_id = _setup_base(db_session)
    count = map_measurements(db_session, batch_id)
    assert count > 0, "Expected measurements to be mapped"
    # MIMIC demo: ~107K labevents + ~668K chartevents
    assert count > 10000, f"Expected >10K measurements, got {count}"


def test_map_procedures(db_session):
    batch_id = _setup_base(db_session)
    count = map_procedures(db_session, batch_id)
    assert count > 0, "Expected procedures to be mapped"


def test_some_conditions_mapped_to_standard(db_session):
    """At least some ICD codes should map to standard SNOMED concepts."""
    batch_id = _setup_base(db_session)
    map_conditions(db_session, batch_id)
    result = db_session.execute(text("""
        SELECT count(*) FROM inpatient.condition_occurrence
        WHERE condition_concept_id != 0
    """))
    mapped = result.scalar()
    assert mapped > 0, "Expected some conditions to map to standard concepts"


def test_concept_gaps_logged(db_session):
    """Unmapped codes should be logged to concept_gap."""
    batch_id = _setup_base(db_session)
    map_conditions(db_session, batch_id)
    map_drugs(db_session, batch_id)
    map_measurements(db_session, batch_id)
    map_procedures(db_session, batch_id)
    gap_count = log_concept_gaps(db_session, batch_id)
    # MIMIC uses local item IDs for measurements — many won't map
    assert gap_count > 0, "Expected some concept gaps"
