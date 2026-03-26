import pytest
from app.engine.inspector import SchemaInspector


def test_list_tables(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    tables = inspector.list_tables()
    assert set(tables) == {"person", "visit_occurrence"}


def test_list_tables_with_filter(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    tables = inspector.list_tables(include=["person"])
    assert tables == ["person"]


def test_get_columns(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    names = [c["name"] for c in columns]
    assert "person_id" in names
    assert "gender_concept_id" in names
    assert len(columns) == 6


def test_get_columns_returns_type(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    pid = next(c for c in columns if c["name"] == "person_id")
    assert pid["type"] in ("integer", "INTEGER", "int")


def test_get_columns_nonexistent_table(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    with pytest.raises(Exception):
        inspector.get_columns("nonexistent_table")
