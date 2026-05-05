"""Write unmapped (system, code) pairs to the app.unmapped_concepts_queue table.

The existing Laravel ``MappingReviewController`` flow surfaces queued rows to a
human reviewer. Phase 1 does NOT call any AI mapping pathway (devplan §6.7).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.engine import Engine


class MappingQueueRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: str
    source_system: str
    source_code: str
    source_display: str | None = None
    resource_type: str
    resource_id: str


def write_unmapped(row: MappingQueueRow, engine: Engine, *, schema: str) -> None:
    """INSERT-or-increment-occurrence into the queue table."""
    qual = (
        "unmapped_concepts_queue" if schema in {"main", ""} else f"{schema}.unmapped_concepts_queue"
    )
    with engine.begin() as conn:
        existing = conn.execute(
            text(
                f"SELECT id FROM {qual} "
                "WHERE run_id = :run_id AND source_system = :sys AND source_code = :code"
            ),
            {"run_id": row.run_id, "sys": row.source_system, "code": row.source_code},
        ).fetchone()
        if existing:
            conn.execute(
                text(
                    f"UPDATE {qual} SET occurrence_count = occurrence_count + 1 " f"WHERE id = :id"
                ),
                {"id": existing[0]},
            )
        else:
            conn.execute(
                text(
                    f"INSERT INTO {qual} "
                    "(run_id, source_system, source_code, source_display, "
                    "resource_type, resource_id, occurrence_count) "
                    "VALUES (:run_id, :sys, :code, :display, :rtype, :rid, 1)"
                ),
                {
                    "run_id": row.run_id,
                    "sys": row.source_system,
                    "code": row.source_code,
                    "display": row.source_display,
                    "rtype": row.resource_type,
                    "rid": row.resource_id,
                },
            )
