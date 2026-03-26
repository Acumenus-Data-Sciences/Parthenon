import pytest
from app.engine.profiler import ColumnProfiler
from app.engine.inspector import SchemaInspector


def test_profile_table_returns_all_columns(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    assert result.table_name == "person"
    assert result.row_count == 3
    assert result.column_count == 6
    assert len(result.columns) == 6


def test_profile_null_stats(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    psv = next(c for c in result.columns if c.name == "person_source_value")
    assert psv.null_count == 1
    assert psv.non_null_count == 2
    assert abs(psv.null_percentage - 33.33) < 1.0


def test_profile_distinct_count(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    gc = next(c for c in result.columns if c.name == "gender_concept_id")
    assert gc.distinct_count == 2


def test_profile_top_values(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    gc = next(c for c in result.columns if c.name == "gender_concept_id")
    assert gc.top_values is not None
    assert gc.top_values.get("8507", 0) == 2


def test_profile_numeric_extras(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    yob = next(c for c in result.columns if c.name == "year_of_birth")
    assert yob.min_value == 1975
    assert yob.max_value == 1990
    assert yob.mean is not None


def test_profile_string_extras(sqlite_engine):
    inspector = SchemaInspector(sqlite_engine, "main")
    columns = inspector.get_columns("person")
    profiler = ColumnProfiler(sqlite_engine, "main")
    result = profiler.profile_table("person", columns, sample_rows=None, top_n=5)
    psv = next(c for c in result.columns if c.name == "person_source_value")
    assert psv.min_length is not None
    assert psv.max_length is not None
    assert psv.min_length == 4
    assert psv.max_length == 4
