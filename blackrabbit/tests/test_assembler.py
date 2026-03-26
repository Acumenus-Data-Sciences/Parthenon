import pytest
from app.engine.assembler import ResultAssembler
from app.models import ScanRequest


def test_assemble_full_scan(sqlite_engine):
    request = ScanRequest(
        dbms="sqlite",
        server=":memory:",
        port=0,
        user="",
        password="",
        schema="main",
    )
    assembler = ResultAssembler(sqlite_engine, "main", request)
    result = assembler.run()
    assert result.status == "ok"
    assert len(result.tables) == 2
    table_names = {t.table_name for t in result.tables}
    assert table_names == {"person", "visit_occurrence"}


def test_assemble_with_table_filter(sqlite_engine):
    request = ScanRequest(
        dbms="sqlite",
        server=":memory:",
        port=0,
        user="",
        password="",
        schema="main",
        tables=["person"],
    )
    assembler = ResultAssembler(sqlite_engine, "main", request)
    result = assembler.run()
    assert len(result.tables) == 1
    assert result.tables[0].table_name == "person"


def test_assemble_includes_scan_time(sqlite_engine):
    request = ScanRequest(
        dbms="sqlite",
        server=":memory:",
        port=0,
        user="",
        password="",
        schema="main",
    )
    assembler = ResultAssembler(sqlite_engine, "main", request)
    result = assembler.run()
    assert result.scan_time_seconds is not None
    assert result.scan_time_seconds >= 0
