import pytest
from sqlalchemy import Column, Integer, String, Float, Date, Table, MetaData, create_engine, text


@pytest.fixture
def sqlite_engine():
    """Create an in-memory SQLite database with test tables."""
    engine = create_engine("sqlite:///:memory:")
    meta = MetaData()

    Table("person", meta,
        Column("person_id", Integer, primary_key=True),
        Column("gender_concept_id", Integer),
        Column("year_of_birth", Integer),
        Column("birth_datetime", String),  # SQLite has no native date
        Column("race_concept_id", Integer),
        Column("person_source_value", String),
    )

    Table("visit_occurrence", meta,
        Column("visit_occurrence_id", Integer, primary_key=True),
        Column("person_id", Integer),
        Column("visit_concept_id", Integer),
        Column("visit_start_date", String),
        Column("visit_end_date", String),
        Column("visit_type_concept_id", Integer),
    )

    meta.create_all(engine)

    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO person (person_id, gender_concept_id, year_of_birth, "
            "birth_datetime, race_concept_id, person_source_value) VALUES "
            "(1, 8507, 1980, '1980-06-15', 8527, 'P001'), "
            "(2, 8532, 1975, '1975-03-22', 8527, 'P002'), "
            "(3, 8507, 1990, NULL, 8516, NULL)"
        ))
        conn.execute(text(
            "INSERT INTO visit_occurrence (visit_occurrence_id, person_id, "
            "visit_concept_id, visit_start_date, visit_end_date, visit_type_concept_id) VALUES "
            "(1, 1, 9201, '2020-01-15', '2020-01-15', 44818517), "
            "(2, 1, 9202, '2020-06-01', '2020-06-03', 44818517), "
            "(3, 2, 9201, '2021-03-10', '2021-03-10', 44818517)"
        ))

    return engine


@pytest.fixture
def sqlite_schema():
    return "main"
