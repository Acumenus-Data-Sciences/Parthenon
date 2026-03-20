from sqlalchemy import text

from app.adapters.mimic_adapter import MimicAdapter
from app.mapper.person_mapper import map_persons, get_person_id_map
from app.mapper.visit_mapper import map_visits, get_visit_id_map


def test_map_persons_creates_100_records(db_session):
    """MIMIC demo has 100 patients -> should create 100 person records."""
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()

    count = map_persons(db_session, batch_id)
    assert count == 100, f"Expected 100 persons, got {count}"


def test_person_gender_mapping(db_session):
    """Gender should map to OMOP concepts: M->8507, F->8532."""
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    map_persons(db_session, batch_id)

    result = db_session.execute(
        text("SELECT DISTINCT gender_concept_id FROM inpatient.person")
    )
    genders = {row[0] for row in result}
    # Should only contain 8507 (M) and/or 8532 (F)
    assert genders.issubset({8507, 8532, 0}), f"Unexpected gender concepts: {genders}"
    assert len(genders) > 0


def test_person_id_map_returns_all(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    map_persons(db_session, batch_id)

    id_map = get_person_id_map(db_session, batch_id)
    assert len(id_map) == 100


def test_map_visits_creates_records(db_session):
    """Visits should be created from MIMIC admissions."""
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    map_persons(db_session, batch_id)

    visit_count = map_visits(db_session, batch_id)
    assert visit_count > 0, "Expected visits to be mapped"


def test_visit_has_valid_person_id(db_session):
    """Every visit should reference a valid person_id."""
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    map_persons(db_session, batch_id)
    map_visits(db_session, batch_id)

    result = db_session.execute(text("""
        SELECT count(*) FROM inpatient.visit_occurrence v
        WHERE NOT EXISTS (SELECT 1 FROM inpatient.person p WHERE p.person_id = v.person_id)
    """))
    orphans = result.scalar()
    assert orphans == 0, f"Found {orphans} visits with no matching person"


def test_visit_id_map_returns_all(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    map_persons(db_session, batch_id)
    map_visits(db_session, batch_id)

    visit_map = get_visit_id_map(db_session, batch_id)
    assert len(visit_map) > 0
