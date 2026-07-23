#!/usr/bin/env python3
"""Synchronize the PostgreSQL BGE concept index from current OMOP membership."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ai"))

import psycopg2
from psycopg2.extras import execute_values

from app.config import settings
from app.services.bge import get_bge_service

ELIGIBLE_VOCABULARIES = ("SNOMED", "RxNorm", "LOINC", "ATC", "HCPCS")
MODEL_NAME = "BAAI/bge-base-en-v1.5"


def validate_identifier(value: str, label: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"Unsafe {label}: {value!r}")
    return value


def eligibility_predicate(alias: str = "concept") -> str:
    prefix = f"{alias}." if alias else ""
    return (
        f"{prefix}invalid_reason IS NULL AND {prefix}standard_concept = 'S' "
        f"AND {prefix}vocabulary_id = ANY(%s)"
    )


def vector_literal(vector: list[float]) -> str:
    if len(vector) != 768:
        raise ValueError(f"Expected a 768-dimensional BGE vector, got {len(vector)}")
    return "[" + ",".join(format(value, ".9g") for value in vector) + "]"


def sync(connection: Any, *, schema: str, table: str, batch_size: int) -> dict[str, int]:
    schema = validate_identifier(schema, "schema")
    table = validate_identifier(table, "embedding table")
    if batch_size < 1 or batch_size > 2_000:
        raise ValueError("batch_size must be between 1 and 2000")
    qualified_concept = f'"{schema}"."concept"'
    qualified_embedding = f'"{schema}"."{table}"'

    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_lock(hashtext(%s))", [f"parthenon:{schema}:{table}:sync"])
        cursor.execute(
            f"DELETE FROM {qualified_embedding} embedding WHERE embedding.model_name <> %s "
            f"OR NOT EXISTS (SELECT 1 FROM {qualified_concept} concept WHERE concept.concept_id = embedding.concept_id "
            f"AND {eligibility_predicate('concept')})",
            [MODEL_NAME, list(ELIGIBLE_VOCABULARIES)],
        )
        removed = cursor.rowcount
    connection.commit()

    service = get_bge_service()
    inserted = 0
    batches = 0
    after_id = -1
    while True:
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT concept.concept_id, concept.concept_name FROM {qualified_concept} concept "
                f"LEFT JOIN {qualified_embedding} embedding ON embedding.concept_id = concept.concept_id "
                f"WHERE {eligibility_predicate('concept')} AND embedding.concept_id IS NULL "
                "AND concept.concept_id > %s ORDER BY concept.concept_id LIMIT %s",
                [list(ELIGIBLE_VOCABULARIES), after_id, batch_size],
            )
            rows = cursor.fetchall()
        if not rows:
            break
        vectors = service.encode_documents([row[1] for row in rows])
        values = [
            (concept_id, vector_literal(vector), MODEL_NAME)
            for (concept_id, _), vector in zip(rows, vectors, strict=True)
        ]
        with connection.cursor() as cursor:
            execute_values(
                cursor,
                f"INSERT INTO {qualified_embedding} (concept_id, embedding, model_name, embedded_at) VALUES %s "
                "ON CONFLICT (concept_id) DO UPDATE SET embedding = EXCLUDED.embedding, "
                "model_name = EXCLUDED.model_name, embedded_at = EXCLUDED.embedded_at",
                values,
                template="(%s, %s::vector, %s, now())",
                page_size=batch_size,
            )
        connection.commit()
        after_id = rows[-1][0]
        inserted += len(rows)
        batches += 1
        print(f"bge sync: {inserted:,} generated", flush=True)

    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT count(*) FROM {qualified_concept} concept WHERE {eligibility_predicate('concept')}",
            [list(ELIGIBLE_VOCABULARIES)],
        )
        expected = cursor.fetchone()[0]
        cursor.execute(
            f"SELECT count(*) FROM {qualified_embedding} embedding JOIN {qualified_concept} concept USING (concept_id) "
            f"WHERE embedding.model_name = %s AND {eligibility_predicate('concept')}",
            [MODEL_NAME, list(ELIGIBLE_VOCABULARIES)],
        )
        actual = cursor.fetchone()[0]
        cursor.execute(f"ANALYZE {qualified_embedding}")
        cursor.execute("SELECT pg_advisory_unlock(hashtext(%s))", [f"parthenon:{schema}:{table}:sync"])
    connection.commit()
    if actual != expected:
        raise RuntimeError(f"BGE exact-count audit failed: expected {expected}, got {actual}")
    return {"expected": expected, "actual": actual, "inserted": inserted, "removed": removed, "batches": batches}


def write_manifest(path: Path, payload: dict[str, Any]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode()
    path.write_bytes(encoded)
    digest = hashlib.sha256(encoded).hexdigest()
    path.with_suffix(path.suffix + ".sha256").write_text(f"{digest}  {path.name}\n")
    return digest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema", default=settings.ariadne_vocab_schema)
    parser.add_argument("--table", default=settings.ariadne_embedding_table)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    dsn = os.getenv("BGE_DATABASE_URL") or os.getenv("GIS_DATABASE_URL") or settings.database_url
    started = time.monotonic()
    connection = psycopg2.connect(dsn)
    try:
        stats = sync(connection, schema=args.schema, table=args.table, batch_size=args.batch_size)
    finally:
        connection.close()
    payload = {
        "format": "parthenon.bge-vocabulary-sync.v1",
        "created_at": datetime.now(UTC).isoformat(),
        "model": MODEL_NAME,
        "dimension": 768,
        "eligible_vocabularies": list(ELIGIBLE_VOCABULARIES),
        "stats": stats,
        "duration_seconds": round(time.monotonic() - started, 3),
    }
    digest = write_manifest(args.manifest, payload)
    print(json.dumps({"manifest": str(args.manifest), "sha256": digest, **stats}, indent=2))


if __name__ == "__main__":
    main()
