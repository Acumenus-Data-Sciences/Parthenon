"""Unmapped concepts queue: insert-or-increment writer."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.unmapped_queue import MappingQueueRow, write_unmapped


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE unmapped_concepts_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id TEXT NOT NULL,
                    source_system TEXT NOT NULL,
                    source_code TEXT NOT NULL,
                    source_display TEXT,
                    resource_type TEXT NOT NULL,
                    resource_id TEXT NOT NULL,
                    first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    occurrence_count INTEGER DEFAULT 1,
                    UNIQUE(run_id, source_system, source_code)
                )
                """
            )
        )
    return eng


def test_writes_new_row(engine) -> None:
    row = MappingQueueRow(
        run_id="r1",
        source_system="http://snomed.info/sct",
        source_code="999999999",
        source_display="Unknown thing",
        resource_type="Condition",
        resource_id="c1",
    )
    write_unmapped(row, engine, schema="main")
    with engine.connect() as conn:
        n = conn.execute(text("SELECT COUNT(*) FROM unmapped_concepts_queue")).scalar()
    assert n == 1


def test_increments_occurrence_count_on_repeat(engine) -> None:
    row = MappingQueueRow(
        run_id="r1",
        source_system="http://snomed.info/sct",
        source_code="999999999",
        source_display="Unknown thing",
        resource_type="Condition",
        resource_id="c1",
    )
    write_unmapped(row, engine, schema="main")
    write_unmapped(row, engine, schema="main")
    write_unmapped(row, engine, schema="main")
    with engine.connect() as conn:
        cnt = conn.execute(
            text(
                "SELECT occurrence_count FROM unmapped_concepts_queue "
                "WHERE source_code = '999999999'"
            )
        ).scalar()
    assert cnt == 3
