"""ResultAssembler: orchestrates schema inspection + column profiling into ScanResult."""
from __future__ import annotations

import logging
import time

from sqlalchemy.engine import Engine

from app.engine.inspector import SchemaInspector
from app.engine.profiler import ColumnProfiler
from app.models import ScanRequest, ScanResult, TableProfile, ProgressEvent
from app.scan_store import ScanState

log = logging.getLogger("blackrabbit.assembler")


class ResultAssembler:
    def __init__(
        self,
        engine: Engine,
        schema: str | None,
        request: ScanRequest,
        scan_state: ScanState | None = None,
    ) -> None:
        self._engine = engine
        self._schema = schema
        self._request = request
        self._state = scan_state

    def _publish(self, event: ProgressEvent) -> None:
        if self._state:
            self._state.publish(event)

    def run(self) -> ScanResult:
        start = time.monotonic()
        inspector = SchemaInspector(self._engine, self._schema or "")
        profiler = ColumnProfiler(self._engine, self._schema)

        tables = inspector.list_tables(include=self._request.tables)
        total = len(tables)

        if self._state:
            self._publish(ProgressEvent(
                event="started",
                scan_id=self._state.scan_id,
                total_tables=total,
            ))

        results: list[TableProfile] = []
        errors: list[dict[str, str]] = []

        for idx, table_name in enumerate(tables, 1):
            self._publish(ProgressEvent(
                event="table_started",
                table=table_name,
                index=idx,
                of=total,
            ))

            table_start = time.monotonic()
            try:
                columns = inspector.get_columns(table_name)
                profile = profiler.profile_table(
                    table_name,
                    columns,
                    sample_rows=self._request.rows_per_table,
                    top_n=self._request.max_distinct_values,
                )
                results.append(profile)

                elapsed_ms = int((time.monotonic() - table_start) * 1000)
                self._publish(ProgressEvent(
                    event="table_done",
                    table=table_name,
                    index=idx,
                    of=total,
                    rows=profile.row_count,
                    columns=profile.column_count,
                    elapsed_ms=elapsed_ms,
                ))

            except Exception as e:
                log.warning("Error profiling table %s: %s", table_name, e)
                errors.append({"table": table_name, "message": str(e)})
                self._publish(ProgressEvent(
                    event="error",
                    table=table_name,
                    message=str(e),
                ))

        total_elapsed = round(time.monotonic() - start, 3)

        completion_event = "completed" if not errors else "completed_with_errors"
        self._publish(ProgressEvent(
            event=completion_event,
            tables_count=total,
            columns_count=sum(t.column_count for t in results),
            total_elapsed_ms=int(total_elapsed * 1000),
            succeeded=len(results),
            failed=len(errors),
        ))

        return ScanResult(
            status="ok" if not errors else "partial",
            tables=results,
            scan_time_seconds=total_elapsed,
            errors=errors if errors else None,
        )
