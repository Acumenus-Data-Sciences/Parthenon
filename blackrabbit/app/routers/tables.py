"""Lightweight schema inspection — lists tables without profiling."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.engine.connection import ConnectionFactory
from app.engine.inspector import SchemaInspector
from app.models import TablesRequest, TablesResponse, TableInfo

router = APIRouter()
log = logging.getLogger("blackrabbit.tables")


@router.post("/tables")
def list_tables(request: TablesRequest) -> TablesResponse:
    try:
        engine = ConnectionFactory.create_engine(
            dbms=request.dbms,
            server=request.server,
            port=request.port,
            user=request.user,
            password=request.password,
            schema=request.schema_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        inspector = SchemaInspector(engine, request.schema_name)
        table_names = inspector.list_tables()

        tables: list[TableInfo] = []
        schema_prefix = f'"{request.schema_name}".' if request.schema_name and request.schema_name != "main" else ""

        for name in table_names:
            columns = inspector.get_columns(name)
            row_count = None
            try:
                with engine.connect() as conn:
                    result = conn.execute(text(f'SELECT COUNT(*) FROM {schema_prefix}"{name}"'))
                    row_count = result.scalar()
            except Exception:
                pass

            tables.append(TableInfo(
                name=name,
                column_count=len(columns),
                row_count=row_count,
            ))

        engine.dispose()
        return TablesResponse(tables=tables)

    except Exception as e:
        engine.dispose()
        log.exception("Failed to list tables")
        raise HTTPException(status_code=500, detail=str(e))
