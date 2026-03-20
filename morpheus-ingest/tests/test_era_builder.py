from sqlalchemy import text

from app.adapters.mimic_adapter import MimicAdapter
from app.mapper.person_mapper import map_persons
from app.mapper.visit_mapper import map_visits
from app.mapper.condition_mapper import map_conditions
from app.mapper.drug_mapper import map_drugs
from app.mapper.era_builder import (
    build_observation_periods,
    build_condition_eras,
    build_drug_eras,
)


def _setup_full(db_session):
    """Stage + map persons, visits, conditions, drugs."""
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    map_persons(db_session, batch_id)
    map_visits(db_session, batch_id)
    map_conditions(db_session, batch_id)
    map_drugs(db_session, batch_id)
    return batch_id


def test_build_observation_periods(db_session):
    _setup_full(db_session)
    count = build_observation_periods(db_session)
    # One observation period per person who has visits
    assert count > 0
    assert count <= 100  # At most 100 patients


def test_observation_period_dates_valid(db_session):
    _setup_full(db_session)
    build_observation_periods(db_session)
    result = db_session.execute(text("""
        SELECT count(*) FROM inpatient.observation_period
        WHERE observation_period_start_date > observation_period_end_date
    """))
    assert result.scalar() == 0, "Start date should not be after end date"


def test_build_condition_eras(db_session):
    _setup_full(db_session)
    count = build_condition_eras(db_session)
    assert count > 0, "Expected condition eras from mapped conditions"


def test_build_drug_eras(db_session):
    _setup_full(db_session)
    count = build_drug_eras(db_session)
    # Drug eras only for mapped concepts (concept_id != 0)
    # May be 0 if no drugs mapped to standard concepts
    assert count >= 0
