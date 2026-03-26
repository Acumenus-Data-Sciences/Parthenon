"""SchemaInspector: enumerate tables and columns via SQLAlchemy reflection."""
from __future__ import annotations

from sqlalchemy import inspect
from sqlalchemy.engine import Engine


TYPE_MAP: dict[str, str] = {
    "INTEGER": "integer",
    "BIGINT": "integer",
    "SMALLINT": "integer",
    "TINYINT": "integer",
    "INT": "integer",
    "FLOAT": "float",
    "DOUBLE": "float",
    "DOUBLE_PRECISION": "float",
    "REAL": "float",
    "NUMERIC": "decimal",
    "DECIMAL": "decimal",
    "BOOLEAN": "boolean",
    "BOOL": "boolean",
    "DATE": "date",
    "DATETIME": "datetime",
    "TIMESTAMP": "timestamp",
    "TIMESTAMP WITHOUT TIME ZONE": "timestamp",
    "TIMESTAMP WITH TIME ZONE": "timestamp",
    "VARCHAR": "string",
    "NVARCHAR": "string",
    "TEXT": "string",
    "CHAR": "string",
    "NCHAR": "string",
    "STRING": "string",
    "CLOB": "string",
    "BLOB": "binary",
    "BYTEA": "binary",
    "VARBINARY": "binary",
    "BINARY": "binary",
}


def normalize_type(raw_type: str) -> str:
    """Map a SQLAlchemy type string to our normalized type set."""
    upper = raw_type.upper().split("(")[0].strip()
    return TYPE_MAP.get(upper, "unknown")


class SchemaInspector:
    def __init__(self, engine: Engine, schema: str) -> None:
        self._engine = engine
        self._schema = schema if schema and schema != "main" else None
        self._inspector = inspect(engine)

    def list_tables(self, include: list[str] | None = None) -> list[str]:
        tables = self._inspector.get_table_names(schema=self._schema)
        if include:
            include_lower = {t.lower() for t in include}
            tables = [t for t in tables if t.lower() in include_lower]
        return sorted(tables)

    def get_columns(self, table_name: str) -> list[dict[str, str]]:
        raw_columns = self._inspector.get_columns(table_name, schema=self._schema)
        if not raw_columns:
            raise ValueError(f"Table {table_name!r} not found or has no columns")
        return [
            {
                "name": col["name"],
                "type": normalize_type(str(col["type"])),
                "raw_type": str(col["type"]),
            }
            for col in raw_columns
        ]
